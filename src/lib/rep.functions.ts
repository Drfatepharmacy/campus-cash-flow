import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A rep is scoped by their profile.faculty_id (faculty_rep) or profile.department_id (department_rep).
 * Returns scope info plus aggregate stats and recent transactions matching their scope.
 */
export const getRepOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isFacultyRep = roleSet.has("faculty_rep");
    const isDeptRep = roleSet.has("department_rep");
    if (!isFacultyRep && !isDeptRep) throw new Error("Forbidden: rep role required");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("faculty_id, department_id, faculty:faculties(name), department:departments(name)")
      .eq("id", context.userId).single();
    if (!profile) throw new Error("Profile not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build query against transactions joined to payment_requests for scope filter
    let query = supabaseAdmin
      .from("transactions")
      .select("id, reference, base_amount, service_charge, total_amount, status, paid_at, created_at, student:profiles!transactions_student_id_profiles_fkey(full_name, matric_no), payment_request:payment_requests!inner(title, target_faculty_id, target_department_id)")
      .order("created_at", { ascending: false })
      .limit(200);

    // Fail closed: a rep without an assigned scope must never see platform-wide data.
    if (isDeptRep && profile.department_id) {
      query = query.eq("payment_request.target_department_id", profile.department_id);
    } else if (isFacultyRep && profile.faculty_id) {
      query = query.eq("payment_request.target_faculty_id", profile.faculty_id);
    } else {
      return {
        scope: {
          kind: isDeptRep ? "department" : "faculty",
          faculty: profile.faculty?.name ?? null,
          department: profile.department?.name ?? null,
        },
        scope_missing: true,
        stats: { revenue: 0, charges: 0, paid_count: 0, pending_count: 0 },
        transactions: [] as any[],
      };
    }

    const { data: txns } = await query;
    const rows = txns ?? [];
    const paid = rows.filter((t: any) => t.status === "paid");
    const stats = {
      revenue: paid.reduce((s: number, t: any) => s + Number(t.total_amount), 0),
      charges: paid.reduce((s: number, t: any) => s + Number(t.service_charge), 0),
      paid_count: paid.length,
      pending_count: rows.filter((t: any) => t.status === "pending").length,
    };

    return {
      scope: {
        kind: isDeptRep ? "department" : "faculty",
        faculty: profile.faculty?.name ?? null,
        department: profile.department?.name ?? null,
      },
      stats,
      transactions: rows,
    };
  });
