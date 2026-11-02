import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refundEligibility } from "@/lib/money-ops";

async function requirePlatformAdmin(supabase: any, userId: string) {
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!a && !s) throw new Error("Forbidden: platform administrators only");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function originOf() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return new URL(getRequest().url).origin;
}

/* ---------------- Background reconciliation ---------------- */

export const runReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { reconcilePending } = await import("@/lib/reconcile.server");
    return reconcilePending(await admin(), await originOf());
  });

export const lastReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { data } = await (await admin()).from("audit_logs").select("created_at, metadata")
      .eq("action", "payments.reconciled").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
  });

/* ---------------- Refund requests ---------------- */

const reasonType = z.enum(["duplicate", "overcharged", "service_not_rendered", "wrong_payment", "other"]);

/** Signed-in student, for an in-app payment they own. */
export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reference: z.string().regex(/^[A-Za-z0-9-]{8,80}$/), reason_type: reasonType, reason: z.string().trim().min(10).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase.from("transactions")
      .select("id, student_id, status, paid_at, total_minor, payment_request_id, association_id, reference")
      .eq("reference", data.reference).maybeSingle();
    if (!t || t.student_id !== context.userId) throw new Error("Payment not found");
    const el = refundEligibility({ status: t.status, paid_at: t.paid_at });
    if (!el.ok) throw new Error(el.reason);
    const db = await admin();
    const { count } = await db.from("transactions").select("id", { count: "exact", head: true })
      .eq("student_id", context.userId).eq("payment_request_id", t.payment_request_id).eq("status", "paid");
    const { error } = await db.from("refund_requests").insert({
      kind: "transaction", transaction_id: t.id, association_id: t.association_id, reference: t.reference,
      amount_minor: Number(t.total_minor), reason_type: data.reason_type, reason: data.reason,
      requester_id: context.userId, duplicate_suspected: (count ?? 0) > 1,
    });
    if (error) throw new Error(error.code === "23505" ? "A refund request for this payment is already open" : "Couldn't submit your request");
    await db.from("audit_logs").insert({ actor_id: context.userId, action: "refund.requested", entity: "transaction", entity_id: t.id, association_id: t.association_id, metadata: { reference: t.reference, reason_type: data.reason_type } });
    return { ok: true };
  });

/** Public payer (no sign-in). The PL- reference is unguessable; matric must match too. */
export const requestLinkRefund = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    reference: z.string().regex(/^PL-[A-Z0-9-]{8,60}$/), matric_no: z.string().trim().min(4).max(30),
    contact: z.string().trim().min(5).max(200), reason_type: reasonType, reason: z.string().trim().min(10).max(1000),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("payment_link_payments")
      .select("id, link_id, association_id, matric_no, status, paid_at, amount_minor, source, reference").eq("reference", data.reference).maybeSingle();
    const { normMatric } = await import("@/lib/payment-link-utils");
    if (!p || p.matric_no !== normMatric(data.matric_no)) throw new Error("Payment not found");
    if (p.source !== "online") throw new Error("Offline payments are refunded directly by the association treasurer");
    const el = refundEligibility({ status: p.status, paid_at: p.paid_at });
    if (!el.ok) throw new Error(el.reason);
    const { count } = await db.from("payment_link_payments").select("id", { count: "exact", head: true })
      .eq("link_id", p.link_id).eq("matric_no", p.matric_no).eq("status", "paid");
    const { error } = await db.from("refund_requests").insert({
      kind: "link_payment", link_payment_id: p.id, association_id: p.association_id, reference: p.reference,
      amount_minor: Number(p.amount_minor), reason_type: data.reason_type, reason: data.reason,
      requester_contact: data.contact, duplicate_suspected: (count ?? 0) > 1,
    });
    if (error) throw new Error(error.code === "23505" ? "A refund request for this payment is already open" : "Couldn't submit your request");
    await db.from("audit_logs").insert({ actor_id: null, action: "refund.requested", entity: "payment_link_payment", entity_id: p.id, association_id: p.association_id, metadata: { reference: p.reference, reason_type: data.reason_type } });
    return { ok: true };
  });

export const myRefundRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("refund_requests")
      .select("id, reference, status, amount_minor, reason_type, decision_reason, created_at").order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });

export const listRefundRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.string().max(20).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    let q = (await admin()).from("refund_requests")
      .select("*, association:associations(name, short_name)").order("created_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    return (rows ?? []).map((r: any) => ({ ...r, can_decide: r.status === "pending" && r.requester_id !== context.userId }));
  });

export const decideRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), reason: z.string().trim().max(500).optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    if (data.decision === "rejected" && !data.reason) throw new Error("A reason is required when rejecting a refund");
    const db = await admin();
    const { data: r } = await db.from("refund_requests").select("*").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Refund request not found");
    if (r.status !== "pending") throw new Error("This request has already been decided");
    if (r.requester_id === context.userId) throw new Error("Separation of duties: you cannot decide your own refund");

    // Atomic claim so two admins can't both execute.
    const { data: claimed } = await db.from("refund_requests")
      .update({ status: data.decision === "approved" ? "processing" : "rejected", decided_by: context.userId, decided_at: new Date().toISOString(), decision_reason: data.reason ?? null })
      .eq("id", r.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) throw new Error("This request has already been decided");

    let outcome = data.decision as string;
    if (data.decision === "approved") {
      try {
        const { createRefund } = await import("@/lib/paystack.server");
        const ref = await createRefund(r.reference, Number(r.amount_minor), `Refund ${r.id}`);
        await db.from("refund_requests").update({ paystack_refund_id: ref.id }).eq("id", r.id);
        outcome = "processing";
      } catch (e) {
        await db.from("refund_requests").update({ status: "failed", failure_reason: (e as Error).message.slice(0, 300) }).eq("id", r.id);
        outcome = "failed";
      }
    }
    await db.from("audit_logs").insert({ actor_id: context.userId, action: `refund.${outcome}`, entity: "refund_request", entity_id: r.id, association_id: r.association_id, metadata: { reference: r.reference, amount_minor: r.amount_minor, reason: data.reason ?? null } });
    if (outcome === "failed") throw new Error("Approved, but the payment provider refused the refund. See the request for details.");
    return { ok: true, outcome };
  });
