import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — UniEgo" },
      { name: "description", content: "When and how UniEgo issues refunds on payments." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Refund Policy"
      intro="Refunds protect payers when a transaction is duplicated, unsuccessful, or made in error."
    >
      <h2>1. Eligible cases</h2>
      <ul>
        <li>You were debited but the payment status is failed or pending after 24 hours.</li>
        <li>You paid twice for the same item by mistake.</li>
        <li>You paid the wrong association or purpose and the recipient confirms they have not disbursed the funds.</li>
      </ul>

      <h2>2. Non-refundable cases</h2>
      <ul>
        <li>Payments already released to the receiving association or department.</li>
        <li>Change of mind after a service, event, or good has been delivered.</li>
        <li>Third-party gateway fees where the payment was completed successfully.</li>
      </ul>

      <h2>3. How to request a refund</h2>
      <p>Email <a href="mailto:support@emmtec.ng">support@emmtec.ng</a> within 30 days of the transaction. Include your transaction reference, date, and a brief description.</p>

      <h2>4. Processing time</h2>
      <p>Approved refunds are returned to the original payment method within 5 to 10 business days, depending on your bank or card issuer.</p>
    </LegalPage>
  ),
});
