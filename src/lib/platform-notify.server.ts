
/**
 * Server-only platform notifications.
 * Sends emails directly through Resend.
 */

const DEFAULT_RECIPIENT = "ilomuche@gmail.com";

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

async function sendResendEmail(payload: {
  to: string[];
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[platform-notify] RESEND_API_KEY is missing");
    return { sent: false };
  }

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "UniEgo <support@uniego.app>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...payload }),
    });

    if (!res.ok) {
      console.error(
        "[platform-notify] Resend failed",
        res.status,
        await res.text(),
      );
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("[platform-notify] Send error", error);
    return { sent: false };
  }
}

export async function notifyPlatformAdmins(
  subject: string,
  lines: string[],
) {
  const to =
    process.env.PLATFORM_NOTIFY_EMAIL || DEFAULT_RECIPIENT;

  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px">
    <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
    ${lines.map((line) => `<p style="margin:6px 0;color:#333">${escapeHtml(line)}</p>`).join("")}
    <p style="margin-top:18px;font-size:12px;color:#777">UniEgo platform notification</p>
  </div>`;

  return sendResendEmail({ to: [to], subject, html });
}

export async function notifyEmail(
  to: string,
  subject: string,
  lines: string[],
) {
  if (!to) {
    return { sent: false };
  }

  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px">
    <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
    ${lines.map((line) => `<p style="margin:6px 0;color:#333">${escapeHtml(line)}</p>`).join("")}
    <p style="margin-top:18px;font-size:12px;color:#777">UniEgo</p>
  </div>`;

  return sendResendEmail({ to: [to], subject, html });
}
