/**
 * Association settlement bank account — three-stage control.
 *
 *   Officer submits  ->  second officer approves  ->  Super Admin verifies
 *
 * Only a `verified` primary account can ever receive a settlement. The full
 * account number never leaves the server: clients only ever see the last four
 * digits. Every stage writes an audit event.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAssociationContext, requirePermission, maskAccount } from "./association-access";

const slugInput = z.object({ slug: z.string().min(1).max(80) });

export const getAssociationBankAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "bank_details.view");

    const { data: rows, error: accountsError } = await context.supabase
      .from("association_financial_accounts")
      .select(
        "id, bank_name, account_name, account_last4, status, verified, is_primary, rejection_reason, submitted_by, officer_approved_by, officer_approved_at, verified_at, created_at",
      )
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false });
    if (accountsError) throw new Error("Could not load association bank details");

    const accounts = (rows ?? []).map((a: any) => ({
      id: a.id,
      bank_name: a.bank_name,
      account_name: a.account_name,
      masked: maskAccount(a.account_last4),
      status: a.status as string,
      is_primary: a.is_primary,
      rejection_reason: a.rejection_reason,
      officer_approved_at: a.officer_approved_at,
      verified_at: a.verified_at,
      created_at: a.created_at,
      submitted_by_me: a.submitted_by === context.userId,
    }));

    const { data: pending, error: requestsError } = await context.supabase
      .from("approval_requests")
      .select("id, payload, status, reason, requested_by, created_at")
      .eq("association_id", ctx.association.id)
      .eq("action_type", "bank_details.change")
      .in("status", ["pending"])
      .order("created_at", { ascending: false });
    if (requestsError) throw new Error("Could not load bank change requests");

    const requests = (pending ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      reason: r.reason,
      bank_name: r.payload?.bank_name ?? "",
      account_name: r.payload?.account_name ?? "",
      masked: maskAccount(r.payload?.account_last4),
      // Separation of duties: the maker can never be the checker.
      can_decide: ctx.permissions.includes("approvals.approve") && r.requested_by !== context.userId,
      mine: r.requested_by === context.userId,
    }));

    return {
      accounts,
      requests,
      canSubmit: ctx.permissions.includes("bank_details.change_request"),
      canApprove: ctx.permissions.includes("approvals.approve"),
      hasVerifiedAccount: accounts.some((a) => a.status === "verified" && a.is_primary),
    };
  });

export const submitBankChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        bank_code: z.string().trim().regex(/^[0-9A-Za-z]{2,10}$/, "Choose your bank from the list"),
        account_number: z.string().trim().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "bank_details.change_request");
    if (["suspended", "archived", "rejected"].includes(String(ctx.association.status))) {
      throw new Error("Bank details cannot be changed while the association is suspended or archived");
    }

    // NIBSS name enquiry: the account name is never typed — it comes from the bank.
    const { listBanks, resolveAccount } = await import("@/lib/paystack.server");
    const bank = (await listBanks()).find((b) => b.code === data.bank_code);
    if (!bank) throw new Error("Choose your bank from the list");
    const resolvedName = await resolveAccount(data.account_number, data.bank_code);
    const bankName = bank.name;

    const { data: dupe, error: duplicateCheckError } = await context.supabase
      .from("approval_requests")
      .select("id")
      .eq("association_id", ctx.association.id)
      .eq("action_type", "bank_details.change")
      .eq("status", "pending")
      .maybeSingle();
    if (duplicateCheckError) throw new Error("Could not check for an existing bank change request");
    if (dupe) throw new Error("A bank change request is already awaiting approval");

    const { error } = await context.supabase.from("approval_requests").insert({
      association_id: ctx.association.id,
      action_type: "bank_details.change",
      payload: {
        bank_name: bankName,
        bank_code: data.bank_code,
        account_name: resolvedName,
        nuban_verified_at: new Date().toISOString(),
        account_number: data.account_number,
        account_last4: data.account_number.slice(-4),
      } as never,
      reason: data.reason ?? null,
      requested_by: context.userId,
      requires_super_admin: true,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({
      actor_id: context.userId,
      action: "bank_details.change_requested",
      entity: "approval_request",
      association_id: ctx.association.id,
      metadata: { bank_name: bankName, nuban_verified: true, last4: data.account_number.slice(-4) },
    }, context.supabase);
    return { ok: true };
  });

/** Nigerian bank list from Paystack, for the bank picker. */
export const listSettlementBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listBanks } = await import("@/lib/paystack.server");
    return listBanks();
  });

/** Live NUBAN name enquiry so officers can confirm before submitting. */
export const resolveSettlementAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80), bank_code: z.string().regex(/^[0-9A-Za-z]{2,10}$/), account_number: z.string().regex(/^\d{10}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "bank_details.change_request");
    const { resolveAccount } = await import("@/lib/paystack.server");
    return { account_name: await resolveAccount(data.account_number, data.bank_code) };
  });
