
/**
 * Server-only UniEgo email service.
 * Sends transactional emails through Resend.
 */

const DEFAULT_RECIPIENT = "ilomuche@gmail.com";
const DEFAULT_FROM = "UniEgo <support@uniego.app>";

type EmailResult = {
  sent: boolean;
  id?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

async function sendResendEmail(payload: {
  to: string[];
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("[UniEgo email] RESEND_API_KEY is missing");
    return { sent: false };
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        ...payload,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[UniEgo email] Resend request failed", {
        status: response.status,
        message: result?.message ?? "Email delivery request failed",
      });

      return { sent: false };
    }

    return {
      sent: true,
      id: typeof result?.id === "string" ? result.id : undefined,
    };
  } catch (error) {
    console.error(
      "[UniEgo email] Request failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    return { sent: false };
  }
}

function createEmailHtml(subject: string, lines: string[]): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1230">
      <h2>${escapeHtml(subject)}</h2>
      ${lines
        .map(
          (line) =>
            `<p style="margin:8px 0;line-height:1.6">${escapeHtml(line)}</p>`,
        )
        .join("")}
      <hr style="border:0;border-top:1px solid #eee;margin:24px 0" />
      <p style="font-size:12px;color:#777">
        UniEgo — Pay with Ease and Stress Free.
        Powered by EMMTEC Securities.
      </p>
    </div>
  `;
}

export async function notifyPlatformAdmins(
  subject: string,
  lines: string[],
): Promise<EmailResult> {
  const recipient =
    process.env.PLATFORM_NOTIFY_EMAIL || DEFAULT_RECIPIENT;

  return sendResendEmail({
    to: [recipient],
    subject,
    html: createEmailHtml(subject, lines),
  });
}

export async function notifyEmail(
  to: string,
  subject: string,
  lines: string[],
): Promise<EmailResult> {
  if (!to?.trim()) {
    return { sent: false };
  }

  return sendResendEmail({
    to: [to.trim()],
    subject,
    html: createEmailHtml(subject, lines),
  });
}
