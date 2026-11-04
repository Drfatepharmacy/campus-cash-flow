/**
 * Tamper-evident audit writer. `audit_logs` denies direct writes to app roles.
 * With a signed-in caller's client we use the `record_audit_event` database
 * function (actor bound to the verified session) — no service key needed,
 * so this works on Vercel. Without a caller client we fall back to the
 * service role (Lovable hosting / system jobs only).
 */
export async function recordAudit(
  entry: {
    actor_id?: string | null;
    action: string;
    entity: string;
    entity_id?: string | null;
    association_id?: string | null;
    metadata?: Record<string, unknown>;
  },
  callerClient?: any,
) {
  if (callerClient) {
    const { error } = await callerClient.rpc("record_audit_event", {
      _action: entry.action,
      _entity: entry.entity,
      _entity_id: entry.entity_id ?? null,
      _association_id: entry.association_id ?? null,
      _metadata: (entry.metadata ?? {}) as never,
    });
    if (error) throw new Error("Could not record audit event");
    return;
  }
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
