import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { previewCharge, initiatePayment } from "@/lib/payments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pay/$requestId")({
  head: () => ({ meta: [{ title: "Pay — UniPay NG" }] }),
  component: Pay,
});

function Pay() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const preview = useServerFn(previewCharge);
  const initiate = useServerFn(initiatePayment);

  const q = useQuery({ queryKey: ["preview", requestId], queryFn: () => preview({ data: { payment_request_id: requestId } }) });

  const pay = useMutation({
    mutationFn: () => initiate({ data: {
      payment_request_id: requestId,
      callback_url: window.location.origin + "/dashboard",
    } }),
    onSuccess: (res) => { window.location.href = res.authorization_url; },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="mx-auto max-w-xl px-6">
        <div className="flex items-center justify-between">
          <Link to="/dashboard"><Logo /></Link>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4 mr-1"/> Back
          </Button>
        </div>

        <Card className="mt-6 shadow-elegant">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment summary</div>
            <CardTitle className="font-display text-2xl">{q.data?.title ?? "Loading…"}</CardTitle>
          </CardHeader>
          <CardContent>
            {q.isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Loading preview…</div>}
            {q.error && <div className="text-sm text-destructive">{(q.error as Error).message}</div>}
            {q.data && (
              <>
                <div className="space-y-3 text-sm">
                  <Row label="Base amount" value={formatNaira(q.data.base_amount)} />
                  <Row label="Service charge" value={formatNaira(q.data.service_charge)} />
                  <div className="h-px bg-border" />
                  <Row label="Total" value={formatNaira(q.data.total_amount)} bold />
                </div>
                <Button onClick={() => pay.mutate()} disabled={pay.isPending} size="lg" className="w-full mt-6 bg-royal text-royal-foreground hover:opacity-90">
                  {pay.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
                  Pay {formatNaira(q.data.total_amount)} with Paystack
                </Button>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5"/> Secure checkout · You'll be redirected to Paystack
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-display text-xl font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
