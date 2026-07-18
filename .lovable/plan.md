# UniEgo

**Secure. Transparent. Verifiable.**

**Built by EMMTEC Securities**

## Overview

UniEgo is a digital payment and financial management platform designed to simplify how organizations, institutions, and communities collect, manage, verify, and monitor payments.

The platform provides a centralized system for creating payment requests, processing secure online payments, generating digital receipts, verifying transactions, and producing financial insights through an intuitive administrative dashboard.

Built by **EMMTEC Securities**, UniEgo combines modern technology with secure financial infrastructure to deliver a reliable, scalable, and user-friendly payment experience.

## Core Capabilities

- Secure online payment processing
- Digital receipt generation
- QR-based payment verification
- Payment request management
- Transaction tracking
- Role-based access control
- Financial reporting and analytics
- Audit logging
- Automated notifications
- Exportable financial records

## User Experience

UniEgo provides dedicated experiences for different categories of users while ensuring a consistent and intuitive interface.

Users can:

- Register and manage their profiles
- View available payment requests
- Complete payments securely
- Access payment history
- Download receipts
- Verify transactions
- Receive payment confirmations

Administrators can:

- Manage organizational structure
- Create and monitor payment requests
- View financial summaries
- Track transactions
- Generate reports
- Configure platform settings
- Monitor system activity

## Payment Workflow

The platform streamlines the complete payment lifecycle, from payment creation to successful verification.

Each completed transaction generates a unique receipt that can be verified using a secure QR code or receipt reference, ensuring transparency and reducing the risk of fraud.

## Security

UniEgo prioritizes security and accountability through modern authentication, role-based permissions, secure payment verification, comprehensive audit logs, and encrypted communication across the platform.

## Design Philosophy

The platform is built around three principles:

- Simplicity
- Reliability
- Transparency

Every interaction is designed to minimize friction while providing users with confidence throughout the payment process.

## Technology

UniEgo leverages a modern web architecture built with contemporary frontend and backend technologies, enabling high performance, scalability, maintainability, and secure integrations with third-party services.

## Scalability

The platform is designed with modularity in mind, allowing new features, organizations, payment methods, and services to be introduced without disrupting existing functionality.

Its architecture supports future growth while maintaining a consistent user experience.

## Vision

To provide a trusted digital payment infrastructure that enables organizations to manage collections efficiently, improve financial transparency, and deliver a seamless payment experience for every user.

---

## Technical section

### Stack
TanStack Start + Lovable Cloud (Supabase) + Tailwind v4 + shadcn + TanStack Query. Paystack via server functions. Resend via Lovable connector.

### Data model (Supabase, all in `public` with GRANTs + RLS)
- `campuses` (id, name, slug, active)
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

### Secrets
- `PAYSTACK_SECRET_KEY` (test mode `sk_test_...`)
- Resend via connector → `RESEND_API_KEY` + `LOVABLE_API_KEY` auto

### Success check
Student registers → sees a payment request → pays in Paystack test mode → webhook flips status → receipt page renders with QR → scanning QR opens verify page showing Valid + details → admin sees the transaction in dashboard and CSV export.
