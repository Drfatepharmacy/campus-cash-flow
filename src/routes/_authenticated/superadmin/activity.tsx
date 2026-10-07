import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlatformActivity } from "@/lib/superadmin-console.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/activity")({
  head: () => ({ meta: [{ title: "Activity log — UniEgo Super Admin" }, { name: "description", content: "Every platform decision and association event, newest first." }] }),
  component: ActivityPage,
});

const KINDS = { all: "All", association: "Associations", nomination: "Leadership", bank: "Bank", payment: "Payments", platform: "Roles" } as const;

function ActivityPage() {
  const load = useServerFn(listPlatformActivity);
  const q = useQuery({ queryKey: ["sa-activity"], queryFn: () => load(), retry: false });
  const [kind, setKind] = useState<keyof typeof KINDS>("all");
  const [search, setSearch] = useState("");
  const rows = (q.data ?? []).filter((r: any) => {
    const okKind = kind === "all" || r.action.startsWith(kind) || (kind === "bank" && r.action.includes("bank"));
    const s = search.trim().toLowerCase();
    return okKind && (!s || r.action.includes(s) || r.association?.name?.toLowerCase().includes(s) || r.actor?.email?.toLowerCase().includes(s));
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-royal" /><h1 className="text-2xl font-semibold">Activity log</h1></div>
      <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
        <TabsList className="flex-wrap h-auto">{Object.entries(KINDS).map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Input placeholder="Search by action, association or person" value={search} onChange={(e) => setSearch(e.target.value)} />
      {q.isLoading ? <Skeleton className="h-64" /> : (
        <Card><CardContent className="p-0 divide-y">
          {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing matches.</p>}
          {rows.map((r: any) => (
            <div key={r.id} className="p-4 text-sm flex flex-wrap justify-between gap-2">
              <div><div className="font-medium capitalize">{r.action.replace(/[._]/g, " ")}</div>
                <div className="text-xs text-muted-foreground">{r.actor?.full_name ?? r.actor?.email ?? "System"}{r.association?.name ? ` · ${r.association.name}` : ""}</div></div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
