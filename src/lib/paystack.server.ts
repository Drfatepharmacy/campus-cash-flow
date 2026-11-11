/**
 * Thin Paystack REST client (server-only). Every call goes through the
 * real-funds kill switch in payments-guard so live keys stay gated.
 */
import { getPaystackSecret } from "@/lib/payments-guard.server";

const BASE = "https://api.paystack.co";

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; message: string; data?: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${getPaystackSecret()}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  let j: any = null;
  try { j = await res.json(); } catch { /* non-JSON */ }
  return { ok: res.ok && Boolean(j?.status), message: String(j?.message ?? res.statusText), data: j?.data as T };
}

export type PaystackBank = { name: string; code: string };

export async function listBanks(): Promise<PaystackBank[]> {
  const r = await call<any[]>("/bank?country=nigeria&currency=NGN&perPage=100&use_cursor=false");
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Bank list is unavailable right now. Please try again shortly.");
  const seen = new Set<string>();
  return r.data
    .filter((b) => b?.active !== false && b?.code && !seen.has(b.code) && seen.add(b.code))
    .map((b) => ({ name: String(b.name), code: String(b.code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** NIBSS name enquiry via Paystack. Returns the registered account name. */
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<string> {
  const r = await call<{ account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  if (!r.ok || !r.data?.account_name) throw new Error("We couldn't confirm this account with the bank. Check the number and bank.");
  return r.data.account_name.trim();
}

export async function createSubaccount(input: { business_name: string; bank_code: string; account_number: string; email?: string | null }) {
  const r = await call<{ subaccount_code: string }>("/subaccount", {
    method: "POST",
    body: {
      business_name: input.business_name.slice(0, 100),
      settlement_bank: input.bank_code,
      account_number: input.account_number,
      percentage_charge: 0, // platform takes only the explicit service charge per transaction
      primary_contact_email: input.email ?? undefined,
    },
  });
  if (!r.ok || !r.data?.subaccount_code) throw new Error(r.message || "Split account could not be created");
  return r.data.subaccount_code;
}

export type PaystackVerify = { status: string; id?: number; amount?: number; currency?: string; paid_at?: string; reference?: string; customer?: { email?: string } };

export async function verifyTransaction(reference: string) {
  const r = await call<PaystackVerify>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return r.data ?? null;
}

export async function createRefund(reference: string, amountMinor: number, note: string) {
  const r = await call<{ id: number; status: string }>("/refund", {
    method: "POST",
    body: { transaction: reference, amount: amountMinor, merchant_note: note.slice(0, 200), customer_note: "UniEgo refund" },
  });
  if (!r.ok || !r.data) throw new Error(r.message || "Refund could not be started");
  return { id: String(r.data.id), status: String(r.data.status) };
}

/** Verified primary account split code for an association, if any. */
export async function subaccountFor(db: any, associationId: string | null | undefined): Promise<string | null> {
  if (!associationId) return null;
  const { data } = await db
    .from("association_financial_accounts")
    .select("paystack_subaccount_code")
    .eq("association_id", associationId)
    .eq("is_primary", true)
    .eq("status", "verified")
    .maybeSingle();
  return (data?.paystack_subaccount_code as string | null) ?? null;
}
