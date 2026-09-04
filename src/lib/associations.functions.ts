import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAssociationContext, requirePermission, maskAccount } from "@/lib/association-access";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Public directory of active associations. */
export const listPublicAssociations = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client
    .from("associations")
    .select("id, slug, name, short_name, type, institution, logo_url, description, session_year")
    .eq("status", "active")
    .order("name");
  return data ?? [];
});

/** Associations the caller belongs to, created, or holds a role in. */
export const myAssociations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships } = await context.supabase
      .from("association_memberships")
      .select("status, association:associations(id, slug, name, short_name, status, status_reason, logo_url, institution)")
      .eq("user_id", context.userId);
    const { data: assignments } = await context.supabase
      .from("association_role_assignments")
      .select("role_key, status, ends_at, association:associations(id, slug, name, short_name, status, status_reason, logo_url, institution)")
      .eq("user_id", context.userId)
      .eq("status", "active");
    const { data: created } = await context.supabase
      .from("associations")
      .select("id, slug, name, short_name, status, status_reason, logo_url, institution")
      .eq("created_by", context.userId);

    const map = new Map<string, any>();
    for (const c of created ?? []) map.set(c.id, { ...c, membership: "owner", roles: [] as string[] });
    for (const m of memberships ?? []) {
      const a = (m as any).association;
      if (!a) continue;
      map.set(a.id, { ...(map.get(a.id) ?? a), membership: (m as any).status, roles: map.get(a.id)?.roles ?? [] });
    }
    for (const r of assignments ?? []) {
      const a = (r as any).association;
      if (!a) continue;
      const prev = map.get(a.id) ?? { ...a, membership: "role", roles: [] };
      prev.roles = [...(prev.roles ?? []), (r as any).role_key];
      map.set(a.id, prev);
    }
    return Array.from(map.values());
  });

export const createAssociation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(3).max(160),
      short_name: z.string().trim().max(30).optional().nullable(),
      type: z.enum(["departmental", "faculty", "institutional", "religious", "social", "professional", "sports", "other"]),
      institution: z.string().trim().min(2).max(160),
      campus_id: z.string().uuid().optional().nullable(),
      faculty_id: z.string().uuid().optional().nullable(),
      department_id: z.string().uuid().optional().nullable(),
      official_email: z.string().trim().email().max(255).optional().nullable(),
      official_phone: z.string().trim().max(20).optional().nullable(),
      description: z.string().trim().max(2000).optional().nullable(),
      session_year: z.string().trim().max(20).optional().nullable(),
      logo_url: z.string().trim().url().max(500).optional().nullable(),
      banner_url: z.string().trim().url().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const base = slugify(data.short_name || data.name) || "association";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: row, error } = await context.supabase
      .from("associations")
      .insert({ ...data, slug, status: "draft", created_by: context.userId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    // The creator becomes a member — never an executive. Roles come from Super Admin approval.
    await context.supabase.from("association_memberships").insert({ association_id: row.id, user_id: context.userId, status: "pending" });

    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "association.created", entity: "association", entity_id: row.id, association_id: row.id, metadata: { name: data.name } });

    const { notifyPlatformAdmins } = await import("@/lib/platform-notify.server");
    await notifyPlatformAdmins(`New association registration: ${data.name}`, [
      `Name: ${data.name}`,
      `Type: ${data.type} · Institution: ${data.institution}`,
      `Official email: ${data.official_email ?? "not provided"}`,
      `Workspace slug: ${row.slug}`,
      "Status: draft — it will appear for review once submitted.",
    ]);
    return row;
  });

