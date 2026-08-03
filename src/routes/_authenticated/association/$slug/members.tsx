import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMembers, setMemberStatus } from "@/lib/associations.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/members")({
  head: () => ({ meta: [{ title: "Members — Association workspace" }, { name: "description", content: "Approve, suspend and review association members." }] }),
  component: MembersPage,
});

function MembersPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listMembers);
  const setStatus = useServerFn(setMemberStatus);

  const members = useQuery({ queryKey: ["members", slug], queryFn: () => fetchMembers({ data: { slug } }), retry: false });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "active" | "suspended" | "removed" }) => setStatus({ data: { slug, membership_id: v.id, status: v.status } }),
    onSuccess: () => { toast.success("Member updated"); qc.invalidateQueries({ queryKey: ["members", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (members.isLoading) return <Skeleton className="h-64" />;
  if (members.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(members.error as Error).message}</CardContent></Card>;
  const rows = members.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Members ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />No members yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Matric</th><th className="py-2 pr-3">Status</th><th className="py-2 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.profile?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                    </td>
                    <td className="py-2 pr-3">{r.profile?.matric_no ?? "—"}</td>
                    <td className="py-2 pr-3"><Badge variant={r.status === "active" ? "default" : "secondary"} className="capitalize">{r.status}</Badge></td>
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      {r.status !== "active" && <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, status: "active" })}>Approve</Button>}
                      {r.status === "active" && <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, status: "suspended" })}>Suspend</Button>}
                    </td>
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
