// Browser-side, privacy-safe error reporting. Sends only coarse context.
import { recordClientError } from "@/lib/client-errors.functions";

export type ErrKind = "render" | "load" | "chunk" | "network" | "unhandled";
export type ErrCategory = "restart" | "offline" | "timeout" | "permission" | "not_found" | "unknown";

export function newCorrelationId() {
  const b = new Uint8Array(5); crypto.getRandomValues(b);
  return "ERR-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Classifies an error without ever sending its text anywhere. */
export function classify(error: unknown): { kind: ErrKind; category: ErrCategory; restartLike: boolean } {
  const msg = String((error as any)?.message ?? error ?? "").toLowerCase();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const chunk = /dynamically imported module|loading chunk|importing a module script|failed to fetch dynamically/.test(msg);
  const network = /failed to fetch|networkerror|load failed|network request failed|502|503|504/.test(msg);
  const category: ErrCategory = offline ? "offline" : chunk || network ? "restart" : /timeout|timed out/.test(msg) ? "timeout"
    : /unauthor|forbidden|permission/.test(msg) ? "permission" : /not found/.test(msg) ? "not_found" : "unknown";
  return { kind: chunk ? "chunk" : network ? "network" : "render", category, restartLike: chunk || network || offline };
}

function context() {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\//i.test(ua) ? "Opera" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop";
  return { browser, os, device: device as "mobile" | "tablet" | "desktop", online: navigator.onLine };
}

export function reportClientError(error: unknown, kind?: ErrKind, correlationId = newCorrelationId()) {
  if (typeof window === "undefined") return correlationId;
  const c = classify(error);
  recordClientError({ data: { correlation_id: correlationId, route: window.location.pathname, kind: kind ?? c.kind, category: c.category, ...context() } }).catch(() => {});
  return correlationId;
}
