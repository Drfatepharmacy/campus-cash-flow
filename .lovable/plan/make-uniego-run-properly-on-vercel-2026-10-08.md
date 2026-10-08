# Make UniEgo run properly on Vercel

## Goal
When the project is deployed to Vercel, every page (home, sign-in, payment links, dashboards) loads instead of showing "This page didn't load" or a blank/404 screen. Lovable hosting keeps working exactly as it does today.

## What changes
1. **Tell the build which host it is on.** When Vercel builds the project, it will explicitly build for Vercel's servers. Everywhere else it keeps building for Lovable hosting. Today it relies on auto-detection, which can fall back to the Lovable target and break on Vercel.
2. **Vercel settings file.** Point Vercel at the right output folder so it serves the pages and server features (not an empty static site).
3. **Missing settings check.** If a required Vercel setting (backend address, public key) is missing, the site shows a clear branded notice in the logs instead of crashing every page.
4. **Test a real Vercel build here.** Build a copy with Vercel's setup, start it the way Vercel does, and open home, sign-in, verify, legal and a payment link page. All must load with no server errors.
5. **Update the deploy guide** with the exact Vercel screens to fill in (framework "Other", Node 22, settings list) and what to do if a page still fails.

## What still won't work on Vercel (unchanged limitation)
Payment confirmation by webhook and admin-only actions need the backend's private service key, which Lovable Cloud does not reveal. Public pages, sign-in, student pages and payment links checkout will work.

## Technical details
- `vite.config.ts`: `nitro: process.env.VERCEL ? { preset: "vercel" } : undefined` passed through `@lovable.dev/vite-tanstack-config` (sandbox still forces cloudflare-module, so Lovable hosting is untouched).
- `vercel.json`: `framework: null`, `buildCommand: "vite build"`, rely on Build Output API v3 (`.vercel/output`) emitted by nitro's vercel preset; no `outputDirectory`.
- `src/server.ts` default `fetch` export stays compatible with the vercel preset.
- Verify by running `VERCEL=1 vite build` outside the sandbox flag, inspecting `.vercel/output/config.json` + functions, and serving the function locally.
- If you have the Vercel build or runtime error text, paste it so the fix can target it exactly.
