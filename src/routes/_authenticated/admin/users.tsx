import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsersWithRoles, setUserRole } from "@/lib/settlements.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & roles — Admin" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const setFn = useServerFn(setUserRole);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });

  const mut = useMutation({
    mutationFn: (vars: { user_id: string; role: "admin"; grant: boolean }) => setFn({ data: vars }),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Users &amp; roles</h1>
        <p className="text-sm text-muted-foreground mt-1">Grant or revoke admin access. The last admin cannot be removed.</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Matric</th>
                <th className="text-left p-3">Roles</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(q.data ?? []).map((u: any) => {
                const isAdmin = u.roles.includes("admin");
                return (
                  <tr key={u.id}>
                    <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                    <td className="p-3 text-xs">{u.email}</td>
                    <td className="p-3 text-xs">{u.matric_no ?? "—"}</td>
                    <td className="p-3"><div className="flex gap-1 flex-wrap">{u.roles.map((r: string) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className={r === "admin" ? "bg-royal text-royal-foreground" : ""}>{r}</Badge>)}</div></td>
                    <td className="p-3 text-right">
                      {isAdmin ? (
                        <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate({ user_id: u.id, role: "admin", grant: false })}>
                          <ShieldOff className="h-3.5 w-3.5 mr-1"/>Revoke admin
                        </Button>
                      ) : (
                        <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate({ user_id: u.id, role: "admin", grant: true })} className="bg-royal text-royal-foreground hover:opacity-90">
                          <ShieldCheck className="h-3.5 w-3.5 mr-1"/>Grant admin
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(q.data ?? []).length === 0 && <tr><td colSpan={5} className="p-5 text-center text-sm text-muted-foreground">No users yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
