import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/association-verification")({
  head: () => ({
    meta: [
      { title: "Association Verification — UniEgo" },
      { name: "description", content: "How UniEgo verifies associations, faculties, and departments before they can collect payments." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Association Verification"
      intro="To protect payers, every association, faculty, or department that collects money through UniEgo goes through a verification process before going live."
    >
      <h2>1. Who can be verified</h2>
      <ul>
        <li>Recognized university faculties and departments.</li>
        <li>Registered student associations, unions, and clubs with a supporting letter from the institution.</li>
        <li>Institution-approved event organizers and committees.</li>
      </ul>

      <h2>2. Required documents</h2>
      <ul>
        <li>Formal request or approval letter from the institution or parent body.</li>
        <li>Contact details of the elected or appointed executive.</li>
        <li>Verified settlement account details in the name of the association or its designated custodian.</li>
      </ul>

      <h2>3. Ongoing checks</h2>
      <p>Verified associations are periodically reviewed. UniEgo may suspend collections at any time if it receives credible reports of misrepresentation or misuse.</p>

      <h2>4. Reporting concerns</h2>
      <p>If a payment request looks suspicious, report it to <a href="mailto:support@emmtec.ng">support@emmtec.ng</a> with the payment link or reference. We investigate every report.</p>
    </LegalPage>
  ),
});
