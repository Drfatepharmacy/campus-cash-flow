import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssociationBankAccounts, submitBankChangeRequest } from "@/lib/association-bank.functions";
import { decideApprovalRequest } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/bank")({
  head: () => ({
    meta: [
      { title: "Settlement bank account — UniEgo" },
      { name: "description", content: "Submit and approve the bank account your association's dues and settlements pay out to." },
    ],
  }),
  component: BankPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "secondary",
  officer_approved: "secondary",
  verified: "default",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting officer approval",
  officer_approved: "Awaiting UniEgo verification",
  verified: "Verified — receives settlements",
  rejected: "Rejected",
};

function BankPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const load = useServerFn(getAssociationBankAccounts);
  const submit = useServerFn(submitBankChangeRequest);
  const decide = useServerFn(decideApprovalRequest);

  const q = useQuery({ queryKey: ["assoc-bank", slug], queryFn: () => load({ data: { slug } }), retry: false });

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const submitM = useMutation({
    mutationFn: () => submit({ data: { slug, bank_name: bankName, account_name: accountName, account_number: accountNumber, reason: reason || null } }),
    onSuccess: () => {
      toast.success("Submitted — a second officer must approve it next");
      setBankName(""); setAccountName(""); setAccountNumber(""); setReason("");
      qc.invalidateQueries({ queryKey: ["assoc-bank", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideM = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => decide({ data: { slug, id: v.id, decision: v.decision, reason: note || null } }),
    onSuccess: () => {
      toast.success("Decision recorded");
      setNote("");
      qc.invalidateQueries({ queryKey: ["assoc-bank", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (q.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Not available</AlertTitle>
        <AlertDescription>{(q.error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const d = q.data!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Settlement bank account</h1>
        <p className="text-sm text-muted-foreground">
          One officer submits, a second officer approves, then UniEgo verifies. Only a verified account can receive dues settlements.
        </p>
      </div>

      {!d.hasVerifiedAccount && (
        <Alert>
          <Landmark className="h-4 w-4" />
          <AlertTitle>No verified account yet</AlertTitle>
          <AlertDescription>Settlement payouts stay blocked until an account clears all three approval stages.</AlertDescription>
        </Alert>
      )}

      {d.requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting officer approval</CardTitle>
            <CardDescription>A different officer from the one who submitted must approve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.requests.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.bank_name} · {r.account_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{r.masked}</p>
                    {r.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</p>}
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                {r.can_decide ? (
                  <div className="space-y-2">
                    <Textarea rows={2} placeholder="Decision note (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={decideM.isPending} onClick={() => decideM.mutate({ id: r.id, decision: "approved" })}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={decideM.isPending || !note} onClick={() => decideM.mutate({ id: r.id, decision: "rejected" })}>Reject</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {r.mine ? "You submitted this — another officer must approve it." : "You do not have approval rights for this request."}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts on file</CardTitle>
          <CardDescription>Account numbers are always masked. Full numbers never leave UniEgo's servers.</CardDescription>
        </CardHeader>
        <CardContent>
          {d.accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bank account submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {d.accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {a.bank_name} · {a.account_name}
                      {a.is_primary && a.status === "verified" && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">{a.masked}</p>
                    {a.rejection_reason && <p className="text-xs text-destructive mt-1">{a.rejection_reason}</p>}
                  </div>
                  <Badge variant={(STATUS_TONE[a.status] ?? "secondary") as any}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {d.canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit a new settlement account</CardTitle>
            <CardDescription>Replacing a verified account restarts the full three-stage review.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => { e.preventDefault(); submitM.mutate(); }}
            >
              <div className="space-y-2">
                <Label>Bank name</Label>
                <Input required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Zenith Bank" />
              </div>
              <div className="space-y-2">
                <Label>Account name</Label>
                <Input required value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Registered association account name" />
              </div>
              <div className="space-y-2">
                <Label>Account number</Label>
                <Input required inputMode="numeric" pattern="\d{10}" maxLength={10} value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digits" />
              </div>
              <div className="space-y-2">
                <Label>Reason / context <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. new treasury account for 2026 session" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitM.isPending}>
                  {submitM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit for approval
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
