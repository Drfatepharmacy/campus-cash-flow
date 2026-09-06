/**
 * Turns any thrown value into a short, safe, human sentence.
 * Never leaks stack traces, file paths, framework internals, SQL, URLs or keys.
 */

const LEAKY = [
  /supabase/i,
  /postgres|pgrst|sql|relation "|column "/i,
  /tanstack|vite|react|node_modules|webpack/i,
  /\bsrc\/|\.tsx?\b|\.js\b|at\s+\w+\s+\(/i,
  /https?:\/\//i,
  /eyJ[A-Za-z0-9_-]{10,}/,
  /\b(sb_secret|sb_publishable|sk_live|sk_test|pk_live|bearer|api[_-]?key|service[_ -]?role|process\.env)\b/i,
  /\b[A-Z][A-Z0-9_]{6,}\b/,
];

const FRIENDLY: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "That email and password don't match. Please try again."],
  [/email not confirmed/i, "Please open the verification link we emailed you, then sign in."],
  [/user already registered|already been registered/i, "An account already exists for that email. Try signing in instead."],
  [/password.*(6|short|weak)/i, "Please choose a longer password (at least 6 characters)."],
  [/rate limit|too many/i, "Too many attempts. Please wait a moment and try again."],
  [/popup|window closed|closed by user/i, "The sign-in window closed before finishing. Please try again."],
  [/unsupported provider|provider is not enabled/i, "Google sign-in isn't available right now. Please use your email and password."],
  [/network|fetch failed|timeout|offline/i, "We couldn't reach the network. Check your connection and try again."],
  [/unauthorized|not authorized|permission|forbidden|401|403/i, "You don't have permission to do that."],
  [/not found|404/i, "We couldn't find what you were looking for."],
];

export function toUserMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  if (!raw) return fallback;

  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw)) return message;
  }

  const oneLine = raw.split("\n")[0].trim();
  if (!oneLine || oneLine.length > 160) return fallback;
  if (LEAKY.some((p) => p.test(oneLine))) return fallback;
  return oneLine;
}
