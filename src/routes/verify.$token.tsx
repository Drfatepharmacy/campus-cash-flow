import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { verifyReceipt } from "@/lib/verify.functions";
import { publicLookupQr, publicLogScan } from "@/lib/qr.functions";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react";
import { formatNaira } from "@/lib/charges";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({ meta: [{ title: "Verify — UniPay NG" }, { name: "robots", content: "noindex" }] }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useParams();
  const receiptFn = useServerFn(verifyReceipt);
  const qrLookupFn = useServerFn(publicLookupQr);
  const logScanFn = useServerFn(publicLogScan);

  const receipt = useQuery({ queryKey: ["verify-receipt", token], queryFn: () => receiptFn({ data: { token } }) });
  const qr = useQuery({
    queryKey: ["verify-qr", token],
    queryFn: () => qrLookupFn({ data: { token } }),
    enabled: receipt.isSuccess && !receipt.data?.valid,
  });

  // Log a scan when we've resolved to either a receipt or a QR entry
  useEffect(() => {
    if (receipt.data?.valid) return; // receipt path — no scan log
    if (!qr.data) return;
    logScanFn({ data: { token, userAgent: navigator.userAgent.slice(0, 400) } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr.data, receipt.data]);

  const loading = receipt.isLoading || (receipt.isSuccess && !receipt.data?.valid && qr.isLoading);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/verify" className="text-sm text-muted-foreground hover:text-foreground">Scan another →</Link>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-xl w-full px-6 py-16">
        {loading && (
          <Card><CardContent className="p-8 flex items-center gap-3"><Clock className="h-5 w-5 animate-pulse"/> Checking code…</CardContent></Card>
        )}

        {!loading && receipt.data?.valid && (
          <Card className="shadow-elegant">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 text-emerald">
                <CheckCircle2 className="h-5 w-5"/>
                <span className="text-sm font-semibold uppercase tracking-wider">Valid receipt</span>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold">{receipt.data.title}</h1>
              <div className="mt-1 font-display text-2xl">{formatNaira(receipt.data.amount)}</div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Info label="Student" value={receipt.data.student_name}/>
                <Info label="Matric" value={receipt.data.matric_no}/>
                <Info label="Reference" value={receipt.data.reference}/>
                <Info label="Status" value={receipt.data.status}/>
                <Info label="Paid at" value={receipt.data.paid_at ? new Date(receipt.data.paid_at).toLocaleString() : "—"}/>
                <Info label="Receipt issued" value={new Date(receipt.data.issued_at).toLocaleString()}/>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !receipt.data?.valid && qr.data?.found && <QrResult data={qr.data}/>}

        {!loading && !receipt.data?.valid && qr.data && !qr.data.found && (
          <Card className="border-destructive">
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 mx-auto text-destructive"/>
              <h1 className="mt-4 font-display text-2xl font-bold">Not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">This code does not match any receipt or QR code in our system.</p>
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

type QrLookup = {
  found: true; id: string; label: string; description: string | null; type: string;
  encoded_value: string; status: "active"|"revoked"|"archived";
  expires_at: string | null; scan_count: number; max_scans: number | null;
  single_use: boolean; created_at: string;
};

function QrResult({ data }: { data: QrLookup }) {
  const expired = data.expires_at && new Date(data.expires_at).getTime() < Date.now();
  const exhausted = (data.max_scans && data.scan_count >= data.max_scans) || (data.single_use && data.scan_count >= 1);
  const revoked = data.status === "revoked";
  const archived = data.status === "archived";
  const valid = !expired && !exhausted && !revoked && !archived && data.status === "active";

  return (
    <Card className={valid ? "shadow-elegant" : "border-destructive"}>
      <CardContent className="p-8">
        {valid ? (
          <div className="flex items-center gap-2 text-emerald">
            <ShieldCheck className="h-5 w-5"/><span className="text-sm font-semibold uppercase tracking-wider">✅ Verified</span>
          </div>
        ) : revoked ? (
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5"/><span className="text-sm font-semibold uppercase tracking-wider">❌ Revoked</span>
          </div>
        ) : expired || exhausted ? (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5"/><span className="text-sm font-semibold uppercase tracking-wider">⚠ {expired ? "Expired" : "Already used"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-5 w-5"/><span className="text-sm font-semibold uppercase tracking-wider">Archived</span>
          </div>
        )}

        <h1 className="mt-4 font-display text-3xl font-bold">{data.label}</h1>
        {data.description && <p className="text-sm text-muted-foreground mt-1">{data.description}</p>}

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Info label="Type" value={data.type}/>
          <Info label="Status" value={<Badge variant={valid ? "default" : "secondary"}>{data.status}</Badge>}/>
          <Info label="Scans" value={`${data.scan_count}${data.max_scans ? ` / ${data.max_scans}` : ""}`}/>
          <Info label="Issued" value={new Date(data.created_at).toLocaleString()}/>
          {data.expires_at && <Info label="Expires" value={new Date(data.expires_at).toLocaleString()}/>}
          <Info label="Single-use" value={data.single_use ? "Yes" : "No"}/>
        </div>

        <div className="mt-6 rounded-lg border bg-secondary/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Encoded content</div>
          <div className="mt-1 text-sm break-all font-mono">{data.encoded_value}</div>
          {valid && /^https?:\/\//i.test(data.encoded_value) && (
            <a href={data.encoded_value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-royal hover:underline">
              Open link <ExternalLink className="h-3 w-3"/>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium break-words">{value}</div>
    </div>
  );
}
