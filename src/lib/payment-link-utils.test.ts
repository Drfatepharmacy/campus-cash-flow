import { describe, it, expect } from "vitest";
import { maskName, maskMatric, priceForClass, normMatric } from "./payment-link-utils";

describe("payment link rules", () => {
  it("public list shows first name and last initial only", () => {
    expect(maskName("Chinedu Okafor")).toBe("Chinedu O.");
  });
  it("public list hides the middle of the matric number", () => {
    expect(maskMatric("ENG2006960")).toBe("ENG200**60");
    expect(maskMatric("ENG2006960")).not.toContain("6960");
  });
  it("price is fixed per class by the treasurer", () => {
    const prices = [{ class: "100", amount_minor: 500000 }, { class: "200", amount_minor: 700000 }];
    expect(priceForClass(prices, "200")).toBe(700000);
    expect(() => priceForClass(prices, "900")).toThrow();
  });
  it("matric numbers match regardless of spaces or case", () => {
    expect(normMatric(" eng 2006960 ")).toBe("ENG2006960");
  });
});
