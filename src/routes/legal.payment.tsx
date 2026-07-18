import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/payment")({
  head: () => ({
    meta: [
      { title: "Payment Policy — UniEgo" },
      { name: "description", content: "How payments are collected, processed, and settled on UniEgo." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Payment Policy"
      intro="This policy explains how UniEgo processes payments for institutions, faculties, departments, and student associations."
    >
      <h2>1. Accepted payment methods</h2>
      <p>Payments are processed through our licensed payment partner and support cards, bank transfers, and USSD as offered by that partner.</p>

      <h2>2. Charges and fees</h2>
      <p>Any service charges are disclosed on the payment page before you confirm the transaction. There are no hidden fees.</p>

      <h2>3. Confirmation and receipts</h2>
      <p>Every successful payment generates a digital receipt with a unique reference and a QR verification code that any recipient can independently verify.</p>

      <h2>4. Failed and pending transactions</h2>
      <p>If your account is debited but the transaction is marked failed or pending, it is automatically reconciled within 24 hours. If the payment cannot be confirmed, funds are returned to the source account under our refund policy.</p>

      <h2>5. Settlement to organizations</h2>
      <p>Funds are settled to the verified account of the receiving institution, faculty, department, or association based on our settlement schedule.</p>

      <h2>6. Disputes</h2>
      <p>Report payment disputes within 30 days of the transaction date to <a href="mailto:support@emmtec.ng">support@emmtec.ng</a>. Include the transaction reference from your receipt.</p>
    </LegalPage>
  ),
});
