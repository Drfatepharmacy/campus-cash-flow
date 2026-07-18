import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — UniEgo" },
      { name: "description", content: "How UniEgo collects, uses, stores, and protects your personal information." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Privacy Policy"
      intro="UniEgo is committed to protecting your personal information. This policy describes what we collect, why we collect it, and the choices you have."
    >
      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account details</strong> — name, email, phone number, matriculation number, faculty, department, and level.</li>
        <li><strong>Payment details</strong> — amount, purpose, association or department, and transaction reference. Card and bank details are handled by our licensed payment processor and are not stored on UniEgo servers.</li>
        <li><strong>Usage data</strong> — device, browser, and pages visited, used to keep the service secure and reliable.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To process payments and issue receipts.</li>
        <li>To verify your identity and eligibility for association or departmental payments.</li>
        <li>To provide transaction history, refunds, and customer support.</li>
        <li>To detect fraud, abuse, and unauthorized access.</li>
      </ul>

      <h2>3. Sharing</h2>
      <p>We share information only with:</p>
      <ul>
        <li><strong>Licensed payment processors</strong> to complete transactions.</li>
        <li><strong>Your institution, faculty, department, or association</strong> for payments you make to them.</li>
        <li><strong>Authorities</strong> where required by Nigerian law.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>4. Data retention</h2>
      <p>Transaction records are retained for as long as required by financial record-keeping obligations. Account data is retained while your account is active and for a reasonable period afterwards.</p>

      <h2>5. Your rights</h2>
      <p>You may request access to, correction of, or deletion of your personal data, subject to legal and record-keeping obligations. Email <a href="mailto:support@emmtec.ng">support@emmtec.ng</a> to make a request.</p>

      <h2>6. Cookies</h2>
      <p>We use essential cookies for authentication and session management. We do not use advertising cookies.</p>

      <h2>7. Contact</h2>
      <p>Data controller: EMMTEC Securities. Contact: <a href="mailto:privacy@emmtec.ng">privacy@emmtec.ng</a>.</p>
    </LegalPage>
  ),
});
