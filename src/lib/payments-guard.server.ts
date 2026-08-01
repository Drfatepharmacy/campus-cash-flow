import process from "node:process";

/**
 * Real-funds kill switch.
 *
 * Live Paystack keys (`sk_live_…`) are refused unless PAYMENTS_LIVE_ENABLED is
 * explicitly set to "true". Sandbox keys (`sk_test_…`) always work. This keeps
 * the pilot on test money until every gate in the hardening checklist passes.
 */
export function getPaystackSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("Payments are not yet configured. Ask the admin to add a Paystack secret key.");
  }
  const isLive = key.startsWith("sk_live_");
  const liveEnabled = String(process.env.PAYMENTS_LIVE_ENABLED ?? "").toLowerCase() === "true";
  if (isLive && !liveEnabled) {
    throw new Error(
      "Live payments are disabled. UniEgo is running in pilot mode — set PAYMENTS_LIVE_ENABLED=true only after the go-live checklist passes.",
    );
  }
  return key;
}

export function isLiveMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_live_");
}
