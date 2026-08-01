/**
 * Service charge tier engine. Tiers are evaluated in order; the first tier
 * whose `max` is null OR >= amount applies. type='flat' is a naira amount;
 * type='percent' is a percentage of amount (rounded to 2 d.p.).
 */
export type Tier = { max: number | null; type: "flat" | "percent"; value: number };

export const DEFAULT_TIERS: Tier[] = [
  { max: 5000, type: "flat", value: 250 },
  { max: 20000, type: "flat", value: 500 },
  { max: null, type: "percent", value: 3 },
];

export function calcServiceCharge(amount: number, tiers: Tier[] = DEFAULT_TIERS): number {
  for (const t of tiers) {
    if (t.max === null || amount <= t.max) {
      if (t.type === "flat") return Math.round(t.value * 100) / 100;
      return Math.round(((amount * t.value) / 100) * 100) / 100;
    }
  }
  return 0;
}

/** Convert a naira value to integer kobo without float drift. */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/**
 * Authoritative charge calculation in integer minor units (kobo).
 * All money that reaches the provider or the database goes through this.
 */
export function calcServiceChargeMinor(baseMinor: number, tiers: Tier[] = DEFAULT_TIERS): number {
  for (const t of tiers) {
    const maxMinor = t.max === null ? null : toMinor(t.max);
    if (maxMinor === null || baseMinor <= maxMinor) {
      if (t.type === "flat") return toMinor(t.value);
      return Math.round((baseMinor * t.value) / 100);
    }
  }
  return 0;
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount);
}
