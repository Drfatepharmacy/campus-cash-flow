
# UniPay NG — Phase 1 Build Plan

Powered by EMMTEC Securities. Single-campus launch (UNIBEN), architected for multi-campus later.

## Phase 1 Scope (what we ship now)

1. **Brand + design system** — Deep Gold / Royal Dark Purple / Emerald / White. Premium fintech feel (Linear × Stripe × Notion). Tailwind v4 tokens in `src/styles.css`, shadcn variants.
2. **Public marketing surface**
   - Landing page (vision, modules, "powered by EMMTEC")
   - QR verification page `/verify/:receiptId` (public, no auth)
3. **Auth** — Email/password + Google (via Lovable broker). Roles: `admin`, `student` (department_rep, faculty_rep, bank_runner stubbed in enum, built in Phase 2).
4. **Admin Control Center** (`/_authenticated/admin/...`)
   - Campuses, Faculties, Departments CRUD
   - Payment Requests (title, target audience by faculty/dept/level, base amount, active window)
   - Service Charge rules (tiered: ≤5k → ₦250, ≤20k → ₦500, >20k → 3%, editable)
   - Transactions list + filters + CSV export
   - Dashboard: revenue, txn count, service charge collected, top departments
5. **Student Payment Engine**
   - Self-registration (matric, faculty, dept, level, phone, email)
   - Student dashboard: eligible payment requests, payment history
   - Pay flow: select request → preview (base + charge + total) → Paystack checkout (test) → success
   - Webhook `/api/public/webhooks/paystack` (HMAC verified) → mark txn paid, generate receipt + QR
6. **Receipt + QR**
   - Receipt page `/receipt/:id` (HTML, branded, printable) with QR linking to `/verify/:id`
   - QR generated with `qrcode` package
   - Email receipt link via Resend (Lovable Emails not used — user-selected Resend)
7. **Audit log** — append-only `audit_logs` table; admin actions + payments + webhook events logged.

## Phase 1 explicitly DEFERRED

Bank runner module, settlement engine, deposit jobs, faculty/dept rep portals, marketplace, multi-campus UI switcher, SMS/Termii, PDF/Puppeteer, advanced fraud detection, dispute resolution, CSV student import (admin can still single-create). Schema will accommodate them.

---

## Technical section

### Stack
TanStack Start (existing) + Lovable Cloud (Supabase) + Tailwind v4 + shadcn + TanStack Query. Paystack via server functions. Resend via Lovable connector (`standard_connectors--connect resend`).

### Data model (Supabase, all in `public` with GRANTs + RLS)
- `campuses` (id, name, slug, active) — seed UNIBEN
- `faculties` (id, campus_id, name)
- `departments` (id, faculty_id, name)
- `profiles` (id=auth.users.id, email, full_name, phone, matric_no, campus_id, faculty_id, department_id, level)
- `app_role` enum: `admin | student | department_rep | faculty_rep | bank_runner`
- `user_roles` (id, user_id, role) + `has_role()` SECURITY DEFINER
- `payment_requests` (id, campus_id, title, description, base_amount, target_faculty_id?, target_department_id?, target_level?, opens_at, closes_at, active, created_by)
- `service_charge_rules` (id, scope: global|department, department_id?, tiers jsonb)
- `transactions` (id, reference unique, student_id, payment_request_id, base_amount, service_charge, total_amount, status: pending|paid|failed, paystack_ref, paid_at, created_at)
- `receipts` (id, transaction_id, qr_token unique, issued_at)
- `audit_logs` (id, actor_id, action, entity, entity_id, metadata jsonb, ip, created_at) — append-only RLS
- `settlements`, `deposit_jobs` — schema stubs only, no UI

### RLS sketch
- Students: read own profile, own transactions, own receipts.
- Admin: full read/write via `has_role(auth.uid(),'admin')`.
- `payment_requests` public-read for authenticated students filtered by their faculty/dept/level.
- `receipts` + `transactions` public-read by `qr_token` via server fn using `supabaseAdmin` (safe-column projection only) for the verify page.

### Server functions / routes
- `src/lib/payments.functions.ts`
  - `initiatePayment` (requireSupabaseAuth) → creates pending txn, calls Paystack init, returns auth_url
  - `getMyTransactions`, `getEligibleRequests`
- `src/lib/admin.functions.ts` (requireSupabaseAuth + admin role check)
  - CRUD for campuses/faculties/departments/payment_requests/service_charge_rules
  - `getAdminDashboardStats`
- `src/lib/verify.functions.ts` (public, no auth) — `verifyReceipt(qrToken)` returns safe projection
- `src/routes/api/public/webhooks/paystack.ts` — HMAC verify with `PAYSTACK_SECRET_KEY`, idempotent update, send receipt email via Resend gateway

### Routing
```
/                              landing
/auth                          login/signup
/verify/$token                 public QR verify
/receipt/$id                   receipt view (auth: owner or admin)
/_authenticated/route.tsx      integration-managed gate
/_authenticated/dashboard      student dashboard
/_authenticated/pay/$requestId payment flow
/_authenticated/admin/*        admin shell + pages (gated by admin role)
```

### Secrets needed (will prompt at the right step)
- `PAYSTACK_SECRET_KEY` (test mode `sk_test_...`)
- Resend via connector → `RESEND_API_KEY` + `LOVABLE_API_KEY` auto

### Build order
1. Enable Lovable Cloud
2. Migrations: enums, tables, RLS, GRANTs, `has_role`, seed UNIBEN + first admin role assignment helper
3. Design tokens + shared layout (nav, brand)
4. Auth pages (`/auth`) + Google provider config
5. Landing page
6. Student registration + dashboard
7. Admin shell + CRUD pages + dashboard stats
8. Payment flow + Paystack init server fn (prompt for `PAYSTACK_SECRET_KEY`)
9. Webhook route + receipt + QR generation
10. Verify page
11. Connect Resend + send receipt email
12. Audit log writes across mutations

### Success check
Student registers → sees a payment request → pays in Paystack test mode → webhook flips status → receipt page renders with QR → scanning QR opens verify page showing Valid + details → admin sees the transaction in dashboard and CSV export.
