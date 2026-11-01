// Server-only: load + email official receipts for public payment-link payments.
export async function loadLinkReceipt(db: any, reference: string) {
  const { data: p } = await db.from("payment_link_payments")
    .select("id, reference, payer_name, matric_no, class_label, payer_email, amount_minor, currency, status, paid_at, link:payment_links(title), association:associations(name)")
    .eq("reference", reference).maybeSingle();
  if (!p || p.status !== "paid") return null;
  let { data: r } = await db.from("receipts").select("qr_token, receipt_no, verification_hash, issued_at").eq("link_payment_id", p.id).maybeSingle();
  if (!r) {
    await db.rpc("issue_link_receipt", { _payment_id: p.id });
    ({ data: r } = await db.from("receipts").select("qr_token, receipt_no, verification_hash, issued_at").eq("link_payment_id", p.id).maybeSingle());
  }
  if (!r) return null;
  return {
    reference: p.reference as string, payer_name: p.payer_name as string, matric_no: p.matric_no as string,
    class_label: p.class_label as string, payer_email: (p.payer_email ?? null) as string | null,
    amount_minor: Number(p.amount_minor), currency: p.currency as string, paid_at: p.paid_at as string,
    title: (p.link?.title ?? "Payment") as string, association: (p.association?.name ?? "Association") as string,
    receipt_no: r.receipt_no as string, qr_token: r.qr_token as string, verification_hash: r.verification_hash as string, issued_at: r.issued_at as string,
  };
}

export async function emailLinkReceipt(db: any, reference: string, appOrigin: string) {
  try {
    const rec = await loadLinkReceipt(db, reference);
    if (!rec?.payer_email || rec.payer_email.endsWith("@payer.uniego.app")) return;
    const { notifyEmail } = await import("@/lib/platform-notify.server");
    const amt = `₦${(rec.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    await notifyEmail(rec.payer_email, `Receipt ${rec.receipt_no}: ${rec.title} (${amt})`, [
      `Hi ${rec.payer_name}, your payment to ${rec.association} was successful.`,
      `Payment: ${rec.title}`, `Amount: ${amt}`, `Matric number: ${rec.matric_no} · Class: ${rec.class_label}`,
      `Reference: ${rec.reference}`, `Receipt number: ${rec.receipt_no}`,
      `Date: ${new Date(rec.paid_at).toLocaleString("en-NG")}`,
      `Verify this receipt: ${appOrigin}/verify?token=${rec.qr_token}`,
    ]);
  } catch (e) {
    console.error("link receipt email failed", e);
  }
}
