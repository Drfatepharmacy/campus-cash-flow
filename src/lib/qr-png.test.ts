import { describe, it, expect } from "vitest";
import { decode } from "fast-png";
import { qrPng } from "./qr-png.server";

describe("server QR PNG", () => {
  it("produces a valid square PNG with the PNG signature", () => {
    const png = qrPng("https://uniego.lovable.app/verify/ABC123", { scale: 4, margin: 2 });
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const img = decode(png);
    expect(img.width).toBe(img.height);
    expect(img.width % 4).toBe(0);
  });
});
