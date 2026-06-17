import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkImportStudents } from "@/lib/students.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Bulk student import — Admin" }] }),
  component: StudentsImport,
});

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: any = {};
    header.forEach((h, i) => { row[h] = cells[i] === "" ? null : cells[i]; });
    if (row.level) row.level = Number(row.level);
    return row;
  });
}

function StudentsImport() {
  const [csv, setCsv] = useState("email,full_name,matric_no,phone,faculty_id,department_id,level\n");
  const [result, setResult] = useState<any>(null);
  const fn = useServerFn(bulkImportStudents);
  const mut = useMutation({
    mutationFn: (rows: any[]) => fn({ data: { rows } }),
    onSuccess: (r) => { setResult(r); toast.success(`Imported ${r.ok} of ${r.total}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onImport() {
    try {
      const rows = parseCsv(csv);
      if (!rows.length) return toast.error("CSV has no data rows");
      mut.mutate(rows);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Bulk student import</h1>
        <p className="text-sm text-muted-foreground mt-1">Paste CSV with header row. Accounts are created and confirmed; students set passwords via "Forgot password" on first sign in.</p>
      </div>

      <Card><CardContent className="p-5 space-y-3">
        <div className="text-xs text-muted-foreground">Columns: <code>email,full_name,matric_no,phone,faculty_id,department_id,level</code></div>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs h-64" />
        <Button onClick={onImport} disabled={mut.isPending} className="bg-royal text-royal-foreground hover:opacity-90">
          <Upload className="h-4 w-4 mr-1.5"/>{mut.isPending ? "Importing…" : "Import"}
        </Button>
      </CardContent></Card>

      {result && (
        <Card><CardContent className="p-0 overflow-x-auto">
          <div className="p-4 flex items-center gap-3">
            <Badge className="bg-emerald text-white">{result.ok} ok</Badge>
            <Badge variant="destructive">{result.total - result.ok} failed</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Email</th><th className="text-left p-3">Status</th><th className="text-left p-3">Detail</th></tr>
            </thead>
            <tbody className="divide-y">
              {result.results.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="p-3 text-xs">{r.email}</td>
                  <td className="p-3">{r.ok ? <span className="inline-flex items-center gap-1 text-emerald text-xs"><CheckCircle2 className="h-3.5 w-3.5"/>Created</span> : <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle className="h-3.5 w-3.5"/>Failed</span>}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
