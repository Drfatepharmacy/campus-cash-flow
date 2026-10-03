import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const short = (n: number) => z.string().trim().max(n);

/** Public, privacy-safe error beacon. Stores only coarse context — never raw error text. */
export const recordClientError = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    correlation_id: z.string().regex(/^[A-Z0-9-]{6,40}$/),
    route: short(200).transform((r) => r.split("?")[0]!.replace(/[A-Za-z0-9-]{16,}/g, ":id")),
    kind: z.enum(["render", "load", "chunk", "network", "unhandled"]),
    category: z.enum(["restart", "offline", "timeout", "permission", "not_found", "unknown"]),
    browser: short(40).nullable(), os: short(40).nullable(), device: z.enum(["mobile", "tablet", "desktop"]).nullable(),
    online: z.boolean().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("client_error_events").insert({ ...data, occurred_at: new Date().toISOString() });
    return { ok: true };
  });

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only administrators can use this");
}

async function recentSummary() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await supabaseAdmin.from("client_error_events")
    .select("correlation_id, route, kind, category, browser, os, device, online, occurred_at")
    .gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(300);
  return data ?? [];
}

export const listClientErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => { await requireAdmin(context); return recentSummary(); });

export const diagnosePageLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ description: z.string().trim().min(10).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("The troubleshooting assistant is not available right now");
    const events = await recentSummary();
    const count = (f: (e: any) => string) => Object.entries(events.reduce((a: Record<string, number>, e) => { const k = f(e); a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const stats = { total_last_7_days: events.length, by_route: count((e) => e.route), by_kind: count((e) => e.kind), by_category: count((e) => e.category), by_browser: count((e) => `${e.browser}/${e.os}/${e.device}`), offline_share: events.filter((e) => e.online === false).length };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You help non-technical administrators of UniEgo, a campus payments website, troubleshoot pages that fail to load. Reply in plain English with markdown: '## Likely causes' (ranked, each with a one-line why) then '## What to try' (numbered, practical steps a non-developer can do, e.g. refresh, try another browser, check network, note the reference code and contact support). Never mention frameworks, code, servers by product name, or ask for passwords. Keep it under 250 words." },
          { role: "user", content: `Administrator's description:\n${data.description}\n\nAnonymous error stats from the last 7 days (JSON):\n${JSON.stringify(stats)}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error("The assistant is busy. Please try again in a minute.");
    if (res.status === 402) throw new Error("The assistant is out of AI credits. Add credits in workspace settings.");
    if (!res.ok) throw new Error("The assistant couldn't answer right now. Please try again.");
    const j = (await res.json()) as any;
    return { answer: String(j.choices?.[0]?.message?.content ?? ""), stats };
  });
