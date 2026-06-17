import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const since = new Date(); since.setDate(since.getDate() - 29);
    const { data: txns } = await context.supabase
      .from("transactions")
      .select("total_amount, service_charge, status, paid_at, created_at, payment_request:payment_requests(target_faculty_id, target_department_id, faculty:faculties!payment_requests_target_faculty_id_fkey(name), department:departments!payment_requests_target_department_id_fkey(name))")
      .gte("created_at", since.toISOString());

    const rows = txns ?? [];
    const paid = rows.filter((t: any) => t.status === "paid");

    // 30-day series
    const series: { date: string; revenue: number; charges: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, revenue: 0, charges: 0, count: 0 });
    }
    const byDate = new Map(series.map((s) => [s.date, s]));
    for (const t of paid) {
      const day = (t.paid_at ?? t.created_at).slice(0, 10);
      const bucket = byDate.get(day);
      if (bucket) {
        bucket.revenue += Number(t.total_amount);
        bucket.charges += Number(t.service_charge);
        bucket.count += 1;
      }
    }

    // breakdown by faculty
    const facMap = new Map<string, number>();
    const deptMap = new Map<string, number>();
    for (const t of paid) {
      const pr: any = t.payment_request;
      const facName = pr?.faculty?.name ?? "Unassigned";
      const deptName = pr?.department?.name ?? "Unassigned";
      facMap.set(facName, (facMap.get(facName) ?? 0) + Number(t.total_amount));
      deptMap.set(deptName, (deptMap.get(deptName) ?? 0) + Number(t.total_amount));
    }
    const topFaculties = Array.from(facMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    const topDepartments = Array.from(deptMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    return {
      series,
      topFaculties,
      topDepartments,
      totals: {
        revenue: paid.reduce((s: number, t: any) => s + Number(t.total_amount), 0),
        charges: paid.reduce((s: number, t: any) => s + Number(t.service_charge), 0),
        paid_count: paid.length,
        attempts: rows.length,
      },
    };
  });
