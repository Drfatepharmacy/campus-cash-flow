import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAssociationDues, createAssociationDues, setAssociationDuesActive } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pause, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/association/$slug/dues")({
  head: () => ({
    meta: [
      { title: "Dues — Association workspace | UniEgo" },
      { name: "description", content: "Set up association dues, track collections and review dues payment history." },
    ],
  }),
  component: DuesPage,
});

const naira = (minor: number) => `₦${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function DuesPage() {
  const { slug } = useParams({ from: "/_authenticated/association/$slug" });
  const qc = useQueryClient();
  const load = useServerFn(listAssociationDues);
  const create = useServerFn(createAssociationDues);
  const toggle = useServerFn(setAssociationDuesActive);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [level, setLevel] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const q = useQuery({ queryKey: ["dues", slug], queryFn: () => load({ data: { slug } }), retry: false });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dues", slug] });

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          slug,
          title: title.trim(),
          description: description.trim() || null,
          base_amount: Number(amount),
          target_level: level ? Number(level) : null,
          closes_at: closesAt || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dues published — members can now pay");
      setOpen(false); setTitle(""); setDescription(""); setAmount(""); setLevel(""); setClosesAt("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: { slug, ...v } }),
    onSuccess: () => { toast.success("Dues updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{(q.error as Error).message}</CardContent></Card>;

  const d = q.data!;
  const dues = d.dues as any[];
  const totalCollected = dues.reduce((sum, x) => sum + Number(x.stats.collected_minor ?? 0), 0);
  const totalPaid = dues.reduce((sum, x) => sum + Number(x.stats.paid ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Dues items</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{dues.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Payments received</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{totalPaid}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Collected</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{naira(totalCollected)}</p></CardContent></Card>
      </div>

      {d.canManage && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Set up dues</CardTitle><CardDescription>Published dues appear to eligible members on their dashboard.</CardDescription></div>
            <Button size="sm" onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4 mr-1" /> {open ? "Cancel" : "New dues"}</Button>
          </CardHeader>
          {open && (
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {!d.hasCampus && <p className="sm:col-span-2 text-sm text-destructive">This association has no campus set — a platform administrator must set it before dues can be created.</p>}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="dues-title">Title</Label>
                <Input id="dues-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2025/2026 Association dues" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="dues-desc">Description</Label>
                <Textarea id="dues-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the dues cover" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dues-amount">Amount (₦)</Label>
                <Input id="dues-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dues-level">Level (optional)</Label>
                <Input id="dues-level" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dues-closes">Closes at (optional)</Label>
                <Input id="dues-closes" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  disabled={createM.isPending || !d.hasCampus || title.trim().length < 3 || !(Number(amount) > 0)}
                  onClick={() => createM.mutate()}
                >
                  Publish dues
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Dues & collections</CardTitle></CardHeader>
        <CardContent>
          {dues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No dues set up yet.</p>
          ) : (
            <ul className="space-y-3">
              {dues.map((x) => (
                <li key={x.id} className="border rounded-xl p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{x.title}</p>
                    <p className="text-sm text-muted-foreground">
                      ₦{Number(x.base_amount).toLocaleString()} · {x.stats.paid} paid · {x.stats.pending} pending · {naira(Number(x.stats.collected_minor))} collected
                    </p>
                    {x.closes_at && <p className="text-xs text-muted-foreground mt-1">Closes {new Date(x.closes_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={x.active ? "default" : "secondary"}>{x.active ? "Active" : "Paused"}</Badge>
                    {d.canManage && (
                      <Button size="sm" variant="outline" disabled={toggleM.isPending} onClick={() => toggleM.mutate({ id: x.id, active: !x.active })}>
                        {x.active ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Resume</>}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
