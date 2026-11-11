import { timingSafeEqual, createHmac } from "node:crypto";

const REFERENCE_RE = /^[A-Za-z0-9-]{8,80}$/;

export class PaystackPayloadError extends Error {}

type ParseOptions = {
  expectedReference?: string;
  now?: Date;
};

export type ParsedPaystackCharge = {
  reference: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  paidAt: string;
  customerEmail: string;
};

function parseIntegerField(value: unknown, field: string): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) throw new PaystackPayloadError(`invalid ${field}`);
    return value;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  throw new PaystackPayloadError(`invalid ${field}`);
}

function parsePaidAt(value: unknown, now: Date): string {
  if (value === null || value === undefined || value === "") return now.toISOString();
  if (typeof value !== "string") throw new PaystackPayloadError("invalid paid_at");
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) throw new PaystackPayloadError("invalid paid_at");
  return t.toISOString();
}

export function parsePaystackChargeData(data: unknown, options: ParseOptions = {}): ParsedPaystackCharge {
  if (!data || typeof data !== "object") throw new PaystackPayloadError("invalid payload");
  const row = data as Record<string, unknown>;

  const reference = typeof row.reference === "string" ? row.reference.trim() : "";
  if (!REFERENCE_RE.test(reference)) throw new PaystackPayloadError("bad reference");
  if (options.expectedReference && reference !== options.expectedReference) {
    throw new PaystackPayloadError("reference mismatch");
  }

  const amountMinor = parseIntegerField(row.amount, "amount");
  const providerId = parseIntegerField(row.id, "id");
  const currencyRaw = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currencyRaw)) throw new PaystackPayloadError("invalid currency");
  const paidAt = parsePaidAt(row.paid_at, options.now ?? new Date());

  const customer = row.customer;
  let customerEmail = "";
  if (customer && typeof customer === "object") {
    const rawEmail = (customer as Record<string, unknown>).email;
    if (rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== "string") {
      throw new PaystackPayloadError("invalid customer email");
    }
    customerEmail = typeof rawEmail === "string" ? rawEmail.trim() : "";
  }

  return {
    reference,
    providerRef: String(providerId),
    amountMinor,
    currency: currencyRaw,
    paidAt,
    customerEmail,
  };
}

export function verifyPaystackSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !/^[a-fA-F0-9]+$/.test(signature) || signature.length % 2 !== 0) return false;
  const expected = createHmac("sha512", secret).update(body).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isUniqueConstraintViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

export function isPaidFinalizeOutcome(outcome: string | null | undefined): boolean {
  return outcome === "captured" || outcome === "already_paid";
}
