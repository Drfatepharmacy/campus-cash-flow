import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssociationDetail } from "@/lib/superadmin-console.functions";
import { setAssociationStatus, approveAssociationRequest, rejectAssociationRequest } from "@/lib/superadmin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { maskAccount } from "@/lib/association-access";
import { ArrowLeft, Check, X, Ban, RotateCcw, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/association/$id")({
  head: () => ({ meta: [{ title: "Association details — UniEgo Super Admin" }, { name: "description", content: "Full application details and decisions for one association." }] }),
  component: DetailPage,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

function DetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getAssociationDetail);
  const setStatus = useServerFn(setAssociationStatus);
  const approve = useServerFn(approveAssociationRequest);
  const reject = useServerFn(rejectAssociationRequest);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["sa-assoc", id], queryFn: () => load({ data: { id } }), retry: false });
  const done = (msg: string) => { toast.success(msg); setReason(""); qc.invalidateQueries({ queryKey: ["sa-assoc", id] }); qc.invalidateQueries({ queryKey: ["sa-counts"] }); qc.invalidateQueries({ queryKey: ["admin-associations"] }); };
  const fail = (e: unknown) => toast.error("That didn't go through", { description: toUserMessage(e) });

  const mStatus = useMutation({ mutationFn: (status: any) => setStatus({ data: { id, status, reason: reason.trim() || null } }), onSuccess: () => done("Status updated and recorded"), onError: fail });
  const mApprove = useMutation({ mutationFn: () => approve({ data: { id, term_months: 12 } }), onSuccess: () => done("Approved — association is now active"), onError: fail });
  const mReject = useMutation({ mutationFn: () => reject({ data: { id, reason: reason.trim() } }), onSuccess: () => done("Rejected — the requester has been told why"), onError: fail });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <Card><CardContent className="p-6 text-sm text-muted-foreground">We couldn't open this association. <Link to="/superadmin/associations" className="underline">Back to the list</Link></CardContent></Card>;
  const { association: a, creator, nominations, accounts, assignments, audit, memberCount } = q.data as any;
  const busy = mStatus.isPending || mApprove.isPending || mReject.isPending;
  const s = a.status as string;

  return (
    <div className="space-y-5">
      <Link to="/superadmin/associations" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All associations</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{a.name}</h1>
          <p className="text-sm text-muted-foreground">{a.institution}{a.faculty?.name ? ` · ${a.faculty.name}` : ""} · {a.type}</p>
        </div>
        <Badge variant={s === "active" ? "default" : s === "rejected" || s === "suspended" ? "destructive" : "secondary"} className="capitalize">{s.replace("_", " ")}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Reason or note (required to reject or suspend; the requester sees it)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <div className="flex flex-wrap gap-2">
            {s === "submitted" && <Button size="sm" variant="outline" disabled={busy} onClick={() => mStatus.mutate("under_review")}><Eye className="h-4 w-4 mr-1" />Start review</Button>}
            {["submitted", "under_review", "verified"].includes(s) && <Button size="sm" disabled={busy} onClick={() => mApprove.mutate()}><Check className="h-4 w-4 mr-1" />Approve & activate</Button>}
            {["submitted", "under_review", "verified"].includes(s) && <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => mReject.mutate()}><X className="h-4 w-4 mr-1" />Reject</Button>}
            {s === "active" && <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => mStatus.mutate("suspended")}><Ban className="h-4 w-4 mr-1" />Suspend</Button>}
            {s === "suspended" && <Button size="sm" disabled={busy} onClick={() => mStatus.mutate("active")}><RotateCcw className="h-4 w-4 mr-1" />Restore</Button>}
            {s === "draft" && <p className="text-sm text-muted-foreground">This is still a draft. The applicant hasn't sent it for review yet.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row k="Applied by" v={creator ? `${creator.full_name ?? ""} (${creator.email})` : "—"} />
            <Row k="Official email" v={a.official_email ?? "—"} />
            <Row k="Official phone" v={a.official_phone ?? "—"} />
            <Row k="Session" v={a.session_year ?? "—"} />
            <Row k="Active members" v={String(memberCount)} />
            <Row k="Applied" v={fmt(a.created_at)} />
            <Row k="Last reviewed" v={fmt(a.reviewed_at)} />
            {a.status_reason && <Row k="Last note" v={a.status_reason} />}
            {a.description && <p className="pt-2 text-muted-foreground">{a.description}</p>}
            {Array.isArray(a.verification_documents) && a.verification_documents.length > 0 && (
              <div className="pt-2"><div className="font-medium">Documents</div>
                {a.verification_documents.map((d: any, i: number) => <div key={i} className="text-muted-foreground">{d?.name ?? d?.label ?? `Document ${i + 1}`}</div>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">Proposed and current leaders</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {nominations.length === 0 && assignments.length === 0 && <p className="text-muted-foreground">No leaders proposed yet.</p>}
            {nominations.map((n: any) => (
              <div key={n.id} className="flex justify-between gap-2"><span><span className="capitalize">{n.role_key.replace("_", " ")}</span>: {n.nominee_name} <span className="text-muted-foreground">{n.nominee_email}</span></span><Badge variant="outline" className="capitalize shrink-0">{n.status}</Badge></div>
            ))}
            {assignments.map((r: any) => (
              <div key={r.id} className="flex justify-between gap-2"><span><span className="capitalize">{r.role_key.replace("_", " ")}</span>: {r.person?.full_name ?? r.person?.email ?? "Member"}</span><Badge variant={r.status === "active" ? "default" : "secondary"} className="capitalize shrink-0">{r.status}</Badge></div>
            ))}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">Bank accounts</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {accounts.length === 0 && <p className="text-muted-foreground">No settlement account submitted yet.</p>}
            {accounts.map((b: any) => (
              <div key={b.id} className="flex justify-between gap-2"><span>{b.bank_name} · {maskAccount(b.account_last4)}<br /><span className="text-muted-foreground">{b.account_name}</span></span><Badge variant="outline" className="capitalize shrink-0">{b.status.replace("_", " ")}</Badge></div>
            ))}
            {accounts.some((b: any) => b.status === "officer_approved") && <Link to="/superadmin/bank-verifications" className="underline">Verify in Bank accounts</Link>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2 max-h-80 overflow-y-auto">
            {audit.length === 0 && <p className="text-muted-foreground">No events yet.</p>}
            {audit.map((e: any) => (
              <div key={e.id}><div className="font-medium">{e.action.replace(/[._]/g, " ")}</div><div className="text-xs text-muted-foreground">{fmt(e.created_at)} · {e.actor?.full_name ?? e.actor?.email ?? "System"}</div></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right break-all">{v}</span></div>;
}
