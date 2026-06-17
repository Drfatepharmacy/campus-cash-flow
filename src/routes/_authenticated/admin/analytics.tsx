import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent } from "@/components/ui/card";
import { formatNaira } from "@/lib/charges";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getAnalytics);
  const q = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fn() });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days of collections.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Stat label="Revenue" value={d ? formatNaira(d.totals.revenue) : "—"} />
        <Stat label="Charges" value={d ? formatNaira(d.totals.charges) : "—"} />
        <Stat label="Paid" value={d ? String(d.totals.paid_count) : "—"} />
        <Stat label="Attempts" value={d ? String(d.totals.attempts) : "—"} />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-medium mb-3">Revenue (₦) — last 30 days</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatNaira(v)} />
                <Line type="monotone" dataKey="revenue" stroke="var(--royal)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="charges" stroke="var(--gold)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-medium mb-3">Top faculties</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d?.topFaculties ?? []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatNaira(v)} />
                  <Bar dataKey="value" fill="var(--royal)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-medium mb-3">Top departments</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d?.topDepartments ?? []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatNaira(v)} />
                  <Bar dataKey="value" fill="var(--emerald)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}
