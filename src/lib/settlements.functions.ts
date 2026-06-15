import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data } = await context.supabase
      .from("settlements")
      .select("*, department:departments(name)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getUnsettledStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data } = await context.supabase
      .from("transactions")
      .select("base_amount, service_charge, total_amount")
      .eq("status", "paid")
      .is("settlement_id", null);
    const rows = data ?? [];
    return {
      count: rows.length,
      gross: rows.reduce((s: number, r: any) => s + Number(r.total_amount), 0),
      charges: rows.reduce((s: number, r: any) => s + Number(r.service_charge), 0),
      net: rows.reduce((s: number, r: any) => s + Number(r.base_amount), 0),
    };
  });

export const createSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      notes: z.string().trim().max(500).optional().nullable(),
      department_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    // collect unsettled paid txns (optionally filtered by department via payment_request → department)
    const { data: txns, error: txErr } = await context.supabase
      .from("transactions")
      .select("id, base_amount")
      .eq("status", "paid")
      .is("settlement_id", null);
    if (txErr) throw new Error(txErr.message);
    if (!txns || txns.length === 0) throw new Error("No unsettled paid transactions to batch.");

    const amount = txns.reduce((s: number, t: any) => s + Number(t.base_amount), 0);
    const reference = `SETL-${Date.now().toString(36).toUpperCase()}`;

    const { data: settlement, error: sErr } = await context.supabase
      .from("settlements")
      .insert({ reference, amount, notes: data.notes ?? null, department_id: data.department_id ?? null })
      .select("*")
      .single();
    if (sErr) throw new Error(sErr.message);

    const ids = txns.map((t: any) => t.id);
    const { error: uErr } = await context.supabase
      .from("transactions")
      .update({ settlement_id: settlement.id })
      .in("id", ids);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, reference, count: ids.length, amount };
  });

export const completeSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      bank_reference: z.string().trim().min(2).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("settlements")
      .update({ status: "deposited", settled_at: new Date().toISOString(), bank_reference: data.bank_reference })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reconcileCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rows: z.array(z.object({
        reference: z.string().trim().min(3),
        amount: z.number().nonnegative(),
      })).min(1).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const refs = data.rows.map((r) => r.reference);
    const { data: txns } = await context.supabase
      .from("transactions")
      .select("reference, total_amount, status, paid_at")
      .in("reference", refs);
    const byRef = new Map((txns ?? []).map((t: any) => [t.reference, t]));
    const matched: any[] = [];
    const mismatched: any[] = [];
    const missing: any[] = [];
    for (const row of data.rows) {
      const t = byRef.get(row.reference);
      if (!t) { missing.push(row); continue; }
      if (Math.abs(Number(t.total_amount) - row.amount) > 0.01 || t.status !== "paid") {
        mismatched.push({ ...row, expected: Number(t.total_amount), status: t.status });
      } else {
        matched.push({ ...row, paid_at: t.paid_at });
      }
    }
    return { matched, mismatched, missing, total: data.rows.length };
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, email, full_name, matric_no").order("created_at", { ascending: false }).limit(200);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "student", "department_rep", "faculty_rep", "bank_runner"]),
      grant: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      // Safety: don't allow removing the last admin
      if (data.role === "admin") {
        const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        if ((admins ?? []).length <= 1) throw new Error("Cannot remove the last admin.");
      }
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
