import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Super Admin console reads + platform-role management. Every handler re-verifies Super Admin server-side. */

async function assertSuper(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden: platform administrators only");
}

export const getSuperCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const head = (q: any) => q.then((r: any) => r.count ?? 0);
    const [applications, leadership, bank] = await Promise.all([
      head(supabaseAdmin.from("associations").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
      head(supabaseAdmin.from("leadership_nominations").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
      head(supabaseAdmin.from("association_financial_accounts").select("id", { count: "exact", head: true }).eq("status", "officer_approved")),
    ]);
    return { applications, leadership, bank, total: applications + leadership + bank };
  });

export const getAssociationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: association } = await supabaseAdmin
      .from("associations")
      .select("*, campus:campuses(name), faculty:faculties(name), department:departments(name)")
      .eq("id", data.id).maybeSingle();
    if (!association) throw new Error("Association not found");
    const [noms, accts, assigns, audit, members] = await Promise.all([
      supabaseAdmin.from("leadership_nominations").select("id, nominee_name, nominee_email, role_key, status, decision_reason, created_at").eq("association_id", data.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("association_financial_accounts").select("id, bank_name, account_name, account_last4, status, is_primary, rejection_reason, created_at").eq("association_id", data.id),
      supabaseAdmin.from("association_role_assignments").select("id, user_id, role_key, status, starts_at, ends_at").eq("association_id", data.id),
      supabaseAdmin.from("audit_logs").select("id, action, actor_id, metadata, created_at").eq("association_id", data.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("association_memberships").select("id", { count: "exact", head: true }).eq("association_id", data.id).eq("status", "active"),
    ]);
    const ids = Array.from(new Set([association.created_by, ...(assigns.data ?? []).map((a) => a.user_id), ...(audit.data ?? []).map((a) => a.actor_id)].filter(Boolean))) as string[];
    const { data: profs } = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as any[] };
    const people = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    return {
      association,
      creator: association.created_by ? people[association.created_by] ?? null : null,
      nominations: noms.data ?? [],
      accounts: accts.data ?? [],
      assignments: (assigns.data ?? []).map((a) => ({ ...a, person: people[a.user_id] ?? null })),
      audit: (audit.data ?? []).map((a) => ({ ...a, actor: a.actor_id ? people[a.actor_id] ?? null : null })),
      memberCount: members.count ?? 0,
    };
  });

export const listPlatformActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, entity, entity_id, actor_id, association_id, created_at, association:associations(name, slug)")
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = Array.from(new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
    const { data: profs } = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as any[] };
    const people = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    return (data ?? []).map((r) => ({ ...r, actor: r.actor_id ? people[r.actor_id] ?? null : null }));
  });

export const searchPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("profiles").select("id, full_name, email, matric_no, created_at").order("created_at", { ascending: false }).limit(50);
    const s = data.q.replace(/[%,()]/g, "");
    if (s) query = query.or(`email.ilike.%${s}%,full_name.ilike.%${s}%,matric_no.ilike.%${s}%`);
    const { data: profs } = await query;
    const ids = (profs ?? []).map((p) => p.id);
    if (!ids.length) return [];
    const [{ data: roles }, { data: assigns }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("association_role_assignments").select("user_id, role_key, status, association:associations(name, slug)").in("user_id", ids).eq("status", "active"),
    ]);
    return (profs ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      associationRoles: (assigns ?? []).filter((a) => a.user_id === p.id).map((a: any) => ({ role: a.role_key, association: a.association?.name, slug: a.association?.slug })),
    }));
  });

export const setPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error("Could not grant the role");
    } else {
      const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("You can't remove the last Admin");
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
      if (error) throw new Error("Could not remove the role");
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.grant ? "platform.admin_granted" : "platform.admin_revoked",
      entity: "user", entity_id: data.user_id, metadata: {},
    });
    return { ok: true };
  });
