import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import {
  createQrCode, listQrCodes, updateQrCode, softDeleteQrCode, restoreQrCode,
  duplicateQrCode, qrAnalytics, qrScanHistory,
} from "@/lib/qr.functions";
import type { QrPayload, QrType } from "@/lib/qr-encoder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  QrCode, Download, Copy, Archive, Trash2, RotateCcw, Ban, Search, Plus,
  ImageIcon, FileText as FileTextIcon, Filter, TrendingUp, ShieldCheck, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/qr-codes")({
  head: () => ({ meta: [{ title: "QR Codes — UniPay NG" }] }),
  component: QrAdmin,
});

type QrRow = {
  id: string; token: string; label: string; description: string | null; type: QrType;
  encoded_value: string; status: "active" | "revoked" | "archived"; scan_count: number;
  max_scans: number | null; single_use: boolean; expires_at: string | null;
  deleted_at: string | null; created_at: string;
  style: { size?: number; margin?: number; fg?: string; bg?: string; ecl?: "L"|"M"|"Q"|"H" };
};

const TYPES: { value: QrType; label: string }[] = [
  { value: "url", label: "URL" }, { value: "text", label: "Plain text" },
  { value: "email", label: "Email" }, { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" }, { value: "wifi", label: "Wi-Fi" },
  { value: "vcard", label: "Contact (vCard)" }, { value: "location", label: "Location" },
  { value: "event", label: "Event" }, { value: "payment", label: "Payment link" },
  { value: "custom", label: "Custom data" },
];

function QrAdmin() {
  const [tab, setTab] = useState("dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">QR Codes</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate, verify, manage and audit every QR code issued by your workspace.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-2"/>Dashboard</TabsTrigger>
          <TabsTrigger value="generate"><Plus className="h-4 w-4 mr-2"/>Generate</TabsTrigger>
          <TabsTrigger value="manage"><QrCode className="h-4 w-4 mr-2"/>Manage</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2"/>Scan history</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6"><Dashboard/></TabsContent>
        <TabsContent value="generate" className="mt-6"><Generator/></TabsContent>
        <TabsContent value="manage" className="mt-6"><Manager/></TabsContent>
        <TabsContent value="history" className="mt-6"><History/></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard() {
  const fn = useServerFn(qrAnalytics);
  const q = useQuery({ queryKey: ["qr-analytics"], queryFn: () => fn() });
  const s = q.data;

  if (q.isLoading) return <SkeletonGrid n={5}/>;
  if (!s) return <Empty title="No analytics yet" hint="Generate your first QR code to start collecting stats."/>;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Total QR codes" value={s.total} accent="text-royal"/>
        <Stat label="Active" value={s.active} accent="text-emerald"/>
        <Stat label="Expired" value={s.expired} accent="text-amber-600"/>
        <Stat label="Revoked" value={s.revoked} accent="text-destructive"/>
        <Stat label="Total scans" value={s.total_scans} accent="text-gold"/>
      </div>
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Verification success</div>
            <div className="mt-1 font-display text-2xl font-bold">{s.success_rate}%</div>
          </div>
          <ShieldCheck className="h-8 w-8 text-emerald"/>
        </div>
        <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-emerald" style={{ width: `${s.success_rate}%` }}/>
        </div>
      </CardContent></Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-sm font-semibold mb-3">Scans (last 30 days)</div>
          {s.daily.length === 0 ? <div className="text-sm text-muted-foreground">No scans yet.</div> : (
            <div className="flex items-end gap-1 h-32">
              {s.daily.map(([day, n]) => {
                const max = Math.max(...s.daily.map(d => d[1] as number));
                const h = max ? Math.max(4, ((n as number) / max) * 100) : 4;
                return <div key={day as string} className="flex-1 bg-royal/70 rounded-t" style={{ height: `${h}%` }} title={`${day}: ${n}`}/>;
              })}
            </div>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-sm font-semibold mb-3">Top QR codes</div>
          {s.top.length === 0 ? <div className="text-sm text-muted-foreground">Nothing scanned yet.</div> : (
            <ul className="space-y-2 text-sm">
              {s.top.map(t => (
                <li key={t.id} className="flex items-center justify-between border-b last:border-0 py-2">
                  <span className="truncate">{t.label}</span>
                  <span className="font-mono text-muted-foreground">{t.scan_count} scans</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}

/* ---------------- Generator ---------------- */

function Generator() {
  const qc = useQueryClient();
  const create = useServerFn(createQrCode);
  const [type, setType] = useState<QrType>("url");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [style, setStyle] = useState({ size: 512, margin: 4, fg: "#0F1230", bg: "#FFFFFF", ecl: "M" as "L"|"M"|"Q"|"H" });
  const [singleUse, setSingleUse] = useState(false);
  const [maxScans, setMaxScans] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [batch, setBatch] = useState<string>("");

  const buildPayload = (): QrPayload => {
    const p = payload as Record<string, string>;
    switch (type) {
      case "url": return { type, url: p.url ?? "" };
      case "text": return { type, text: p.text ?? "" };
      case "email": return { type, to: p.to ?? "", subject: p.subject, body: p.body };
      case "phone": return { type, number: p.number ?? "" };
      case "sms": return { type, number: p.number ?? "", message: p.message };
      case "wifi": return { type, ssid: p.ssid ?? "", password: p.password, encryption: (p.encryption as "WPA"|"WEP"|"nopass") ?? "WPA", hidden: p.hidden === "true" };
      case "vcard": return { type, firstName: p.firstName ?? "", lastName: p.lastName, org: p.org, title: p.title, phone: p.phone, email: p.email, url: p.url, address: p.address };
      case "location": return { type, latitude: Number(p.latitude ?? 0), longitude: Number(p.longitude ?? 0), label: p.label };
      case "event": return { type, title: p.title ?? "", start: p.start ?? "", end: p.end, location: p.location, description: p.description };
      case "payment": return { type, url: p.url ?? "", amount: p.amount ? Number(p.amount) : undefined, reference: p.reference };
      case "custom": return { type, value: p.value ?? "" };
    }
  };

  const previewIt = async () => {
    try {
      const { encodePayload } = await import("@/lib/qr-encoder");
      const value = encodePayload(buildPayload());
      const url = await QRCode.toDataURL(value, { width: style.size, margin: style.margin, color: { dark: style.fg, light: style.bg }, errorCorrectionLevel: style.ecl });
      setPreview(url);
    } catch (e) { toast.error((e as Error).message); }
  };

  const mut = useMutation({
    mutationFn: async () => create({ data: {
      label, description: description || undefined, payload: buildPayload(), style,
      single_use: singleUse, max_scans: maxScans ? Number(maxScans) : null,
      expires_at: expiresAt || null,
    }}),
    onSuccess: () => { toast.success("QR code created"); qc.invalidateQueries({ queryKey: ["qr-codes"] }); qc.invalidateQueries({ queryKey: ["qr-analytics"] }); setLabel(""); setPayload({}); setPreview(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const batchGenerate = async () => {
    const lines = batch.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error("Paste one URL/value per line"); return; }
    let ok = 0, fail = 0;
    for (const line of lines) {
      try {
        const payload: QrPayload = type === "url" ? { type: "url", url: line } : { type: "text", text: line };
        await create({ data: { label: line.slice(0, 60), payload, style, single_use: false, max_scans: null, expires_at: null } });
        ok++;
      } catch { fail++; }
    }
    toast.success(`Batch complete — ${ok} created, ${fail} failed`);
    qc.invalidateQueries({ queryKey: ["qr-codes"] });
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <Card><CardContent className="p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Freshers welcome poster" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v as QrType); setPayload({}); setPreview(""); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}/>
        </div>

        <TypeFields type={type} payload={payload} setPayload={setPayload}/>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label>Foreground</Label><Input type="color" value={style.fg} onChange={e => setStyle(s => ({...s, fg: e.target.value}))}/></div>
          <div><Label>Background</Label><Input type="color" value={style.bg} onChange={e => setStyle(s => ({...s, bg: e.target.value}))}/></div>
          <div><Label>Size (px)</Label><Input type="number" min={64} max={2048} value={style.size} onChange={e => setStyle(s => ({...s, size: Number(e.target.value)}))}/></div>
          <div><Label>Margin</Label><Input type="number" min={0} max={16} value={style.margin} onChange={e => setStyle(s => ({...s, margin: Number(e.target.value)}))}/></div>
          <div className="sm:col-span-2">
            <Label>Error correction level</Label>
            <Select value={style.ecl} onValueChange={(v) => setStyle(s => ({...s, ecl: v as "L"|"M"|"Q"|"H"}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Low (7%)</SelectItem>
                <SelectItem value="M">Medium (15%)</SelectItem>
                <SelectItem value="Q">Quartile (25%)</SelectItem>
                <SelectItem value="H">High (30%) — best with logos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-2 gap-3">
            <div>
              <Label>Expires at (optional)</Label>
              <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}/>
            </div>
            <div>
              <Label>Max scans (optional)</Label>
              <Input type="number" min={1} value={maxScans} onChange={e => setMaxScans(e.target.value)}/>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={singleUse} onChange={e => setSingleUse(e.target.checked)}/>
          Single-use (invalidate after first successful scan)
        </label>

        <div className="flex gap-2">
          <Button variant="outline" onClick={previewIt}>Preview</Button>
          <Button className="bg-royal text-royal-foreground hover:opacity-90" onClick={() => mut.mutate()} disabled={mut.isPending || !label}>
            {mut.isPending ? "Creating…" : "Create QR code"}
          </Button>
        </div>

        <div className="pt-6 border-t">
          <Label>Batch generate (one URL or line per row)</Label>
          <Textarea value={batch} onChange={e => setBatch(e.target.value)} rows={4} placeholder="https://example.com/a&#10;https://example.com/b"/>
          <Button variant="outline" className="mt-2" onClick={batchGenerate}>Batch create as {type === "url" ? "URLs" : "text"}</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <div className="text-sm font-semibold mb-3">Live preview</div>
        <div className="aspect-square rounded-xl border bg-secondary/40 grid place-items-center overflow-hidden">
          {preview ? <img src={preview} alt="QR preview" className="w-full h-full object-contain"/> : <QrCode className="h-16 w-16 text-muted-foreground"/>}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Preview updates when you click Preview. Higher error correction lets scanners read QRs with a logo or partial damage.</p>
      </CardContent></Card>
    </div>
  );
}

function TypeFields({ type, payload, setPayload }: { type: QrType; payload: Record<string, unknown>; setPayload: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => setPayload({ ...payload, [k]: v });
  const F = ({ k, label, ...rest }: { k: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div><Label>{label}</Label><Input value={(payload[k] as string) ?? ""} onChange={e => set(k, e.target.value)} {...rest}/></div>
  );
  switch (type) {
    case "url": return <div className="grid gap-3"><F k="url" label="URL" placeholder="https://…"/></div>;
    case "text": return <div><Label>Text</Label><Textarea rows={3} value={(payload.text as string) ?? ""} onChange={e => set("text", e.target.value)}/></div>;
    case "email": return <div className="grid gap-3 sm:grid-cols-2"><F k="to" label="Email address"/><F k="subject" label="Subject"/><div className="sm:col-span-2"><Label>Body</Label><Textarea value={(payload.body as string) ?? ""} onChange={e => set("body", e.target.value)}/></div></div>;
    case "phone": return <F k="number" label="Phone number" placeholder="+234…"/>;
    case "sms": return <div className="grid gap-3"><F k="number" label="Phone number"/><div><Label>Message</Label><Textarea value={(payload.message as string) ?? ""} onChange={e => set("message", e.target.value)}/></div></div>;
    case "wifi": return (
      <div className="grid gap-3 sm:grid-cols-2">
        <F k="ssid" label="Network name (SSID)"/>
        <F k="password" label="Password" type="text"/>
        <div>
          <Label>Encryption</Label>
          <Select value={(payload.encryption as string) ?? "WPA"} onValueChange={(v) => set("encryption", v)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">Open</SelectItem></SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={payload.hidden === "true"} onChange={e => set("hidden", e.target.checked ? "true" : "")}/>Hidden network</label>
      </div>
    );
    case "vcard": return (
      <div className="grid gap-3 sm:grid-cols-2">
        <F k="firstName" label="First name"/><F k="lastName" label="Last name"/>
        <F k="org" label="Organisation"/><F k="title" label="Title"/>
        <F k="phone" label="Phone"/><F k="email" label="Email"/>
        <F k="url" label="Website"/><F k="address" label="Address"/>
      </div>
    );
    case "location": return <div className="grid gap-3 sm:grid-cols-3"><F k="latitude" label="Latitude"/><F k="longitude" label="Longitude"/><F k="label" label="Label"/></div>;
    case "event": return <div className="grid gap-3 sm:grid-cols-2"><F k="title" label="Title"/><F k="location" label="Location"/><F k="start" label="Starts" type="datetime-local"/><F k="end" label="Ends" type="datetime-local"/><div className="sm:col-span-2"><Label>Description</Label><Textarea value={(payload.description as string) ?? ""} onChange={e => set("description", e.target.value)}/></div></div>;
    case "payment": return <div className="grid gap-3 sm:grid-cols-3"><div className="sm:col-span-3"><Label>Payment URL</Label><Input value={(payload.url as string) ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://…"/></div><F k="amount" label="Amount" type="number"/><F k="reference" label="Reference"/></div>;
    case "custom": return <div><Label>Custom data</Label><Textarea rows={3} value={(payload.value as string) ?? ""} onChange={e => set("value", e.target.value)}/></div>;
  }
}

/* ---------------- Manager ---------------- */

function Manager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listQrCodes);
  const update = useServerFn(updateQrCode);
  const del = useServerFn(softDeleteQrCode);
  const restore = useServerFn(restoreQrCode);
  const dup = useServerFn(duplicateQrCode);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all"|"active"|"revoked"|"archived">("all");
  const [sort, setSort] = useState<"created_desc"|"created_asc"|"scans_desc"|"label_asc">("created_desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [detail, setDetail] = useState<QrRow | null>(null);

  const q = useQuery({
    queryKey: ["qr-codes", search, status, sort, includeDeleted],
    queryFn: () => listFn({ data: { q: search || undefined, status, sort, includeDeleted } }) as Promise<QrRow[]>,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["qr-codes"] }); qc.invalidateQueries({ queryKey: ["qr-analytics"] }); };

  const exportCsv = () => {
    const rows = q.data ?? [];
    const header = ["token","label","type","status","scans","max_scans","expires_at","created_at","encoded_value"];
    const csv = [header.join(","), ...rows.map(r => [r.token, r.label, r.type, r.status, r.scan_count, r.max_scans ?? "", r.expires_at ?? "", r.created_at, JSON.stringify(r.encoded_value)].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "qr-codes.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search label</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder="Search…"/>
          </div>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="revoked">Revoked</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[180px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="created_asc">Oldest first</SelectItem>
              <SelectItem value="scans_desc">Most scanned</SelectItem>
              <SelectItem value="label_asc">Label A→Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDeleted} onChange={e => setIncludeDeleted(e.target.checked)}/>
          Show deleted
        </label>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
      </CardContent></Card>

      {q.isLoading ? <SkeletonGrid n={6}/> : (q.data ?? []).length === 0 ? (
        <Empty title="No QR codes match" hint="Try changing filters or generate a new one." icon={<Filter className="h-8 w-8"/>}/>
      ) : (
        <div className="grid gap-3">
          {(q.data ?? []).map((r) => (
            <Card key={r.id} className={r.deleted_at ? "opacity-60" : ""}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <MiniQr value={r.encoded_value} style={r.style}/>
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{r.label}</div>
                    <StatusBadge row={r}/>
                    <Badge variant="secondary">{r.type}</Badge>
                    {r.single_use && <Badge variant="outline">single-use</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate max-w-lg">{r.encoded_value}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.scan_count} scans{r.max_scans ? ` / ${r.max_scans}` : ""} · token <code>{r.token}</code>
                    {r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setDetail(r)}><ImageIcon className="h-4 w-4"/></Button>
                  <Button size="sm" variant="outline" onClick={async () => { await dup({ data: { id: r.id }}); invalidate(); toast.success("Duplicated"); }}><Copy className="h-4 w-4"/></Button>
                  {r.status !== "revoked" ? (
                    <Button size="sm" variant="outline" onClick={async () => { await update({ data: { id: r.id, status: "revoked" }}); invalidate(); toast.success("Revoked"); }}><Ban className="h-4 w-4"/></Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={async () => { await update({ data: { id: r.id, status: "active" }}); invalidate(); toast.success("Reactivated"); }}><RotateCcw className="h-4 w-4"/></Button>
                  )}
                  {r.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={async () => { await update({ data: { id: r.id, status: "archived" }}); invalidate(); toast.success("Archived"); }}><Archive className="h-4 w-4"/></Button>
                  )}
                  {r.deleted_at ? (
                    <Button size="sm" variant="outline" onClick={async () => { await restore({ data: { id: r.id }}); invalidate(); toast.success("Restored"); }}><RotateCcw className="h-4 w-4"/></Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={async () => { if (!confirm("Delete this QR code? It can be restored.")) return; await del({ data: { id: r.id }}); invalidate(); }}><Trash2 className="h-4 w-4"/></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DetailDialog row={detail} onClose={() => setDetail(null)}/>
    </div>
  );
}

function StatusBadge({ row }: { row: QrRow }) {
  if (row.deleted_at) return <Badge variant="destructive">Deleted</Badge>;
  if (row.status === "revoked") return <Badge variant="destructive">Revoked</Badge>;
  if (row.status === "archived") return <Badge variant="secondary">Archived</Badge>;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return <Badge variant="secondary">Expired</Badge>;
  return <Badge className="bg-emerald text-white hover:bg-emerald">Active</Badge>;
}

function MiniQr({ value, style }: { value: string; style: QrRow["style"] }) {
  const [src, setSrc] = useState<string>("");
  useMemo(() => {
    QRCode.toDataURL(value, { width: 96, margin: 1, color: { dark: style.fg ?? "#0F1230", light: style.bg ?? "#FFFFFF" }, errorCorrectionLevel: style.ecl ?? "M" }).then(setSrc);
  }, [value, style.fg, style.bg, style.ecl]);
  return <div className="w-16 h-16 rounded-md border bg-white grid place-items-center overflow-hidden">{src && <img src={src} alt="qr" className="w-full h-full"/>}</div>;
}

/* ---------------- Detail dialog with PNG / SVG / PDF downloads ---------------- */

function DetailDialog({ row, onClose }: { row: QrRow | null; onClose: () => void }) {
  const [png, setPng] = useState<string>("");
  const [svg, setSvg] = useState<string>("");

  useMemo(() => {
    if (!row) return;
    const opts = { width: row.style.size ?? 512, margin: row.style.margin ?? 4, color: { dark: row.style.fg ?? "#0F1230", light: row.style.bg ?? "#FFFFFF" }, errorCorrectionLevel: (row.style.ecl ?? "M") as "L"|"M"|"Q"|"H" };
    QRCode.toDataURL(row.encoded_value, opts).then(setPng);
    QRCode.toString(row.encoded_value, { type: "svg", ...opts }).then(setSvg);
  }, [row]);

  if (!row) return null;
  const downloadPng = () => { const a = document.createElement("a"); a.href = png; a.download = `${row.label}.png`; a.click(); };
  const downloadSvg = () => { const blob = new Blob([svg], { type: "image/svg+xml" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${row.label}.svg`; a.click(); };
  const downloadPdf = async () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFontSize(18); pdf.text(row.label, 20, 25);
    pdf.setFontSize(10); pdf.setTextColor(120); pdf.text(`Token: ${row.token}`, 20, 32);
    pdf.text(row.encoded_value.slice(0, 90), 20, 38);
    pdf.addImage(png, "PNG", 60, 55, 90, 90);
    pdf.save(`${row.label}.pdf`);
  };
  const printSheet = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${row.label}</title><style>body{font-family:sans-serif;padding:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%}.c{border:1px solid #ddd;padding:12px;text-align:center;border-radius:8px}</style></head><body><h1>${row.label}</h1><div class="grid">${Array.from({length:9}).map(() => `<div class="c"><img src="${png}"/><div style="font-size:11px;margin-top:8px">${row.token}</div></div>`).join("")}</div><script>window.print()</script></body></html>`);
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row.label}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="bg-white rounded-lg border p-4 grid place-items-center">{png && <img src={png} alt="qr" className="max-w-full"/>}</div>
          <div className="text-xs text-muted-foreground break-all">{row.encoded_value}</div>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" onClick={downloadPng}><Download className="h-4 w-4 mr-1"/>PNG</Button>
            <Button variant="outline" onClick={downloadSvg}><Download className="h-4 w-4 mr-1"/>SVG</Button>
            <Button variant="outline" onClick={downloadPdf}><FileTextIcon className="h-4 w-4 mr-1"/>PDF</Button>
            <Button variant="outline" onClick={printSheet}>Print sheet</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Scan history ---------------- */

function History() {
  const fn = useServerFn(qrScanHistory);
  const q = useQuery({ queryKey: ["qr-scans"], queryFn: () => fn() });
  if (q.isLoading) return <SkeletonGrid n={5}/>;
  const rows = q.data ?? [];
  if (rows.length === 0) return <Empty title="No scans yet" hint="Scan history appears here after your first QR is used."/>;
  return (
    <Card><CardContent className="p-0">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
          <tr><th className="text-left px-4 py-3">When</th><th className="text-left px-4 py-3">Token</th><th className="text-left px-4 py-3">Result</th><th className="text-left px-4 py-3">User agent</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id as string} className="border-t">
              <td className="px-4 py-3">{new Date(r.created_at as string).toLocaleString()}</td>
              <td className="px-4 py-3 font-mono">{r.token as string}</td>
              <td className="px-4 py-3"><ResultBadge result={r.result as string}/></td>
              <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{(r.user_agent as string) ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent></Card>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === "valid") return <Badge className="bg-emerald text-white hover:bg-emerald">✓ Valid</Badge>;
  if (result === "not_found") return <Badge variant="destructive">✕ Not found</Badge>;
  return <Badge variant="secondary">⚠ {result}</Badge>;
}

/* ---------------- Bits ---------------- */

function Stat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return <Card><CardContent className="p-5">
    <div className={`text-xs uppercase tracking-wider ${accent}`}>{label}</div>
    <div className="mt-1 font-display text-2xl font-bold">{value}</div>
  </CardContent></Card>;
}

function SkeletonGrid({ n }: { n: number }) {
  return <div className="grid gap-3">{Array.from({length:n}).map((_,i) => <div key={i} className="h-20 rounded-xl bg-secondary/60 animate-pulse"/>)}</div>;
}

function Empty({ title, hint, icon }: { title: string; hint: string; icon?: React.ReactNode }) {
  return <Card><CardContent className="p-10 text-center">
    <div className="mx-auto w-12 h-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">{icon ?? <QrCode className="h-6 w-6"/>}</div>
    <div className="mt-4 font-semibold">{title}</div>
    <div className="text-sm text-muted-foreground mt-1">{hint}</div>
  </CardContent></Card>;
}
