/** Atomic session-authorized association approval. No service key on any host. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ProvisionResult {
  association_id: string;
  activated: boolean;
  assigned: { role_key: string; user_id: string }[];
  pending_signup: { role_key: string; email: string; name: string }[];
}

export async function provisionApprovedAssociation(
  associationId: string,
  caller: SupabaseClient<Database>,
  termMonths = 12,
): Promise<ProvisionResult> {
  const { data, error } = await caller.rpc("approve_association_application", {
    _association_id: associationId,
    _term_months: termMonths,
  });
  if (error) throw new Error("Could not approve this application. Confirm it was submitted with a proposed President and try again.");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Approval result unavailable");
  return data as unknown as ProvisionResult;
}
