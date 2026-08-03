import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useWorkspace } from "./route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Banknote, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/")({
  head: () => ({
    meta: [
      { title: "Association overview — UniEgo" },
      { name: "description", content: "Association overview: verification state, your role, permissions and financial status." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const ws = useWorkspace();
  if (!ws.data) return null;
  const a = ws.data.association;
  const perms: string[] = ws.data.permissions ?? [];
  const roles: string[] = ws.data.roles ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">{a.name}</h1>
        <p className="text-muted-foreground text-sm">{a.institution}{a.session_year ? ` · ${a.session_year} session` : ""}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Verification</CardDescription></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold capitalize">{String(a.status).replace("_", " ")}</p>
            {a.status_reason && <p className="text-xs text-muted-foreground mt-1">{a.status_reason}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Collecting payments</CardDescription></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{a.financials_enabled ? "Enabled" : "Disabled"}</p>
            <p className="text-xs text-muted-foreground mt-1">Enabled by UniEgo after compliance review.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Your position</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {roles.length ? (
              <div className="flex flex-wrap gap-1">
                {roles.map((r) => <Badge key={r} className="capitalize">{r.replace(/_/g, " ")}</Badge>)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{ws.data.isSuperAdmin ? "Platform administrator" : "Member"}</p>
            )}
            <p className="text-xs text-muted-foreground">{perms.length} permission{perms.length === 1 ? "" : "s"} granted</p>
          </CardContent>
        </Card>
      </div>

      {a.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-line">{a.description}</p></CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {perms.includes("members.view") && (
          <Button asChild variant="outline" className="justify-between"><Link to="/association/$slug/members" params={{ slug }}><span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> Members</span><ArrowRight className="h-4 w-4" /></Link></Button>
        )}
        {perms.includes("executives.view") && (
          <Button asChild variant="outline" className="justify-between"><Link to="/association/$slug/executives" params={{ slug }}><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Executives</span><ArrowRight className="h-4 w-4" /></Link></Button>
        )}
        {perms.includes("finance.view") && (
          <Button asChild variant="outline" className="justify-between"><Link to="/association/$slug/finance" params={{ slug }}><span className="inline-flex items-center gap-2"><Banknote className="h-4 w-4" /> Finance</span><ArrowRight className="h-4 w-4" /></Link></Button>
        )}
      </div>

      {perms.length === 0 && !ws.data.isSuperAdmin && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          You are a member of this association. Executive tools appear here once UniEgo approves you for a role.
        </CardContent></Card>
      )}
    </div>
  );
}
