import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsersWithRoles, setUserRole } from "@/lib/settlements.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & roles — Admin" }] }),
  component: UsersPage,
});

type Role = "super_admin" | "admin" | "student" | "faculty_rep" | "department_rep" | "bank_runner";

const ROLES: { value: Role; label: string; tone: string }[] = [
  { value: "super_admin", label: "Super admin", tone: "bg-foreground text-background" },
  { value: "admin", label: "Admin", tone: "bg-royal text-royal-foreground" },
  { value: "faculty_rep", label: "Faculty rep", tone: "bg-gold text-gold-foreground" },
  { value: "department_rep", label: "Dept rep", tone: "bg-emerald text-emerald-foreground" },
  { value: "bank_runner", label: "Bank runner", tone: "bg-foreground text-background" },
  { value: "student", label: "Student", tone: "" },
];


function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const setFn = useServerFn(setUserRole);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");

  const mut = useMutation({
    mutationFn: (vars: { user_id: string; role: Role; grant: boolean }) => setFn({ data: vars }),
    onSuccess: (_d, v) => { toast.success(`${v.grant ? "Granted" : "Revoked"} ${v.role.replace("_", " ")}`); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return q.data ?? [];
    return (q.data ?? []).filter((u: any) =>
      [u.full_name, u.email, u.matric_no].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Users &amp; roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grant or revoke roles per user. The last admin cannot be removed. Faculty / department reps still need a
          faculty or department assigned on their profile to see scoped data.
        </p>
      </div>

      <Input
        placeholder="Search by name, email, or matric…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Current roles</th>
                <th className="text-left p-3">Manage roles</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u: any) => (
                <tr key={u.id} className="align-top">
                  <td className="p-3">
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {u.matric_no && <div className="text-xs text-muted-foreground">{u.matric_no}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                      {u.roles.map((r: string) => {
                        const meta = ROLES.find((x) => x.value === r);
                        return (
                          <Badge key={r} className={meta?.tone || ""} variant={meta?.tone ? "default" : "secondary"}>
                            {meta?.label ?? r}
                          </Badge>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {ROLES.map((r) => {
                        const has = u.roles.includes(r.value);
                        return (
                          <Button
                            key={r.value}
                            size="sm"
                            variant={has ? "outline" : "secondary"}
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ user_id: u.id, role: r.value, grant: !has })}
                            className="h-7 text-xs"
                          >
                            {has ? <X className="h-3 w-3 mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            {has ? "Revoke" : "Grant"} {r.label}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="p-5 text-center text-sm text-muted-foreground">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
