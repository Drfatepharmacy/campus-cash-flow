import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Camera, Upload, ShieldCheck, ArrowRight, CameraOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/verify/")({
  head: () => ({
    meta: [
      { title: "Verify a receipt — UniPay NG" },
      { name: "description", content: "Scan or enter a UniPay NG receipt code to verify a payment. Public and free for everyone." },
      { property: "og:title", content: "Verify a UniPay NG receipt" },
      { property: "og:description", content: "Scan or enter a UniPay NG receipt code to instantly verify a payment." },
    ],
  }),
  component: VerifyLanding,
});

type BarcodeDetectorLike = new (opts: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function getDetector(): InstanceType<BarcodeDetectorLike> | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorLike };
  if (!w.BarcodeDetector) return null;
  try { return new w.BarcodeDetector({ formats: ["qr_code"] }); } catch { return null; }
}

function extractToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "verify" || p === "receipt");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch { /* not a URL */ }
  return trimmed;
}

function VerifyLanding() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorLike> | null>(null);

  useEffect(() => {
    detectorRef.current = getDetector();
    setSupported(!!detectorRef.current);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(raw: string) {
    const t = extractToken(raw);
    if (!t) { toast.error("Enter or scan a receipt code"); return; }
    stopCamera();
    navigate({ to: "/verify/$token", params: { token: t } });
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startCamera() {
    if (!detectorRef.current) { toast.error("Camera scanning not supported on this browser. Use manual entry or upload."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const tick = async () => {
        if (!streamRef.current || !detectorRef.current || !videoRef.current) return;
        try {
          const results = await detectorRef.current.detect(videoRef.current);
          if (results[0]?.rawValue) { goTo(results[0].rawValue); return; }
        } catch { /* keep looping */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      toast.error("Could not access camera. Check permissions.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const det = detectorRef.current ?? getDetector();
    if (!det) { toast.error("QR decoding not supported here. Enter the code manually."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const results = await det.detect(bitmap);
      if (results[0]?.rawValue) goTo(results[0].rawValue);
      else toast.error("No QR code found in that image.");
    } catch { toast.error("Could not read that image."); }
    finally { e.target.value = ""; }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b glass sticky top-0 z-40">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-12 md:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald" /> Public verification · Free for everyone
          </div>
          <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight">
            Verify a <span className="text-royal">UniPay NG</span> receipt
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Scan the QR code on any receipt, upload a photo, or paste the receipt code below to confirm the payment is real.
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Card className="shadow-elegant">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Camera className="h-4 w-4 text-royal" /> Scan with camera
              </div>
              <div className="mt-4 aspect-square w-full rounded-2xl bg-secondary/60 border overflow-hidden grid place-items-center relative">
                {scanning ? (
                  <>
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                    <div className="absolute inset-6 rounded-xl border-2 border-royal/70 pointer-events-none" />
                  </>
                ) : (
                  <div className="text-center px-4">
                    <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div className="mt-3 text-xs text-muted-foreground">
                      {supported ? "Camera off" : "Camera scanning not supported on this browser"}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                {!scanning ? (
                  <Button onClick={startCamera} disabled={!supported} className="flex-1 bg-royal text-royal-foreground hover:opacity-90">
                    <Camera className="h-4 w-4 mr-2" /> Start scanning
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    <CameraOff className="h-4 w-4 mr-2" /> Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRight className="h-4 w-4 text-royal" /> Or enter the code
              </div>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => { e.preventDefault(); goTo(token); }}
              >
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="e.g. UPN-9X4F2B-A7Q2K or paste verify URL"
                  autoComplete="off"
                />
                <Button type="submit" className="w-full">
                  Verify receipt <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div className="h-px bg-border flex-1" /> or <div className="h-px bg-border flex-1" />
              </div>

              <label className="block">
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                <div className="cursor-pointer rounded-xl border border-dashed p-4 text-center hover:bg-secondary/50 transition-colors">
                  <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                  <div className="mt-2 text-sm font-medium">Upload a QR image</div>
                  <div className="text-xs text-muted-foreground">PNG, JPG, or screenshot</div>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          <div className="font-display text-foreground font-semibold mb-2">How verification works</div>
          Every UniPay NG receipt carries a signed QR token. Scanning it takes you to a public page that reads the transaction reference, amount, status, and paid date directly from our database — no sign-in required.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
