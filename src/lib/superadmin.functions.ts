import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Platform-level association governance. Every handler re-verifies Super Admin server-side. */

export const listAllAssociations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("associations")
      .select("*, campus:campuses(name), faculty:faculties(name), department:departments(name)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const listAllNominations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("leadership_nominations")
      .select("*, association:associations(name, slug, status), role:association_roles(name, is_head)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const setAssociationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "submitted", "under_review", "verified", "active", "suspended", "archived"]),
      reason: z.string().trim().max(500).optional().nullable(),
      financials_enabled: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("associations").select("status, financials_enabled").eq("id", data.id).maybeSingle();

    const patch: any = {
      status: data.status,
      status_reason: data.reason ?? null,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    };
    // Financial activation is never implied by approval — it is an explicit decision.
    if (typeof data.financials_enabled === "boolean") patch["financials_enabled"] = data.financials_enabled;
    if (data.status === "suspended" || data.status === "archived") patch["financials_enabled"] = false;

    const { error } = await supabaseAdmin.from("associations").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({
      actor_id: context.userId,
      action: `association.${data.status}`,
      entity: "association",
      entity_id: data.id,
      association_id: data.id,
      metadata: { before, after: patch, reason: data.reason ?? null },
    });
    return { ok: true };
  });

/** Approve or reject a nominated executive. Approval activates a tenure-bounded assignment. */
export const decideNomination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().trim().max(500).optional().nullable(),
      term_months: z.number().int().min(1).max(48).default(12),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit } = await import("@/lib/association-audit.server");

    const { data: nom } = await supabaseAdmin.from("leadership_nominations").select("*").eq("id", data.id).maybeSingle();
    if (!nom) throw new Error("Nomination not found");
    if (nom.status !== "submitted" && nom.status !== "under_review") throw new Error("This nomination has already been decided");

    if (data.decision === "rejected") {
      await supabaseAdmin.from("leadership_nominations")
        .update({ status: "rejected", decided_by: context.userId, decided_at: new Date().toISOString(), decision_reason: data.reason ?? null })
        .eq("id", data.id);
      await recordAudit({ actor_id: context.userId, action: "executive.nomination_rejected", entity: "leadership_nomination", entity_id: data.id, association_id: nom.association_id, metadata: { reason: data.reason ?? null } });
      return { ok: true, activated: false };
    }

    let userId = nom.nominee_user_id as string | null;
    if (!userId && nom.nominee_email) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("id").ilike("email", nom.nominee_email).maybeSingle();
      userId = prof?.id ?? null;
    }
    if (!userId) throw new Error("The nominee has no UniEgo account yet — ask them to sign up with the nominated email first.");

    // One current term per association.
    let { data: term } = await supabaseAdmin
      .from("executive_terms").select("*").eq("association_id", nom.association_id).eq("is_current", true).maybeSingle();
    if (!term) {
      const { data: created, error: termErr } = await supabaseAdmin
        .from("executive_terms")
        .insert({ association_id: nom.association_id, label: `Tenure ${new Date().getFullYear()}`, session_year: String(new Date().getFullYear()), created_by: context.userId })
        .select("*").single();
      if (termErr) throw new Error(termErr.message);
      term = created;
    }

    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + data.term_months);

    // Replace any sitting holder of this role — history is retained, not deleted.
    const { data: sitting } = await supabaseAdmin
      .from("association_role_assignments").select("id, user_id")
      .eq("association_id", nom.association_id).eq("role_key", nom.role_key).eq("status", "active");
    for (const s of sitting ?? []) {
      await supabaseAdmin.from("association_role_assignments")
        .update({ status: "revoked", revocation_reason: "Replaced by approved nomination", ends_at: new Date().toISOString() })
        .eq("id", s.id);
      await recordAudit({ actor_id: context.userId, action: "executive.revoked", entity: "association_role_assignment", entity_id: s.id, association_id: nom.association_id, metadata: { role: nom.role_key, replaced_user: s.user_id } });
    }

    const { error: aErr } = await supabaseAdmin.from("association_role_assignments").insert({
      association_id: nom.association_id,
      user_id: userId,
      role_key: nom.role_key,
      term_id: term!.id,
      status: "active",
      appointment_source: "nomination",
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
    });
    if (aErr) throw new Error(aErr.message);

    await supabaseAdmin.from("association_memberships")
      .upsert({ association_id: nom.association_id, user_id: userId, status: "active", joined_at: new Date().toISOString() }, { onConflict: "association_id,user_id" });

    await supabaseAdmin.from("leadership_nominations")
      .update({ status: "approved", decided_by: context.userId, decided_at: new Date().toISOString(), decision_reason: data.reason ?? null, nominee_user_id: userId, term_id: term!.id })
      .eq("id", data.id);

    await recordAudit({
      actor_id: context.userId,
      action: "executive.approved",
      entity: "association_role_assignment",
      association_id: nom.association_id,
      metadata: { role: nom.role_key, user_id: userId, ends_at: endsAt.toISOString(), nomination_id: data.id },
    });
    return { ok: true, activated: true };
  });

export const listAssignmentsForAssociation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ association_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("association_role_assignments")
      .select("*, role:association_roles(name, is_head)")
      .eq("association_id", data.association_id)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let map = new Map<string, any>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
      map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const changeAssignmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended", "revoked", "expired"]), reason: z.string().trim().max(500).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("association_role_assignments").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Assignment not found");

    const patch: any = { status: data.status, revocation_reason: data.reason ?? null };
    if (data.status === "revoked" || data.status === "expired") patch["ends_at"] = new Date().toISOString();
    const { error } = await supabaseAdmin.from("association_role_assignments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({
      actor_id: context.userId, action: `executive.${data.status}`, entity: "association_role_assignment",
      entity_id: data.id, association_id: row.association_id,
      metadata: { before: row.status, after: data.status, role: row.role_key, reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const expireLapsedTenures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("expire_role_assignments");
    if (error) throw new Error(error.message);
    return { expired: Number(data ?? 0) };
  });

export const setAssociationBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      association_id: z.string().uuid(),
      bank_name: z.string().trim().min(2).max(120),
      account_name: z.string().trim().min(2).max(160),
      account_number: z.string().trim().regex(/^\d{10}$/, "Account number must be 10 digits"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden: platform administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("association_financial_accounts").update({ is_primary: false }).eq("association_id", data.association_id);
    const { error } = await supabaseAdmin.from("association_financial_accounts").insert({
      association_id: data.association_id,
      bank_name: data.bank_name,
      account_name: data.account_name,
      account_number: data.account_number,
      account_last4: data.account_number.slice(-4),
      is_primary: true,
      verified: true,
      verified_by: context.userId,
      verified_at: new Date().toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({
      actor_id: context.userId, action: "bank_details.changed", entity: "association_financial_account",
      association_id: data.association_id, metadata: { bank_name: data.bank_name, last4: data.account_number.slice(-4) },
    });
    return { ok: true };
  });
