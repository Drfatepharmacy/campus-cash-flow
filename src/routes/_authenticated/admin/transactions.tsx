import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Admin" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const fn = useServerFn(listTransactions);
  const q = useQuery({ queryKey: ["admin-txns"], queryFn: () => fn() });

  function exportCsv() {
    const rows = q.data ?? [];
    const header = ["Reference","Student","Matric","Email","Payment","Base","Charge","Total","Status","Paid at","Created"];
    const body = rows.map((t: any) => [
      t.reference, t.student?.full_name ?? "", t.student?.matric_no ?? "", t.student?.email ?? "",
      t.payment_request?.title ?? "", t.base_amount, t.service_charge, t.total_amount,
      t.status, t.paid_at ?? "", t.created_at,
    ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uniego-transactions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Transactions</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5"/>Export CSV</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Reference</th>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(q.data ?? []).map((t: any) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono text-xs">{t.reference}</td>
                  <td className="p-3"><div className="font-medium">{t.student?.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{t.student?.matric_no}</div></td>
                  <td className="p-3">{t.payment_request?.title ?? "—"}</td>
                  <td className="p-3 text-right font-semibold">{formatNaira(Number(t.total_amount))}</td>
                  <td className="p-3">
                    {t.status === "paid" && <Badge className="bg-emerald text-white">Paid</Badge>}
                    {t.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                    {t.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(q.data ?? []).length === 0 && <tr><td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
