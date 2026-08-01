import { createFileRoute } from "@tanstack/react-router";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import QRCode from "qrcode";


export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 500 });

        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        if (body.length > 200_000) return new Response("payload too large", { status: 413 });
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        let event: {
          event: string;
          id?: string | number;
          data: {
            reference: string; status: string; paid_at?: string; id?: number;
            amount?: number; currency?: string; customer?: { email?: string };
            metadata?: Record<string, unknown>;
          };
        };
        try { event = JSON.parse(body); } catch { return new Response("bad json", { status: 400 }); }
        if (event.event !== "charge.success") return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const reference = String(event.data?.reference ?? "");
        if (!/^[A-Za-z0-9-]{8,80}$/.test(reference)) return new Response("bad reference", { status: 400 });

        // Replay protection: the (provider, event_id) pair may only be processed once.
        const payloadHash = createHash("sha256").update(body).digest("hex");
        const eventId = String(event.id ?? event.data?.id ?? payloadHash);
        const { error: dupErr } = await supabaseAdmin.from("webhook_events").insert({
          provider: "paystack",
          event_id: eventId,
          event_type: event.event,
          reference,
          payload_hash: payloadHash,
          outcome: "processing",
        });
        if (dupErr) {
          // Unique violation => already handled. Ack so Paystack stops retrying.
          return new Response("duplicate", { status: 200 });
        }

        const { data: rpc, error: finErr } = await supabaseAdmin.rpc("finalize_payment", {
          _reference: reference,
          _provider: "paystack",
          _provider_ref: String(event.data.id ?? ""),
          _provider_event_id: eventId,
          _amount_minor: Number(event.data.amount ?? -1),
          _currency: String(event.data.currency ?? "NGN").toUpperCase(),
          _customer_email: event.data.customer?.email ?? "",
          _paid_at: event.data.paid_at ?? new Date().toISOString(),
          _raw: event.data as never,
        });
        if (finErr) {
          await supabaseAdmin.from("webhook_events").update({ outcome: "error" }).eq("provider", "paystack").eq("event_id", eventId);
          return new Response("finalize failed", { status: 500 });
        }

        const row = (Array.isArray(rpc) ? rpc[0] : rpc) as { outcome: string; transaction_id: string | null; qr_token: string | null } | null;
        const outcome = row?.outcome ?? "unknown";
        await supabaseAdmin.from("webhook_events").update({ outcome }).eq("provider", "paystack").eq("event_id", eventId);

        if (outcome !== "captured") {
          // already_paid / amount_mismatch / not_found are recorded in the ledger; ack to stop retries.
          return new Response(outcome, { status: 200 });
        }

        const receiptToken = row?.qr_token ?? "";
        const { data: txn } = await supabaseAdmin
          .from("transactions")
          .select("id, total_amount, student:profiles!transactions_student_id_fkey(email, full_name), payment_request:payment_requests(title)")
          .eq("reference", reference)
          .maybeSingle();
        if (!txn) return new Response("ok", { status: 200 });
        const paidAt = event.data.paid_at ?? new Date().toISOString();


        // Send receipt email via Resend connector gateway.
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const student = (txn as any).student;
        const pr = (txn as any).payment_request;
        if (LOVABLE_API_KEY && RESEND_API_KEY && student?.email) {
          const origin = new URL(request.url).origin;
          const verifyUrl = `${origin}/verify/${receiptToken}`;
          const receiptUrl = `${origin}/receipt/${receiptToken}`;
          try {
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 320, margin: 1, color: { dark: "#1a1230", light: "#ffffff" } });
            const qrBase64 = qrDataUrl.split(",")[1] ?? "";
            const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": RESEND_API_KEY,
              },
              body: JSON.stringify({
                from: "UniEgo <onboarding@resend.dev>",
                to: [student.email],
                subject: `Receipt: ${pr?.title ?? "Payment"} — ${reference}`,
                html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1230">
                  <h1 style="font-size:22px;color:#3d2169">UniEgo receipt</h1>
                  <p>Hi ${student.full_name ?? "there"}, your payment for <strong>${pr?.title ?? "Payment"}</strong> was successful.</p>
                  <p><strong>Amount:</strong> ₦${Number(txn.total_amount).toLocaleString()}<br/>
                     <strong>Reference:</strong> ${reference}<br/>
                     <strong>Paid at:</strong> ${new Date(paidAt).toLocaleString()}</p>
                  <div style="text-align:center;margin:24px 0">
                    <img src="cid:receipt-qr" alt="Verification QR" width="180" height="180" style="border:1px solid #eee;border-radius:12px;padding:8px;background:#fff"/>
                    <div style="font-size:11px;color:#666;margin-top:8px">Scan to verify this receipt</div>
                  </div>
                  <p style="text-align:center"><a href="${receiptUrl}" style="background:#3d2169;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">View receipt</a></p>
                  <p style="color:#666;font-size:12px">Or verify at <a href="${verifyUrl}">${verifyUrl}</a></p>
                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
                  <p style="color:#999;font-size:11px">UniEgo — Pay with Ease and Stress Free<br/>Powered by EMMTEC Securities</p>
                </div>`,
                attachments: [
                  {
                    filename: `receipt-${reference}-qr.png`,
                    content: qrBase64,
                    content_id: "receipt-qr",
                    content_type: "image/png",
                  },
                ],
              }),
            });
            if (!res.ok) console.error("Resend send failed", res.status, await res.text());
          } catch (e) { console.error("Resend send error", e); }

        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
