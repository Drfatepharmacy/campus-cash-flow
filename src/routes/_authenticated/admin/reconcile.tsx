import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { reconcileCsv } from "@/lib/settlements.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reconcile")({
  head: () => ({ meta: [{ title: "Reconcile — Admin" }] }),
  component: ReconcilePage,
});

function parseCsv(text: string): { reference: string; amount: number }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("ref") || first.includes("amount");
  const start = hasHeader ? 1 : 0;
  const out: { reference: string; amount: number }[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;
    const reference = parts[0];
    const amount = Number(parts[1].replace(/[₦,\s]/g, ""));
    if (!reference || Number.isNaN(amount)) continue;
    out.push({ reference, amount });
  }
  return out;
}

function ReconcilePage() {
  const fn = useServerFn(reconcileCsv);
  const [result, setResult] = useState<any>(null);

  const run = useMutation({
    mutationFn: (rows: any[]) => fn({ data: { rows } }),
    onSuccess: (r) => { setResult(r); toast.success(`Reconciled ${r.total} rows`); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length === 0) { toast.error("No rows parsed. Expect: reference,amount"); return; }
      run.mutate(rows);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reconciliation</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a bank statement CSV (columns: <span className="font-mono">reference,amount</span>) to match against transactions.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-royal text-royal-foreground text-sm font-medium">
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}
              Choose CSV
            </div>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={run.isPending}/>
            <span className="text-sm text-muted-foreground">Up to 5,000 rows</span>
          </label>
        </CardContent>
      </Card>

      {result && (
        <div className="grid md:grid-cols-3 gap-4">
          <Bucket title="Matched" tone="emerald" rows={result.matched}/>
          <Bucket title="Mismatched" tone="gold" rows={result.mismatched}/>
          <Bucket title="Missing" tone="destructive" rows={result.missing}/>
        </div>
      )}
    </div>
  );
}

function Bucket({ title, tone, rows }: { title: string; tone: "emerald" | "gold" | "destructive"; rows: any[] }) {
  const cls = tone === "emerald" ? "bg-emerald text-white" : tone === "gold" ? "bg-gold text-foreground" : "bg-destructive text-destructive-foreground";
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">{title}</h3>
          <Badge className={cls}>{rows.length}</Badge>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y text-sm">
          {rows.length === 0 && <div className="text-muted-foreground text-xs py-2">None</div>}
          {rows.map((r, i) => (
            <div key={i} className="py-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs truncate">{r.reference}</span>
              <span className="text-right">
                <div>{formatNaira(r.amount)}</div>
                {r.expected !== undefined && <div className="text-[10px] text-muted-foreground">exp {formatNaira(r.expected)}</div>}
                {r.status && <div className="text-[10px] text-muted-foreground">{r.status}</div>}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
