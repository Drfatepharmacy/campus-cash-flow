import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAssociationFinance,
  raiseApprovalRequest,
  listAssociationTransactions,
  listAssociationSettlements,
  listAssociationReceipts,
} from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Banknote, Download, Lock, Search, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Association workspace | UniEgo" },
      { name: "description", content: "Association collections, transactions, settlements, receipts and settlement account." },
    ],
  }),
  component: FinancePage,
});

const naira = (minor: number) => `₦${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function FinancePage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const fetchFinance = useServerFn(getAssociationFinance);
  const raise = useServerFn(raiseApprovalRequest);
  const fin = useQuery({ queryKey: ["finance", slug], queryFn: () => fetchFinance({ data: { slug } }), retry: false });

  const m = useMutation({
    mutationFn: () => raise({ data: { slug, action_type: "settlement.payout", payload: {}, reason: "Payout of collected dues" } }),
    onSuccess: () => { toast.success("Settlement requested — awaiting a second officer's approval"); qc.invalidateQueries({ queryKey: ["approvals", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (fin.isLoading) return <Skeleton className="h-64" />;
  if (fin.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(fin.error as Error).message}</CardContent></Card>;
  const d = fin.data!;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Collected</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{naira(d.totals.collected_minor)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Net to association</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{naira(d.totals.net_minor)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Paid</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{d.totals.paid_count}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{d.totals.pending_count}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Settlement account</CardTitle><CardDescription>Bank details are masked by design.</CardDescription></div>
          {d.canRequestSettlement && <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}><Banknote className="h-4 w-4 mr-1" /> Request payout</Button>}
        </CardHeader>
        <CardContent>
          {d.bank ? (
            <div className="text-sm space-y-1">
              <p className="font-medium">{d.bank.account_name}</p>
              <p className="text-muted-foreground">{d.bank.bank_name} · {d.bank.masked}</p>
              <Badge variant={d.bank.verified ? "default" : "secondary"}>{d.bank.verified ? "Verified" : "Unverified"}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Lock className="h-4 w-4" /> No settlement account visible to your role.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-4"><TransactionsTab slug={slug} canExport={Boolean(d.canExport)} /></TabsContent>
        <TabsContent value="settlements" className="mt-4"><SettlementsTab slug={slug} /></TabsContent>
        <TabsContent value="receipts" className="mt-4"><ReceiptsTab slug={slug} /></TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionsTab({ slug, canExport }: { slug: string; canExport: boolean }) {
  const load = useServerFn(listAssociationTransactions);
  const [status, setStatus] = useState<"all" | "pending" | "paid" | "failed" | "refunded">("all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["assoc-txns", slug, status, search],
    queryFn: () => load({ data: { slug, status, search: search.trim() || null } }),
    retry: false,
  });

  const exportCsv = () => {
    const rows = [["Reference", "Item", "Student", "Status", "Total", "Created"],
      ...((q.data as any[]) ?? []).map((t) => [t.reference, t.payment_request?.title ?? "", t.student?.full_name ?? "", t.status, String(Number(t.total_minor) / 100), t.created_at])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${slug}-transactions.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <CardTitle className="text-base">Transactions</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-44" placeholder="Reference" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "pending", "paid", "failed", "refunded"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {canExport && <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <Skeleton className="h-32" /> : q.error ? (
          <p className="py-8 text-center text-sm text-destructive">{(q.error as Error).message}</p>
        ) : ((q.data as any[]) ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b"><tr><th className="py-2 pr-3">Reference</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Amount</th><th className="py-2">Status</th></tr></thead>
              <tbody>
                {(q.data as any[]).map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{t.reference}</td>
                    <td className="py-2 pr-3">{t.payment_request?.title ?? "—"}</td>
                    <td className="py-2 pr-3">{t.student?.full_name ?? "—"}<span className="block text-xs text-muted-foreground">{t.student?.matric_no ?? ""}</span></td>
                    <td className="py-2 pr-3">{naira(Number(t.total_minor))}</td>
                    <td className="py-2"><Badge variant={t.status === "paid" ? "default" : "secondary"} className="capitalize">{t.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const SETTLEMENT_STATUSES = ["pending", "assigned", "in_progress", "deposited", "confirmed", "flagged"] as const;

function SettlementsTab({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const load = useServerFn(listAssociationSettlements);
  const raise = useServerFn(raiseApprovalRequest);
  const q = useQuery({ queryKey: ["assoc-settlements", slug], queryFn: () => load({ data: { slug } }), retry: false });
  const [draft, setDraft] = useState<Record<string, string>>({});

  const m = useMutation({
    mutationFn: (v: { settlement_id: string; status: string }) =>
      raise({ data: { slug, action_type: "settlement.status_update", payload: v, reason: `Set settlement to ${v.status}` } }),
    onSuccess: () => { toast.success("Status change requested — a second officer must approve it"); qc.invalidateQueries({ queryKey: ["assoc-settlements", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-32" />;
  if (q.error) return <Card><CardContent className="py-8 text-center text-sm text-destructive">{(q.error as Error).message}</CardContent></Card>;
  const d = q.data!;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settlements</CardTitle>
        <CardDescription>Status changes follow maker-checker: one officer requests, another approves.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {d.pendingUpdates.length > 0 && (
          <p className="text-xs text-muted-foreground">{d.pendingUpdates.length} status change(s) awaiting approval in the Approvals tab.</p>
        )}
        {d.settlements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No settlements recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {d.settlements.map((s: any) => (
              <li key={s.id} className="border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs">{s.reference}</p>
                  <p className="font-medium">₦{Number(s.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Created {new Date(s.created_at).toLocaleDateString()}{s.bank_reference ? ` · bank ref ${s.bank_reference}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "confirmed" ? "default" : s.status === "flagged" ? "destructive" : "secondary"} className="capitalize">{String(s.status).replace("_", " ")}</Badge>
                  {d.canRequest && (
                    <>
                      <Select value={draft[s.id] ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, [s.id]: v }))}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="New status" /></SelectTrigger>
                        <SelectContent>
                          {SETTLEMENT_STATUSES.filter((x) => x !== s.status).map((x) => <SelectItem key={x} value={x} className="capitalize">{x.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!draft[s.id] || m.isPending} onClick={() => m.mutate({ settlement_id: s.id, status: draft[s.id]! })}>Request</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReceiptsTab({ slug }: { slug: string }) {
  const load = useServerFn(listAssociationReceipts);
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["assoc-receipts", slug, search], queryFn: () => load({ data: { slug, search: search.trim() || null } }), retry: false });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <CardTitle className="text-base">Receipts</CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Reference, name or matric" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <Skeleton className="h-32" /> : q.error ? (
          <p className="py-8 text-center text-sm text-destructive">{(q.error as Error).message}</p>
        ) : ((q.data as any[]) ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No receipts issued yet.</p>
        ) : (
          <ul className="space-y-2">
            {(q.data as any[]).map((r) => (
              <li key={r.id} className="border rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.student?.full_name ?? "—"} <span className="text-xs text-muted-foreground">{r.student?.matric_no ?? ""}</span></p>
                  <p className="text-xs text-muted-foreground">{r.payment_request?.title ?? "Payment"} · {naira(Number(r.total_minor))} · {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}</p>
                </div>
                {r.receipt?.qr_token ? (
                  <a className="text-sm inline-flex items-center gap-1 text-royal hover:underline" href={`/verify/${r.receipt.qr_token}`} target="_blank" rel="noreferrer">
                    Verify <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : <Badge variant="secondary">No receipt</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
