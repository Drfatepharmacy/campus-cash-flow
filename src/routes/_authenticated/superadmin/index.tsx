import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssociations, listAllNominations } from "@/lib/superadmin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Crown, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/")({
  head: () => ({
    meta: [
      { title: "Super Admin console — UniEgo governance" },
      { name: "description", content: "Platform governance console for reviewing association applications and approving association leadership." },
      { property: "og:title", content: "Super Admin console — UniEgo" },
      { property: "og:description", content: "Review association applications and approve association leadership." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminOverview,
});

function SuperAdminOverview() {
  const loadAssoc = useServerFn(listAllAssociations);
  const loadNoms = useServerFn(listAllNominations);
  const assoc = useQuery({ queryKey: ["sa-associations"], queryFn: () => loadAssoc(), retry: false });
  const noms = useQuery({ queryKey: ["sa-nominations"], queryFn: () => loadNoms(), retry: false });

  const pendingAssoc = (assoc.data ?? []).filter((a: any) => ["submitted", "under_review"].includes(a.status)).length;
  const activeAssoc = (assoc.data ?? []).filter((a: any) => a.status === "active").length;
  const pendingNoms = (noms.data ?? []).filter((n: any) => ["submitted", "under_review"].includes(n.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-royal" />
        <h1 className="text-2xl font-semibold">Platform governance</h1>
      </div>

      {assoc.isLoading || noms.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Awaiting review" value={pendingAssoc} />
          <Stat label="Active associations" value={activeAssoc} />
          <Stat label="Leadership pending" value={pendingNoms} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Association applications</CardTitle>
            <CardDescription>Verify, activate, suspend or archive associations. Every decision is written to the audit trail.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/superadmin/associations"><Button>Review applications</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Crown className="h-4 w-4" /> Leadership approvals</CardTitle>
            <CardDescription>Approve or reject proposed Heads and Treasurers, and set their tenure.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/superadmin/nominations"><Button>Review nominations</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent><p className="text-3xl font-semibold">{value}</p></CardContent>
    </Card>
  );
}
