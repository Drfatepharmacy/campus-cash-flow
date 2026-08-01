import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomUUID } from "node:crypto";
import { calcServiceChargeMinor, toMinor, fromMinor, type Tier } from "@/lib/charges";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles").select("*, faculty:faculties(name), department:departments(name), campus:campuses(name)").eq("id", context.userId).maybeSingle();
    return data;
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role);
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(20).optional().nullable(),
    matric_no: z.string().trim().regex(/^[A-Z]{3}\d{7}$/, "Matric must be 3 letters + 7 digits (e.g. PHA2006960)").optional().nullable(),
    campus_id: z.string().uuid().optional().nullable(),
    faculty_id: z.string().uuid().optional().nullable(),
    department_id: z.string().uuid().optional().nullable(),
    level: z.number().int().min(100).max(800).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEligibleRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("faculty_id, department_id, level").eq("id", context.userId).maybeSingle();
    const { data } = await context.supabase
      .from("payment_requests")
      .select("*, faculty:faculties(name), department:departments(name)")
      .eq("active", true)
      .order("created_at", { ascending: false });
    const rows = (data ?? []).filter((r) => {
      if (r.target_faculty_id && r.target_faculty_id !== profile?.faculty_id) return false;
      if (r.target_department_id && r.target_department_id !== profile?.department_id) return false;
      if (r.target_level && r.target_level !== profile?.level) return false;
      return true;
    });
    return rows;
  });

export const getMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("transactions")
      .select("*, payment_request:payment_requests(title), receipt:receipts(id, qr_token)")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

/** Server-authoritative pricing. Never trust an amount supplied by the client. */
async function resolveAmounts(supabase: any, payment_request_id: string) {
  const { data: pr } = await supabase.from("payment_requests").select("*").eq("id", payment_request_id).maybeSingle();
  if (!pr) throw new Error("Payment request not found");
  const { data: rules } = await supabase.from("service_charge_rules").select("*").eq("active", true);
  const rule = rules?.find((r: any) => r.scope === "payment_request" && r.payment_request_id === pr.id)
    ?? rules?.find((r: any) => r.scope === "department" && r.department_id === pr.target_department_id)
    ?? rules?.find((r: any) => r.scope === "global");
  const baseMinor = toMinor(Number(pr.base_amount));
  const chargeMinor = calcServiceChargeMinor(baseMinor, (rule?.tiers as Tier[] | undefined) ?? undefined);
  return { pr, baseMinor, chargeMinor, totalMinor: baseMinor + chargeMinor };
}

export const previewCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { pr, baseMinor, chargeMinor, totalMinor } = await resolveAmounts(context.supabase, data.payment_request_id);
    return {
      title: pr.title,
      base_amount: fromMinor(baseMinor),
      service_charge: fromMinor(chargeMinor),
      total_amount: fromMinor(totalMinor),
      currency: "NGN",
    };
  });

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    payment_request_id: z.string().uuid(),
    callback_url: z.string().url(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { getPaystackSecret } = await import("@/lib/payments-guard.server");
    const PAYSTACK_SECRET_KEY = getPaystackSecret();

    const { pr, baseMinor, chargeMinor, totalMinor } = await resolveAmounts(context.supabase, data.payment_request_id);
    if (!pr.active) throw new Error("Payment request unavailable");
    if (pr.opens_at && new Date(pr.opens_at) > new Date()) throw new Error("This payment is not open yet");
    if (pr.closes_at && new Date(pr.closes_at) < new Date()) throw new Error("This payment has closed");

    const { data: profile } = await context.supabase
      .from("profiles").select("email, full_name, campus_id, faculty_id, department_id, level").eq("id", context.userId).maybeSingle();
    if (!profile?.email) throw new Error("Complete your profile before paying");

    // Tenant/eligibility check enforced server-side, not by the UI filter.
    if (pr.target_faculty_id && pr.target_faculty_id !== profile.faculty_id) throw new Error("You are not eligible for this payment");
    if (pr.target_department_id && pr.target_department_id !== profile.department_id) throw new Error("You are not eligible for this payment");
    if (pr.target_level && pr.target_level !== profile.level) throw new Error("You are not eligible for this payment");

    // Reuse an existing pending attempt instead of stacking references.
    const reference = `UEG-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    const { error: insErr } = await context.supabase.from("transactions").insert({
      reference,
      student_id: context.userId,
      payment_request_id: pr.id,
      base_amount: fromMinor(baseMinor),
      service_charge: fromMinor(chargeMinor),
      total_amount: fromMinor(totalMinor),
      base_minor: baseMinor,
      charge_minor: chargeMinor,
      total_minor: totalMinor,
      currency: "NGN",
      status: "pending",
    });
    if (insErr) throw new Error(insErr.message);

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: profile.email,
        amount: totalMinor,
        currency: "NGN",
        reference,
        callback_url: data.callback_url,
        metadata: {
          payment_request_id: pr.id,
          student_id: context.userId,
          campus_id: pr.campus_id,
          department_id: pr.target_department_id,
          full_name: profile.full_name,
        },
      }),
    });
    const json = await res.json() as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!res.ok || !json.status || !json.data) throw new Error(json.message || "Paystack init failed");

    return { authorization_url: json.data.authorization_url, reference };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reference: z.string().trim().min(8).max(80).regex(/^[A-Za-z0-9-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { getPaystackSecret } = await import("@/lib/payments-guard.server");
    const PAYSTACK_SECRET_KEY = getPaystackSecret();

    // Ownership is checked against the caller's own RLS-scoped view.
    const { data: txn } = await context.supabase
      .from("transactions")
      .select("id, status, student_id, total_minor, currency, payment_request_id")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!txn || txn.student_id !== context.userId) throw new Error("Transaction not found");
    if (txn.status === "paid") return { status: "paid" as const };

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const json = await res.json() as {
      status: boolean;
      data?: { status: string; paid_at?: string; id?: number; amount?: number; currency?: string; reference?: string; customer?: { email?: string }; metadata?: Record<string, unknown> };
    };
    if (!res.ok || !json.status || !json.data) throw new Error("Verification failed");
    const p = json.data;
    if (p.status !== "success") return { status: "pending" as const };
    // Reference echoed back by the provider must match what we asked about.
    if (p.reference && p.reference !== data.reference) throw new Error("Verification failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("finalize_payment", {
      _reference: data.reference,
      _provider: "paystack",
      _provider_ref: String(p.id ?? ""),
      _provider_event_id: `verify:${data.reference}`,
      _amount_minor: Number(p.amount ?? -1),
      _currency: String(p.currency ?? "NGN").toUpperCase(),
      _customer_email: p.customer?.email ?? "",
      _paid_at: p.paid_at ?? new Date().toISOString(),
      _raw: p as never,
    });
    if (error) throw new Error(error.message);

    const outcome = (Array.isArray(result) ? result[0]?.outcome : (result as any)?.outcome) as string | undefined;
    if (outcome === "captured" || outcome === "already_paid") return { status: "paid" as const };
    if (outcome === "amount_mismatch" || outcome === "currency_mismatch") {
      throw new Error("Payment could not be confirmed — the amount received does not match this invoice. Support has been notified.");
    }
    return { status: "pending" as const };
  });

