import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance Statement — UniEgo" },
      { name: "description", content: "How UniEgo aligns with Nigerian data protection and payment industry expectations." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Compliance Statement"
      intro="UniEgo is operated by EMMTEC Securities and is designed to align with applicable Nigerian data protection and payment industry expectations."
    >
      <h2>1. Data protection</h2>
      <p>We handle personal data in line with the Nigeria Data Protection Act (NDPA) 2023 and the NDPR. Our practices are described in the <a href="/legal/privacy" className="underline">Privacy Policy</a>.</p>

      <h2>2. Payment processing</h2>
      <p>Card and bank payments are processed through a licensed payment service provider regulated by the Central Bank of Nigeria (CBN). UniEgo itself does not store full card details.</p>

      <h2>3. Institutional partnerships</h2>
      <p>UniEgo only enables collections for verified faculties, departments, and associations. See the <a href="/legal/association-verification" className="underline">Association Verification</a> page for how this works.</p>

      <h2>4. Record keeping</h2>
      <p>Financial transaction records are retained in line with statutory record-keeping obligations. Every action on the admin console is written to an audit log.</p>

      <h2>5. Not a certification</h2>
      <p>This page describes enabled controls and current practices. It is not an independent audit, and does not by itself constitute PCI DSS, SOC 2, or ISO certification.</p>

      <h2>6. Contact</h2>
      <p>Compliance and data-protection queries: <a href="mailto:compliance@emmtec.ng">compliance@emmtec.ng</a>.</p>
    </LegalPage>
  ),
});
