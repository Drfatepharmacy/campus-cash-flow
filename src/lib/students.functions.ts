import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const RowSchema = z
  .object({
    email: z.string().email().optional().nullable(),
    full_name: z.string().trim().min(2).optional().nullable(),
    matric_no: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}\d{7}$/, "Matric must be 3 letters + 7 digits (e.g. PHA2006960)")
      .optional()
      .nullable(),
    phone: z.string().trim().optional().nullable(),
    faculty_id: z.string().uuid().optional().nullable(),
    department_id: z.string().uuid().optional().nullable(),
    level: z.number().int().min(100).max(800).optional().nullable(),
  })
  .refine((r) => !!(r.email || r.matric_no), {
    message: "Each row needs at least an email or a matric number",
    path: ["email"],
  });

export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(RowSchema).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const row of data.rows) {
      // Derive email if missing (needed for auth). Uses matric_no as local part.
      const email =
        row.email?.toLowerCase() ??
        (row.matric_no ? `${row.matric_no.toLowerCase()}@students.import.local` : null);
      const full_name =
        row.full_name?.trim() ||
        (row.matric_no ? `Student ${row.matric_no}` : email ? email.split("@")[0] : "Student");

      if (!email) {
        results.push({ email: "(missing)", ok: false, error: "Missing email and matric number" });
        continue;
      }

      try {
        const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (authErr) throw new Error(authErr.message);
        const uid = created.user!.id;
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name,
            matric_no: row.matric_no ?? null,
            phone: row.phone ?? null,
            faculty_id: row.faculty_id ?? null,
            department_id: row.department_id ?? null,
            level: row.level ?? null,
          })
          .eq("id", uid);
        if (profErr) throw new Error(profErr.message);
        results.push({ email, ok: true });
      } catch (e: any) {
        results.push({ email, ok: false, error: e.message });
      }
    }
    return { results, total: data.rows.length, ok: results.filter((r) => r.ok).length };
  });
