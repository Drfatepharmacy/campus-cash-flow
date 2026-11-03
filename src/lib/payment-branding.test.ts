import { describe, expect, it } from "vitest";
import { assertBrandingPath } from "./payment-branding";
const association = "11111111-1111-4111-8111-111111111111";
const image = "22222222-2222-4222-8222-222222222222";
describe("association payment image isolation", () => {
  it("accepts the association's uploaded banner", () => { expect(() => assertBrandingPath(`${association}/banner/${image}.webp`, association, "banner")).not.toThrow(); });
  it("rejects another association's banner", () => { expect(() => assertBrandingPath(`${image}/banner/${image}.webp`, association, "banner")).toThrow(); });
  it("rejects external URLs and logo paths used as banners", () => { expect(() => assertBrandingPath("https://example.org/image.webp", association, "banner")).toThrow(); expect(() => assertBrandingPath(`${association}/logo/${image}.webp`, association, "banner")).toThrow(); });
});