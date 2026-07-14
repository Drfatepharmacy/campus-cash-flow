import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkImportStudents } from "@/lib/students.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, XCircle, FileSpreadsheet, Download } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Bulk student import — Admin" }] }),
  component: StudentsImport,
});

const EXPECTED = ["email", "full_name", "matric_no", "phone", "faculty_id", "department_id", "level"] as const;

function normalizeRows(raw: any[]): any[] {
  return raw.map((r) => {
    const row: any = {};
    for (const key of Object.keys(r)) {
      const k = key.trim().toLowerCase().replace(/\s+/g, "_");
      row[k] = r[key];
    }
    const out: any = {};
    for (const col of EXPECTED) {
      let v = row[col];
      if (v === undefined || v === null || v === "") { out[col] = null; continue; }
      if (typeof v === "string") v = v.trim();
      out[col] = v;
    }
    if (out.email) out.email = String(out.email).toLowerCase();
    if (out.matric_no) out.matric_no = String(out.matric_no).toUpperCase().replace(/[\s/-]/g, "");
    if (out.level != null) out.level = Number(out.level);
    return out;
  }).filter((r) => r.email && r.full_name);
}

function StudentsImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const fn = useServerFn(bulkImportStudents);
  const mut = useMutation({
    mutationFn: (rows: any[]) => fn({ data: { rows } }),
    onSuccess: (r) => { setResult(r); toast.success(`Imported ${r.ok} of ${r.total}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
        const rows = normalizeRows(raw as any[]);
        if (!rows.length) { toast.error("No valid rows found. Required columns: email, full_name"); return; }
        setPreview(rows);
        toast.success(`Parsed ${rows.length} row${rows.length === 1 ? "" : "s"} from ${file.name}`);
      } catch (err: any) {
        toast.error(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { email: "student@example.edu.ng", full_name: "Jane Doe", matric_no: "PHA2006960", phone: "08000000000", faculty_id: "", department_id: "", level: 200 },
    ], { header: [...EXPECTED] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students-template.xlsx");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Bulk student import</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload an Excel file (.xlsx or .xls). Accounts are created and confirmed; students set passwords via "Forgot password" on first sign in.</p>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <div className="text-xs text-muted-foreground">
          Columns: <code>email, full_name, matric_no, phone, faculty_id, department_id, level</code>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer">
            <div className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-royal text-royal-foreground text-sm font-medium hover:opacity-90">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName ? "Choose different file" : "Choose Excel file"}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={onFile}
              disabled={mut.isPending}
            />
          </label>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1.5" />Download template
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName} · {preview.length} row{preview.length === 1 ? "" : "s"}</span>}
        </div>

        {preview.length > 0 && (
          <>
            <div className="overflow-x-auto border rounded-md max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>{EXPECTED.map((c) => <th key={c} className="text-left p-2">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {preview.slice(0, 20).map((r, i) => (
                    <tr key={i}>{EXPECTED.map((c) => <td key={c} className="p-2 whitespace-nowrap">{r[c] ?? "—"}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && <div className="p-2 text-center text-xs text-muted-foreground">…and {preview.length - 20} more</div>}
            </div>
            <Button onClick={() => mut.mutate(preview)} disabled={mut.isPending} className="bg-royal text-royal-foreground hover:opacity-90">
              <Upload className="h-4 w-4 mr-1.5" />{mut.isPending ? "Importing…" : `Import ${preview.length} student${preview.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
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
