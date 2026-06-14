import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminStats } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { formatNaira } from "@/lib/charges";
import { Wallet, TrendingUp, ReceiptText, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview — UniPay NG" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const fn = useServerFn(adminStats);
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });

  const s = q.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time collections across the platform.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Wallet} label="Total revenue" value={s ? formatNaira(s.revenue) : "—"} accent="text-royal"/>
        <Stat icon={TrendingUp} label="Service charges" value={s ? formatNaira(s.charges) : "—"} accent="text-gold"/>
        <Stat icon={ReceiptText} label="Paid transactions" value={s ? String(s.paid_count) : "—"} accent="text-emerald"/>
        <Stat icon={Clock} label="Pending" value={s ? String(s.pending_count) : "—"} accent="text-muted-foreground"/>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className={`h-5 w-5 ${accent}`}/>
        <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
