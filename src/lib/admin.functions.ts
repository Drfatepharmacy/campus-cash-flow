import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data: txns } = await context.supabase.from("transactions").select("status, total_amount, service_charge");
    const paid = (txns ?? []).filter((t) => t.status === "paid");
    return {
      revenue: paid.reduce((s, t) => s + Number(t.total_amount), 0),
      charges: paid.reduce((s, t) => s + Number(t.service_charge), 0),
      paid_count: paid.length,
      pending_count: (txns ?? []).filter((t) => t.status === "pending").length,
      total_count: (txns ?? []).length,
    };
  });

export const listCampuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("campuses").select("*").order("name")).data ?? []);

export const listFaculties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("faculties").select("*, campus:campuses(name)").order("name")).data ?? []);

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("departments").select("*, faculty:faculties(name)").order("name")).data ?? []);

export const listPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("payment_requests").select("*").order("created_at", { ascending: false })).data ?? []);

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data } = await context.supabase
      .from("transactions")
      .select("*, student:profiles!transactions_student_id_fkey(full_name, matric_no, email), payment_request:payment_requests(title)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const createFaculty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campus_id: z.string().uuid(), name: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("faculties").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ faculty_id: z.string().uuid(), name: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("departments").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    campus_id: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    base_amount: z.number().positive().max(10_000_000),
    target_faculty_id: z.string().uuid().optional().nullable(),
    target_department_id: z.string().uuid().optional().nullable(),
    target_level: z.number().int().min(100).max(800).optional().nullable(),
    active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("payment_requests").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPaymentRequestActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("payment_requests").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { count } = await context.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("payment_request_id", data.id);
    if ((count ?? 0) > 0) {
      // Preserve history — deactivate instead of hard delete when transactions exist.
      const { error } = await context.supabase.from("payment_requests").update({ active: false }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, softDeleted: true };
    }
    const { error } = await context.supabase.from("payment_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, softDeleted: false };
  });

export const grantAdminToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Bootstrap: first user can claim admin if no admins exist yet.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    if ((existing ?? []).length > 0) throw new Error("An admin already exists. Ask the existing admin to grant your role.");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
