import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMyDepositJobs, completeDepositJob } from "@/lib/runner.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { Loader2, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/runner/")({
  head: () => ({ meta: [{ title: "My deposit jobs — UniPay NG" }] }),
  component: RunnerJobs,
});

function RunnerJobs() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyDepositJobs);
  const completeFn = useServerFn(completeDepositJob);
  const jobs = useQuery({ queryKey: ["my-jobs"], queryFn: () => listFn() });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Bank runner</div>
        <h1 className="font-display text-3xl font-bold mt-1">Deposit jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">Take settlement batches to the bank, capture the deposit reference, mark complete.</p>
      </div>

      {jobs.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>}
      {!jobs.isLoading && (jobs.data ?? []).length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No deposit jobs assigned to you yet.</CardContent></Card>
      )}

      <div className="space-y-4">
        {(jobs.data ?? []).map((j: any) => (
          <JobCard key={j.id} j={j} onComplete={async (bank_reference, notes) => {
            try { await completeFn({ data: { job_id: j.id, bank_reference, notes } }); toast.success("Deposit confirmed"); qc.invalidateQueries({ queryKey: ["my-jobs"] }); }
            catch (e: any) { toast.error(e.message); }
          }}/>
        ))}
      </div>
    </div>
  );
}

function JobCard({ j, onComplete }: { j: any; onComplete: (ref: string, notes: string | null) => Promise<void> }) {
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const done = j.status === "deposited";
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald/10 grid place-items-center"><Banknote className="h-5 w-5 text-emerald"/></div>
          <div className="flex-1">
            <div className="font-display font-semibold">{j.settlement?.reference}</div>
            <div className="text-xs text-muted-foreground font-mono">{j.reference}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">{formatNaira(Number(j.settlement?.amount ?? 0))}</div>
            {done
              ? <Badge className="bg-emerald text-white mt-1">Deposited</Badge>
              : <Badge variant="secondary" className="mt-1">Assigned</Badge>}
          </div>
        </div>
        {done && j.settlement?.bank_reference && (
          <div className="text-xs text-muted-foreground">Bank ref: <span className="font-mono">{j.settlement.bank_reference}</span> · {j.settlement.settled_at && new Date(j.settlement.settled_at).toLocaleString()}</div>
        )}
        {!done && (
          <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-center pt-2 border-t">
            <Input placeholder="Bank deposit ref" value={ref} onChange={(e) => setRef(e.target.value)} />
            <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button disabled={!ref || busy} onClick={async () => { setBusy(true); await onComplete(ref, notes || null); setBusy(false); setRef(""); setNotes(""); }} className="bg-royal text-royal-foreground hover:opacity-90">
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>}Mark deposited
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
