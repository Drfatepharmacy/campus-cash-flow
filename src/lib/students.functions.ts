import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const RowSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().min(2),
  matric_no: z.string().trim().min(2).optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  faculty_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  level: z.number().int().min(100).max(800).optional().nullable(),
});

export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(RowSchema).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const row of data.rows) {
      try {
        const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: { full_name: row.full_name },
        });
        if (authErr) throw new Error(authErr.message);
        const uid = created.user!.id;
        const { error: profErr } = await supabaseAdmin.from("profiles").update({
          full_name: row.full_name,
          matric_no: row.matric_no ?? null,
          phone: row.phone ?? null,
          faculty_id: row.faculty_id ?? null,
          department_id: row.department_id ?? null,
          level: row.level ?? null,
        }).eq("id", uid);
        if (profErr) throw new Error(profErr.message);
        results.push({ email: row.email, ok: true });
      } catch (e: any) {
        results.push({ email: row.email, ok: false, error: e.message });
      }
    }
    return { results, total: data.rows.length, ok: results.filter((r) => r.ok).length };
  });
