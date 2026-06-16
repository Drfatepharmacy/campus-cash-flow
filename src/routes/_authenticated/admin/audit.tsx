import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs } from "@/lib/audit.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — Admin" }] }),
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(listAuditLogs);
  const q = useQuery({ queryKey: ["audit"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Audit log</h1>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Actor</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Entity</th>
                <th className="text-left p-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(q.data ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="p-3">{l.actor?.full_name ?? l.actor?.email ?? <span className="text-muted-foreground">system</span>}</td>
                  <td className="p-3"><Badge variant="secondary" className="font-mono text-[10px]">{l.action}</Badge></td>
                  <td className="p-3 text-xs">{l.entity}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ""}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground max-w-md truncate">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
                </tr>
              ))}
              {(q.data ?? []).length === 0 && <tr><td colSpan={5} className="p-5 text-center text-sm text-muted-foreground">No audit events yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