export const submitAssociationForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ association_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: assoc } = await context.supabase.from("associations").select("*").eq("id", data.association_id).maybeSingle();
    if (!assoc) throw new Error("Association not found");
    if (assoc.created_by !== context.userId) {
      const ctx = await loadAssociationContext(context.supabase, context.userId, assoc.id);
      requirePermission(ctx, "association.manage");
    }
    if (!["draft", "under_review", "rejected"].includes(assoc.status)) throw new Error(`Cannot submit an association in state "${assoc.status}"`);
    if (!assoc.official_email) throw new Error("An official email is required before submitting");

    const { data: nominations } = await context.supabase
      .from("leadership_nominations").select("id").eq("association_id", assoc.id).eq("role_key", "president").limit(1);
    if (!(nominations ?? []).length) throw new Error("Nominate a proposed President before submitting for review");

    const wasRejected = assoc.status === "rejected";
    const { error } = await context.supabase.from("associations").update({ status: "submitted" }).eq("id", assoc.id);
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({
      actor_id: context.userId,
      action: wasRejected ? "association.resubmitted" : "association.submitted",
      entity: "association", entity_id: assoc.id, association_id: assoc.id,
    });
    const { notifyPlatformAdmins } = await import("@/lib/platform-notify.server");
    await notifyPlatformAdmins(`Association ${wasRejected ? "resubmitted" : "submitted"} for review: ${assoc.name}`, [
      `Name: ${assoc.name}`,
      `Institution: ${assoc.institution}`,
      `Official email: ${assoc.official_email}`,
      `Review it in the Super Admin console: /admin/associations`,
    ]);

    // Confirm to the requester by email and SMS that the application is back in the queue.
    const { resolveRequesterContact, notifyRequester } = await import("@/lib/notify.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const contact = await resolveRequesterContact(supabaseAdmin, assoc);
    await notifyRequester(
      contact,
      wasRejected ? "Association Application Resubmitted" : "Association Application Submitted",
      [
        `Your application for "${assoc.name}" has been ${wasRejected ? "resubmitted" : "submitted"} for review.`,
        "A platform administrator will review it shortly and you will be notified of the decision.",
      ],
      `UniEgo: your application for "${assoc.name}" has been ${wasRejected ? "resubmitted" : "submitted"} for review. We'll notify you of the decision.`,
    );
    return { ok: true };
  });

/** Everything the workspace shell needs: profile, caller permissions, headline counts. */
export const getWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    if (!ctx.isMember && !ctx.isSuperAdmin && ctx.roles.length === 0 && ctx.association.created_by !== context.userId) {
      throw new Error("Permission denied: you are not a member of this association");
    }
    return {
      association: ctx.association,
      permissions: ctx.permissions,
      roles: ctx.roles,
      isSuperAdmin: ctx.isSuperAdmin,
      isOwner: ctx.association.created_by === context.userId,
    };
  });

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "members.view");
    const { data: rows } = await context.supabase
      .from("association_memberships")
      .select("id, user_id, status, joined_at, created_at")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email, matric_no, level").in("id", ids);
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80), membership_id: z.string().uuid(), status: z.enum(["active", "suspended", "removed", "pending"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "members.manage");
    const { error } = await context.supabase
      .from("association_memberships")
      .update({ status: data.status, joined_at: data.status === "active" ? new Date().toISOString() : null })
      .eq("id", data.membership_id)
      .eq("association_id", ctx.association.id);
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "membership.status_changed", entity: "association_membership", entity_id: data.membership_id, association_id: ctx.association.id, metadata: { status: data.status } });
    return { ok: true };
  });

export const requestMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ association_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("association_memberships")
      .insert({ association_id: data.association_id, user_id: context.userId, status: "pending" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const listExecutives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "executives.view");
    const { data: rows } = await context.supabase
      .from("association_role_assignments")
      .select("*, role:association_roles(name, is_head), term:executive_terms(label, session_year)")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false });
    const { data: nominations } = await context.supabase
      .from("leadership_nominations")
      .select("*, role:association_roles(name)")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let map = new Map<string, any>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
      map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    }
    return {
      assignments: (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null })),
      nominations: nominations ?? [],
    };
  });

