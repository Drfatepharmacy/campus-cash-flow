import { describe, it, expect } from "vitest";
import { encodePayload, generateToken } from "@/lib/qr-encoder";

describe("encodePayload", () => {
  it("encodes URL", () => {
    expect(encodePayload({ type: "url", url: "https://a.co" })).toBe("https://a.co");
  });
  it("rejects bad URL", () => {
    expect(() => encodePayload({ type: "url", url: "a.co" })).toThrow();
  });
  it("encodes email with subject", () => {
    expect(encodePayload({ type: "email", to: "a@b.co", subject: "Hi" })).toBe("mailto:a@b.co?subject=Hi");
  });
  it("encodes phone / sms / geo", () => {
    expect(encodePayload({ type: "phone", number: "+2341" })).toBe("tel:+2341");
    expect(encodePayload({ type: "sms", number: "+1", message: "yo" })).toBe("SMSTO:+1:yo");
    expect(encodePayload({ type: "location", latitude: 6.5, longitude: 3.4 })).toBe("geo:6.5,3.4");
  });
  it("encodes wifi with escaping", () => {
    const s = encodePayload({ type: "wifi", ssid: "My;Net", password: "p:1", encryption: "WPA" });
    expect(s).toContain("S:My\\;Net");
    expect(s).toContain("P:p\\:1");
  });
  it("encodes vcard", () => {
    const s = encodePayload({ type: "vcard", firstName: "Ada", lastName: "L", email: "a@b.co" });
    expect(s).toContain("BEGIN:VCARD");
    expect(s).toContain("FN:Ada L");
    expect(s).toContain("EMAIL:a@b.co");
  });
  it("encodes event with ICS date", () => {
    const s = encodePayload({ type: "event", title: "T", start: "2030-01-02T03:04:00Z" });
    expect(s).toMatch(/DTSTART:20300102T030400Z/);
  });
  it("encodes payment url with params", () => {
    const s = encodePayload({ type: "payment", url: "https://p.co/x", amount: 100, reference: "R1" });
    expect(s).toContain("amount=100");
    expect(s).toContain("ref=R1");
  });
});

describe("generateToken", () => {
  it("has prefix and two segments", () => {
    const t = generateToken("QR");
    expect(t).toMatch(/^QR-[A-Z0-9]{6}-[A-Z0-9]{6}$/);
  });
  it("is reasonably unique", () => {
    const s = new Set(Array.from({ length: 500 }, () => generateToken()));
    expect(s.size).toBe(500);
  });
});
