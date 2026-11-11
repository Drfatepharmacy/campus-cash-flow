/**
 * Orphaned-payment recovery. Finds local payments still `pending` after the
 * redirect/webhook window, asks Paystack for the truth, and finalizes them via
 * the same idempotent database procedures the webhook uses.
 */
import { reconcileAction, RECONCILE_MIN_AGE_MIN, RECONCILE_MAX_AGE_HOURS } from "@/lib/money-ops";

export type ReconcileSummary = { checked: number; recovered: number; failed: number; waiting: number; errors: number };

export async function reconcilePending(db: any, origin: string, limit = 50): Promise<ReconcileSummary> {
  const { verifyTransaction } = await import("@/lib/paystack.server");
  const now = Date.now();
  const newest = new Date(now - RECONCILE_MIN_AGE_MIN * 60_000).toISOString();
  const oldest = new Date(now - RECONCILE_MAX_AGE_HOURS * 3_600_000).toISOString();
  const s: ReconcileSummary = { checked: 0, recovered: 0, failed: 0, waiting: 0, errors: 0 };

  const { data: txns } = await db.from("transactions").select("reference, created_at")
    .eq("status", "pending").lte("created_at", newest).gte("created_at", oldest).order("created_at").limit(limit);
  const { data: links } = await db.from("payment_link_payments").select("reference, created_at")
    .eq("status", "pending").eq("source", "online").lte("created_at", newest).gte("created_at", oldest).order("created_at").limit(limit);

  const rows = [...(txns ?? []), ...(links ?? [])] as { reference: string; created_at: string }[];
  for (const r of rows) {
    s.checked++;
    try {
      const p = await verifyTransaction(r.reference);
      const age = (now - new Date(r.created_at).getTime()) / 60_000;
      const action = reconcileAction(p?.status, age);
      const isLink = r.reference.startsWith("PL-");
      if (action === "wait") { s.waiting++; continue; }
      if (action === "fail") {
        await db.from(isLink ? "payment_link_payments" : "transactions").update({ status: "failed" }).eq("reference", r.reference).eq("status", "pending");
        s.failed++; continue;
      }
      if (p?.reference && p.reference !== r.reference) { s.errors++; continue; }
      const eventId = `reconcile:${r.reference}`;
      if (isLink) {
        const { data: out, error } = await db.rpc("finalize_link_payment", {
          _reference: r.reference, _provider_ref: String(p?.id ?? ""), _amount_minor: Number(p?.amount ?? -1),
          _currency: String(p?.currency ?? "NGN").toUpperCase(), _paid_at: p?.paid_at ?? new Date().toISOString(), _event_id: eventId,
        });
        if (error) { s.errors++; continue; }
        if (out === "captured") {
          s.recovered++;
          try { const { emailLinkReceipt } = await import("@/lib/link-receipt.server"); await emailLinkReceipt(db, r.reference, origin); } catch { /* non-blocking */ }
        }
      } else {
        const { data: out, error } = await db.rpc("finalize_payment", {
          _reference: r.reference, _provider: "paystack", _provider_ref: String(p?.id ?? ""), _provider_event_id: eventId,
          _amount_minor: Number(p?.amount ?? -1), _currency: String(p?.currency ?? "NGN").toUpperCase(),
          _customer_email: p?.customer?.email ?? "", _paid_at: p?.paid_at ?? new Date().toISOString(), _raw: (p ?? {}) as never,
        });
        if (error) { s.errors++; continue; }
        const outcome = (Array.isArray(out) ? out[0]?.outcome : out?.outcome) as string | undefined;
        if (outcome === "captured") s.recovered++;
      }
    } catch {
      s.errors++;
    }
  }

  await db.from("audit_logs").insert({ actor_id: null, action: "payments.reconciled", entity: "reconciliation", metadata: s as never });
  return s;
}
