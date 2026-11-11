import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Scheduled orphaned-payment recovery. Call every 10–15 minutes from a
 * scheduler (e.g. Vercel Cron or cron-job.org) with header
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export const Route = createFileRoute("/api/public/cron/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { reconcilePending } = await import("@/lib/reconcile.server");
  const summary = await reconcilePending(supabaseAdmin, new URL(request.url).origin);
  return Response.json(summary);
}
