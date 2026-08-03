import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listApprovalRequests, decideApprovalRequest } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/association/$slug/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Association workspace" }, { name: "description", content: "Maker-checker approvals for sensitive financial actions." }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const list = useServerFn(listApprovalRequests);
  const decide = useServerFn(decideApprovalRequest);
  const q = useQuery({ queryKey: ["approvals", slug], queryFn: () => list({ data: { slug } }), retry: false });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => decide({ data: { slug, request_id: v.id, decision: v.decision, reason: null } }),
    onSuccess: () => { toast.success("Decision recorded"); qc.invalidateQueries({ queryKey: ["approvals", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(q.error as Error).message}</CardContent></Card>;
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Approval requests</CardTitle><CardDescription>The officer who raises a request can never approve it.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing awaiting approval.</p>}
        {rows.map((r: any) => (
          <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">{String(r.action_type).replace(/[._]/g, " ")}</p>
              <p className="text-xs text-muted-foreground">Raised by {r.requester?.full_name ?? "—"} · {new Date(r.created_at).toLocaleString()}</p>
              {r.reason && <p className="text-xs mt-1">{r.reason}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === "pending" ? "secondary" : "default"} className="capitalize">{r.status}</Badge>
              {r.status === "pending" && r.canDecide && (
                <>
                  <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "approved" })}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "rejected" })}>Reject</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
