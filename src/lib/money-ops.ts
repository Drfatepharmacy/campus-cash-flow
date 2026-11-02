/** Pure rules shared by reconciliation and refunds (unit-tested). */

export const RECONCILE_MIN_AGE_MIN = 5; // give the redirect/webhook a chance first
export const RECONCILE_MAX_AGE_HOURS = 72;
export const ABANDON_AFTER_HOURS = 24;

export type ReconcileAction = "finalize" | "fail" | "wait";

/** Decide what to do with a local pending payment given Paystack's verify status. */
export function reconcileAction(paystackStatus: string | null | undefined, ageMinutes: number): ReconcileAction {
  if (paystackStatus === "success") return "finalize";
  if (paystackStatus === "failed" || paystackStatus === "reversed") return "fail";
  if (ageMinutes >= ABANDON_AFTER_HOURS * 60) return "fail"; // abandoned / never completed / unknown
  return "wait";
}

export const REFUND_WINDOW_DAYS = 90;

export function refundEligibility(input: { status: string; paid_at: string | null; now?: Date }): { ok: true } | { ok: false; reason: string } {
  if (input.status !== "paid") return { ok: false, reason: "Only successful payments can be refunded" };
  if (!input.paid_at) return { ok: false, reason: "Only successful payments can be refunded" };
  const age = ((input.now ?? new Date()).getTime() - new Date(input.paid_at).getTime()) / 86_400_000;
  if (age > REFUND_WINDOW_DAYS) return { ok: false, reason: `Refunds must be requested within ${REFUND_WINDOW_DAYS} days of payment` };
  return { ok: true };
}

/** Paystack name-enquiry names are uppercase and vary in spacing/order. */
export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  return norm(a) === norm(b);
}
