// Payload encoders for every supported QR type. Pure functions — safe to unit test.

export type QrType =
  | "url" | "text" | "email" | "phone" | "sms" | "wifi"
  | "vcard" | "location" | "event" | "payment" | "custom";

export type QrPayload =
  | { type: "url"; url: string }
  | { type: "text"; text: string }
  | { type: "email"; to: string; subject?: string; body?: string }
  | { type: "phone"; number: string }
  | { type: "sms"; number: string; message?: string }
  | { type: "wifi"; ssid: string; password?: string; encryption?: "WPA" | "WEP" | "nopass"; hidden?: boolean }
  | { type: "vcard"; firstName: string; lastName?: string; org?: string; title?: string; phone?: string; email?: string; url?: string; address?: string }
  | { type: "location"; latitude: number; longitude: number; label?: string }
  | { type: "event"; title: string; start: string; end?: string; location?: string; description?: string }
  | { type: "payment"; url: string; amount?: number; reference?: string }
  | { type: "custom"; value: string };

const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");

const toICSDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
};

export function encodePayload(p: QrPayload): string {
  switch (p.type) {
    case "url": {
      if (!/^https?:\/\//i.test(p.url)) throw new Error("URL must start with http:// or https://");
      return p.url;
    }
    case "text": return p.text;
    case "email": {
      const q = new URLSearchParams();
      if (p.subject) q.set("subject", p.subject);
      if (p.body) q.set("body", p.body);
      const qs = q.toString();
      return `mailto:${p.to}${qs ? "?" + qs : ""}`;
    }
    case "phone": return `tel:${p.number}`;
    case "sms": return `SMSTO:${p.number}:${p.message ?? ""}`;
    case "wifi": {
      const enc = p.encryption ?? "WPA";
      return `WIFI:T:${enc};S:${esc(p.ssid)};${enc !== "nopass" ? `P:${esc(p.password ?? "")};` : ""}${p.hidden ? "H:true;" : ""};`;
    }
    case "vcard": {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${p.lastName ?? ""};${p.firstName};;;`,
        `FN:${[p.firstName, p.lastName].filter(Boolean).join(" ")}`,
        p.org ? `ORG:${p.org}` : "",
        p.title ? `TITLE:${p.title}` : "",
        p.phone ? `TEL:${p.phone}` : "",
        p.email ? `EMAIL:${p.email}` : "",
        p.url ? `URL:${p.url}` : "",
        p.address ? `ADR:;;${p.address};;;;` : "",
        "END:VCARD",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "location": return `geo:${p.latitude},${p.longitude}${p.label ? `?q=${encodeURIComponent(p.label)}` : ""}`;
    case "event": {
      const lines = [
        "BEGIN:VEVENT",
        `SUMMARY:${p.title}`,
        `DTSTART:${toICSDate(p.start)}`,
        p.end ? `DTEND:${toICSDate(p.end)}` : "",
        p.location ? `LOCATION:${p.location}` : "",
        p.description ? `DESCRIPTION:${p.description}` : "",
        "END:VEVENT",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "payment": {
      if (!/^https?:\/\//i.test(p.url)) throw new Error("Payment URL must start with http:// or https://");
      const u = new URL(p.url);
      if (p.amount != null) u.searchParams.set("amount", String(p.amount));
      if (p.reference) u.searchParams.set("ref", p.reference);
      return u.toString();
    }
    case "custom": return p.value;
  }
}

/**
 * Cryptographically secure token (>=128 bits of entropy).
 * Never use Math.random() here: these tokens gate public verification pages.
 */
export function generateToken(prefix = "QR"): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${hex.slice(0, 20)}-${hex.slice(20)}`;
}
