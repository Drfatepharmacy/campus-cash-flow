// Server-safe QR → PNG. Uses qrcode's pure core (no fs) and fast-png (pure JS),
// so it runs on the edge worker. Load lazily: await import("@/lib/qr-png.server").
// @ts-expect-error — internal subpath without types.
import QRCore from "qrcode/lib/core/qrcode";
import { encode } from "fast-png";

type Opts = { scale?: number; margin?: number; dark?: [number, number, number]; light?: [number, number, number] };

export function qrPng(text: string, opts: Opts = {}): Uint8Array {
  const scale = opts.scale ?? 8;
  const margin = opts.margin ?? 2;
  const dark = opts.dark ?? [0x1a, 0x12, 0x30];
  const light = opts.light ?? [255, 255, 255];
  const qr = QRCore.create(text, { errorCorrectionLevel: "M" });
  const size: number = qr.modules.size;
  const bits: Uint8Array = qr.modules.data;
  const px = (size + margin * 2) * scale;
  const data = new Uint8Array(px * px * 3);
  for (let y = 0; y < px; y++) {
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - margin;
      const on = my >= 0 && mx >= 0 && my < size && mx < size && bits[my * size + mx];
      const c = on ? dark : light;
      const i = (y * px + x) * 3;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  }
  return encode({ width: px, height: px, data, channels: 3, depth: 8 });
}

export function qrPngBase64(text: string, opts?: Opts): string {
  return Buffer.from(qrPng(text, opts)).toString("base64");
}
