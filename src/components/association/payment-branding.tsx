import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { uploadPaymentImage, updatePaymentBranding } from "@/lib/payment-branding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";

export function PaymentImages({ slug, banner, onBanner, onBusy }: { slug: string; banner: string | null; onBanner: (path: string | null) => void; onBusy: (busy: boolean) => void }) {
  const upload = useServerFn(uploadPaymentImage);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const choose = async (file: File, kind: "logo" | "banner") => {
    setBusy(true); onBusy(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose a PNG, JPEG or WebP image under 10 MB.");
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, (kind === "logo" ? 512 : 1600) / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image could not be opened.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const encoded = canvas.toDataURL("image/webp", 0.85).split(",")[1]; if (!encoded) throw new Error("Image could not be opened.");
      const result = await upload({ data: { slug, kind, base64: encoded } });
      if (kind === "banner") { onBanner(result.path); setPreview(result.url); }
      else { qc.invalidateQueries({ queryKey: ["workspace", slug] }); toast.success("Association logo saved"); }
    } catch (e) { toast.error(toUserMessage(e)); }
    finally { setBusy(false); onBusy(false); }
  };
  return <div className="space-y-3">
    {(["logo", "banner"] as const).map(kind => <div className="space-y-1.5" key={kind}><Label htmlFor={`image-${kind}-${slug}`}>{kind === "logo" ? "Association logo (shared across payments)" : "Payment banner"}</Label><Input id={`image-${kind}-${slug}`} aria-label={kind === "logo" ? "Association logo" : "Payment banner"} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file, kind); e.target.value = ""; }} /></div>)}
    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-label="Uploading image" />}
    {preview && <img src={preview} alt="Payment banner preview" className="aspect-[3/1] w-full rounded-lg object-cover" />}
    {banner && <Button type="button" size="sm" variant="ghost" onClick={() => { onBanner(null); setPreview(null); }}>Remove banner</Button>}
  </div>;
}

export function EditPaymentBranding({ slug, item, kind, onSaved }: { slug: string; item: { id: string; description?: string | null; banner_path?: string | null }; kind: "public" | "private"; onSaved: () => void }) {
  const save = useServerFn(updatePaymentBranding);
  const [open, setOpen] = useState(false); const [description, setDescription] = useState(item.description ?? ""); const [banner, setBanner] = useState(item.banner_path ?? null); const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><ImagePlus className="mr-1 h-4 w-4" />Branding</Button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Payment branding</DialogTitle></DialogHeader><PaymentImages slug={slug} banner={banner} onBanner={setBanner} onBusy={setBusy} /><Label htmlFor={`description-${item.id}`}>Description</Label><Textarea id={`description-${item.id}`} value={description} maxLength={500} onChange={e => setDescription(e.target.value)} /><Button disabled={busy || saving} onClick={async () => { setSaving(true); try { await save({ data: { slug, id: item.id, kind, description, banner_path: banner } }); toast.success("Payment branding saved"); setOpen(false); onSaved(); } catch (e) { toast.error(toUserMessage(e)); } finally { setSaving(false); } }}>Save branding</Button></DialogContent></Dialog>;
}