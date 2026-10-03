// Pure helpers for public payment links — safe on client and server.

export type ClassPrice = { class: string; amount_minor: number };

/** "Chinedu Okafor Emeka" -> "Chinedu O." */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]!;
  const last = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : "";
  return `${first}${last}`;
}

/** "ENG2006960" -> "ENG200****60" (keeps first 6 and last 2). */
export function maskMatric(m: string): string {
  const s = m.trim().toUpperCase();
  if (s.length <= 4) return "****";
  if (s.length <= 8) return `${s.slice(0, 2)}****${s.slice(-2)}`;
  return `${s.slice(0, 6)}${"*".repeat(Math.max(2, s.length - 8))}${s.slice(-2)}`;
}

/** The price is always looked up from the treasurer's list — never taken from the payer. */
export function priceForClass(prices: ClassPrice[], cls: string): number {
  const hit = prices.find((p) => p.class.trim().toLowerCase() === cls.trim().toLowerCase());
  if (!hit || !Number.isInteger(hit.amount_minor) || hit.amount_minor <= 0) {
    throw new Error("Please pick a valid class for this payment");
  }
  return hit.amount_minor;
}

export const normMatric = (m: string) => m.trim().toUpperCase().replace(/[\s/]+/g, "");

export const nairaMinor = (minor: number) =>
  `₦${(minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
