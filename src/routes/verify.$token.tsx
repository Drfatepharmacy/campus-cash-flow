import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyReceipt } from "@/lib/verify.functions";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatNaira } from "@/lib/charges";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({ meta: [{ title: "Verify receipt — UniPay NG" }, { name: "robots", content: "noindex" }] }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useParams();
  const fn = useServerFn(verifyReceipt);
  const q = useQuery({ queryKey: ["verify", token], queryFn: () => fn({ data: { token } }) });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center"><Link to="/"><Logo /></Link></div>
      </header>
      <main className="flex-1 mx-auto max-w-xl w-full px-6 py-16">
        {q.isLoading && <Card><CardContent className="p-8 flex items-center gap-3"><Clock className="h-5 w-5 animate-pulse"/> Checking receipt…</CardContent></Card>}
        {!q.isLoading && !q.data?.valid && (
          <Card className="border-destructive">
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 mx-auto text-destructive"/>
              <h1 className="mt-4 font-display text-2xl font-bold">Receipt not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">This QR code does not match any receipt in our system.</p>
            </CardContent>
          </Card>
        )}
        {q.data?.valid && (
          <Card className="shadow-elegant">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 text-emerald">
                <CheckCircle2 className="h-5 w-5"/>
                <span className="text-sm font-semibold uppercase tracking-wider">Valid receipt</span>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold">{q.data.title}</h1>
              <div className="mt-1 font-display text-2xl">{formatNaira(q.data.amount)}</div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Info label="Student" value={q.data.student_name}/>
                <Info label="Matric" value={q.data.matric_no}/>
                <Info label="Reference" value={q.data.reference}/>
                <Info label="Status" value={q.data.status}/>
                <Info label="Paid at" value={q.data.paid_at ? new Date(q.data.paid_at).toLocaleString() : "—"}/>
                <Info label="Receipt issued" value={new Date(q.data.issued_at).toLocaleString()}/>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium break-words">{value}</div>
    </div>
  );
}
