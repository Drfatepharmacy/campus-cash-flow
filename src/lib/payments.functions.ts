import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcServiceCharge, type Tier } from "@/lib/charges";

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

export const previewCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: pr } = await context.supabase.from("payment_requests").select("*").eq("id", data.payment_request_id).maybeSingle();
    if (!pr) throw new Error("Payment request not found");
    const { data: rules } = await context.supabase.from("service_charge_rules").select("*").eq("active", true);
    const rule = rules?.find((r) => r.scope === "payment_request" && r.payment_request_id === pr.id)
      ?? rules?.find((r) => r.scope === "department" && r.department_id === pr.target_department_id)
      ?? rules?.find((r) => r.scope === "global");
    const charge = calcServiceCharge(Number(pr.base_amount), (rule?.tiers as Tier[] | undefined) ?? undefined);
    return {
      title: pr.title,
      base_amount: Number(pr.base_amount),
      service_charge: charge,
      total_amount: Number(pr.base_amount) + charge,
    };
  });

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    payment_request_id: z.string().uuid(),
    callback_url: z.string().url(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Payments are not yet configured. Ask the admin to add a Paystack secret key.");
    }
    const { data: pr } = await context.supabase.from("payment_requests").select("*").eq("id", data.payment_request_id).maybeSingle();
    if (!pr || !pr.active) throw new Error("Payment request unavailable");
    const { data: profile } = await context.supabase.from("profiles").select("email, full_name").eq("id", context.userId).maybeSingle();
    if (!profile?.email) throw new Error("Complete your profile before paying");

    const { data: rules } = await context.supabase.from("service_charge_rules").select("*").eq("active", true);
    const rule = rules?.find((r) => r.scope === "payment_request" && r.payment_request_id === pr.id)
      ?? rules?.find((r) => r.scope === "department" && r.department_id === pr.target_department_id)
      ?? rules?.find((r) => r.scope === "global");
    const base = Number(pr.base_amount);
    const charge = calcServiceCharge(base, (rule?.tiers as Tier[] | undefined) ?? undefined);
    const total = base + charge;
    const reference = `UPN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const { error: insErr } = await context.supabase.from("transactions").insert({
      reference,
      student_id: context.userId,
      payment_request_id: pr.id,
      base_amount: base,
      service_charge: charge,
      total_amount: total,
      status: "pending",
    });
    if (insErr) throw new Error(insErr.message);

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: profile.email,
        amount: Math.round(total * 100),
        reference,
        callback_url: data.callback_url,
        metadata: { payment_request_id: pr.id, student_id: context.userId, full_name: profile.full_name },
      }),
    });
    const json = await res.json() as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!res.ok || !json.status || !json.data) throw new Error(json.message || "Paystack init failed");

    return { authorization_url: json.data.authorization_url, reference };
  });
