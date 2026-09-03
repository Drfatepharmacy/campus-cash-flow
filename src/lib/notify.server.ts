/**
 * Server-only requester notifications for association lifecycle events.
 *
 * Email goes out over the project's configured mail transport (the existing
 * SMTP/Resend relay in platform-notify.server.ts). SMS goes out over Termii.
 * Every failure is logged and swallowed — a notification must never break the
 * approval, rejection or resubmission that triggered it.
 */

import { notifyEmail } from "./platform-notify.server";

const TERMII_ENDPOINT = "https://api.ndc.termii.com/api/sms/send";

/** Normalise a Nigerian number to Termii's international format (2348012345678). */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;
  if (digits.startsWith("234")) return digits.length >= 13 ? digits : null;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits.length >= 11 ? digits : null;
}

export async function sendSms(to: string | null | undefined, message: string) {
  try {
    const apiKey = process.env["TERMII_API_KEY"];
    const sender = process.env["TERMII_SENDER_ID"] || "UniEgo";
    const phone = normalizePhone(to);
    if (!apiKey) {
      console.warn("[notify] TERMII_API_KEY missing; SMS skipped");
      return { sent: false, reason: "no_api_key" };
    }
    if (!phone) return { sent: false, reason: "no_phone" };

    const res = await fetch(TERMII_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: sender,
        sms: message.slice(0, 300),
        type: "plain",
        channel: "generic",
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[notify] termii send failed", res.status, body);
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[notify] termii error", e);
    return { sent: false, reason: "exception" };
  }
}

export interface RequesterContact {
  email: string | null;
  phone: string | null;
  name?: string | null;
}

/** Resolve the best email + phone for whoever raised an association request. */
export async function resolveRequesterContact(
  supabaseAdmin: any,
  association: { created_by?: string | null; official_email?: string | null; official_phone?: string | null },
): Promise<RequesterContact> {
  let email = association.official_email ?? null;
  let phone = association.official_phone ?? null;
  let name: string | null = null;
  if (association.created_by) {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email, phone, full_name").eq("id", association.created_by).maybeSingle();
    email = prof?.email ?? email;
    phone = prof?.phone ?? phone;
    name = prof?.full_name ?? null;
  }
  return { email, phone, name };
}

/** Send the same notice by email and SMS; neither failure blocks the caller. */
export async function notifyRequester(
  contact: RequesterContact,
  subject: string,
  lines: string[],
  smsText: string,
) {
  const results = await Promise.allSettled([
    contact.email ? notifyEmail(contact.email, subject, lines) : Promise.resolve({ sent: false }),
    sendSms(contact.phone, smsText),
  ]);
  return {
    email: results[0]?.status === "fulfilled" ? results[0].value : { sent: false },
    sms: results[1]?.status === "fulfilled" ? results[1].value : { sent: false },
  };
}
