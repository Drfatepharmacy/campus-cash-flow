import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRepOverview } from "@/lib/rep.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";

export const Route = createFileRoute("/_authenticated/rep/")({
  head: () => ({ meta: [{ title: "Rep portal — UniPay NG" }] }),
  component: RepOverview,
});

function RepOverview() {
  const fn = useServerFn(getRepOverview);
  const q = useQuery({ queryKey: ["rep-overview"], queryFn: () => fn() });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{d?.scope.kind === "department" ? "Department" : "Faculty"} representative</div>
        <h1 className="font-display text-3xl font-bold mt-1">
          {d?.scope.kind === "department" ? d?.scope.department ?? "—" : d?.scope.faculty ?? "—"}
        </h1>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Stat label="Revenue" value={d ? formatNaira(d.stats.revenue) : "—"} />
        <Stat label="Service charges" value={d ? formatNaira(d.stats.charges) : "—"} />
        <Stat label="Paid txns" value={d?.stats.paid_count ?? "—"} />
        <Stat label="Pending" value={d?.stats.pending_count ?? "—"} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Reference</th>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(d?.transactions ?? []).map((t: any) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono text-xs">{t.reference}</td>
                  <td className="p-3">{t.student?.full_name ?? "—"} <span className="text-xs text-muted-foreground">{t.student?.matric_no ?? ""}</span></td>
                  <td className="p-3">{t.payment_request?.title ?? "—"}</td>
                  <td className="p-3 text-right font-semibold">{formatNaira(Number(t.total_amount))}</td>
                  <td className="p-3">{t.status === "paid" ? <Badge className="bg-emerald text-white">Paid</Badge> : t.status === "pending" ? <Badge variant="secondary">Pending</Badge> : <Badge variant="destructive">Failed</Badge>}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(t.paid_at ?? t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(d?.transactions ?? []).length === 0 && <tr><td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">No transactions for your scope yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}
