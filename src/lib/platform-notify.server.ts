/**
 * Server-only platform notifications. Used to alert UniEgo platform
 * administrators about association lifecycle events. Failures are logged and
 * never allowed to break the originating transaction.
 */

const DEFAULT_RECIPIENT = "ilomuche@gmail.com";

export async function notifyPlatformAdmins(subject: string, lines: string[]) {
  try {
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    const to = process.env["PLATFORM_NOTIFY_EMAIL"] || DEFAULT_RECIPIENT;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.warn("[platform-notify] email keys missing; skipped:", subject);
      return { sent: false };
    }

    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
      ${lines.map((l) => `<p style="margin:6px 0;color:#333">${escapeHtml(l)}</p>`).join("")}
      <p style="margin-top:18px;font-size:12px;color:#777">UniEgo platform notification</p>
    </div>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "UniEgo <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[platform-notify] send failed", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[platform-notify] error", e);
    return { sent: false };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
