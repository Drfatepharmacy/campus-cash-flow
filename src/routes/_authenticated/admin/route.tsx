import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { LayoutDashboard, Building2, FileText, Receipt, ArrowLeft, Banknote, FileCheck2, ShieldCheck, Truck, ScrollText, BarChart3, Users, QrCode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: hasRole } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!hasRole) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const nav: { to: "/admin" | "/admin/analytics" | "/admin/faculties" | "/admin/payment-requests" | "/admin/transactions" | "/admin/settlements" | "/admin/reconcile" | "/admin/runners" | "/admin/students" | "/admin/users" | "/admin/audit"; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/faculties", label: "Faculties & departments", icon: Building2 },
  { to: "/admin/payment-requests", label: "Payment requests", icon: FileText },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/settlements", label: "Settlements", icon: Banknote },
  { to: "/admin/runners", label: "Bank runners", icon: Truck },
  { to: "/admin/reconcile", label: "Reconcile CSV", icon: FileCheck2 },
  { to: "/admin/students", label: "Bulk import students", icon: Users },
  { to: "/admin/users", label: "Users & roles", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
];

function AdminLayout() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Logo /></Link>
            <span className="text-xs uppercase tracking-wider bg-royal text-royal-foreground rounded-full px-2.5 py-1 font-semibold">Admin</span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4"/> Student view
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        <aside>
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                activeProps={{ className: "bg-background text-foreground font-medium shadow-sm" }}
              >
                <item.icon className="h-4 w-4"/> {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
