import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssociations, setAssociationStatus, listAssignmentsForAssociation, changeAssignmentStatus, approveAssociationRequest, rejectAssociationRequest } from "@/lib/superadmin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Search, Ban, RotateCcw, Eye, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/associations")({
  head: () => ({
    meta: [
      { title: "Association review — UniEgo Super Admin" },
      { name: "description", content: "Review association applications, manage lifecycle status and suspend or restore associations." },
    ],
  }),
  component: AdminAssociationsPage,
});

const FILTERS = ["submitted", "under_review", "verified", "active", "rejected", "suspended", "all"] as const;

function AdminAssociationsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listAllAssociations);
  const setStatus = useServerFn(setAssociationStatus);
  const approve = useServerFn(approveAssociationRequest);
  const reject = useServerFn(rejectAssociationRequest);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("submitted");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({ queryKey: ["admin-associations"], queryFn: () => load(), retry: false });

  const m = useMutation({
    mutationFn: (v: { id: string; status: any; reason?: string | null; financials_enabled?: boolean }) => setStatus({ data: v }),
    onSuccess: () => { toast.success("Association updated — the change is recorded in the audit log"); setReason(""); qc.invalidateQueries({ queryKey: ["admin-associations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mApprove = useMutation({
    mutationFn: (v: { id: string }) => approve({ data: { id: v.id, term_months: 12 } }),
    onSuccess: (r: any) => {
      toast.success(
        r?.pending_signup?.length
          ? `Approved and activated. Still to onboard: ${r.pending_signup.map((p: any) => `${p.name} (${p.email})`).join(", ")}`
          : "Approved — association activated and its dashboard provisioned",
      );
      qc.invalidateQueries({ queryKey: ["admin-associations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReject = useMutation({
    mutationFn: (v: { id: string; reason: string }) => reject({ data: v }),
    onSuccess: () => { toast.success("Application rejected — the requester has been notified"); setReason(""); qc.invalidateQueries({ queryKey: ["admin-associations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-72" />;
  const all = q.data ?? [];
  const rows = all.filter((a: any) => {
    const okFilter = filter === "all" || a.status === filter;
    const s = search.trim().toLowerCase();
    const okSearch = !s || a.name?.toLowerCase().includes(s) || a.institution?.toLowerCase().includes(s) || a.slug?.toLowerCase().includes(s);
    return okFilter && okSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-royal" />
        <h1 className="text-2xl font-semibold">Association applications</h1>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="flex-wrap h-auto">
              {FILTERS.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f.replace("_", " ")} ({f === "all" ? all.length : all.filter((a: any) => a.status === f).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, institution or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing here right now.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((a: any) => (
                <li key={a.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to="/superadmin/association/$id" params={{ id: a.id }} className="font-medium truncate block hover:underline">{a.name}</Link>
                      <p className="text-sm text-muted-foreground">
                        {a.institution} · <span className="capitalize">{a.type}</span>
                        {a.campus?.name ? ` · ${a.campus.name}` : ""}{a.faculty?.name ? ` · ${a.faculty.name}` : ""}{a.department?.name ? ` · ${a.department.name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{a.official_email ?? "no official email"} · applied {new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={a.status === "active" ? "default" : a.status === "suspended" || a.status === "archived" || a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                        {String(a.status).replace("_", " ")}
                      </Badge>
                      {a.financials_enabled && <Badge variant="outline">Financials on</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => setDetail(a)}><Eye className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {a.status === "submitted" && (
                      <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "under_review" })}>Start review</Button>
                    )}
                    {["submitted", "under_review"].includes(a.status) && (
                      <>
                        <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "verified" })}>Verify</Button>
                        <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "draft", reason: "More information required" })}>Request more info</Button>
                      </>
                    )}
                    {["submitted", "under_review", "verified", "rejected"].includes(a.status) && (
                      <Button size="sm" disabled={mApprove.isPending} onClick={() => mApprove.mutate({ id: a.id })}>
                        <Check className="h-4 w-4 mr-1" /> Approve &amp; activate
                      </Button>
                    )}
                    {["draft", "submitted", "under_review", "verified"].includes(a.status) && (
                      <Button size="sm" variant="destructive" disabled={mReject.isPending}
                        onClick={() => {
                          if (!reason.trim()) { toast.error("Add a decision note below — a rejection needs a reason"); return; }
                          mReject.mutate({ id: a.id, reason: reason.trim() });
                        }}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    )}
                    {a.status === "verified" && (
                      <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "active", financials_enabled: true })}>Activate + enable financials</Button>
                    )}
                    {a.status === "active" && (
                      <>
                        <Button size="sm" variant="outline" disabled={m.isPending}
                          onClick={() => m.mutate({ id: a.id, status: "active", financials_enabled: !a.financials_enabled })}>
                          {a.financials_enabled ? "Disable financials" : "Enable financials"}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "suspended", reason: reason || "Suspended by platform administrator" })}>
                          <Ban className="h-4 w-4 mr-1" /> Suspend
                        </Button>
                      </>
                    )}
                    {(a.status === "suspended" || a.status === "archived") && (
                      <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "active", reason: "Restored by platform administrator" })}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Restore
                      </Button>
                    )}
                    {a.status !== "archived" && (
                      <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, status: "archived", reason: reason || null })}>Archive</Button>
                    )}
                  </div>
                  {a.status_reason && <p className="text-xs text-muted-foreground">Last decision note: {a.status_reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Decision note</CardTitle><CardDescription>Required for a rejection, and attached to the next suspend or archive action and stored in the audit trail.</CardDescription></CardHeader>
        <CardContent><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" /></CardContent>
      </Card>

      <DetailDialog association={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function DetailDialog({ association, onClose }: { association: any | null; onClose: () => void }) {
  const listAssignments = useServerFn(listAssignmentsForAssociation);
  const change = useServerFn(changeAssignmentStatus);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-assoc-assignments", association?.id],
    queryFn: () => listAssignments({ data: { association_id: association.id } }),
    enabled: Boolean(association?.id),
    retry: false,
  });
  const m = useMutation({
    mutationFn: (v: { id: string; status: any }) => change({ data: v }),
    onSuccess: () => { toast.success("Executive updated"); qc.invalidateQueries({ queryKey: ["admin-assoc-assignments", association?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(association)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{association?.name}</DialogTitle>
          <DialogDescription>{association?.description || "No description provided."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Slug: <span className="font-mono">{association?.slug}</span></p>
          <p className="text-muted-foreground">Contact: {association?.official_email ?? "—"} {association?.official_phone ? `· ${association.official_phone}` : ""}</p>
          <div>
            <p className="font-medium mb-2">Executives</p>
            {q.isLoading ? <Skeleton className="h-16" /> : (q.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No executives appointed yet.</p>
            ) : (
              <ul className="space-y-2">
                {(q.data as any[]).map((r) => (
                  <li key={r.id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate">{r.profile?.full_name ?? r.profile?.email ?? r.user_id}</p>
                      <p className="text-xs text-muted-foreground">{r.role?.name ?? r.role_key} · {r.status}{r.ends_at ? ` · until ${new Date(r.ends_at).toLocaleDateString()}` : ""}</p>
                    </div>
                    {r.status === "active" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => m.mutate({ id: r.id, status: "suspended" })}>Suspend</Button>
                        <Button size="sm" variant="destructive" onClick={() => m.mutate({ id: r.id, status: "revoked" })}>Revoke</Button>
                      </div>
                    ) : r.status === "suspended" ? (
                      <Button size="sm" onClick={() => m.mutate({ id: r.id, status: "active" })}>Restore</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
