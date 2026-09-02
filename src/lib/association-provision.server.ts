/**
 * Server-only association provisioning.
 *
 * Turning an approved application into a working association workspace:
 * current tenure, executive assignments from approved nominations, memberships
 * and activation. Every step is idempotent — approving twice never duplicates
 * an association, a term, a membership or an executive assignment.
 */

import { recordAudit } from "@/lib/association-audit.server";

export interface ProvisionResult {
  association_id: string;
  activated: boolean;
  assigned: { role_key: string; user_id: string }[];
  pending_signup: { role_key: string; email: string; name: string }[];
}

export async function provisionApprovedAssociation(
  associationId: string,
  approverId: string,
  termMonths = 12,
): Promise<ProvisionResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: assoc, error: aErr } = await supabaseAdmin
    .from("associations").select("*").eq("id", associationId).maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!assoc) throw new Error("Association not found");
  if (assoc.status === "archived") throw new Error("This association is archived");

  // 1. One current tenure per association.
  let { data: term } = await supabaseAdmin
    .from("executive_terms").select("*").eq("association_id", associationId).eq("is_current", true).maybeSingle();
  if (!term) {
    const year = String(new Date().getFullYear());
    const { data: created, error } = await supabaseAdmin
      .from("executive_terms")
      .insert({ association_id: associationId, label: `Tenure ${year}`, session_year: assoc.session_year ?? year, created_by: approverId })
      .select("*").single();
    if (error) throw new Error(error.message);
    term = created;
  }

  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + termMonths);
  const nowIso = new Date().toISOString();

  // 2. Turn every outstanding nomination into a tenure-bounded assignment.
  const { data: nominations } = await supabaseAdmin
    .from("leadership_nominations").select("*")
    .eq("association_id", associationId)
    .in("status", ["draft", "submitted", "under_review"]);

  const assigned: ProvisionResult["assigned"] = [];
  const pending_signup: ProvisionResult["pending_signup"] = [];

  for (const nom of nominations ?? []) {
    let userId: string | null = nom.nominee_user_id ?? null;
    if (!userId && nom.nominee_email) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("id").ilike("email", nom.nominee_email).maybeSingle();
      userId = prof?.id ?? null;
    }
    if (!userId) {
      // No fake accounts — the nominee must onboard with the nominated email first.
      pending_signup.push({ role_key: nom.role_key, email: nom.nominee_email ?? "", name: nom.nominee_name ?? "" });
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("association_role_assignments").select("id")
      .eq("association_id", associationId).eq("role_key", nom.role_key).eq("user_id", userId).eq("status", "active").maybeSingle();

    if (!existing) {
      // Retire any sitting holder of the same role — history is kept, never deleted.
      const { data: sitting } = await supabaseAdmin
        .from("association_role_assignments").select("id, user_id")
        .eq("association_id", associationId).eq("role_key", nom.role_key).eq("status", "active");
      for (const s of sitting ?? []) {
        await supabaseAdmin.from("association_role_assignments")
          .update({ status: "revoked", revocation_reason: "Replaced at association approval", ends_at: nowIso }).eq("id", s.id);
      }
      const { error } = await supabaseAdmin.from("association_role_assignments").insert({
        association_id: associationId,
        user_id: userId,
        role_key: nom.role_key,
        term_id: term!.id,
        status: "active",
        appointment_source: "nomination",
        approved_by: approverId,
        approved_at: nowIso,
        starts_at: nowIso,
        ends_at: endsAt.toISOString(),
      });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("association_memberships").upsert(
      { association_id: associationId, user_id: userId, status: "active", joined_at: nowIso },
      { onConflict: "association_id,user_id" },
    );

    await supabaseAdmin.from("leadership_nominations")
      .update({ status: "approved", decided_by: approverId, decided_at: nowIso, nominee_user_id: userId, term_id: term!.id })
      .eq("id", nom.id);

    assigned.push({ role_key: nom.role_key, user_id: userId });
  }

  // 3. The requester keeps an active membership (never an automatic executive role).
  if (assoc.created_by) {
    await supabaseAdmin.from("association_memberships").upsert(
      { association_id: associationId, user_id: assoc.created_by, status: "active", joined_at: nowIso },
      { onConflict: "association_id,user_id" },
    );
  }

  // 4. Activate. Financial activation stays a separate, explicit decision.
  const alreadyActive = assoc.status === "active";
  if (!alreadyActive) {
    const { error } = await supabaseAdmin.from("associations")
      .update({ status: "active", status_reason: null, reviewed_by: approverId, reviewed_at: nowIso })
      .eq("id", associationId);
    if (error) throw new Error(error.message);
  }

  await recordAudit({
    actor_id: approverId,
    action: "association.approved",
    entity: "association",
    entity_id: associationId,
    association_id: associationId,
    metadata: {
      previous_status: assoc.status,
      new_status: "active",
      assigned,
      pending_signup: pending_signup.map((p) => `${p.role_key}:${p.email}`),
      idempotent_replay: alreadyActive,
    },
  });

  return { association_id: associationId, activated: !alreadyActive, assigned, pending_signup };
}
