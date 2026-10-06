# Make the Super Admin console easy to reach and fill the missing screens

## What I checked
- I signed in as ilomuche@gmail.com on a phone-sized screen. The "Super Admin" button shows on the dashboard. The Overview, Association applications, Leadership approvals and Bank verifications pages all open, with no errors.
- One application is waiting for review: "Pharmaceutical Association of Nigeria Students". It was submitted from a **different account**, not ilomuche@gmail.com. That's why "My associations" on your dashboard is empty, and why you don't see that association's dashboard yourself. The "Faculty of Arts" application is still an unsent draft.
- If you're using uniego.lovable.app, it doesn't have the recent fixes until you publish.

## What I'll build

1. **Easier access to Super Admin**
   - A clear "Super Admin console" card at the top of the dashboard, showing how many items are waiting (applications, leadership, bank accounts).
   - On phones, the console menu becomes a scrolling tab bar along the top instead of a long list, so the page content shows straight away.
   - Each menu item shows how many items are waiting.

2. **Fuller Super Admin screens**
   - **Association details page:** opens from any application. It shows the full details, submitted documents, proposed leaders, bank account status and decision history, with all actions (review, verify, activate, suspend, restore, reject) in one place.
   - **All associations:** a search box and a link to view each association's workspace as Super Admin. This view is read-only: viewing never gives money or approval powers.
   - **Platform activity log:** a new page listing every Super Admin decision and association lifecycle event, with filters.
   - **Users and roles:** a new page to look up a user and see their platform roles and association roles. You can grant or remove Admin. Super Admin itself stays protected, and the last holder can't be removed.

3. **Association-side gaps**
   - **Dashboard application status:** the person who applied sees a clear status timeline (Submitted, Under review, Verified, Active). Rejected applications show the reason and a "Fix and resubmit" button.
   - **Finishing a draft:** a "Continue application" button for drafts like Faculty of Arts, so they can be finished and sent.
   - **First steps after activation:** a checklist on the association's home page: add bank details, invite officers, create dues or a payment link.

4. **Check everything**
   - Sign in as Super Admin on phone and desktop sizes and open every page.
   - Approve a test application all the way to active, and confirm the association's dashboard opens for its leader.

## Technical details
- New pages under the Super Admin section: association details, activity log, and users & roles. A read-only workspace view uses the same permission checks; Super Admin read access never grants payment or approval rights (maker-checker stays intact).
- New server functions for counts, association details, the platform activity list and role lookup/grant. All re-check the Super Admin role on the server.
- Dashboard: an application timeline from the association's status, and continue/resubmit links to the registration wizard.
- No changes to payments, the ledger or the security rules beyond reusing existing ones.
