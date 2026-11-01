// Browser-only: branded official receipt PDF for public payment-link payments.
export type LinkReceipt = {
  reference: string; payer_name: string; matric_no: string; class_label: string; amount_minor: number;
  currency: string; paid_at: string; title: string; association: string; receipt_no: string; qr_token: string; verification_hash: string;
};

export async function downloadLinkReceiptPdf(r: LinkReceipt) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import("jspdf"), import("@/lib/qr-browser")]);
  const verifyUrl = `${window.location.origin}/verify?token=${r.qr_token}`;
  const qr = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 1, errorCorrectionLevel: "M" });
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  // Brand header (UniEgo purple + gold)
  doc.setFillColor(76, 29, 149); doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(212, 175, 55); doc.rect(0, 90, W, 4, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("UniEgo", 40, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text("Official Payment Receipt", 40, 70);
  doc.setFontSize(10); doc.text(`Receipt No. ${r.receipt_no}`, W - 40, 50, { align: "right" });
  doc.text(new Date(r.paid_at).toLocaleString("en-NG"), W - 40, 70, { align: "right" });

  doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(r.association, 40, 135);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(90, 90, 90); doc.text(r.title, 40, 155);

  const amt = `NGN ${(r.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const rows: [string, string][] = [
    ["Payer name", r.payer_name], ["Matric number", r.matric_no], ["Class / level", r.class_label],
    ["Association", r.association], ["Payment for", r.title], ["Amount paid", amt],
    ["Date paid", new Date(r.paid_at).toLocaleString("en-NG")], ["Reference", r.reference], ["Status", "PAID"],
  ];
  let y = 195;
  for (const [k, v] of rows) {
    doc.setDrawColor(230, 230, 230); doc.line(40, y + 8, W - 200, y + 8);
    doc.setTextColor(110, 110, 110); doc.setFontSize(10); doc.text(k, 40, y);
    doc.setTextColor(20, 20, 20); doc.setFontSize(11); doc.setFont("helvetica", k === "Amount paid" ? "bold" : "normal");
    doc.text(String(v), 170, y, { maxWidth: W - 380 }); doc.setFont("helvetica", "normal");
    y += 28;
  }
  doc.addImage(qr, "PNG", W - 180, 185, 140, 140);
  doc.setFontSize(8); doc.setTextColor(110, 110, 110);
  doc.text("Scan to verify", W - 110, 340, { align: "center" });

  doc.setFillColor(236, 253, 245); doc.roundedRect(40, y + 10, W - 80, 60, 6, 6, "F");
  doc.setTextColor(6, 95, 70); doc.setFontSize(10);
  doc.text(`Verify at ${verifyUrl}`, 50, y + 32, { maxWidth: W - 100 });
  doc.setFontSize(7); doc.text(`Verification hash: ${r.verification_hash}`, 50, y + 54, { maxWidth: W - 100 });

  doc.setTextColor(140, 140, 140); doc.setFontSize(8);
  doc.text("This receipt was issued electronically by UniEgo. Powered by EMMTEC Securities.", W / 2, 800, { align: "center" });
  doc.save(`UniEgo-receipt-${r.reference}.pdf`);
}
