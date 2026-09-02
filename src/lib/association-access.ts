/**
 * Association authorization helpers.
 *
 * Client-safe module (no server-only imports) — takes an already-authorized
 * Supabase client. Permissions are ALWAYS derived server-side from active,
 * in-tenure role assignments. A client-supplied association id or role name is
 * never trusted.
 */

export type Permission =
  | "association.view" | "association.manage"
  | "members.view" | "members.manage"
  | "executives.view" | "executives.nominate"
  | "finance.view" | "finance.export"
  | "dues.view" | "dues.manage"
  | "transactions.view" | "receipts.view"
  | "settlement.view" | "settlement.request" | "settlement.approve"
  | "bank_details.view" | "bank_details.change_request"
  | "reports.view" | "reports.export"
  | "approvals.view" | "approvals.request" | "approvals.approve"
  | "audit.view";

export interface AssociationContext {
  association: Record<string, any>;
  permissions: Permission[];
  roles: string[];
  isSuperAdmin: boolean;
  isMember: boolean;
}

export class PermissionDenied extends Error {
  constructor(permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDenied";
  }
}

/** Mask an account number so only the last 4 digits are ever rendered. */
export function maskAccount(last4: string | null | undefined) {
  return last4 ? `•••• •••• ${last4}` : "••••";
}

export async function loadAssociationContext(
  supabase: any,
  userId: string,
  slugOrId: string,
): Promise<AssociationContext> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const { data: association, error } = await supabase
    .from("associations")
    .select("*")
    .eq(isUuid ? "id" : "slug", slugOrId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!association) throw new Error("Association not found");

  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });

  const { data: membership } = await supabase
    .from("association_memberships")
    .select("status")
    .eq("association_id", association.id)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from("association_role_assignments")
    .select("role_key, status, starts_at, ends_at")
    .eq("association_id", association.id)
    .eq("user_id", userId)
    .eq("status", "active");

  const now = Date.now();
  const roles = (assignments ?? [])
    .filter((a: any) => new Date(a.starts_at).getTime() <= now && (!a.ends_at || new Date(a.ends_at).getTime() > now))
    .map((a: any) => a.role_key as string);

  let permissions: Permission[] = [];
  if (roles.length) {
    const { data: rp } = await supabase.from("role_permissions").select("permission_key").in("role_key", roles);
    permissions = Array.from(new Set((rp ?? []).map((r: any) => r.permission_key))) as Permission[];
  }
  if (isSuper) {
    const { data: all } = await supabase.from("permissions").select("key");
    permissions = (all ?? []).map((p: any) => p.key) as Permission[];
  }

  return {
    association,
    permissions,
    roles,
    isSuperAdmin: Boolean(isSuper),
    isMember: membership?.status === "active",
  };
}

export function can(ctx: AssociationContext, permission: Permission) {
  return ctx.permissions.includes(permission);
}

export function requirePermission(ctx: AssociationContext, permission: Permission) {
  if (!can(ctx, permission)) throw new PermissionDenied(permission);
}
