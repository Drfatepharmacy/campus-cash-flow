import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public verification — no auth. Returns safe projection only. */
export const verifyReceipt = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: receipt } = await supabaseAdmin
      .from("receipts")
      .select("id, issued_at, transaction:transactions(reference, base_amount, service_charge, total_amount, status, paid_at, payment_request:payment_requests(title), student:profiles!transactions_student_id_fkey(full_name, matric_no))")
      .eq("qr_token", data.token)
      .maybeSingle();
    if (!receipt || !receipt.transaction) return { valid: false as const };
    const t = receipt.transaction as unknown as {
      reference: string; total_amount: number; status: string; paid_at: string | null;
      payment_request: { title: string } | null;
      student: { full_name: string | null; matric_no: string | null } | null;
    };
    return {
      valid: true as const,
      receipt_id: receipt.id,
      issued_at: receipt.issued_at,
      reference: t.reference,
      title: t.payment_request?.title ?? "Payment",
      amount: Number(t.total_amount),
      status: t.status,
      paid_at: t.paid_at,
      student_name: t.student?.full_name ?? "—",
      matric_no: t.student?.matric_no ?? "—",
    };
  });
