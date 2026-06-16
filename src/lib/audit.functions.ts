import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");
    const { data: logs } = await context.supabase
      .from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    const rows = logs ?? [];
    const ids = Array.from(new Set(rows.map((l: any) => l.actor_id).filter(Boolean)));
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      for (const r of rows) (r as any).actor = map.get(r.actor_id) ?? null;
    }
    return rows;
  });
