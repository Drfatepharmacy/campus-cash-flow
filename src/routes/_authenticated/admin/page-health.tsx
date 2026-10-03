import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClientErrors, diagnosePageLoad } from "@/lib/client-errors.functions";
import { toUserMessage } from "@/lib/user-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/page-health")({
  head: () => ({ meta: [{ title: "Page health — Admin | UniEgo" }] }),
  component: PageHealth,
});

function PageHealth() {
  const list = useServerFn(listClientErrors);
  const diagnose = useServerFn(diagnosePageLoad);
  const q = useQuery({ queryKey: ["client-errors"], queryFn: () => list(), retry: false });
  const [desc, setDesc] = useState("");
  const m = useMutation({ mutationFn: () => diagnose({ data: { description: desc } }) });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Troubleshooting assistant</CardTitle><CardDescription>Describe the problem. The assistant also looks at the last 7 days of page errors.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} placeholder="e.g. Students on iPhone say the dues page shows 'didn't load' every evening" />
          <Button disabled={desc.trim().length < 10 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}Find likely causes
          </Button>
          {m.error && <p className="text-sm text-destructive">{toUserMessage(m.error)}</p>}
          {m.data && <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">{m.data.answer}</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent page errors</CardTitle><CardDescription>No personal data or error text is stored.</CardDescription></CardHeader>
        <CardContent>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No errors in the last 7 days.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr><th className="py-2 pr-3">When</th><th className="pr-3">Page</th><th className="pr-3">Type</th><th className="pr-3">Browser</th><th>Reference</th></tr></thead>
              <tbody>{(q.data ?? []).map((e: any) => (
                <tr key={e.correlation_id + e.occurred_at} className="border-b last:border-0">
                  <td className="py-2 pr-3">{new Date(e.occurred_at).toLocaleString()}</td><td className="pr-3 font-mono text-xs">{e.route}</td>
                  <td className="pr-3">{e.category}</td><td className="pr-3">{e.browser} · {e.os} · {e.device}{e.online === false ? " · offline" : ""}</td><td className="font-mono text-xs">{e.correlation_id}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
