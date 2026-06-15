import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSettlements, getUnsettledStats, createSettlement, completeSettlement } from "@/lib/settlements.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { Loader2, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settlements")({
  head: () => ({ meta: [{ title: "Settlements — Admin" }] }),
  component: SettlementsPage,
});

function SettlementsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSettlements);
  const statsFn = useServerFn(getUnsettledStats);
  const createFn = useServerFn(createSettlement);
  const completeFn = useServerFn(completeSettlement);

  const settlements = useQuery({ queryKey: ["settlements"], queryFn: () => listFn() });
  const stats = useQuery({ queryKey: ["unsettled"], queryFn: () => statsFn() });

  const create = useMutation({
    mutationFn: () => createFn({ data: { notes: null, department_id: null } }),
    onSuccess: (r) => { toast.success(`Batch ${r.reference} created (${r.count} txns)`); qc.invalidateQueries({ queryKey: ["settlements"] }); qc.invalidateQueries({ queryKey: ["unsettled"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Settlements</h1>

      <Card>
        <CardContent className="p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald/10 grid place-items-center"><Banknote className="h-5 w-5 text-emerald"/></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Unsettled paid</div>
              <div className="font-display text-2xl font-bold">{stats.data ? formatNaira(stats.data.net) : "—"}</div>
              <div className="text-xs text-muted-foreground">{stats.data?.count ?? 0} txns · charges {stats.data ? formatNaira(stats.data.charges) : "—"}</div>
            </div>
          </div>
          <div className="flex-1"/>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !stats.data || stats.data.count === 0} className="bg-royal text-royal-foreground hover:opacity-90">
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>}
            Create settlement batch
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Reference</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Bank ref</th>
                <th className="text-left p-3">Created</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(settlements.data ?? []).map((s: any) => (
                <Row key={s.id} s={s} onComplete={async (bank_reference) => {
                  try { await completeFn({ data: { id: s.id, bank_reference } }); toast.success("Settlement completed"); qc.invalidateQueries({ queryKey: ["settlements"] }); }
                  catch (e: any) { toast.error(e.message); }
                }}/>
              ))}
              {(settlements.data ?? []).length === 0 && <tr><td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">No settlements yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ s, onComplete }: { s: any; onComplete: (ref: string) => void | Promise<void> }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <tr>
      <td className="p-3 font-mono text-xs">{s.reference}</td>
      <td className="p-3 text-right font-semibold">{formatNaira(Number(s.amount))}</td>
      <td className="p-3">
        {s.status === "deposited" ? <Badge className="bg-emerald text-white">Settled</Badge> : <Badge variant="secondary">Pending</Badge>}
      </td>
      <td className="p-3 text-xs">{s.bank_reference ?? "—"}</td>
      <td className="p-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
      <td className="p-3 text-right">
        {s.status !== "deposited" && (
          <div className="flex items-center gap-2 justify-end">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank ref" className="h-8 w-36"/>
            <Button size="sm" variant="outline" disabled={!ref || busy} onClick={async () => { setBusy(true); await onComplete(ref); setBusy(false); setRef(""); }}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin"/>}Mark settled
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
