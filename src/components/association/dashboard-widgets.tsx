import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSuperCounts } from "@/lib/superadmin-console.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";

export function SuperAdminCard() {
  const load = useServerFn(getSuperCounts);
  const q = useQuery({ queryKey: ["sa-counts"], queryFn: () => load(), retry: false });
  const c = q.data;
  return (
    <Card className="bg-royal text-royal-foreground border-0">
      <CardContent className="p-5 flex flex-wrap items-center gap-4">
        <ShieldCheck className="h-6 w-6 text-gold" />
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold">Super Admin console</div>
          <div className="text-sm text-royal-foreground/80">
            {c ? `${c.applications} applications · ${c.leadership} leadership · ${c.bank} bank accounts waiting` : "Review applications, leaders and bank accounts"}
          </div>
        </div>
        <Link to="/superadmin"><Button size="sm" className="bg-gold text-gold-foreground hover:opacity-90">Open console <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
      </CardContent>
    </Card>
  );
}

const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "verified", label: "Verified" },
  { key: "active", label: "Active" },
];

export function ApplicationTimeline({ association: a }: { association: any }) {
  const s = String(a.status ?? "draft");
  if (s === "draft") {
    return (
      <Link to="/associations/new" search={{ resume: a.id, slug: a.slug }}>
        <Button size="sm" variant="outline">Continue application</Button>
      </Link>
    );
  }
  if (s === "rejected") {
    return (
      <Link to="/associations/new" search={{ resume: a.id, slug: a.slug }}>
        <Button size="sm" variant="outline">Fix and resubmit</Button>
      </Link>
    );
  }
  const idx = STEPS.findIndex((x) => x.key === s);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1 text-[11px]">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${i <= idx ? "bg-emerald" : "bg-muted-foreground/30"}`} />
          <span className={i <= idx ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
          {i < STEPS.length - 1 && <span className="w-3 h-px bg-border" />}
        </li>
      ))}
    </ol>
  );
}
