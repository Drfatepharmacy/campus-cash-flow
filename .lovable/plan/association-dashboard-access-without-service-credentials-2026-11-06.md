# Association dashboard access without service credentials

## User-facing outcome
Presidents and treasurers can load their member, executive, finance, settlement, and bank-detail views on Vercel using their signed-in session. Access remains scoped to the association and granted permission.

## Implementation
- Replace service-role reads in `listMembers`, `listExecutives`, and `getAssociationFinance` with `context.supabase`; use the authenticated client for the association bank-account dashboard read as well.
- Keep all server-side permission checks and select only the fields each dashboard already needs. Preserve masking of account numbers and the existing visibility checks for transactions, settlements, and bank details.
- Add least-privilege SELECT policies for signed-in association users: members with `members.view` may read profiles for their own association's memberships; officers with `finance.view` or `transactions.view` may read transactions assigned to their association; officers with `settlement.view` may read its settlements; and officers with `bank_details.view` may read its account records. Add an association-scoped approval-request read policy for the bank dashboard only if required after inspecting its existing policy; retain the requester/approver constraints.
- Grant only the table-level SELECT privileges needed to authenticated users, retaining RLS as the row boundary. Do not expose these reads to anonymous users or grant write access.
- Add focused tests for dashboard permission gates and verify the live RLS policies exclude another association and users without the needed permissions.

## Technical notes
- Resolve association ownership through `association_memberships`, `transactions.association_id`, `settlements.association_id`, and the association linkage of financial accounts; do not trust a caller-provided association ID.
- Profile visibility should be narrowly associated with active membership records; do not grant broad profile reads to officers.
- Preserve the current dashboard return shape and masked bank details.
- Validate with relevant unit tests, a type check/build signal, and read-only policy inspection. No live Vercel deployment is performed in this change.
