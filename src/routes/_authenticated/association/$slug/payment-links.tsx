import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "@/lib/qr-browser";
import {
  listPaymentLinks, createPaymentLink, setPaymentLinkActive, recordOfflinePayment, uploadRoster, getLinkReport,
} from "@/lib/payment-links.functions";
import { nairaMinor } from "@/lib/payment-link-utils";
import { toUserMessage } from "@/lib/user-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Download, FileText, Link2, Plus, QrCode, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/payment-links")({
  head: () => ({ meta: [{ title: "Payment links — Association workspace | UniEgo" }, { name: "description", content: "Create public payment links and QR codes, record offline payments and track defaulters." }] }),
  component: PaymentLinksPage,
});

function PaymentLinksPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const load = useServerFn(listPaymentLinks);
  const q = useQuery({ queryKey: ["plinks", slug], queryFn: () => load({ data: { slug } }), retry: false });
  const [open, setOpen] = useState<string | null>(null);

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{toUserMessage(q.error)}</CardContent></Card>;
  const d = q.data!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Payment links</h2><p className="text-sm text-muted-foreground">Anyone with the link or QR code can pay — no sign-in needed.</p></div>
        {d.canManage && <CreateLink slug={slug} />}
      </div>
      {d.links.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No payment links yet.</CardContent></Card> : (
        <div className="grid gap-4">
          {d.links.map((l: any) => (
            <Card key={l.id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{l.title}</CardTitle>
                  <CardDescription>{(l.class_prices as any[]).map((c) => `${c.class}: ${nairaMinor(c.amount_minor)}`).join(" · ")}</CardDescription>
                  <p className="mt-1 text-sm">{l.paid_count} paid · {nairaMinor(l.paid_total_minor)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={l.active ? "default" : "secondary"}>{l.active ? "Open" : "Paused"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Close" : "Manage"}</Button>
                </div>
              </CardHeader>
              {open === l.id && <CardContent><LinkDetail slug={slug} linkId={l.id} canManage={d.canManage} /></CardContent>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateLink({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createPaymentLink);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prices, setPrices] = useState([{ class: "100", amount: "" }]);
  const m = useMutation({
    mutationFn: () => create({ data: { slug, title, description: desc || null, class_prices: prices.filter((p) => p.class.trim() && Number(p.amount) > 0).map((p) => ({ class: p.class.trim(), amount_minor: Math.round(Number(p.amount) * 100) })) } }),
    onSuccess: () => { toast.success("Payment link created"); setOpen(false); setTitle(""); setDesc(""); setPrices([{ class: "100", amount: "" }]); qc.invalidateQueries({ queryKey: ["plinks", slug] }); },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New payment link</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New payment link</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>What is being paid for</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2026 departmental dues" maxLength={120} /></div>
          <div className="space-y-1.5"><Label>Note for payers (optional)</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></div>
          <Label>Price for each class (₦)</Label>
          {prices.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input className="w-28" value={p.class} placeholder="Class" onChange={(e) => setPrices(prices.map((x, j) => j === i ? { ...x, class: e.target.value } : x))} />
              <Input type="number" min={1} value={p.amount} placeholder="Amount" onChange={(e) => setPrices(prices.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
              <Button size="icon" variant="ghost" disabled={prices.length === 1} onClick={() => setPrices(prices.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setPrices([...prices, { class: "", amount: "" }])}><Plus className="h-4 w-4 mr-1" />Add class</Button>
          <Button className="w-full" disabled={title.trim().length < 3 || m.isPending || !prices.some((p) => p.class.trim() && Number(p.amount) > 0)} onClick={() => m.mutate()}>Create link</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PAY_COLS = [{ key: "payer_name", label: "Name" }, { key: "matric_no", label: "Matric" }, { key: "class_label", label: "Class" }, { key: "amount", label: "Amount" }, { key: "how", label: "Method" }, { key: "date", label: "Date" }];
const DEF_COLS = [{ key: "full_name", label: "Name" }, { key: "matric_no", label: "Matric" }, { key: "class_label", label: "Class" }, { key: "state", label: "Status" }];

function LinkDetail({ slug, linkId, canManage }: { slug: string; linkId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getLinkReport);
  const toggle = useServerFn(setPaymentLinkActive);
  const q = useQuery({ queryKey: ["plreport", linkId], queryFn: () => load({ data: { slug, link_id: linkId } }), retry: false });
  const [qr, setQr] = useState("");
  const url = q.data ? `${window.location.origin}/p/${q.data.link.token}` : "";
  useEffect(() => { if (url) QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setQr); }, [url]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["plreport", linkId] }); qc.invalidateQueries({ queryKey: ["plinks", slug] }); };
  const t = useMutation({ mutationFn: (active: boolean) => toggle({ data: { slug, link_id: linkId, active } }), onSuccess: refresh, onError: (e) => toast.error(toUserMessage(e)) });

  if (q.isLoading) return <Skeleton className="h-40" />;
  if (q.error) return <p className="text-sm text-destructive">{toUserMessage(q.error)}</p>;
  const d = q.data!;
  const payRows = d.payments.map((p: any) => ({ ...p, amount: nairaMinor(Number(p.amount_minor)), how: p.source === "online" ? "Online" : `Offline (${String(p.offline_method ?? "").replace("_", " ")})`, date: p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "" }));
  const defRows = d.defaulters.map((r: any) => ({ ...r, state: "Unpaid" }));
  const rosterRows = d.roster.map((r: any) => ({ ...r, state: r.paid ? "Paid" : "Unpaid" }));
  const base = d.link.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const xlsx = async () => { const { downloadXlsx } = await import("@/lib/payment-link-export"); await downloadXlsx(`${base}-tracking.xlsx`, [{ name: "Paid", cols: PAY_COLS, rows: payRows }, { name: "Defaulters", cols: DEF_COLS, rows: defRows }, { name: "Full list", cols: DEF_COLS, rows: rosterRows }]); };
  const pdf = async () => { const { downloadPdf } = await import("@/lib/payment-link-export"); await downloadPdf(`${base}-tracking.pdf`, d.link.title, `${payRows.length} paid · ${defRows.length} unpaid on the student list · generated ${new Date().toLocaleString()}`, [{ heading: "Paid", cols: PAY_COLS, rows: payRows }, { heading: "Defaulters (unpaid)", cols: DEF_COLS, rows: defRows }]); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-6">
        {qr && <img src={qr} alt="Payment QR code" className="h-36 w-36 rounded-lg border bg-card p-1" />}
        <div className="flex-1 space-y-2 min-w-0">
          <p className="break-all font-mono text-xs">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4 mr-1" />Copy link</Button>
            {qr && <Button size="sm" variant="outline" asChild><a href={qr} download={`${base}-qr.png`}><QrCode className="h-4 w-4 mr-1" />Download QR</a></Button>}
            <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><Link2 className="h-4 w-4 mr-1" />Open</a></Button>
            {typeof navigator !== "undefined" && "share" in navigator && <Button size="sm" variant="outline" onClick={() => navigator.share({ title: d.link.title, url }).catch(() => {})}>Share</Button>}
            {canManage && <Button size="sm" variant="ghost" onClick={() => t.mutate(!d.link.active)}>{d.link.active ? "Pause" : "Resume"}</Button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canManage && <OfflineDialog slug={slug} linkId={linkId} classes={d.link.class_prices.map((c) => c.class)} onDone={refresh} />}
        {canManage && <RosterDialog slug={slug} linkId={linkId} onDone={refresh} />}
        <Button size="sm" variant="outline" onClick={xlsx}><Download className="h-4 w-4 mr-1" />Tracking spreadsheet</Button>
        <Button size="sm" variant="outline" onClick={pdf}><FileText className="h-4 w-4 mr-1" />Tracking PDF</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Paid ({payRows.length})</h3>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {payRows.map((p: any) => <li key={p.reference} className="flex justify-between gap-2 border-b py-1"><span className="truncate">{p.payer_name} <span className="text-xs text-muted-foreground">{p.matric_no} · {p.class_label}</span></span><span className="text-xs text-muted-foreground shrink-0">{p.how}</span></li>)}
            {payRows.length === 0 && <li className="text-muted-foreground">No payments yet.</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Defaulters ({defRows.length}{d.roster.length ? ` of ${d.roster.length}` : ""})</h3>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {d.roster.length === 0 ? <li className="text-muted-foreground">Upload a student list to see who hasn't paid.</li>
              : defRows.map((r: any) => <li key={r.matric_no} className="border-b py-1">{r.full_name ?? "—"} <span className="text-xs text-muted-foreground">{r.matric_no}{r.class_label ? ` · ${r.class_label}` : ""}</span></li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OfflineDialog({ slug, linkId, classes, onDone }: { slug: string; linkId: string; classes: string[]; onDone: () => void }) {
  const rec = useServerFn(recordOfflinePayment);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ payer_name: "", matric_no: "", class_label: "", method: "bank_transfer" as "cash" | "bank_transfer" | "pos" | "other", note: "" });
  const m = useMutation({
    mutationFn: () => rec({ data: { slug, link_id: linkId, ...f, note: f.note || null } }),
    onSuccess: () => { toast.success("Payment recorded"); setOpen(false); setF({ ...f, payer_name: "", matric_no: "", note: "" }); onDone(); },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Record offline payment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record an offline payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Full name" value={f.payer_name} onChange={(e) => setF({ ...f, payer_name: e.target.value })} />
          <Input placeholder="Matric number" value={f.matric_no} onChange={(e) => setF({ ...f, matric_no: e.target.value.toUpperCase() })} />
          <Select value={f.class_label} onValueChange={(v) => setF({ ...f, class_label: v })}><SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger><SelectContent>{classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="pos">POS</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
          <Input placeholder="Note, e.g. transfer reference (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} />
          <Button className="w-full" disabled={m.isPending || f.payer_name.trim().length < 3 || f.matric_no.trim().length < 4 || !f.class_label} onClick={() => m.mutate()}>Save — counts immediately</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const pick = (row: Record<string, any>, names: string[]) => {
  const k = Object.keys(row).find((h) => names.includes(h.toLowerCase().replace(/[^a-z]/g, "")));
  return k ? String(row[k] ?? "").trim() : "";
};

function RosterDialog({ slug, linkId, onDone }: { slug: string; linkId: string; onDone: () => void }) {
  const up = useServerFn(uploadRoster);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ matric_no: string; full_name: string; class_label: string }[]>([]);
  const [replace, setReplace] = useState(false);
  const onFile = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
    const parsed = json.map((r) => ({
      matric_no: pick(r, ["matric", "matricno", "matricnumber", "regno", "registrationnumber", "matno"]),
      full_name: pick(r, ["name", "fullname", "studentname", "names"]),
      class_label: pick(r, ["class", "level", "classlevel", "year"]),
    })).filter((r) => r.matric_no.length >= 4);
    if (!parsed.length) toast.error("No matric numbers found. Make sure a column is called 'Matric'.");
    setRows(parsed);
  };
  const m = useMutation({
    mutationFn: () => up({ data: { slug, link_id: linkId, replace, rows } }),
    onSuccess: (r) => { toast.success(`${r.saved} students saved`); setOpen(false); setRows([]); onDone(); },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" />Upload student list</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload class list</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Excel or CSV with a Matric column. Name and Class columns are optional.</p>
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {rows.length > 0 && <p className="text-sm">{rows.length} students found, e.g. {rows.slice(0, 3).map((r) => r.matric_no).join(", ")}</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace the existing list</label>
        <Button disabled={!rows.length || m.isPending} onClick={() => m.mutate()}>Save list</Button>
      </DialogContent>
    </Dialog>
  );
}
