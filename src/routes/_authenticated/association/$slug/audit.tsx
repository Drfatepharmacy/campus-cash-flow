import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAssociationAudit } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/association/$slug/audit")({
  head: () => ({ meta: [{ title: "Audit log — Association workspace" }, { name: "description", content: "Immutable record of governance and financial actions." }] }),
  component: AuditPage,
});

function AuditPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const list = useServerFn(listAssociationAudit);
  const q = useQuery({ queryKey: ["assoc-audit", slug], queryFn: () => list({ data: { slug } }), retry: false });

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(q.error as Error).message}</CardContent></Card>;
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Append-only. Entries can never be edited or deleted.</CardDescription></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r: any) => (
              <li key={r.id} className="border rounded-lg px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{String(r.action).replace(/[._]/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.entity}{r.entity_id ? ` · ${r.entity_id}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
