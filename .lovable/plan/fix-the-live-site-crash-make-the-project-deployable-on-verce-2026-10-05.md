# Fix the live site crash + make the project deployable on Vercel

## What is actually wrong (confirmed)

Every page on the live site (uniego.lovable.app) returns the "This page didn't load" screen. The preview works, so it looked random, but it is not. A test copy built and run the same way as the live site crashes on every request with the same error:

- The QR-code image library is loaded on the server in its "desktop computer" version, which tries to read files from disk while it starts up. The live hosting has no such disk access, so the whole site fails before any page renders.
- It is loaded from four places: the payment receipt email (webhook), the receipt page, the payment links page, and the admin QR codes page. Because these are all part of one app, one bad load takes down every page, including the home page.
- The backend restart did not cause this and did not fix it. The backend is healthy.

## Fix 1: stop the crash (main fix)

- Pages in the browser (receipt, payment links, admin QR codes): switch to the browser-only version of the QR library, which draws onto the screen and never touches the disk.
- Receipt email (server): add a small server-safe QR helper that builds the QR pattern with the library's core (no disk access) and turns it into a PNG image with a pure-code image encoder that is already installed (it came with the PDF library). The email keeps its inline QR image and PNG attachment.
- Load that helper only when an email is actually sent, so even if email images ever fail, the website itself keeps working.
- Add one automated test that builds a QR PNG with the helper and checks it is a valid image, so this does not come back silently.

## Fix 2: Vercel deployment

- The build tool already picks the right target by itself when it runs on Vercel, so no change of framework is needed. Lovable hosting keeps working exactly as now.
- Add a short `vercel.json` with the build command and output settings, plus a deploy guide in the project (`DEPLOY_VERCEL.md`) listing the settings to enter in Vercel:
  - the backend address and public key (both safe to share)
  - server-only keys: payment (Paystack), email, AI, and the backend service key
- Note in the guide: the Paystack webhook address must be changed in Paystack to the Vercel domain if you take payments there; Google sign-in and email links must have the Vercel domain added as an allowed address.
- Limitation to be honest about: the backend service key is not visible on Lovable Cloud, so server features that need it (payment confirmation webhook, admin actions) will only work on Vercel if you move to a backend you manage yourself. Public pages, sign-in and normal student pages will work.

## Fix 3: package updates

- Update packages to their latest compatible minor/patch versions (UI pieces, data, router, charts, PDF/Excel helpers), keeping the framework build pieces on versions Lovable hosting supports. No big version jumps that would require rewriting pages.
- Remove the duplicate path plugin warning the build prints.
- Run the existing tests and a dependency security scan afterwards.

## Verification

- Rebuild the test copy and run it the same way as the live site: home, sign-in, verify, associations and legal pages must return normally (no 500s).
- All tests pass, preview still loads.
- Then you publish, and I re-check uniego.lovable.app.

## Technical details

- Root cause: `import QRCode from "qrcode"` resolves to `qrcode/lib/server.js` in SSR; `renderer/png.js` -> `pngjs` requires `node:fs` at module init. It is reached through the router's eager route graph (paystack webhook route and 3 page routes), so the worker throws on init and h3 returns 500 for all paths.
- Client routes: `import QRCode from "qrcode/lib/browser"` (add a type shim). 
- Server: `src/lib/qr-png.server.ts` using `qrcode/lib/core/qrcode` `create()` for the module matrix + `fast-png` `encode()`; webhook does `await import("@/lib/qr-png.server")` inside the email block.
- Vercel: nitro auto-detects the `vercel` preset outside the Lovable sandbox (`defaultPreset: cloudflare-module` is only a fallback). `vercel.json`: `buildCommand: "vite build"`, framework null.
- Remove `vite-tsconfig-paths` from dependencies only if the shared config does not need it (it bundles its own path handling).
