import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rep")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "faculty_rep" }),
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "department_rep" }),
    ]);
    if (!f && !d) throw redirect({ to: "/dashboard" });
  },
  component: RepLayout,
});

function RepLayout() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Logo /></Link>
            <span className="text-xs uppercase tracking-wider bg-gold text-foreground rounded-full px-2.5 py-1 font-semibold">Rep portal</span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4"/> Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
