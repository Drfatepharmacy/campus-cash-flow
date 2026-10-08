# Deploying UniEgo on Vercel

Lovable hosting keeps working as-is. This guide is for running a second copy on Vercel.

## 1. Import the project
Connect the project to GitHub from Lovable, then in Vercel choose **Add New → Project** and import that repository.
`vercel.json` already sets the install and build commands. On Vercel the build automatically targets Vercel's servers.

## 2. Environment variables (Vercel → Settings → Environment Variables)
Public (safe to share):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

Server-only (keep secret):
- `SUPABASE_SERVICE_ROLE_KEY` — needed for payment confirmation and admin actions
- `PAYSTACK_SECRET_KEY`
- `LOVABLE_API_KEY`, `RESEND_API_KEY` — receipt emails and AI troubleshooting
- `TERMII_API_KEY`, `TERMII_SENDER_ID` — optional, SMS

Note: on Lovable Cloud the service key is not viewable, so the features that need it only work on Vercel if the backend is moved to one you manage yourself.

## 3. After the first deploy
- Paystack dashboard: set the webhook URL to `https://<your-vercel-domain>/api/public/webhooks/paystack` (only if payments should be confirmed there).
- Add the Vercel domain to the allowed sign-in/redirect addresses so Google sign-in and email links work.

## 4. Optional analytics
- `VITE_GA_MEASUREMENT_ID` (e.g. `G-XXXXXXX`) turns on Google Analytics page views. Leave empty to disable.
- Node version: set Vercel → Settings → Node.js to 22.x.
