import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAssociationContext, requirePermission } from "@/lib/association-access";
import { maskName, maskMatric, priceForClass, normMatric, type ClassPrice } from "@/lib/payment-link-utils";

const token = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadLink(tok: string) {
  const db = await admin();
  const { data } = await db
    .from("payment_links")
    .select("id, token, title, description, class_prices, active, association_id, association:associations(name, short_name, status)")
    .eq("token", tok)
    .maybeSingle();
  if (!data) throw new Error("This payment link does not exist");
  return data as any;
}

/* ---------------- Public (no sign-in) ---------------- */

export const getPublicLink = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const l = await loadLink(data.token);
    return {
      token: l.token, title: l.title, description: l.description,
      class_prices: (l.class_prices ?? []) as ClassPrice[],
      active: Boolean(l.active) && l.association?.status === "active",
      association: l.association?.short_name || l.association?.name || "Association",
    };
  });

export const startLinkPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token,
    payer_name: z.string().trim().min(3).max(120),
    matric_no: z.string().trim().min(4).max(30),
    class_label: z.string().trim().min(1).max(40),
    payer_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    callback_url: z.string().url(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { getPaystackSecret } = await import("@/lib/payments-guard.server");
    const secret = getPaystackSecret();
    const l = await loadLink(data.token);
    if (!l.active || l.association?.status !== "active") throw new Error("This payment link is not accepting payments right now");
    const amount = priceForClass(l.class_prices ?? [], data.class_label);
    const matric = normMatric(data.matric_no);
    const cb = new URL(data.callback_url);
    const { randomUUID } = await import("node:crypto");
    const reference = `PL-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
    const email = data.payer_email || `${matric.toLowerCase()}@payer.uniego.app`;

    const db = await admin();
    const { error } = await db.from("payment_link_payments").insert({
      link_id: l.id, association_id: l.association_id, reference,
      payer_name: data.payer_name, matric_no: matric, class_label: data.class_label,
      payer_email: data.payer_email || null, amount_minor: amount, status: "pending", source: "online",
    });
    if (error) throw new Error("We couldn't start this payment. Please try again.");

    cb.searchParams.set("ref", reference);
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount, currency: "NGN", reference, callback_url: cb.toString(),
        metadata: { kind: "payment_link", link_id: l.id, matric_no: matric, class: data.class_label } }),
    });
    const json = (await res.json()) as { status: boolean; data?: { authorization_url: string } };
    if (!json.status || !json.data) throw new Error("The payment page could not be opened. Please try again.");
    return { authorization_url: json.data.authorization_url, reference };
  });

/** Called after Paystack redirects back — double-checks with Paystack, then records. */
export const confirmLinkPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ reference: z.string().regex(/^PL-[A-Z0-9-]{8,60}$/) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("payment_link_payments").select("status, amount_minor, payer_name, class_label").eq("reference", data.reference).maybeSingle();
    if (!p) return { status: "not_found" as const };
    if (p.status === "paid") return { status: "paid" as const, amount_minor: p.amount_minor, payer: maskName(p.payer_name) };
    const { getPaystackSecret } = await import("@/lib/payments-guard.server");
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${getPaystackSecret()}` },
    });
    const j = (await res.json()) as any;
    if (j?.data?.status === "success") {
      const { data: out } = await db.rpc("finalize_link_payment", {
        _reference: data.reference, _provider_ref: String(j.data.id ?? ""), _amount_minor: Number(j.data.amount),
        _currency: String(j.data.currency ?? "NGN"), _paid_at: j.data.paid_at ?? new Date().toISOString(), _event_id: `verify-${j.data.id}`,
      });
      if (out === "captured" || out === "already_paid") return { status: "paid" as const, amount_minor: p.amount_minor, payer: maskName(p.payer_name) };
      return { status: "problem" as const };
    }
    return { status: "pending" as const };
  });

export const getPublicLedger = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token, class_label: z.string().max(40).nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const l = await loadLink(data.token);
    const db = await admin();
    let q = db.from("payment_link_payments").select("payer_name, matric_no, class_label, amount_minor, paid_at, source")
      .eq("link_id", l.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(5000);
    if (data.class_label) q = q.eq("class_label", data.class_label);
    const { data: rows } = await q;
    const list = (rows ?? []).map((r: any) => ({
      name: maskName(r.payer_name), matric: maskMatric(r.matric_no), class_label: r.class_label,
      amount_minor: Number(r.amount_minor), paid_at: r.paid_at, source: r.source,
    }));
    return {
      title: l.title, association: l.association?.short_name || l.association?.name,
      classes: ((l.class_prices ?? []) as ClassPrice[]).map((c) => c.class),
      rows: list, total_minor: list.reduce((s, r) => s + r.amount_minor, 0),
    };
  });

/* ---------------- Officer (signed in, dues permissions) ---------------- */

const priceSchema = z.array(z.object({ class: z.string().trim().min(1).max(40), amount_minor: z.number().int().positive().max(1_000_000_000) })).min(1).max(30);

