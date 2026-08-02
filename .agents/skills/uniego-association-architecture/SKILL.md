---
name: uniego-association-architecture
description: Master architecture rules for UniEgo — multi-association tenancy, association accounts and workspaces, executive RBAC, Super Admin head approval, shared financial visibility, separation of duties, tenure, leadership transfer, recovery, audit and financial integrity. Use whenever building, extending, refactoring or auditing UniEgo.
---

# UniEgo Association Platform — Master Architecture

An **Association is a first-class platform account and organization**, never just a profile attached to a user. Each association governs itself through authorized officers; UniEgo Super Admin retains platform-level governance.

## 1. Association accounts

Registration fields: name, institution, faculty/department, association type, official email, official phone, logo, banner, description, session year, settlement/account info (where permitted), verification documents, current executive tenure, status.

Lifecycle: `DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED → ACTIVE → SUSPENDED → ARCHIVED`.

Creating an association NEVER auto-grants financial privileges. Financial activation follows approval + compliance.

## 2. Workspace and tenancy

Approved associations get an isolated workspace at `/association/{slug}/...` with: Overview, Members, Executives, Finance, Dues, Transactions, Settlements, Receipts, Reports, Verification, Notifications, Settings, Security, Audit Logs.

Tenant isolation is mandatory and enforced in the database (RLS), not the UI. Never trust a client-supplied `association_id` — always re-derive/authorize server-side.

## 3. Governance model

Roles at minimum: Head/President, Treasurer, Financial Secretary, Staff Adviser; extensible.

Relationships:
```text
User -> AssociationMembership -> Association
User -> AssociationRoleAssignment -> Role -> Permissions
```
Membership never implies executive status. Authorization is server-side RBAC/ABAC on permissions, never frontend role labels.

## 4. Super Admin controls leadership

Flow: `Nomination → Verification → Super Admin Approval → Head Activation`.
Super Admin may approve/reject/replace/remove/transfer/suspend/restore executives, set tenure, force expiry, review history and evidence, resolve disputed claims. Every governance action writes an immutable audit event.

## 5. Shared financial visibility (view != authority)

President, Treasurer, Financial Secretary and Staff Adviser may view (per permission): financial overview, payment totals, dues, transactions, settlements + status, reconciliation, revenue reports, payment references, receipts, approved settlement details.

Distinct permissions: `finance.view`, `finance.export`, `dues.manage`, `settlement.view`, `settlement.request`, `settlement.approve`, `bank_details.view`, `bank_details.change_request`, `reports.view`, `reports.export`.

Mask bank details unless full value is required. Never expose payment credentials, API keys, tokens, PINs or auth secrets to executives.

## 6. Separation of duties

Maker-checker for sensitive financial ops: Treasurer requests → President/authorized officer approves → backend executes → audit event. Super Admin review for the most sensitive. The same person must never silently initiate and approve a protected operation.

## 7. Staff Adviser

Oversight by default: view finance, dues, transactions, settlements, reports, executive records, key audit events. No operational financial control unless explicitly granted.

## 8. Executive tenure

Store: role, user, association, appointment source, approved_by, start, expiry, status, revocation reason, timestamps. Statuses: `PENDING | ACTIVE | EXPIRED | SUSPENDED | REVOKED`. Privileges expire automatically at tenure end unless renewed. History is preserved.

## 9. Leadership transfer

Outgoing admin → new officers submitted → identity verified → Super Admin reviews Head → new tenure created → incoming permissions activated → outgoing privileges revoked → history retained. Never delete executive or transaction history.

## 10-12. Recovery

- Password recovery mandatory for all account types. Generic responses (no account enumeration), cryptographically secure single-use short-lived rate-limited tokens, invalidated after use, sessions revoked, security event recorded.
- Privileged accounts (President, Treasurer, Fin Sec, Adviser, Super Admin) additionally need verified channel, step-up auth, session revocation, notification, suspicious-recovery detection, temporary freeze on sensitive financial changes. Super Admin gets strongest protection; no association officer may reset Super Admin credentials.
- Organizational recovery is separate from user credential recovery: losing the President's login must not lose the association. Reassigning governance requires verification + platform review.

## 13. Data model

`users, associations, association_memberships, roles, permissions, role_permissions, association_role_assignments, executive_terms, leadership_nominations, leadership_approvals, financial_accounts, dues, payments, transactions, settlements, receipts, reconciliation_records, recovery_tokens, sessions, security_events, audit_logs`.

Sensitive tables are protected by RLS. Every new `public` table gets GRANTs + RLS + policies in the same migration.

## 14. Super Admin console

Association approval/suspension, executive verification, head appointment, leadership replacement, dispute resolution, financial oversight, settlement monitoring, security incidents, audit review, platform config. Association permissions never override Super Admin authority; Super Admin actions remain auditable and least-privilege.

## 15. Auditability

Log: association creation/approval, nomination, head approval, role assignment/revocation, permission changes, login/security events, password recovery, settlement request/approval, bank detail changes, financial exports, admin overrides. Each record: actor, action, target, association, timestamp, request/event id, before/after state, reason. Association users can never erase audit history.

## 16. Security baseline

Least privilege, deny-by-default, server-side enforcement, RLS tenant isolation, strong hashing, secure sessions, CSRF where applicable, rate limiting, input validation, output encoding, parameterized queries, secret management, idempotency, replay protection, webhook signature verification, transactional writes, race-condition and double-spend protection, session revocation, security logging, MFA/step-up for privileged ops. Hidden buttons are not authorization.

## 17. Financial integrity rule

Every financial operation: `Authenticate → Authorize → Validate → Check idempotency → Execute transactionally → Reconcile → Audit → Notify`. Never trust a frontend success redirect — verify with the provider backend. Never store raw card credentials.

## 18. Onboarding UX

Create Association → basic info → institution → verification → executives → proposed Head → dues/financial config → submit for review → Super Admin verifies → activated → Head approved → workspace enabled.

Explicit UI states: pending verification, approved, rejected, more info required, suspended, leadership pending, tenure expired.

## 19. Non-negotiable

Preserve: Association Accounts, Organization Workspaces, Executive RBAC, Super Admin Head Approval, Shared Financial Visibility, Separation of Duties, Staff Adviser Oversight, Executive Tenure, Leadership Transfer, Password Recovery, Organizational Recovery, Audit Logging, Tenant Isolation, Financial Integrity Controls. Never weaken these to ship a feature.

## 20. Implementation standard

Reason across Frontend → Auth → API → Authorization → DB → RLS → Payment provider → Webhooks → Reconciliation → Audit → Recovery → Monitoring → Tests. Every feature ships happy path, loading, empty, validation, permission-denied, failure, safe retry, security controls, audit behaviour, mobile responsiveness, low-bandwidth behaviour and accessibility.
