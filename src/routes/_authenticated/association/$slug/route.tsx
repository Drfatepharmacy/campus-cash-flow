import { createFileRoute, Outlet, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/associations.functions";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LayoutDashboard, Users, ShieldCheck, Banknote, Landmark, ClipboardCheck, ScrollText, Coins, ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug")({
  head: () => ({ meta: [{ title: "Association workspace — UniEgo" }] }),
  component: WorkspaceLayout,
});

type NavItem = {
  to: "/association/$slug" | "/association/$slug/members" | "/association/$slug/executives" | "/association/$slug/dues" | "/association/$slug/finance" | "/association/$slug/bank" | "/association/$slug/approvals" | "/association/$slug/audit";
  label: string;
  icon: any;
  permission?: string;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/association/$slug", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/association/$slug/members", label: "Members", icon: Users, permission: "members.view" },
  { to: "/association/$slug/executives", label: "Executives", icon: ShieldCheck, permission: "executives.view" },
  { to: "/association/$slug/dues", label: "Dues", icon: Coins, permission: "dues.view" },
  { to: "/association/$slug/finance", label: "Finance", icon: Banknote, permission: "finance.view" },
  { to: "/association/$slug/bank", label: "Bank details", icon: Landmark, permission: "bank_details.view" },
  { to: "/association/$slug/approvals", label: "Approvals", icon: ClipboardCheck, permission: "approvals.view" },
  { to: "/association/$slug/audit", label: "Audit log", icon: ScrollText, permission: "audit.view" },
];


export function useWorkspace() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const fetchWorkspace = useServerFn(getWorkspace);
  return useQuery({ queryKey: ["workspace", slug], queryFn: () => fetchWorkspace({ data: { slug } }), retry: false });
}

const STATUS_COPY: Record<string, { tone: string; title: string; body: string }> = {
  draft: { tone: "border-muted", title: "Draft", body: "Finish your details and nominate a President, then submit for verification." },
  submitted: { tone: "border-amber-500/50", title: "Awaiting review", body: "UniEgo has your submission. Payments stay disabled until verification completes." },
  under_review: { tone: "border-amber-500/50", title: "Under review", body: "A platform reviewer is checking your documents. We may request more information." },
  verified: { tone: "border-emerald-500/50", title: "Verified", body: "Verified. Activation and financial enablement are the final step." },
  suspended: { tone: "border-destructive/50", title: "Suspended", body: "This association is suspended. Financial operations are disabled." },
  archived: { tone: "border-destructive/50", title: "Archived", body: "This association is archived and read-only." },
};

function WorkspaceLayout() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const ws = useWorkspace();

  if (ws.isLoading) {
    return <div className="mx-auto max-w-7xl px-6 py-10 space-y-4"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  }
  if (ws.error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>{(ws.error as Error).message}</AlertDescription>
        </Alert>
        <Link to="/associations" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to associations
        </Link>
      </div>
    );
  }

  const data = ws.data!;
  const perms: string[] = data.permissions ?? [];
  const nav = NAV.filter((n) => !n.permission || perms.includes(n.permission));
  const status = String(data.association.status);
  const banner = status !== "active" ? STATUS_COPY[status] : null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/"><Logo /></Link>
            <span className="hidden sm:block h-5 w-px bg-border" />
            <span className="truncate font-medium">{data.association.short_name || data.association.name}</span>
            <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize shrink-0">{status.replace("_", " ")}</Badge>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground shrink-0">Exit</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
        <aside>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                params={{ slug }}
                activeOptions={{ exact: item.exact }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors whitespace-nowrap"
                activeProps={{ className: "bg-background text-foreground font-medium shadow-sm" }}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="space-y-4 min-w-0">
          {banner && (
            <Alert className={banner.tone}>
              <AlertTitle>{banner.title}</AlertTitle>
              <AlertDescription>{banner.body}</AlertDescription>
            </Alert>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
