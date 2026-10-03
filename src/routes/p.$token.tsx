import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicLink, startLinkPayment, confirmLinkPayment, getPublicLedger } from "@/lib/payment-links.functions";
import { nairaMinor } from "@/lib/payment-link-utils";
import { toUserMessage } from "@/lib/user-error";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Pay association dues — UniEgo" },
      { name: "description", content: "Pay your association fee securely with UniEgo. No account needed." },
      { property: "og:title", content: "Pay association dues — UniEgo" },
      { property: "og:description", content: "Pay your association fee securely with UniEgo. No account needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPay,
});

function PublicPay() {
  const { token } = Route.useParams();
  const fetchLink = useServerFn(getPublicLink);
  const q = useQuery({ queryKey: ["plink", token], queryFn: () => fetchLink({ data: { token } }), retry: false });
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => { setRef(new URLSearchParams(window.location.search).get("ref")); }, []);

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <Link to="/"><Logo /></Link>
        {q.isLoading ? <Skeleton className="mt-6 h-80" /> : q.error ? (
          <Card className="mt-6"><CardContent className="py-12 text-center text-sm text-muted-foreground">{toUserMessage(q.error)}</CardContent></Card>
        ) : (
          <>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{q.data!.association}</p>
              <h1 className="font-display text-3xl font-bold">{q.data!.title}</h1>
              {q.data!.description && <p className="mt-1 text-muted-foreground">{q.data!.description}</p>}
            </div>
            {ref ? <Confirm reference={ref} onDone={() => { setRef(null); window.history.replaceState(null, "", window.location.pathname); }} /> : null}
            <Tabs defaultValue="pay" className="mt-6">
              <TabsList><TabsTrigger value="pay">Pay</TabsTrigger><TabsTrigger value="ledger">Who has paid</TabsTrigger></TabsList>
              <TabsContent value="pay" className="mt-4"><PayForm token={token} link={q.data!} /></TabsContent>
              <TabsContent value="ledger" className="mt-4"><Ledger token={token} /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function Confirm({ reference, onDone }: { reference: string; onDone: () => void }) {
  const confirm = useServerFn(confirmLinkPayment);
  const q = useQuery({
    queryKey: ["plconfirm", reference], queryFn: () => confirm({ data: { reference } }), retry: false,
    refetchInterval: (s) => (s.state.data?.status === "pending" ? 3000 : false),
  });
  const s = q.data?.status;
  return (
    <Card className="mt-6 border-emerald-500/40">
      <CardContent className="py-6 flex items-center gap-3">
        {s === "paid" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        <div className="flex-1 text-sm">
          {s === "paid" ? <><p className="font-medium">Payment successful</p><p className="text-muted-foreground">{q.data && "amount_minor" in q.data ? nairaMinor(q.data.amount_minor!) : ""} · Reference {reference}</p></>
            : s === "problem" || s === "not_found" ? <p>We couldn't confirm this payment. Keep your reference ({reference}) and contact your treasurer.</p>
            : <p>Confirming your payment…</p>}
        </div>
        {s && s !== "pending" && <Button size="sm" variant="ghost" onClick={onDone}>Close</Button>}
      </CardContent>
    </Card>
  );
}

function PayForm({ token, link }: { token: string; link: { active: boolean; class_prices: { class: string; amount_minor: number }[] } }) {
  const start = useServerFn(startLinkPayment);
  const [f, setF] = useState({ payer_name: "", matric_no: "", class_label: "", payer_email: "" });
  const price = link.class_prices.find((c) => c.class === f.class_label)?.amount_minor;
  const m = useMutation({
    mutationFn: () => start({ data: { token, ...f, callback_url: window.location.origin + window.location.pathname } }),
    onSuccess: (r) => { window.location.href = r.authorization_url; },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  if (!link.active) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">This payment link is paused and not accepting payments right now.</CardContent></Card>;
  const ok = f.payer_name.trim().length >= 3 && f.matric_no.trim().length >= 4 && price;
  return (
    <Card className="shadow-elegant">
      <CardHeader><CardTitle>Your details</CardTitle><CardDescription>No account needed. You'll finish payment on Paystack.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Full name</Label><Input value={f.payer_name} onChange={(e) => setF({ ...f, payer_name: e.target.value })} maxLength={120} /></div>
        <div className="space-y-1.5"><Label>Matric number</Label><Input value={f.matric_no} onChange={(e) => setF({ ...f, matric_no: e.target.value.toUpperCase() })} placeholder="ENG2006960" maxLength={30} /></div>
        <div className="space-y-1.5"><Label>Class / level</Label>
          <Select value={f.class_label} onValueChange={(v) => setF({ ...f, class_label: v })}>
            <SelectTrigger><SelectValue placeholder="Choose your class" /></SelectTrigger>
            <SelectContent>{link.class_prices.map((c) => <SelectItem key={c.class} value={c.class}>{c.class} — {nairaMinor(c.amount_minor)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Email for receipt (optional)</Label><Input type="email" value={f.payer_email} onChange={(e) => setF({ ...f, payer_email: e.target.value })} maxLength={200} /></div>
        <div className="flex items-center justify-between border-t pt-4"><span className="text-muted-foreground">Fee</span><span className="font-display text-2xl font-bold">{price ? nairaMinor(price) : "—"}</span></div>
        <Button className="w-full" size="lg" disabled={!ok || m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pay {price ? nairaMinor(price) : ""}
        </Button>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout by Paystack</p>
      </CardContent>
    </Card>
  );
}

const LEDGER_COLS = [{ key: "name", label: "Name" }, { key: "matric", label: "Matric" }, { key: "class_label", label: "Class" }, { key: "amount", label: "Amount" }, { key: "date", label: "Date" }];

function Ledger({ token }: { token: string }) {
  const load = useServerFn(getPublicLedger);
  const [cls, setCls] = useState("all");
  const q = useQuery({ queryKey: ["plledger", token, cls], queryFn: () => load({ data: { token, class_label: cls === "all" ? null : cls } }), retry: false });
  const rows = useMemo(() => (q.data?.rows ?? []).map((r) => ({ ...r, amount: nairaMinor(r.amount_minor), date: r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "" })), [q.data]);
  const label = cls === "all" ? "all-classes" : `class-${cls}`;
  const xlsx = async () => { const { downloadXlsx } = await import("@/lib/payment-link-export"); await downloadXlsx(`${label}-payments.xlsx`, [{ name: "Paid", cols: LEDGER_COLS, rows }]); };
  const pdf = async () => { const { downloadPdf } = await import("@/lib/payment-link-export"); await downloadPdf(`${label}-payments.pdf`, q.data!.title, `${q.data!.association} · ${cls === "all" ? "All classes" : `Class ${cls}`} · ${rows.length} paid · ${nairaMinor(q.data!.total_minor)}`, [{ heading: "Payments", cols: LEDGER_COLS, rows }]); };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div><CardTitle className="text-base">Collections</CardTitle><CardDescription>Names and matric numbers are partly hidden for privacy.</CardDescription></div>
        <div className="flex items-center gap-2">
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All classes</SelectItem>{(q.data?.classes ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!q.data} onClick={xlsx}><Download className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" disabled={!q.data} onClick={pdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <Skeleton className="h-32" /> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p> : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{rows.length} paid · {nairaMinor(q.data!.total_minor)}</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr>{LEDGER_COLS.map((c) => <th key={c.key} className="py-2 pr-3">{c.label}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{LEDGER_COLS.map((c) => <td key={c.key} className="py-2 pr-3">{(r as any)[c.key]}</td>)}</tr>)}</tbody>
            </table></div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
