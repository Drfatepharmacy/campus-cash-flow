import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssociationFinance, raiseApprovalRequest } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Banknote, Download, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/finance")({
  head: () => ({ meta: [{ title: "Finance — Association workspace" }, { name: "description", content: "Association collections, transactions, settlements and settlement account." }] }),
  component: FinancePage,
});

const naira = (minor: number) => `₦${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function FinancePage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const fetchFinance = useServerFn(getAssociationFinance);
  const raise = useServerFn(raiseApprovalRequest);
  const fin = useQuery({ queryKey: ["finance", slug], queryFn: () => fetchFinance({ data: { slug } }), retry: false });

  const m = useMutation({
    mutationFn: () => raise({ data: { slug, action_type: "settlement.payout", payload: {}, reason: "Payout of collected dues" } }),
    onSuccess: () => { toast.success("Settlement requested — awaiting a second officer's approval"); qc.invalidateQueries({ queryKey: ["approvals", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (fin.isLoading) return <Skeleton className="h-64" />;
  if (fin.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(fin.error as Error).message}</CardContent></Card>;
  const d = fin.data!;

  const exportCsv = () => {
    const rows = [["Reference", "Status", "Total", "Created"], ...d.transactions.map((t: any) => [t.reference, t.status, String(Number(t.total_minor) / 100), t.created_at])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${slug}-transactions.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Collected</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{naira(d.totals.collected_minor)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Net to association</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{naira(d.totals.net_minor)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Paid</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{d.totals.paid_count}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{d.totals.pending_count}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Settlement account</CardTitle><CardDescription>Bank details are masked by design.</CardDescription></div>
          {d.canRequestSettlement && <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}><Banknote className="h-4 w-4 mr-1" /> Request payout</Button>}
        </CardHeader>
        <CardContent>
          {d.bank ? (
            <div className="text-sm space-y-1">
              <p className="font-medium">{d.bank.account_name}</p>
              <p className="text-muted-foreground">{d.bank.bank_name} · {d.bank.masked}</p>
              <Badge variant={d.bank.verified ? "default" : "secondary"}>{d.bank.verified ? "Verified" : "Unverified"}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Lock className="h-4 w-4" /> No settlement account visible to your role.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Transactions</CardTitle>
          {d.canExport && d.transactions.length > 0 && <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>}
        </CardHeader>
        <CardContent>
          {d.transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions recorded for this association yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b"><tr><th className="py-2 pr-3">Reference</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Amount</th><th className="py-2">Status</th></tr></thead>
                <tbody>
                  {d.transactions.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{t.reference}</td>
                      <td className="py-2 pr-3">{t.payment_request?.title ?? "—"}</td>
                      <td className="py-2 pr-3">{naira(Number(t.total_minor))}</td>
                      <td className="py-2"><Badge variant={t.status === "paid" ? "default" : "secondary"} className="capitalize">{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