export const submitNomination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().min(1).max(80),
      role_key: z.string().min(2).max(40),
      nominee_name: z.string().trim().min(2).max(120),
      nominee_email: z.string().trim().email().max(255),
      notes: z.string().trim().max(1000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    const isOwner = ctx.association.created_by === context.userId;
    if (!isOwner) requirePermission(ctx, "executives.nominate");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").ilike("email", data.nominee_email).maybeSingle();

    const { error } = await context.supabase.from("leadership_nominations").insert({
      association_id: ctx.association.id,
      role_key: data.role_key,
      nominee_name: data.nominee_name,
      nominee_email: data.nominee_email.toLowerCase(),
      nominee_user_id: profile?.id ?? null,
      notes: data.notes ?? null,
      status: "submitted",
      submitted_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "executive.nominated", entity: "leadership_nomination", association_id: ctx.association.id, metadata: { role: data.role_key, nominee: data.nominee_email } });
    return { ok: true, nominee_has_account: Boolean(profile) };
  });

/** Financial overview — visibility only. Bank details are masked unless explicitly permitted. */
export const getAssociationFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: txns } = await supabaseAdmin
      .from("transactions")
      .select("id, reference, status, total_minor, charge_minor, base_minor, created_at, paid_at, payment_request:payment_requests(title)")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = txns ?? [];
    const paid = rows.filter((t: any) => t.status === "paid");

    const { data: settlements } = await supabaseAdmin
      .from("settlements").select("id, reference, amount, status, created_at, settled_at")
      .eq("association_id", ctx.association.id).order("created_at", { ascending: false }).limit(50);

    let bank: { bank_name: string; account_name: string; masked: string; verified: boolean } | null = null;
    if (ctx.permissions.includes("bank_details.view")) {
      const { data: acct } = await supabaseAdmin
        .from("association_financial_accounts")
        .select("bank_name, account_name, account_last4, verified")
        .eq("association_id", ctx.association.id).eq("is_primary", true).maybeSingle();
      if (acct) bank = { bank_name: acct.bank_name, account_name: acct.account_name, masked: maskAccount(acct.account_last4), verified: acct.verified };
    }

    return {
      totals: {
        collected_minor: paid.reduce((s: number, t: any) => s + Number(t.total_minor ?? 0), 0),
        charges_minor: paid.reduce((s: number, t: any) => s + Number(t.charge_minor ?? 0), 0),
        net_minor: paid.reduce((s: number, t: any) => s + Number(t.base_minor ?? 0), 0),
        paid_count: paid.length,
        pending_count: rows.filter((t: any) => t.status === "pending").length,
      },
      transactions: ctx.permissions.includes("transactions.view") ? rows.slice(0, 100) : [],
      settlements: ctx.permissions.includes("settlement.view") ? settlements ?? [] : [],
      bank,
      canExport: ctx.permissions.includes("finance.export"),
      canRequestSettlement: ctx.permissions.includes("settlement.request"),
      canApproveSettlement: ctx.permissions.includes("settlement.approve"),
      canRequestBankChange: ctx.permissions.includes("bank_details.change_request"),
    };
  });

/** Maker step — raises a request, never executes it. */
export const raiseApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().min(1).max(80),
      action_type: z.enum(["settlement.payout", "bank_details.change", "settlement.status_update"]),
      payload: z.record(z.string(), z.unknown()).default({}),
      reason: z.string().trim().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "approvals.request");
    if (data.action_type === "settlement.payout") requirePermission(ctx, "settlement.request");
    if (data.action_type === "settlement.status_update") requirePermission(ctx, "settlement.request");
    if (data.action_type === "bank_details.change") requirePermission(ctx, "bank_details.change_request");

    const { error } = await context.supabase.from("approval_requests").insert({
      association_id: ctx.association.id,
      action_type: data.action_type,
      payload: data.payload as never,
      reason: data.reason ?? null,
      requested_by: context.userId,
      requires_super_admin: data.action_type === "bank_details.change",
      status: "pending",
    });
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "approval.requested", entity: "approval_request", association_id: ctx.association.id, metadata: { action_type: data.action_type } });
    return { ok: true };
  });

export const listApprovalRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "approvals.view");
    const { data: rows } = await context.supabase
      .from("approval_requests").select("*").eq("association_id", ctx.association.id).order("created_at", { ascending: false }).limit(100);
    return (rows ?? []).map((r: any) => ({ ...r, can_decide: r.status === "pending" && r.requested_by !== context.userId && ctx.permissions.includes("approvals.approve") }));
  });

