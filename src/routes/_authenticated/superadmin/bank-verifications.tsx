import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBankVerifications, decideBankVerification } from "@/lib/superadmin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/bank-verifications")({
  head: () => ({
    meta: [
      { title: "Bank verifications — UniEgo Super Admin" },
      { name: "description", content: "Verify association settlement accounts after officer maker-checker approval." },
      { property: "og:title", content: "Bank verifications — UniEgo Super Admin" },
      { property: "og:description", content: "Final platform verification of association settlement accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BankVerificationsPage,
});

const FILTERS = ["officer_approved", "verified", "rejected", "pending", "all"] as const;

const TONE: Record<string, string> = {
  pending: "secondary",
  officer_approved: "default",
  verified: "default",
  rejected: "destructive",
};

function BankVerificationsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listBankVerifications);
  const decide = useServerFn(decideBankVerification);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("officer_approved");
  const [reason, setReason] = useState("");

  const q = useQuery({ queryKey: ["admin-bank-verifications"], queryFn: () => load(), retry: false });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "verified" | "rejected" }) =>
      decide({ data: { id: v.id, decision: v.decision, reason: reason || null } }),
    onSuccess: () => {
      toast.success("Decision recorded and logged");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-bank-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-72" />;
  const rows = (q.data ?? []).filter((r: any) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5" /> Bank verifications</h1>
        <p className="text-sm text-muted-foreground">Accounts reach you only after a second association officer approves them. Verification enables settlements.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {FILTERS.map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f.replace("_", " ")}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {rows.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing here right now.</CardContent></Card>
      )}

      <div className="space-y-4">
        {rows.map((r: any) => (
          <Card key={r.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{r.association?.name ?? "Association"}</CardTitle>
                  <CardDescription>{r.bank_name} — {r.account_name}</CardDescription>
                </div>
                <Badge variant={(TONE[r.status] ?? "secondary") as any} className="capitalize shrink-0">{String(r.status).replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="font-mono">{r.masked}</div>
              {r.rejection_reason && <p className="text-destructive">Reason: {r.rejection_reason}</p>}
              {r.status === "officer_approved" && (
                <div className="space-y-2">
                  <Textarea placeholder="Reason (required when rejecting)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "verified" })}>Verify account</Button>
                    <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, decision: "rejected" })}>Reject</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
