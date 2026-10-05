import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import QRCode from "@/lib/qr-browser";
import { jsPDF } from "jspdf";
import { getMyReceipt } from "@/lib/receipts.functions";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/charges";
import { Printer, ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/receipt/$token")({
  head: () => ({ meta: [{ title: "Receipt — UniEgo" }] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getMyReceipt);
  const q = useQuery({ queryKey: ["receipt", token], queryFn: () => fn({ data: { token } }) });
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/verify/${token}`;
      QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#1a1230", light: "#ffffff" } }).then(setQr);
    }
  }, [token]);

  const t = q.data?.transaction as any;

  const downloadPdf = () => {
    if (!t) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    let y = 56;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(26, 18, 48);
    doc.text("UniEgo — Official Receipt", 40, y); y += 8;
    doc.setDrawColor(230); doc.line(40, y, w - 40, y); y += 24;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
    doc.text("Powered by EMMTEC Securities", 40, y); y += 24;

    doc.setTextColor(20); doc.setFontSize(11);
    const rows: [string, string][] = [
      ["For payment of", t?.payment_request?.title ?? "—"],
      ["Student", t?.student?.full_name ?? "—"],
      ["Matric", t?.student?.matric_no ?? "—"],
      ["Email", t?.student?.email ?? "—"],
      ["Reference", t?.reference ?? "—"],
      ["Issued", q.data ? new Date(q.data.issued_at).toLocaleString() : "—"],
      ["Paid at", t?.paid_at ? new Date(t.paid_at).toLocaleString() : "—"],
    ];
    for (const [k, v] of rows) {
      doc.setFont("helvetica", "bold"); doc.text(`${k}:`, 40, y);
      doc.setFont("helvetica", "normal"); doc.text(String(v), 160, y);
      y += 18;
    }

    y += 12; doc.setDrawColor(230); doc.line(40, y, w - 40, y); y += 22;
    const amounts: [string, string][] = [
      ["Base amount", formatNaira(Number(t?.base_amount ?? 0))],
      ["Service charge", formatNaira(Number(t?.service_charge ?? 0))],
    ];
    for (const [k, v] of amounts) {
      doc.setFont("helvetica", "normal"); doc.text(k, 40, y);
      doc.text(v, w - 40, y, { align: "right" }); y += 18;
    }
    doc.setDrawColor(200); doc.line(40, y, w - 40, y); y += 22;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("Total paid", 40, y);
    doc.text(formatNaira(Number(t?.total_amount ?? 0)), w - 40, y, { align: "right" });

    if (qr) doc.addImage(qr, "PNG", w - 160, 40, 120, 120);

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Verify at: ${typeof window !== "undefined" ? window.location.origin : ""}/verify/${token}`, 40, doc.internal.pageSize.getHeight() - 40);

    doc.save(`uniego-receipt-${t?.reference ?? token}.pdf`);
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl px-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/dashboard"><Logo /></Link>
          <div className="flex gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1"/>Back</Button></Link>
            <Button size="sm" variant="outline" onClick={downloadPdf} disabled={!t}><Download className="h-4 w-4 mr-1"/>PDF</Button>
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1"/>Print</Button>
          </div>
        </div>


        <Card className="mt-6 shadow-elegant print:shadow-none print:border-2">
          <CardContent className="p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-royal font-semibold">Official receipt</div>
                <h1 className="mt-2 font-display text-3xl font-bold">UniEgo</h1>
                <div className="text-xs text-muted-foreground">Powered by EMMTEC Securities</div>
              </div>
              {qr && <img src={qr} alt="Verification QR" className="h-28 w-28 rounded-lg border"/>}
            </div>

            <div className="mt-8 h-px bg-border" />

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">For payment of</div>
              <div className="font-display text-xl font-semibold mt-1">{t?.payment_request?.title ?? "—"}</div>
              {t?.payment_request?.description && <div className="text-sm text-muted-foreground mt-1">{t.payment_request.description}</div>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <Info label="Student" value={t?.student?.full_name ?? "—"}/>
              <Info label="Matric" value={t?.student?.matric_no ?? "—"}/>
              <Info label="Email" value={t?.student?.email ?? "—"}/>
              <Info label="Reference" value={t?.reference ?? "—"}/>
              <Info label="Issued" value={q.data ? new Date(q.data.issued_at).toLocaleString() : "—"}/>
              <Info label="Paid at" value={t?.paid_at ? new Date(t.paid_at).toLocaleString() : "—"}/>
            </div>

            <div className="mt-8 rounded-2xl bg-secondary p-5 print:bg-transparent print:border">
              <Row label="Base amount" value={formatNaira(Number(t?.base_amount ?? 0))} />
              <Row label="Service charge" value={formatNaira(Number(t?.service_charge ?? 0))} />
              <div className="h-px bg-border my-3" />
              <Row label="Total paid" value={formatNaira(Number(t?.total_amount ?? 0))} bold />
            </div>

            <div className="mt-6 text-xs text-muted-foreground text-center">
              Scan the QR code or visit <span className="font-mono">/verify/{token}</span> to verify this receipt.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={bold ? "font-display text-xl font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
