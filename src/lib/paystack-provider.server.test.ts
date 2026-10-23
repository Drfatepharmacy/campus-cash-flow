import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  isPaidFinalizeOutcome,
  parsePaystackChargeData,
  verifyPaystackSignature,
} from "@/lib/paystack-provider.server";

describe("paystack provider helpers", () => {
  it("accepts a valid webhook signature", () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 1 } });
    const secret = "sk_test_unit_secret";
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyPaystackSignature(body, signature, secret)).toBe(true);
  });

  it("rejects an invalid webhook signature", () => {
    const body = JSON.stringify({ ok: true });
    expect(verifyPaystackSignature(body, "deadbeef", "sk_test_unit_secret")).toBe(false);
  });

  it("rejects malformed amount values", () => {
    expect(() =>
      parsePaystackChargeData({
        reference: "UEG-TEST-12345678",
        amount: "invalid",
        currency: "NGN",
        id: 1001,
      }),
    ).toThrow("invalid amount");
  });

  it("treats captured and already_paid as paid outcomes", () => {
    expect(isPaidFinalizeOutcome("captured")).toBe(true);
    expect(isPaidFinalizeOutcome("already_paid")).toBe(true);
    expect(isPaidFinalizeOutcome("amount_mismatch")).toBe(false);
  });
});