/** Checker step — the database also refuses approver == requester. */
export const decideApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80), id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), reason: z.string().trim().max(500).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "approvals.approve");
    const { data: req } = await context.supabase.from("approval_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req || req.association_id !== ctx.association.id) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("This request has already been decided");
    if (req.requested_by === context.userId) throw new Error("Separation of duties: you cannot approve your own request");

    const { error } = await context.supabase
      .from("approval_requests")
      .update({ status: data.decision, approved_by: context.userId, approved_at: new Date().toISOString(), decision_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Checker approval is what executes the operation — never the maker's request.
    let executed = false;
    if (data.decision === "approved" && req.action_type === "settlement.status_update") {
      requirePermission(ctx, "settlement.approve");
      const payload = (req.payload ?? {}) as { settlement_id?: string; status?: string };
      const allowed = ["pending", "assigned", "in_progress", "deposited", "confirmed", "flagged"];
      if (payload.settlement_id && payload.status && allowed.includes(payload.status)) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("settlements")
          .update({
            status: payload.status as never,
            settled_at: payload.status === "confirmed" ? new Date().toISOString() : null,
          })
          .eq("id", payload.settlement_id)
          .eq("association_id", ctx.association.id);
        await supabaseAdmin.from("approval_requests").update({ executed_at: new Date().toISOString(), status: "executed" }).eq("id", data.id);
        executed = true;
      }
    }

    // Officer approval of a bank change stages the account for Super Admin verification.
    if (data.decision === "approved" && req.action_type === "bank_details.change") {
      const p = (req.payload ?? {}) as { bank_name?: string; account_name?: string; account_number?: string };
      if (p.bank_name && p.account_name && /^\d{10}$/.test(String(p.account_number ?? ""))) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("association_financial_accounts").insert({
          association_id: ctx.association.id,
          bank_name: p.bank_name,
          account_name: p.account_name,
          account_number: p.account_number!,
          account_last4: p.account_number!.slice(-4),
          is_primary: false,
          verified: false,
          status: "officer_approved",
          submitted_by: req.requested_by,
          officer_approved_by: context.userId,
          officer_approved_at: new Date().toISOString(),
          created_by: req.requested_by,
        } as never);
        await supabaseAdmin.from("approval_requests").update({ executed_at: new Date().toISOString(), status: "executed" }).eq("id", data.id);
        executed = true;
      }
    }


    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: `approval.${data.decision}`, entity: "approval_request", entity_id: data.id, association_id: ctx.association.id, metadata: { action_type: req.action_type, executed } });
    return { ok: true, executed };
  });

/* ---------------------------------------------------------------- Dues --- */

export const listAssociationDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dues } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false });
    const ids = (dues ?? []).map((d: any) => d.id);
    let stats = new Map<string, { paid: number; pending: number; collected_minor: number }>();
    if (ids.length) {
      const { data: txns } = await supabaseAdmin
        .from("transactions")
        .select("payment_request_id, status, total_minor")
        .in("payment_request_id", ids);
      for (const t of txns ?? []) {
        const s = stats.get(t.payment_request_id) ?? { paid: 0, pending: 0, collected_minor: 0 };
        if (t.status === "paid") { s.paid += 1; s.collected_minor += Number(t.total_minor ?? 0); }
        if (t.status === "pending") s.pending += 1;
        stats.set(t.payment_request_id, s);
      }
    }
    return {
      dues: (dues ?? []).map((d: any) => ({ ...d, stats: stats.get(d.id) ?? { paid: 0, pending: 0, collected_minor: 0 } })),
      canManage: ctx.permissions.includes("dues.manage"),
      hasCampus: Boolean(ctx.association.campus_id),
    };
  });

