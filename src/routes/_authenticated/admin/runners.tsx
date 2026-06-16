import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAdminDepositJobs, listRunners, listAssignableSettlements, assignDepositJob } from "@/lib/runner.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/runners")({
  head: () => ({ meta: [{ title: "Bank runners — Admin" }] }),
  component: RunnersPage,
});

function RunnersPage() {
  const qc = useQueryClient();
  const jobsFn = useServerFn(listAdminDepositJobs);
  const runnersFn = useServerFn(listRunners);
  const settlementsFn = useServerFn(listAssignableSettlements);
  const assignFn = useServerFn(assignDepositJob);

  const jobs = useQuery({ queryKey: ["admin-jobs"], queryFn: () => jobsFn() });
  const runners = useQuery({ queryKey: ["runners-list"], queryFn: () => runnersFn() });
  const settlements = useQuery({ queryKey: ["assignable-settlements"], queryFn: () => settlementsFn() });

  const [settlement, setSettlement] = useState<string>("");
  const [runner, setRunner] = useState<string>("");

  const assign = useMutation({
    mutationFn: () => assignFn({ data: { settlement_id: settlement, runner_id: runner } }),
    onSuccess: () => {
      toast.success("Job assigned");
      setSettlement(""); setRunner("");
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["assignable-settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Bank runners</h1>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="font-semibold">Assign a settlement to a runner</div>
          <div className="grid sm:grid-cols-[2fr_2fr_auto] gap-3">
            <Select value={settlement} onValueChange={setSettlement}>
              <SelectTrigger><SelectValue placeholder="Pending settlement"/></SelectTrigger>
              <SelectContent>
                {(settlements.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.reference} · {formatNaira(Number(s.amount))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={runner} onValueChange={setRunner}>
              <SelectTrigger><SelectValue placeholder="Runner"/></SelectTrigger>
              <SelectContent>
                {(runners.data ?? []).map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name ?? r.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => assign.mutate()} disabled={!settlement || !runner || assign.isPending} className="bg-royal text-royal-foreground hover:opacity-90">
              {assign.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>}Assign
            </Button>
          </div>
          {(runners.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No runners yet — grant the <code className="font-mono">bank_runner</code> role under Users & roles.</p>}
          {(settlements.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No unassigned pending settlements available.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Job</th>
                <th className="text-left p-3">Settlement</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Runner</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Bank ref</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(jobs.data ?? []).map((j: any) => (
                <tr key={j.id}>
                  <td className="p-3 font-mono text-xs">{j.reference}</td>
                  <td className="p-3 font-mono text-xs">{j.settlement?.reference}</td>
                  <td className="p-3 text-right font-semibold">{formatNaira(Number(j.settlement?.amount ?? 0))}</td>
                  <td className="p-3">{j.runner?.full_name ?? j.runner?.email ?? "—"}</td>
                  <td className="p-3">{j.status === "deposited" ? <Badge className="bg-emerald text-white">Deposited</Badge> : <Badge variant="secondary">Assigned</Badge>}</td>
                  <td className="p-3 text-xs">{j.settlement?.bank_reference ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(jobs.data ?? []).length === 0 && <tr><td colSpan={7} className="p-5 text-center text-sm text-muted-foreground">No deposit jobs yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
