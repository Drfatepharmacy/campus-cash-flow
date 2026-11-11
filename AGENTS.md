# Project rules

- Never import the `qrcode` package root anywhere: pages use `@/lib/qr-browser`, server code lazily imports `@/lib/qr-png.server`. Why: the root resolves to a Node build that needs disk access and crashes the hosted site on every page.
- Keep `@lovable.dev/vite-tanstack-config`, `nitro` and `vite-tsconfig-paths` as-is; the build target is chosen automatically (Lovable hosting vs Vercel via `vercel.json`). Why: overriding the target breaks one of the two hosts.
- Sign-in/recovery forms use method="post" and keep the submit button disabled until the page is hydrated. Why: an early tap before scripts load triggers a native submit that reloads the page (and a GET would put the password in the URL).

- Association payment images use private Storage, server-authorized dues.manage uploads and temporary signed URLs; never accept another tenant’s media path. Why: public checkout must show branding without opening tenant uploads or bypassing tenure permissions.

- Association application creation, nominations, submission and approval use session-authorized atomic database RPCs; console reads use the authenticated client. Why: Vercel must not require a service-role key and audit writes must commit with governance changes.
- Association dashboard reads use the signed-in caller client with association-scoped RLS; never use service-role access for member, finance, settlement, or bank-detail visibility. Why: preserve tenant isolation and make officer dashboards work on Vercel without privileged credentials.
