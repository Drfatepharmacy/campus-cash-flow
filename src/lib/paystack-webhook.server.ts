import { createHash } from "node:crypto";
import { getPaystackSecret } from "@/lib/payments-guard.server";
import {
  isUniqueConstraintViolation,
  parsePaystackChargeData,
  PaystackPayloadError,
  verifyPaystackSignature,
} from "@/lib/paystack-provider.server";

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type WebhookDeps = {
  getSecret?: () => string;
  getSupabaseAdmin?: () => Promise<SupabaseLike>;
  now?: () => Date;
  sendReceiptEmail?: (args: {
    requestUrl: string;
    reference: string;
    paidAt: string;
    receiptToken: string;
    supabaseAdmin: SupabaseLike;
  }) => Promise<void>;
  logError?: (...args: unknown[]) => void;
};

async function defaultSendReceiptEmail(args: {
  requestUrl: string;
  reference: string;
  paidAt: string;
  receiptToken: string;
  supabaseAdmin: SupabaseLike;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const { data: txn } = await args.supabaseAdmin
    .from("transactions")
    .select("id, total_amount, student:profiles!transactions_student_id_profiles_fkey(email, full_name), payment_request:payment_requests(title)")
    .eq("reference", args.reference)
    .maybeSingle();
  const student = (txn as any)?.student;
  if (!txn || !student?.email) return;
  const pr = (txn as any).payment_request;

  const origin = new URL(args.requestUrl).origin;
  const verifyUrl = `${origin}/verify/${args.receiptToken}`;
  const receiptUrl = `${origin}/receipt/${args.receiptToken}`;

  const { qrPngBase64 } = await import("@/lib/qr-png.server");
  const qrBase64 = qrPngBase64(verifyUrl, { scale: 8, margin: 2 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "UniEgo <support@uniego.app>",
      to: [student.email],
      subject: `Receipt: ${pr?.title ?? "Payment"} — ${args.reference}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1230">
        <h1 style="font-size:22px;color:#3d2169">UniEgo receipt</h1>
        <p>Hi ${String(student.full_name ?? "there")}, your payment for <strong>${String(pr?.title ?? "Payment")}</strong> was successful.</p>
        <p><strong>Amount:</strong> ₦${Number((txn as any).total_amount).toLocaleString()}<br/>
           <strong>Reference:</strong> ${args.reference}<br/>
           <strong>Paid at:</strong> ${new Date(args.paidAt).toLocaleString()}</p>
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
          filename: `receipt-${args.reference}-qr.png`,
          content: qrBase64,
          content_id: "receipt-qr",
          content_type: "image/png",
        },
      ],
    }),
  });
  if (!res.ok) {
    // Best effort only; never fail payment capture because email failed.
    console.error("Resend receipt failed", res.status, await res.text());
  }
}

export async function handlePaystackWebhookRequest(
  request: Request,
  deps: WebhookDeps = {},
): Promise<Response> {
  const logError = deps.logError ?? console.error;
  let secret: string;
  try {
    secret = (deps.getSecret ?? getPaystackSecret)();
  } catch (error) {
    logError("Paystack webhook secret configuration error", error);
    return new Response("not configured", { status: 500 });
  }

  const signature = request.headers.get("x-paystack-signature") ?? "";
  const body = await request.text();
  if (body.length > 200_000) return new Response("payload too large", { status: 413 });
  if (!verifyPaystackSignature(body, signature, secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: { event?: string; id?: string | number; data?: unknown };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (event.event !== "charge.success") return new Response("ok", { status: 200 });

  const now = deps.now?.() ?? new Date();
  let parsed;
  try {
    parsed = parsePaystackChargeData(event.data, { now });
  } catch (error) {
    if (error instanceof PaystackPayloadError) {
      return new Response(error.message, { status: 400 });
    }
    throw error;
  }

  const supabaseAdmin =
    deps.getSupabaseAdmin
      ? await deps.getSupabaseAdmin()
      : (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const payloadHash = createHash("sha256").update(body).digest("hex");
  const eventId = String(event.id ?? parsed.providerRef ?? payloadHash);
  const { error: dupErr } = await supabaseAdmin.from("webhook_events").insert({
    provider: "paystack",
    event_id: eventId,
    event_type: event.event,
    reference: parsed.reference,
    payload_hash: payloadHash,
    outcome: "processing",
  });
  if (dupErr) {
    if (isUniqueConstraintViolation(dupErr)) {
      return new Response("duplicate", { status: 200 });
    }
    logError("Webhook replay insert failed", dupErr);
    return new Response("replay guard unavailable", { status: 500 });
  }

  async function setOutcome(outcome: string) {
    const { error } = await supabaseAdmin
      .from("webhook_events")
      .update({ outcome })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    if (error) logError("Failed to update webhook outcome", { eventId, outcome, error });
  }

  if (parsed.reference.startsWith("PL-")) {
    const { data: out, error: plErr } = await supabaseAdmin.rpc("finalize_link_payment", {
      _reference: parsed.reference,
      _provider_ref: parsed.providerRef,
      _amount_minor: parsed.amountMinor,
      _currency: parsed.currency,
      _paid_at: parsed.paidAt,
      _event_id: eventId,
    });
    if (plErr) {
      await setOutcome("error");
      return new Response("finalize failed", { status: 500 });
    }
    const outcome = String(out ?? "unknown");
    await setOutcome(outcome);
    return new Response(outcome === "captured" || outcome === "already_paid" || outcome === "amount_mismatch" || outcome === "not_found" ? "ok" : outcome, {
      status: 200,
    });
  }

  const { data: rpc, error: finErr } = await supabaseAdmin.rpc("finalize_payment", {
    _reference: parsed.reference,
    _provider: "paystack",
    _provider_ref: parsed.providerRef,
    _provider_event_id: eventId,
    _amount_minor: parsed.amountMinor,
    _currency: parsed.currency,
    _customer_email: parsed.customerEmail,
    _paid_at: parsed.paidAt,
    _raw: event.data as never,
  });
  if (finErr) {
    await setOutcome("error");
    return new Response("finalize failed", { status: 500 });
  }

  const row = (Array.isArray(rpc) ? rpc[0] : rpc) as { outcome: string; qr_token: string | null } | null;
  const outcome = row?.outcome ?? "unknown";
  await setOutcome(outcome);
  if (outcome !== "captured") {
    return new Response(outcome, { status: 200 });
  }

  const receiptToken = row?.qr_token ?? "";
  if (receiptToken) {
    try {
      await (deps.sendReceiptEmail ?? defaultSendReceiptEmail)({
        requestUrl: request.url,
        reference: parsed.reference,
        paidAt: parsed.paidAt,
        receiptToken,
        supabaseAdmin,
      });
    } catch (error) {
      logError("Resend receipt error", error);
    }
  }

  return new Response("ok", { status: 200 });
}
