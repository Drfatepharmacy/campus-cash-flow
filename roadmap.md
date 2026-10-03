# UniEgo — open items after the Sept 21 hardening pass

## Fixed in this pass
- Faculty/department reps with no assigned scope no longer see platform-wide payment data (fails closed).
- QR tokens now use a cryptographically secure generator (was `Math.random`).
- Anonymous visitors can no longer read association `official_email` / `official_phone`.
- Association creators can no longer push their own application into `under_review`.
- Internal database routines (payment finalisation, QR lookup/scan, receipt tokens, role expiry, triggers) are now service-role only.
- Spreadsheet library upgraded to a patched build (prototype pollution + ReDoS advisories cleared).
- Test suite green (17 tests).

## Blocked — needs the user
- **Paystack live mode.** Still running on test keys. Needs a live secret key plus a verified settlement bank account before any real money moves.
- **SMS notifications.** Termii transport is wired but `TERMII_API_KEY` is not configured, so SMS silently skips.
- **Google OAuth branding.** Managed credentials work; own client ID/secret optional.

## Known, accepted
- 4 database helper routines (`has_role`, `has_assoc_permission`, `is_super_admin`, `is_association_member`) remain callable by signed-in users — required by the row-level security policies themselves.
- Dependency scanner cannot parse the patched spreadsheet library's tarball entry in the lockfile; the package itself is the fixed version.
- Framework transitive advisories (undici, js-yaml, browserslist, seroval) resolve when the platform bumps TanStack Start.

## Not yet built / thin
- Association bank details: officer submit + second-officer approve + super-admin verify exists; no bank-name validation or account-name match against the bank.
- Settlements: maker-checker status updates exist; no automated payout execution.
- Dues: setup and collection exist; no reminders, instalments, or waivers.
- Refunds/chargebacks: no flow (policy page exists).
- Analytics: no scheduled/exported reporting.
- Audit log: viewable, no export or retention policy.
- Tests: only charges and QR encoder are covered; no route/RLS integration tests.

## Oct 3 — added
- Public payment links (no sign-in), per-class fixed prices, QR + share, masked public ledger with Excel/PDF by class, instant offline records, roster upload, paid/defaulters reports. Online link payments run on Paystack test keys until live mode is enabled.
- Branded auto-retry loading screen, privacy-safe page error records, admin Page health assistant (AI).
