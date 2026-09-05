import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { ArrowLeft, Building2, Crown, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "super_admin" });
    if (!isSuper) throw redirect({ to: "/dashboard" });
  },
  component: SuperAdminLayout,
});

const nav: { to: "/superadmin" | "/superadmin/associations" | "/superadmin/nominations" | "/superadmin/bank-verifications"; label: string; icon: any; exact?: boolean }[] = [
  { to: "/superadmin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/superadmin/associations", label: "Association applications", icon: Building2 },
  { to: "/superadmin/nominations", label: "Leadership approvals", icon: Crown },
  { to: "/superadmin/bank-verifications", label: "Bank verifications", icon: Landmark },
];

function SuperAdminLayout() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Logo /></Link>
            <span className="text-xs uppercase tracking-wider bg-foreground text-background rounded-full px-2.5 py-1 font-semibold">Super Admin</span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[240px_1fr] gap-8">
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
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
