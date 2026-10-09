# Deploying UniEgo on Vercel

Lovable hosting keeps working as-is. This guide is for running a second copy on Vercel.
Tested: a Vercel-style build produces `.vercel/output` (Node 22 serverless function) and home, sign-in, verify, associations, legal, association login and payment link pages all return 200.

## 1. Import the project
Connect the project to GitHub from Lovable, then in Vercel choose **Add New → Project** and import that repository.
- Framework Preset: **Other**
- Build / Output / Install commands: leave as default (`vercel.json` sets them; do NOT set an Output Directory)
- Settings → Node.js Version: **22.x**

On Vercel the build automatically targets Vercel's servers (`VERCEL=1` switches the preset).

## 2. Environment variables (Vercel → Settings → Environment Variables)
Public (safe to share) — required, or pages will fail:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

Add them before the first build (the `VITE_` ones are baked in at build time; redeploy after changing them).

Server-only (keep secret):
- `SUPABASE_SERVICE_ROLE_KEY` — needed for payment confirmation and admin actions
- `PAYSTACK_SECRET_KEY`
- `LOVABLE_API_KEY`, `RESEND_API_KEY` — receipt emails and AI troubleshooting
- `TERMII_API_KEY`, `TERMII_SENDER_ID` — optional, SMS

Note: on Lovable Cloud the service key is not viewable, so the features that need it only work on Vercel if the backend is moved to one you manage yourself.

## 3. After the first deploy
- Paystack dashboard: set the webhook URL to `https://<your-vercel-domain>/api/public/webhooks/paystack` (only if payments should be confirmed there).
- Add the Vercel domain to the allowed sign-in/redirect addresses so Google sign-in and email links work.

## 4. If a page still fails
- Check Vercel → Deployments → the deployment → **Functions / Runtime Logs** and copy the error text.
- "Missing Supabase environment variable(s)" means step 2 was skipped — add them and redeploy.
- A 404 on every page means an Output Directory was set or the framework preset isn't "Other".

## 5. Optional analytics
- `VITE_GA_MEASUREMENT_ID` (e.g. `G-XXXXXXX`) turns on Google Analytics page views. Leave empty to disable.
