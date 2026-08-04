import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllNominations, decideNomination, expireLapsedTenures } from "@/lib/superadmin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Gavel, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/nominations")({
  head: () => ({
    meta: [
      { title: "Leadership approvals — UniEgo Super Admin" },
      { name: "description", content: "Approve or reject association Head and Treasurer nominations with immutable audit logs." },
    ],
  }),
  component: NominationsPage,
});

const FILTERS = ["submitted", "under_review", "approved", "rejected", "all"] as const;

function NominationsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listAllNominations);
  const decide = useServerFn(decideNomination);
  const expire = useServerFn(expireLapsedTenures);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("submitted");
  const [months, setMonths] = useState(12);
  const [reason, setReason] = useState("");

  const q = useQuery({ queryKey: ["admin-nominations"], queryFn: () => load(), retry: false });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) =>
      decide({ data: { id: v.id, decision: v.decision, reason: reason || null, term_months: months } }),
    onSuccess: (r: any) => {
      toast.success(r?.activated ? "Approved — tenure activated and logged" : "Decision recorded and logged");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-nominations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exp = useMutation({
    mutationFn: () => expire(),
    onSuccess: (r: any) => toast.success(`${r.expired} lapsed tenure(s) expired`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-72" />;
  const all = q.data ?? [];
  const rows = all.filter((n: any) => filter === "all" || n.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Gavel className="h-5 w-5 text-royal" /><h1 className="text-2xl font-semibold">Leadership nominations</h1></div>
        <Button variant="outline" size="sm" onClick={() => exp.mutate()} disabled={exp.isPending}><Clock className="h-4 w-4 mr-1" /> Expire lapsed tenures</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval terms</CardTitle>
          <CardDescription>Approval creates a tenure-bounded role assignment. Nomination alone never grants privileges.</CardDescription>
          <div className="grid sm:grid-cols-[160px_1fr] gap-3 pt-2">
            <Input type="number" min={1} max={48} value={months} onChange={(e) => setMonths(Number(e.target.value) || 12)} aria-label="Tenure months" />
            <Textarea rows={1} placeholder="Decision reason (recorded in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="flex-wrap h-auto">
              {FILTERS.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f.replace("_", " ")} ({f === "all" ? all.length : all.filter((n: any) => n.status === f).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No nominations in this state.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((n: any) => (
                <li key={n.id} className="border rounded-xl p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{n.nominee_name} <span className="text-muted-foreground font-normal">· {n.role?.name ?? n.role_key}{n.role?.is_head ? " (Head)" : ""}</span></p>
                    <p className="text-sm text-muted-foreground truncate">{n.nominee_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.association?.name} · association status {String(n.association?.status ?? "").replace("_", " ")} · {new Date(n.created_at).toLocaleDateString()}
                    </p>
                    {n.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {n.notes}</p>}
                    {n.decision_reason && <p className="text-xs text-muted-foreground mt-1">Decision: {n.decision_reason}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={n.status === "approved" ? "default" : n.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{String(n.status).replace("_", " ")}</Badge>
                    {["submitted", "under_review"].includes(n.status) && (
                      <>
                        <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: n.id, decision: "approved" })}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ id: n.id, decision: "rejected" })}>Reject</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
