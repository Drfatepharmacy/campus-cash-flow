import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkImportStudents } from "@/lib/students.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, XCircle, FileSpreadsheet, Download } from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Bulk student import — Admin" }] }),
  component: StudentsImport,
});

type FieldKey =
  | "email"
  | "full_name"
  | "matric_no"
  | "phone"
  | "faculty_id"
  | "department_id"
  | "level";

const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "email", label: "Email" },
  { key: "full_name", label: "Full name" },
  { key: "matric_no", label: "Matric no" },
  { key: "phone", label: "Phone" },
  { key: "faculty_id", label: "Faculty ID" },
  { key: "department_id", label: "Department ID" },
  { key: "level", label: "Level" },
];

// Header aliases — any of these (case/space/underscore/hyphen-insensitive) auto-map to the field.
const ALIASES: Record<FieldKey, string[]> = {
  email: ["email", "e-mail", "emailaddress", "mail", "student email", "school email"],
  full_name: [
    "full_name", "fullname", "name", "student name", "student", "surname firstname",
    "first name last name", "names",
  ],
  matric_no: [
    "matric_no", "matric", "matricno", "matric number", "matric no", "matriculation",
    "matriculation number", "reg no", "registration number", "student id", "id",
  ],
  phone: ["phone", "phone number", "mobile", "mobile number", "tel", "telephone", "contact"],
  faculty_id: ["faculty_id", "faculty", "faculty id", "faculty uuid"],
  department_id: ["department_id", "department", "dept", "department id", "department uuid"],
  level: ["level", "class", "year", "year of study", "current level"],
};

function normKey(s: string) {
  return String(s).toLowerCase().replace(/[\s_\-./]+/g, "").trim();
}

function autoDetect(headers: string[]): Partial<Record<FieldKey, string>> {
  const map: Partial<Record<FieldKey, string>> = {};
  const used = new Set<string>();
  const normHeaders = headers.map((h) => ({ raw: h, norm: normKey(h) }));
  for (const field of FIELDS) {
    const aliasSet = new Set(ALIASES[field.key].map(normKey));
    const hit = normHeaders.find((h) => !used.has(h.raw) && aliasSet.has(h.norm));
    if (hit) {
      map[field.key] = hit.raw;
      used.add(hit.raw);
    }
  }
  return map;
}

function applyMapping(
  raw: any[],
  mapping: Partial<Record<FieldKey, string>>,
): any[] {
  return raw
    .map((r) => {
      const out: any = {};
      for (const f of FIELDS) {
        const src = mapping[f.key];
        let v = src ? r[src] : null;
        if (v === undefined || v === "") v = null;
        if (typeof v === "string") v = v.trim();
        out[f.key] = v;
      }
      if (out.email) out.email = String(out.email).toLowerCase();
      if (out.matric_no)
        out.matric_no = String(out.matric_no).toUpperCase().replace(/[\s/-]/g, "");
      if (out.level != null && out.level !== "") {
        const n = Number(out.level);
        out.level = Number.isFinite(n) ? n : null;
      } else out.level = null;
      return out;
    })
    // Keep a row if it has any identifier (email OR matric)
    .filter((r) => r.email || r.matric_no);
}

function StudentsImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [result, setResult] = useState<any>(null);
  const fn = useServerFn(bulkImportStudents);

  const preview = useMemo(() => applyMapping(rawRows, mapping), [rawRows, mapping]);

  const mut = useMutation({
    mutationFn: (rows: any[]) => fn({ data: { rows } }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Imported ${r.ok} of ${r.total}`);
    },
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
        const raw = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[];
        if (!raw.length) {
          toast.error("Sheet appears to be empty");
          return;
        }
        // Collect the union of headers across rows (some rows may miss columns)
        const headerSet = new Set<string>();
        for (const r of raw) for (const k of Object.keys(r)) headerSet.add(k);
        const hdrs = Array.from(headerSet);
        const detected = autoDetect(hdrs);
        setHeaders(hdrs);
        setRawRows(raw);
        setMapping(detected);
        const matched = Object.keys(detected).length;
        toast.success(
          `Parsed ${raw.length} row${raw.length === 1 ? "" : "s"} · auto-mapped ${matched}/${FIELDS.length} columns`,
        );
      } catch (err: any) {
        toast.error(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(
      [
        {
          email: "student@example.edu.ng",
          full_name: "Jane Doe",
          matric_no: "PHA2006960",
          phone: "08000000000",
          faculty_id: "",
          department_id: "",
          level: 200,
        },
      ],
      { header: FIELDS.map((f) => f.key) },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students-template.xlsx");
  }

  const hasIdentifier = !!(mapping.email || mapping.matric_no);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Bulk student import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an Excel file (.xlsx or .xls). Column headers are auto-detected — review the
          mapping below and adjust if needed. Rows only need an <strong>email</strong> or a{" "}
          <strong>matric number</strong>; missing fields are filled in automatically.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
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
              <Download className="h-4 w-4 mr-1.5" />
              Download template
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground">
                {fileName} · {preview.length} row{preview.length === 1 ? "" : "s"} ready
              </span>
            )}
          </div>

          {headers.length > 0 && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="text-sm font-medium">Column mapping</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="text-xs space-y-1 block">
                    <span className="text-muted-foreground">{f.label}</span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                      }
                      className="w-full h-9 px-2 rounded-md border bg-background text-sm"
                    >
                      <option value="">— Not in file —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {!hasIdentifier && (
                <div className="text-xs text-destructive">
                  Map either <strong>Email</strong> or <strong>Matric no</strong> to continue.
                </div>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div className="overflow-x-auto border rounded-md max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 uppercase tracking-wider text-muted-foreground sticky top-0">
                    <tr>
                      {FIELDS.map((f) => (
                        <th key={f.key} className="text-left p-2">
                          {f.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        {FIELDS.map((f) => (
                          <td key={f.key} className="p-2 whitespace-nowrap">
                            {r[f.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    …and {preview.length - 20} more
                  </div>
                )}
              </div>
              <Button
                onClick={() => mut.mutate(preview)}
                disabled={mut.isPending || !hasIdentifier}
                className="bg-royal text-royal-foreground hover:opacity-90"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {mut.isPending
                  ? "Importing…"
                  : `Import ${preview.length} student${preview.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="p-4 flex items-center gap-3">
              <Badge className="bg-emerald text-white">{result.ok} ok</Badge>
              <Badge variant="destructive">{result.total - result.ok} failed</Badge>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.results.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="p-3 text-xs">{r.email}</td>
                    <td className="p-3">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Created
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs">
                          <XCircle className="h-3.5 w-3.5" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