export const createAssociationDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().min(1).max(80),
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().max(1000).optional().nullable(),
      base_amount: z.number().positive().max(10_000_000),
      target_level: z.number().int().min(100).max(900).optional().nullable(),
      closes_at: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.manage");
    if (!["active", "verified"].includes(String(ctx.association.status))) {
      throw new Error("Dues can only be created once the association is verified and active");
    }
    if (!ctx.association.campus_id) throw new Error("This association has no campus set — a platform administrator must set it first");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_requests").insert({
      association_id: ctx.association.id,
      campus_id: ctx.association.campus_id,
      target_faculty_id: ctx.association.faculty_id ?? null,
      target_department_id: ctx.association.department_id ?? null,
      target_level: data.target_level ?? null,
      title: data.title,
      description: data.description ?? null,
      base_amount: data.base_amount,
      closes_at: data.closes_at || null,
      active: true,
      created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "dues.created", entity: "payment_request", association_id: ctx.association.id, metadata: { title: data.title, base_amount: data.base_amount } });
    return { ok: true };
  });

export const setAssociationDuesActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80), id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_requests").update({ active: data.active })
      .eq("id", data.id).eq("association_id", ctx.association.id);
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: data.active ? "dues.resumed" : "dues.paused", entity: "payment_request", entity_id: data.id, association_id: ctx.association.id });
    return { ok: true };
  });

/* ------------------------------------------------ Finance sub-resources --- */

export const listAssociationTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().min(1).max(80),
      status: z.enum(["all", "pending", "paid", "failed", "refunded"]).default("all"),
      payment_request_id: z.string().uuid().optional().nullable(),
      search: z.string().trim().max(80).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "transactions.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("transactions")
      .select("id, reference, status, total_minor, base_minor, charge_minor, created_at, paid_at, payment_request:payment_requests(title), student:profiles!transactions_student_id_profiles_fkey(full_name, matric_no)")
      .eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status !== "all") q = q.eq("status", data.status as never);
    if (data.payment_request_id) q = q.eq("payment_request_id", data.payment_request_id);
    if (data.search) q = q.ilike("reference", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAssociationSettlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "settlement.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("settlements").select("*").eq("association_id", ctx.association.id)
      .order("created_at", { ascending: false }).limit(100);
    const { data: pending } = await supabaseAdmin
      .from("approval_requests").select("id, payload, status, requested_by, created_at")
      .eq("association_id", ctx.association.id).eq("action_type", "settlement.status_update").eq("status", "pending");
    return {
      settlements: rows ?? [],
      pendingUpdates: pending ?? [],
      canRequest: ctx.permissions.includes("settlement.request"),
      canApprove: ctx.permissions.includes("settlement.approve"),
    };
  });

export const listAssociationReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80), search: z.string().trim().max(80).optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "receipts.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txns } = await supabaseAdmin
      .from("transactions")
      .select("id, reference, total_minor, paid_at, payment_request:payment_requests(title), student:profiles!transactions_student_id_profiles_fkey(full_name, matric_no)")
      .eq("association_id", ctx.association.id).eq("status", "paid")
      .order("paid_at", { ascending: false }).limit(200);
    const ids = (txns ?? []).map((t: any) => t.id);
    let map = new Map<string, any>();
    if (ids.length) {
      const { data: receipts } = await supabaseAdmin.from("receipts").select("id, transaction_id, qr_token, issued_at").in("transaction_id", ids);
      map = new Map((receipts ?? []).map((r: any) => [r.transaction_id, r]));
    }
    const rows = (txns ?? []).map((t: any) => ({ ...t, receipt: map.get(t.id) ?? null }));
    if (!data.search) return rows;
    const s = data.search.toLowerCase();
    return rows.filter((r: any) =>
      r.reference?.toLowerCase().includes(s) ||
      r.student?.matric_no?.toLowerCase().includes(s) ||
      r.student?.full_name?.toLowerCase().includes(s));
  });

export const listAssociationAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "audit.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("audit_logs").select("id, action, entity, entity_id, metadata, created_at, actor_id")
      .eq("association_id", ctx.association.id).order("created_at", { ascending: false }).limit(200);
    return rows ?? [];
  });

export const listAssociationRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("association_roles").select("*").order("sort_order")).data ?? []);
