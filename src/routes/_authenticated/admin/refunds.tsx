import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRefundRequests, decideRefund, runReconciliation } from "@/lib/money-ops.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({ meta: [{ title: "Refunds & recovery — UniEgo Admin" }, { name: "robots", content: "noindex" }] }),
  component: RefundsPage,
});

const FILTERS = ["pending", "processing", "processed", "rejected", "failed", "all"];
const naira = (m: number) => `₦${(m / 100).toLocaleString()}`;

function RefundsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [note, setNote] = useState<Record<string, string>>({});
  const listFn = useServerFn(listRefundRequests);
  const decideFn = useServerFn(decideRefund);
  const reconFn = useServerFn(runReconciliation);
  const q = useQuery({ queryKey: ["refunds", filter], queryFn: () => listFn({ data: { status: filter } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => decideFn({ data: { ...v, reason: note[v.id] || null } }),
    onSuccess: () => { toast.success("Decision recorded"); qc.invalidateQueries({ queryKey: ["refunds"] }); },
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["refunds"] }); },
  });
  const recon = useMutation({
    mutationFn: () => reconFn(),
    onSuccess: (s) => toast.success(`Checked ${s.checked}: ${s.recovered} recovered, ${s.failed} closed, ${s.waiting} still waiting`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Missed payment recovery</CardTitle>
          <CardDescription>Checks payments still marked pending with Paystack and completes any that were actually paid. Also runs automatically on a schedule when set up.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => recon.mutate()} disabled={recon.isPending}>
            {recon.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Check pending payments now
          </Button>
        </CardContent>
      </Card>

      <div>
        <h1 className="font-display text-2xl font-bold">Refund requests</h1>
        <p className="text-sm text-muted-foreground">Approving sends the refund through Paystack. You can't decide a request you raised yourself.</p>
      </div>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto">{FILTERS.map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
      </Tabs>
      {(q.data ?? []).length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{q.isLoading ? "Loading…" : "Nothing here right now."}</CardContent></Card>}
      <div className="space-y-4">
        {(q.data ?? []).map((r: any) => (
          <Card key={r.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{naira(Number(r.amount_minor))} · {r.association?.short_name || r.association?.name || "In-app payment"}</CardTitle>
                  <CardDescription className="font-mono">{r.reference}</CardDescription>
                </div>
                <div className="flex gap-2">
                  {r.duplicate_suspected && <Badge variant="destructive">Possible duplicate</Badge>}
                  <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium capitalize">{String(r.reason_type).replace(/_/g, " ")}:</span> {r.reason}</p>
              {r.requester_contact && <p className="text-muted-foreground">Contact: {r.requester_contact}</p>}
              {r.decision_reason && <p className="text-muted-foreground">Decision note: {r.decision_reason}</p>}
              {r.failure_reason && <p className="text-destructive">{r.failure_reason}</p>}
              {r.can_decide && (
                <div className="space-y-2">
                  <Textarea rows={2} placeholder="Note (required to reject)" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "approved" })}>Approve & refund</Button>
                    <Button size="sm" variant="outline" disabled={m.isPending || !note[r.id]} onClick={() => m.mutate({ id: r.id, decision: "rejected" })}>Reject</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
