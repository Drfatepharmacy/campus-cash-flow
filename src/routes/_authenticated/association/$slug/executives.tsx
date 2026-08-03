import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listExecutives, submitNomination, listAssociationRoles } from "@/lib/associations.functions";
import { useWorkspace } from "./route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/executives")({
  head: () => ({ meta: [{ title: "Executives — Association workspace" }, { name: "description", content: "Executive tenure, nominations and role history." }] }),
  component: ExecutivesPage,
});

function ExecutivesPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const ws = useWorkspace();
  const fetchExecs = useServerFn(listExecutives);
  const fetchRoles = useServerFn(listAssociationRoles);
  const nominate = useServerFn(submitNomination);

  const execs = useQuery({ queryKey: ["executives", slug], queryFn: () => fetchExecs({ data: { slug } }), retry: false });
  const roles = useQuery({ queryKey: ["association-roles"], queryFn: () => fetchRoles() });
  const [form, setForm] = useState({ role_key: "treasurer", nominee_name: "", nominee_email: "" });

  const canNominate = (ws.data?.permissions ?? []).includes("executives.nominate") || ws.data?.isOwner;
  const m = useMutation({
    mutationFn: () => nominate({ data: { slug, ...form, notes: null } }),
    onSuccess: () => { toast.success("Nomination submitted for UniEgo review"); setForm({ ...form, nominee_name: "", nominee_email: "" }); qc.invalidateQueries({ queryKey: ["executives", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (execs.isLoading) return <Skeleton className="h-64" />;
  if (execs.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(execs.error as Error).message}</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Executive tenure</CardTitle><CardDescription>Privileges expire automatically at the end of a tenure.</CardDescription></CardHeader>
        <CardContent>
          {(execs.data?.assignments ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No executives appointed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2 pr-3">Officer</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Status</th><th className="py-2">Tenure ends</th></tr>
                </thead>
                <tbody>
                  {(execs.data?.assignments ?? []).map((a: any) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{a.profile?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{a.profile?.email}</div>
                      </td>
                      <td className="py-2 pr-3">{a.role?.name ?? a.role_key}</td>
                      <td className="py-2 pr-3"><Badge variant={a.status === "active" ? "default" : "secondary"} className="capitalize">{a.status}</Badge></td>
                      <td className="py-2">{a.ends_at ? new Date(a.ends_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nominations</CardTitle><CardDescription>UniEgo approves every appointment before privileges activate.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {(execs.data?.nominations ?? []).length > 0 && (
            <ul className="space-y-2">
              {(execs.data?.nominations ?? []).map((n: any) => (
                <li key={n.id} className="flex items-center justify-between gap-3 text-sm border rounded-lg px-3 py-2">
                  <span><span className="font-medium">{n.nominee_name}</span> · {n.role?.name ?? n.role_key}</span>
                  <Badge variant="secondary" className="capitalize">{String(n.status).replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
          {canNominate ? (
            <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
              <div>
                <Label>Role</Label>
                <Select value={form.role_key} onValueChange={(v) => setForm({ ...form, role_key: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(roles.data ?? []).map((r: any) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input required value={form.nominee_name} onChange={(e) => setForm({ ...form, nominee_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" required value={form.nominee_email} onChange={(e) => setForm({ ...form, nominee_email: e.target.value })} /></div>
              <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Nominate</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">You do not have permission to submit nominations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
