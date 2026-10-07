import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchPlatformUsers, setPlatformAdmin } from "@/lib/superadmin-console.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/users")({
  head: () => ({ meta: [{ title: "Users and roles — UniEgo Super Admin" }, { name: "description", content: "Look up users and manage platform Admin access." }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const search = useServerFn(searchPlatformUsers);
  const setAdmin = useServerFn(setPlatformAdmin);
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  const q = useQuery({ queryKey: ["sa-users", applied], queryFn: () => search({ data: { q: applied } }), retry: false });
  const m = useMutation({
    mutationFn: (v: { user_id: string; grant: boolean }) => setAdmin({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.grant ? "Admin access granted" : "Admin access removed"); qc.invalidateQueries({ queryKey: ["sa-users"] }); },
    onError: (e) => toast.error("That didn't go through", { description: toUserMessage(e) }),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Users className="h-5 w-5 text-royal" /><h1 className="text-2xl font-semibold">Users and roles</h1></div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(term); }}>
        <Input placeholder="Search by name, email or matric number" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      <p className="text-xs text-muted-foreground">Super Admin access is protected and can't be changed here. Association roles change only through leadership approvals.</p>
      {q.isLoading ? <Skeleton className="h-64" /> : (
        <Card><CardContent className="p-0 divide-y">
          {(q.data ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">No users found.</p>}
          {(q.data ?? []).map((u: any) => {
            const isAdmin = u.roles.includes("admin");
            return (
              <div key={u.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{u.full_name || "No name"}</div>
                  <div className="text-xs text-muted-foreground break-all">{u.email}{u.matric_no ? ` · ${u.matric_no}` : ""}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.roles.map((r: string) => <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="capitalize">{r.replace("_", " ")}</Badge>)}
                    {u.associationRoles.map((r: any, i: number) => <Badge key={i} variant="outline" className="capitalize">{r.role.replace("_", " ")} · {r.association}</Badge>)}
                  </div>
                </div>
                <Button size="sm" variant={isAdmin ? "outline" : "default"} disabled={m.isPending} onClick={() => m.mutate({ user_id: u.id, grant: !isAdmin })}>
                  {isAdmin ? "Remove Admin" : "Make Admin"}
                </Button>
              </div>
            );
          })}
        </CardContent></Card>
      )}
    </div>
  );
}
