import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSuperCounts } from "@/lib/superadmin-console.functions";
import { Logo } from "@/components/brand/logo";
import { Activity, ArrowLeft, Building2, Crown, Landmark, LayoutDashboard, Users } from "lucide-react";

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

type NavTo = "/superadmin" | "/superadmin/associations" | "/superadmin/nominations" | "/superadmin/bank-verifications" | "/superadmin/activity" | "/superadmin/users";
const nav: { to: NavTo; label: string; icon: any; exact?: boolean; count?: "applications" | "leadership" | "bank" }[] = [
  { to: "/superadmin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/superadmin/associations", label: "Associations", icon: Building2, count: "applications" },
  { to: "/superadmin/nominations", label: "Leadership", icon: Crown, count: "leadership" },
  { to: "/superadmin/bank-verifications", label: "Bank accounts", icon: Landmark, count: "bank" },
  { to: "/superadmin/users", label: "Users & roles", icon: Users },
  { to: "/superadmin/activity", label: "Activity log", icon: Activity },
];

function SuperAdminLayout() {
  const load = useServerFn(getSuperCounts);
  const counts = useQuery({ queryKey: ["sa-counts"], queryFn: () => load(), retry: false, refetchInterval: 60_000 });
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/"><Logo /></Link>
            <span className="hidden sm:inline text-xs uppercase tracking-wider bg-foreground text-background rounded-full px-2.5 py-1 font-semibold">Super Admin</span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
        <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {nav.map((item) => <NavItem key={item.to} item={item} n={item.count ? counts.data?.[item.count] : 0} compact />)}
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:py-8 grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block">
          <nav className="space-y-1 sticky top-24">
            {nav.map((item) => <NavItem key={item.to} item={item} n={item.count ? counts.data?.[item.count] : 0} />)}
          </nav>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

function NavItem({ item, n, compact }: { item: (typeof nav)[number]; n?: number; compact?: boolean }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      className={`flex items-center gap-2 rounded-lg text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors ${compact ? "px-3 py-1.5 whitespace-nowrap shrink-0 border bg-background/60" : "px-3 py-2"}`}
      activeProps={{ className: "bg-background text-foreground font-medium shadow-sm" }}
    >
      <item.icon className="h-4 w-4" /> {item.label}
      {n ? <span className="ml-auto rounded-full bg-gold text-gold-foreground text-[11px] font-semibold px-1.5 min-w-5 text-center">{n}</span> : null}
    </Link>
  );
}
