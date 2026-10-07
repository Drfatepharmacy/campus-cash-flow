import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEligibleRequests, getMyTransactions, getMyProfile, verifyPayment } from "@/lib/payments.functions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, LogOut, ShieldAlert, QrCode, Receipt as ReceiptIcon, Loader2 } from "lucide-react";
import { grantAdminToMe } from "@/lib/admin.functions";
import { getMyRoles } from "@/lib/payments.functions";
import { myAssociations } from "@/lib/associations.functions";
import { SuperAdminCard, ApplicationTimeline } from "@/components/association/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — UniEgo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchEligible = useServerFn(getEligibleRequests);
  const fetchTxns = useServerFn(getMyTransactions);
  const fetchRoles = useServerFn(getMyRoles);
  const grant = useServerFn(grantAdminToMe);
  const verify = useServerFn(verifyPayment);
  const fetchAssociations = useServerFn(myAssociations);

  const profile = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const assocs = useQuery({ queryKey: ["my-associations"], queryFn: () => fetchAssociations(), retry: false });
  const eligible = useQuery({ queryKey: ["eligible"], queryFn: () => fetchEligible() });
  const txns = useQuery({ queryKey: ["my-txns"], queryFn: () => fetchTxns(), refetchInterval: (query) => {
    const rows = (query.state.data as any[] | undefined) ?? [];
    return rows.some((t) => t.status === "pending") ? 4000 : false;
  } });

  const verifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference || verifiedRef.current.has(reference)) return;
    verifiedRef.current.add(reference);
    verify({ data: { reference } })
      .then((r) => {
        if (r.status === "paid") {
          toast.success("Payment successful");
          qc.invalidateQueries({ queryKey: ["my-txns"] });
        }
      })
      .catch(() => { /* webhook will finalize; polling picks it up */ })
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      });
  }, [verify, qc]);

  const claim = useMutation({
    mutationFn: () => grant(),
    onSuccess: () => { toast.success("Admin role granted"); qc.invalidateQueries({ queryKey: ["my-roles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const incomplete = profile.data && (!profile.data.matric_no || !profile.data.faculty_id || !profile.data.level);
  const isAdmin = (roles.data ?? []).includes("admin");
  const isSuperAdmin = (roles.data ?? []).includes("super_admin");

  const isRunner = (roles.data ?? []).includes("bank_runner");
  const isRep = (roles.data ?? []).includes("faculty_rep") || (roles.data ?? []).includes("department_rep");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            {isRep && <Link to="/rep"><Button variant="outline" size="sm">Rep portal</Button></Link>}
            {isRunner && <Link to="/runner"><Button variant="outline" size="sm">Runner</Button></Link>}
            {isAdmin && <Link to="/admin"><Button variant="outline" size="sm">Admin</Button></Link>}
            {isSuperAdmin && <Link to="/superadmin"><Button size="sm">Super Admin</Button></Link>}

            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5"/>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</div>
          <h1 className="font-display text-3xl font-bold mt-1">{profile.data?.full_name ?? "Student"}</h1>
        </div>

        {incomplete && (
          <Card className="border-gold">
            <CardContent className="p-5 flex items-center gap-4">
              <ShieldAlert className="h-5 w-5 text-gold" />
              <div className="flex-1">
                <div className="font-medium">Complete your student profile</div>
                <div className="text-sm text-muted-foreground">Add matric number, faculty, department and level to see payment requests.</div>
              </div>
              <Link to="/onboarding"><Button size="sm">Complete</Button></Link>
            </CardContent>
          </Card>
        )}

        {!isAdmin && (
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex-1 text-sm text-muted-foreground">First time setting up the platform? Claim the founder admin role (only available if no admin exists yet).</div>
              <Button size="sm" variant="outline" onClick={() => claim.mutate()} disabled={claim.isPending}>
                {claim.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/>}
                Claim admin
              </Button>
            </CardContent>
          </Card>
        )}

        {isSuperAdmin && <SuperAdminCard />}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">My associations</h2>
            <Link to="/associations/new"><Button size="sm" variant="outline">Register an association</Button></Link>
          </div>
          {(assocs.data ?? []).length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">
              You don&apos;t belong to an association yet. Register one — it becomes active only after UniEgo approves it.
            </CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(assocs.data ?? []).map((a: any) => {
                const status = String(a.status ?? "draft");
                const label = status === "active" ? "Association active"
                  : status === "rejected" ? "Rejected"
                  : status === "draft" ? "Draft"
                  : status === "submitted" || status === "under_review" ? "Pending approval"
                  : status.replace("_", " ");
                const tone = status === "active" ? "default" : status === "rejected" || status === "suspended" ? "destructive" : "secondary";
                return (
                  <Card key={a.id}>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-display font-semibold truncate">{a.short_name || a.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{a.institution}</div>
                        </div>
                        <Badge variant={tone as any} className="capitalize shrink-0">{label}</Badge>
                      </div>
                      <ApplicationTimeline association={a} />
                      {status === "rejected" && a.status_reason && (
                        <p className="text-xs text-destructive">Reason: {a.status_reason}</p>
                      )}
                      {status !== "active" && status !== "rejected" && (
                        <p className="text-xs text-muted-foreground">Awaiting UniEgo verification. Your dashboard unlocks on approval.</p>
                      )}
                      {(a.roles ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(a.roles as string[]).map((r) => <Badge key={r} variant="outline" className="capitalize">{r.replace("_", " ")}</Badge>)}
                        </div>
                      )}
                      {status === "active" && (
                        <Link to="/association/$slug" params={{ slug: a.slug }}>
                          <Button size="sm" className="mt-1">Open association dashboard <ArrowRight className="h-4 w-4 ml-1" /></Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display text-lg font-semibold">Available payments</h2>
            {eligible.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>}
            {!eligible.isLoading && (eligible.data ?? []).length === 0 && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No payment requests match your profile yet.</CardContent></Card>
            )}
            {(eligible.data ?? []).map((r: any) => (
              <Card key={r.id} className="hover:shadow-elegant transition-shadow">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-display font-semibold">{r.title}</div>
                    {r.description && <div className="text-sm text-muted-foreground mt-1">{r.description}</div>}
                    <div className="mt-2 flex gap-2 flex-wrap text-xs text-muted-foreground">
                      {r.faculty?.name && <Badge variant="secondary">{r.faculty.name}</Badge>}
                      {r.department?.name && <Badge variant="secondary">{r.department.name}</Badge>}
                      {r.target_level && <Badge variant="secondary">{r.target_level}L</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold">{formatNaira(Number(r.base_amount))}</div>
                    <Link to="/pay/$requestId" params={{ requestId: r.id }}>
                      <Button size="sm" className="mt-2 bg-royal text-royal-foreground hover:opacity-90">
                        Pay <ArrowRight className="h-4 w-4 ml-1"/>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Recent payments</h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {(txns.data ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No transactions yet.</div>}
                {(txns.data ?? []).map((t: any) => (
                  <div key={t.id} className="p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center">
                      <ReceiptIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.payment_request?.title ?? "Payment"}</div>
                      <div className="text-xs text-muted-foreground">{t.reference}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatNaira(Number(t.total_amount))}</div>
                      <div className="text-[10px] uppercase tracking-wider">
                        {t.status === "paid" ? <span className="text-emerald">Paid</span> : t.status === "pending" ? <span className="text-muted-foreground">Pending</span> : <span className="text-destructive">Failed</span>}
                      </div>
                    </div>
                    {t.status === "paid" && t.receipt?.[0]?.qr_token && (
                      <Link to="/receipt/$token" params={{ token: t.receipt[0].qr_token }}>
                        <Button size="icon" variant="ghost"><QrCode className="h-4 w-4"/></Button>
                      </Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