export const listPaymentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.view");
    const db = await admin();
    const { data: links } = await db.from("payment_links").select("*").eq("association_id", ctx.association.id).order("created_at", { ascending: false });
    const { data: pays } = await db.from("payment_link_payments").select("link_id, amount_minor").eq("association_id", ctx.association.id).eq("status", "paid");
    const agg: Record<string, { count: number; total: number }> = {};
    for (const p of pays ?? []) { const a = (agg[p.link_id] ??= { count: 0, total: 0 }); a.count++; a.total += Number(p.amount_minor); }
    return {
      canManage: ctx.permissions.includes("dues.manage"),
      links: (links ?? []).map((l: any) => ({ ...l, paid_count: agg[l.id]?.count ?? 0, paid_total_minor: agg[l.id]?.total ?? 0 })),
    };
  });

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    slug: z.string().min(1).max(80), title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).optional().nullable(), class_prices: priceSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.manage");
    if (ctx.association.status !== "active") throw new Error("Your association must be active before collecting payments");
    const bytes = new Uint8Array(12); globalThis.crypto.getRandomValues(bytes);
    const tok = "PAY-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const db = await admin();
    const { data: row, error } = await db.from("payment_links").insert({
      association_id: ctx.association.id, token: tok, title: data.title, description: data.description ?? null,
      class_prices: data.class_prices, created_by: context.userId,
    }).select("id, token").single();
    if (error) throw new Error("Could not create the payment link");
    await db.from("audit_logs").insert({ actor_id: context.userId, action: "payment_link.created", entity: "payment_link", entity_id: row.id, association_id: ctx.association.id, metadata: { title: data.title } });
    return row;
  });

async function officerLink(context: any, slug: string, linkId: string, perm: "dues.view" | "dues.manage") {
  const ctx = await loadAssociationContext(context.supabase, context.userId, slug);
  requirePermission(ctx, perm);
  const db = await admin();
  const { data: link } = await db.from("payment_links").select("*").eq("id", linkId).eq("association_id", ctx.association.id).maybeSingle();
  if (!link) throw new Error("Payment link not found");
  return { ctx, db, link: link as any };
}

export const setPaymentLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), link_id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ctx, db, link } = await officerLink(context, data.slug, data.link_id, "dues.manage");
    await db.from("payment_links").update({ active: data.active }).eq("id", link.id);
    await db.from("audit_logs").insert({ actor_id: context.userId, action: data.active ? "payment_link.resumed" : "payment_link.paused", entity: "payment_link", entity_id: link.id, association_id: ctx.association.id });
    return { ok: true };
  });

export const recordOfflinePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    slug: z.string(), link_id: z.string().uuid(),
    payer_name: z.string().trim().min(3).max(120), matric_no: z.string().trim().min(4).max(30),
    class_label: z.string().trim().min(1).max(40),
    method: z.enum(["cash", "bank_transfer", "pos", "other"]),
    note: z.string().trim().max(300).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ctx, db, link } = await officerLink(context, data.slug, data.link_id, "dues.manage");
    const amount = priceForClass(link.class_prices ?? [], data.class_label);
    const matric = normMatric(data.matric_no);
    const { data: dup } = await db.from("payment_link_payments").select("id").eq("link_id", link.id).eq("matric_no", matric).eq("status", "paid").maybeSingle();
    if (dup) throw new Error("This matric number is already marked as paid for this item");
    const { randomUUID } = await import("node:crypto");
    const reference = `OFF-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const { data: row, error } = await db.from("payment_link_payments").insert({
      link_id: link.id, association_id: ctx.association.id, reference, payer_name: data.payer_name, matric_no: matric,
      class_label: data.class_label, amount_minor: amount, status: "paid", source: "offline", offline_method: data.method,
      note: data.note ?? null, recorded_by: context.userId, paid_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw new Error("Could not record this payment");
    await db.from("audit_logs").insert({ actor_id: context.userId, action: "payment_link.offline_recorded", entity: "payment_link_payment", entity_id: row.id, association_id: ctx.association.id, metadata: { reference, matric, amount_minor: amount, method: data.method } });
    return { ok: true };
  });

export const uploadRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    slug: z.string(), link_id: z.string().uuid(), replace: z.boolean().default(false),
    rows: z.array(z.object({ matric_no: z.string().trim().min(4).max(30), full_name: z.string().trim().max(120).optional().nullable(), class_label: z.string().trim().max(40).optional().nullable() })).min(1).max(5000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ctx, db, link } = await officerLink(context, data.slug, data.link_id, "dues.manage");
    if (data.replace) await db.from("payment_link_roster").delete().eq("link_id", link.id);
    const seen = new Map<string, any>();
    for (const r of data.rows) { const m = normMatric(r.matric_no); seen.set(m, { link_id: link.id, association_id: ctx.association.id, matric_no: m, full_name: r.full_name || null, class_label: r.class_label || null }); }
    const { error } = await db.from("payment_link_roster").upsert([...seen.values()], { onConflict: "link_id,matric_no" });
    if (error) throw new Error("Could not save the student list");
    await db.from("audit_logs").insert({ actor_id: context.userId, action: "payment_link.roster_uploaded", entity: "payment_link", entity_id: link.id, association_id: ctx.association.id, metadata: { count: seen.size } });
    return { saved: seen.size };
  });

/** Full (unmasked) report for officers: payments, roster, paid vs defaulters. */
export const getLinkReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), link_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, link } = await officerLink(context, data.slug, data.link_id, "dues.view");
    const [{ data: pays }, { data: roster }] = await Promise.all([
      db.from("payment_link_payments").select("reference, payer_name, matric_no, class_label, amount_minor, source, offline_method, paid_at").eq("link_id", link.id).eq("status", "paid").order("paid_at", { ascending: false }),
      db.from("payment_link_roster").select("matric_no, full_name, class_label").eq("link_id", link.id).order("matric_no"),
    ]);
    const paidSet = new Set((pays ?? []).map((p: any) => p.matric_no));
    const rosterRows = (roster ?? []).map((r: any) => ({ ...r, paid: paidSet.has(r.matric_no) }));
    return {
      link: { id: link.id, title: link.title, token: link.token, class_prices: link.class_prices as ClassPrice[], active: link.active },
      payments: pays ?? [],
      roster: rosterRows,
      defaulters: rosterRows.filter((r) => !r.paid),
    };
  });
