/**
 * Tamper-evident audit writer. Runs with the service role because
 * `audit_logs` denies INSERT/UPDATE/DELETE to every application role.
 */
export async function recordAudit(entry: {
  actor_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  association_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actor_id ?? null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    association_id: entry.association_id ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}
