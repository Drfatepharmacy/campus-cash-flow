import { describe, it, expect } from "vitest";
import { reconcileAction, refundEligibility, namesMatch } from "./money-ops";

describe("reconcileAction", () => {
  it("finalizes when Paystack reports success", () => expect(reconcileAction("success", 10)).toBe("finalize"));
  it("fails when Paystack reports failed", () => expect(reconcileAction("failed", 10)).toBe("fail"));
  it("waits on abandoned payments younger than 24h", () => expect(reconcileAction("abandoned", 60)).toBe("wait"));
  it("fails abandoned payments older than 24h", () => expect(reconcileAction("abandoned", 24 * 60)).toBe("fail"));
});

describe("refundEligibility", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  it("rejects unpaid payments", () => expect(refundEligibility({ status: "pending", paid_at: null, now }).ok).toBe(false));
  it("allows a payment 89 days old", () =>
    expect(refundEligibility({ status: "paid", paid_at: "2026-08-05T00:00:00Z", now }).ok).toBe(true));
  it("rejects a payment 91 days old", () =>
    expect(refundEligibility({ status: "paid", paid_at: "2026-08-03T00:00:00Z", now }).ok).toBe(false));
});

describe("namesMatch", () => {
  it("ignores case and word order", () => expect(namesMatch("PANS Unilag Chapter", "UNILAG PANS CHAPTER")).toBe(true));
  it("detects different names", () => expect(namesMatch("PANS Unilag", "John Doe")).toBe(false));
});
