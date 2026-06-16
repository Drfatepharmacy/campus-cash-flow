import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

async function assertRunner(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "bank_runner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: bank runner only");
}

export const listAdminDepositJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data } = await context.supabase
      .from("deposit_jobs")
      .select("*, settlement:settlements(reference, amount, status, bank_reference)")
      .order("created_at", { ascending: false });
    const jobs = data ?? [];
    // Hydrate runner names via admin client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = Array.from(new Set(jobs.map((j: any) => j.runner_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      for (const j of jobs) (j as any).runner = map.get(j.runner_id) ?? null;
    }
    return jobs;
  });

export const listRunners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "bank_runner");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
    return profs ?? [];
  });

export const listAssignableSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    // Pending settlements with no deposit job yet
    const { data: settlements } = await context.supabase
      .from("settlements").select("id, reference, amount, status").eq("status", "pending").order("created_at", { ascending: false });
    const { data: jobs } = await context.supabase.from("deposit_jobs").select("settlement_id");
    const taken = new Set((jobs ?? []).map((j: any) => j.settlement_id));
    return (settlements ?? []).filter((s: any) => !taken.has(s.id));
  });

export const assignDepositJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ settlement_id: z.string().uuid(), runner_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const reference = `DEP-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await context.supabase.from("deposit_jobs").insert({
      reference,
      settlement_id: data.settlement_id,
      runner_id: data.runner_id,
      status: "assigned",
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action: "deposit_job.assign", entity: "deposit_jobs",
      entity_id: data.settlement_id, metadata: { runner_id: data.runner_id, reference },
    });
    return { ok: true, reference };
  });

export const listMyDepositJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRunner(context as never);
    const { data } = await context.supabase
      .from("deposit_jobs")
      .select("*, settlement:settlements(reference, amount, status, bank_reference, settled_at)")
      .eq("runner_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const completeDepositJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      job_id: z.string().uuid(),
      bank_reference: z.string().trim().min(2).max(120),
      notes: z.string().trim().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRunner(context as never);
    // Load job, confirm ownership
    const { data: job, error: jErr } = await context.supabase
      .from("deposit_jobs").select("*").eq("id", data.job_id).single();
    if (jErr || !job) throw new Error("Job not found");
    if (job.runner_id !== context.userId) throw new Error("Not your job");
    if (job.status === "deposited") throw new Error("Already deposited");
    if (!job.settlement_id) throw new Error("Job has no settlement attached");

    // Use admin client to flip settlement (RLS limits non-admin writes)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { error: sErr } = await supabaseAdmin.from("settlements")
      .update({ status: "deposited", settled_at: nowIso, bank_reference: data.bank_reference })
      .eq("id", job.settlement_id as string);
    if (sErr) throw new Error(sErr.message);
    const { error: dErr } = await supabaseAdmin.from("deposit_jobs")
      .update({ status: "deposited", notes: data.notes ?? null }).eq("id", data.job_id as string);
    if (dErr) throw new Error(dErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "deposit_job.complete", entity: "deposit_jobs",
      entity_id: data.job_id, metadata: { bank_reference: data.bank_reference },
    });
    return { ok: true };
  });
