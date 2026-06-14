import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 500 });

        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as { event: string; data: { reference: string; status: string; paid_at?: string; id?: number; metadata?: Record<string, unknown> } };
        if (event.event !== "charge.success") return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const reference = event.data.reference;
        const { data: txn, error: findErr } = await supabaseAdmin
          .from("transactions")
          .select("*, student:profiles!transactions_student_id_fkey(email, full_name), payment_request:payment_requests(title)")
          .eq("reference", reference)
          .maybeSingle();
        if (findErr || !txn) return new Response("txn not found", { status: 404 });
        if (txn.status === "paid") return new Response("already processed", { status: 200 });

        const paidAt = event.data.paid_at ?? new Date().toISOString();
        const { error: upErr } = await supabaseAdmin
          .from("transactions")
          .update({ status: "paid", paid_at: paidAt, paystack_ref: String(event.data.id ?? ""), paystack_response: event.data as any })
          .eq("id", txn.id);
        if (upErr) return new Response("update failed", { status: 500 });

        // Idempotent receipt: insert if not exists.
        const qrToken = `${reference}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const { data: existing } = await supabaseAdmin.from("receipts").select("id, qr_token").eq("transaction_id", txn.id).maybeSingle();
        const receiptToken = existing?.qr_token ?? qrToken;
        if (!existing) {
          await supabaseAdmin.from("receipts").insert({ transaction_id: txn.id, qr_token: qrToken });
        }

        await supabaseAdmin.from("audit_logs").insert({
          action: "payment.completed",
          entity: "transaction",
          entity_id: txn.id,
          metadata: { reference, total_amount: txn.total_amount } as any,
        });

        // Send receipt email if Resend is configured (optional).
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const student = (txn as any).student;
        const pr = (txn as any).payment_request;
        if (RESEND_API_KEY && student?.email) {
          const origin = new URL(request.url).origin;
          const verifyUrl = `${origin}/verify/${receiptToken}`;
          const receiptUrl = `${origin}/receipt/${receiptToken}`;
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "UniPay NG <receipts@resend.dev>",
                to: [student.email],
                subject: `Receipt: ${pr?.title ?? "Payment"} — ${reference}`,
                html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1230">
                  <h1 style="font-size:22px">UniPay NG receipt</h1>
                  <p>Hi ${student.full_name ?? "there"}, your payment for <strong>${pr?.title ?? "Payment"}</strong> was successful.</p>
                  <p><strong>Amount:</strong> ₦${Number(txn.total_amount).toLocaleString()}<br/>
                     <strong>Reference:</strong> ${reference}</p>
                  <p><a href="${receiptUrl}" style="background:#3d2169;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">View receipt</a></p>
                  <p style="color:#666;font-size:12px">Verify at <a href="${verifyUrl}">${verifyUrl}</a></p>
                  <hr/><p style="color:#999;font-size:11px">Powered by EMMTEC Securities</p>
                </div>`,
              }),
            });
          } catch (e) { console.error("Resend send failed", e); }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
