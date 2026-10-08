# Build check, Vercel readiness, SEO and analytics

## 1. Build errors (Super Admin + association pages)
- The type check currently passes with no errors (the earlier dashboard error has cleared).
- Open every Super Admin page (Overview, Associations, association details, Leadership, Bank accounts, Users, Activity) and every association workspace page in a test browser, signed in as the super admin, on phone and desktop sizes. Fix anything that fails to load.
- Run a full production build and the 22 tests.

## 2. Vercel deployment
- Keep the current framework; confirm a Vercel-target build succeeds and outputs correctly.
- Tidy `vercel.json` (build command, Node version) and refresh `DEPLOY_VERCEL.md` with the exact settings list.
- No major framework version jumps (they would risk breaking the live Lovable site).

## 3. SEO and ranking
- Give every public page its own title, description and social preview text (home, sign-in, association login, associations directory, verify, legal pages, public payment page). Private pages get "noindex".
- Add `robots.txt` (blocks admin, super admin, dashboard and API paths) and `sitemap.xml` for public pages using uniego.lovable.app.
- Add structured data on the home page (organisation + website) so search engines understand the brand.
- Canonical links per page.

## 4. Analytics
- Use Lovable's built-in visitor analytics (already available, no code).
- Add optional Google Analytics 4 that turns on only if you give a measurement ID (G-XXXX); tracks page views on every navigation, never sends names, matric numbers or payment details.
- Run an SEO scan afterwards and fix any findings.

## Technical details
- Per-route `head()` meta; `public/robots.txt`, `public/sitemap.xml`; JSON-LD via head scripts on `/`.
- GA4 loaded from `VITE_GA_MEASUREMENT_ID` in `__root`, page_view on router `onResolved`.
- Verify with `vite build`, vitest, Playwright with a minted super admin session.
