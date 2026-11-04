import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAssociationContext, requirePermission } from "@/lib/association-access";
import { assertBrandingPath, brandingPath } from "./payment-branding";

export const uploadPaymentImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), kind: z.enum(["logo", "banner"]), base64: z.string().max(4_194_304) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.manage");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)) throw new Error("Please choose a valid image.");
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    if (bytes.length > 3 * 1024 * 1024 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") throw new Error("Please choose a WebP image smaller than 3 MB.");
    const path = `${ctx.association.id}/${data.kind}/${crypto.randomUUID()}.webp`;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.storage.from("association-branding").upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (error) throw new Error("The image could not be uploaded. Please try again.");
    if (data.kind === "logo") {
      const { error: updateError } = await db.from("associations").update({ branding_logo_path: path }).eq("id", ctx.association.id);
      if (updateError) throw new Error("The association logo could not be saved.");
      const { recordAudit } = await import("@/lib/association-audit.server");
      await recordAudit({ actor_id: context.userId, action: "association.logo_updated", entity: "association", entity_id: ctx.association.id, association_id: ctx.association.id }, context.supabase);
    }
    const { data: signed } = await db.storage.from("association-branding").createSignedUrl(path, 3600);
    return { path, url: signed?.signedUrl ?? null };
  });

export const updatePaymentBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80), id: z.string().uuid(), kind: z.enum(["public", "private"]), description: z.string().trim().max(500), banner_path: brandingPath }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadAssociationContext(context.supabase, context.userId, data.slug);
    requirePermission(ctx, "dues.manage");
    assertBrandingPath(data.banner_path, ctx.association.id, "banner");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "public" ? "payment_links" : "payment_requests";
    const { data: row, error } = await db.from(table).update({ description: data.description || null, banner_path: data.banner_path ?? null }).eq("id", data.id).eq("association_id", ctx.association.id).select("id").maybeSingle();
    if (error || !row) throw new Error("This payment could not be updated.");
    const { recordAudit } = await import("@/lib/association-audit.server");
    await recordAudit({ actor_id: context.userId, action: "payment.branding_updated", entity: table, entity_id: row.id, association_id: ctx.association.id }, context.supabase);
    return { ok: true };
  });