import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — UniEgo" },
      { name: "description", content: "The terms that govern your use of UniEgo." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your access to and use of UniEgo. By creating an account or making a payment, you agree to them."
    >
      <h2>1. Eligibility</h2>
      <p>You must be a student, staff member, or authorized representative of a recognized institution or association to use UniEgo for institutional payments.</p>

      <h2>2. Your account</h2>
      <p>You are responsible for keeping your credentials secure and for all activity performed under your account.</p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Do not attempt to bypass security controls.</li>
        <li>Do not use UniEgo to launder funds, defraud others, or process payments for illegal activity.</li>
        <li>Do not misrepresent yourself as an association, faculty, or department you do not represent.</li>
      </ul>

      <h2>4. Payments</h2>
      <p>All payments are subject to the <a href="/legal/payment" className="underline">Payment Policy</a> and <a href="/legal/refund" className="underline">Refund Policy</a>.</p>

      <h2>5. Suspension</h2>
      <p>We may suspend or terminate an account that violates these terms, poses a security risk, or is under active investigation.</p>

      <h2>6. Disclaimer</h2>
      <p>UniEgo is provided on an "as is" basis. We take reasonable steps to keep it available and accurate, but do not guarantee uninterrupted service.</p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>8. Changes</h2>
      <p>We may update these terms from time to time. Material changes will be communicated on this page.</p>
    </LegalPage>
  ),
});
