import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encodePayload, generateToken, type QrPayload } from "./qr-encoder";

const styleSchema = z.object({
  size: z.number().int().min(64).max(2048).default(512),
  margin: z.number().int().min(0).max(16).default(4),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0F1230"),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  ecl: z.enum(["L", "M", "Q", "H"]).default("M"),
  logoDataUrl: z.string().optional(),
}).default({});

const payloadSchema: z.ZodType<QrPayload> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: z.string().url() }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("email"), to: z.string().email(), subject: z.string().optional(), body: z.string().optional() }),
  z.object({ type: z.literal("phone"), number: z.string().min(3).max(20) }),
  z.object({ type: z.literal("sms"), number: z.string().min(3).max(20), message: z.string().optional() }),
  z.object({ type: z.literal("wifi"), ssid: z.string().min(1), password: z.string().optional(), encryption: z.enum(["WPA","WEP","nopass"]).optional(), hidden: z.boolean().optional() }),
  z.object({ type: z.literal("vcard"), firstName: z.string().min(1), lastName: z.string().optional(), org: z.string().optional(), title: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")), url: z.string().url().optional().or(z.literal("")), address: z.string().optional() }),
  z.object({ type: z.literal("location"), latitude: z.number(), longitude: z.number(), label: z.string().optional() }),
  z.object({ type: z.literal("event"), title: z.string().min(1), start: z.string(), end: z.string().optional(), location: z.string().optional(), description: z.string().optional() }),
  z.object({ type: z.literal("payment"), url: z.string().url(), amount: z.number().nonnegative().optional(), reference: z.string().optional() }),
  z.object({ type: z.literal("custom"), value: z.string().min(1).max(2000) }),
]);

const createSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  payload: payloadSchema,
  style: styleSchema.optional(),
  single_use: z.boolean().optional(),
  max_scans: z.number().int().positive().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});

export const createQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const encoded = encodePayload(data.payload);
    const token = generateToken("QR");
    const { data: row, error } = await context.supabase
      .from("qr_codes")
      .insert({
        owner_id: context.userId,
        token,
        label: data.label,
        description: data.description ?? null,
        type: data.payload.type,
        payload: data.payload as unknown as Record<string, unknown>,
        encoded_value: encoded,
        style: (data.style ?? {}) as unknown as Record<string, unknown>,
        single_use: data.single_use ?? false,
        max_scans: data.max_scans ?? null,
        expires_at: data.expires_at ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listQrCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().optional(),
    status: z.enum(["all","active","revoked","archived"]).default("all"),
    includeDeleted: z.boolean().default(false),
    sort: z.enum(["created_desc","created_asc","scans_desc","label_asc"]).default("created_desc"),
  }).partial().parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("qr_codes").select("*");
    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.q) q = q.ilike("label", `%${data.q}%`);
    const sort = data.sort ?? "created_desc";
    if (sort === "created_desc") q = q.order("created_at", { ascending: false });
    if (sort === "created_asc") q = q.order("created_at", { ascending: true });
    if (sort === "scans_desc") q = q.order("scan_count", { ascending: false });
    if (sort === "label_asc") q = q.order("label", { ascending: true });
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    status: z.enum(["active","revoked","archived"]).optional(),
    expires_at: z.string().nullable().optional(),
    max_scans: z.number().int().positive().nullable().optional(),
    single_use: z.boolean().optional(),
    style: styleSchema.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("qr_codes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const softDeleteQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("qr_codes").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("qr_codes").update({ deleted_at: null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase.from("qr_codes").select("*").eq("id", data.id).single();
    if (e1 || !src) throw new Error(e1?.message ?? "Not found");
    const token = generateToken("QR");
    const { data: row, error } = await context.supabase.from("qr_codes").insert({
      owner_id: context.userId,
      token,
      label: `${src.label} (copy)`,
      description: src.description,
      type: src.type,
      payload: src.payload,
      encoded_value: src.encoded_value,
      style: src.style,
      single_use: src.single_use,
      max_scans: src.max_scans,
      expires_at: src.expires_at,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const qrScanHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qrId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("qr_scans").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.qrId) q = q.eq("qr_id", data.qrId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const qrAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: codes }, { data: scans }] = await Promise.all([
      context.supabase.from("qr_codes").select("id,status,scan_count,expires_at,created_at,label,deleted_at,owner_id"),
      context.supabase.from("qr_scans").select("id,result,created_at,qr_id"),
    ]);
    const rows = codes ?? [];
    const scanRows = scans ?? [];
    const now = Date.now();
    const active = rows.filter(r => !r.deleted_at && r.status === "active" && (!r.expires_at || +new Date(r.expires_at) > now)).length;
    const expired = rows.filter(r => !r.deleted_at && r.expires_at && +new Date(r.expires_at) <= now).length;
    const revoked = rows.filter(r => r.status === "revoked").length;
    const archived = rows.filter(r => r.status === "archived").length;
    const successRate = scanRows.length ? Math.round((scanRows.filter(s => s.result === "valid").length / scanRows.length) * 1000) / 10 : 0;

    const byDay = new Map<string, number>();
    scanRows.forEach(s => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    });
    const daily = Array.from(byDay.entries()).sort((a,b) => a[0].localeCompare(b[0])).slice(-30);

    const top = [...rows]
      .filter(r => !r.deleted_at)
      .sort((a,b) => (b.scan_count ?? 0) - (a.scan_count ?? 0))
      .slice(0, 5)
      .map(r => ({ id: r.id, label: r.label, scan_count: r.scan_count }));

    return {
      total: rows.filter(r => !r.deleted_at).length,
      active, expired, revoked, archived,
      total_scans: scanRows.length,
      success_rate: successRate,
      daily, top,
    };
  });

// PUBLIC: lookup + log
export const publicLookupQr = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(4).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.rpc("qr_lookup", { _token: data.token });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { found: false as const };
    return { found: true as const, ...row };
  });

export const publicLogScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(4).max(128), userAgent: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res } = await supabaseAdmin.rpc("qr_log_scan", { _token: data.token, _ip: null as unknown as string, _ua: data.userAgent ?? "" });
    return { result: (res as string) ?? "not_found" };
  });
