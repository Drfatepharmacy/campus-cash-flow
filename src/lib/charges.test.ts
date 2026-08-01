import { describe, expect, it } from "vitest";
import { calcServiceChargeMinor, fromMinor, toMinor, DEFAULT_TIERS } from "./charges";

describe("minor-unit money helpers", () => {
  it("converts naira to kobo without float drift", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(5250.55)).toBe(525055);
    expect(toMinor(19.99)).toBe(1999);
  });

  it("round-trips", () => {
    expect(fromMinor(toMinor(1234.56))).toBe(1234.56);
  });
});

describe("calcServiceChargeMinor", () => {
  it("applies the flat low tier", () => {
    expect(calcServiceChargeMinor(toMinor(1000))).toBe(toMinor(250));
    expect(calcServiceChargeMinor(toMinor(5000))).toBe(toMinor(250));
  });

  it("applies the flat mid tier at the boundary", () => {
    expect(calcServiceChargeMinor(toMinor(5000.01))).toBe(toMinor(500));
    expect(calcServiceChargeMinor(toMinor(20000))).toBe(toMinor(500));
  });

  it("applies the percentage tier above the boundary", () => {
    expect(calcServiceChargeMinor(toMinor(20000.01))).toBe(60000);
    expect(calcServiceChargeMinor(toMinor(100000))).toBe(toMinor(3000));
  });

  it("always returns an integer number of kobo", () => {
    for (const naira of [33.33, 7777.77, 20000.01, 123456.78]) {
      const c = calcServiceChargeMinor(toMinor(naira));
      expect(Number.isInteger(c)).toBe(true);
    }
  });

  it("never returns a negative or NaN charge", () => {
    expect(calcServiceChargeMinor(0)).toBe(toMinor(250));
    expect(calcServiceChargeMinor(toMinor(1), DEFAULT_TIERS)).toBeGreaterThanOrEqual(0);
  });
});
