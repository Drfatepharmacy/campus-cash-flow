import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/qr-verification")({
  head: () => ({
    meta: [
      { title: "QR Receipt Verification — UniEgo" },
      { name: "description", content: "How to verify any UniEgo receipt with the QR code — no account required." },
    ],
  }),
  component: () => (
    <LegalPage
      title="QR Receipt Verification"
      intro="Every UniEgo receipt carries a signed QR code that anyone can verify — no login, no cost."
    >
      <h2>1. What the QR code proves</h2>
      <p>Scanning the QR code opens a public verification page showing the transaction reference, amount, purpose, status, and paid date directly from our database. If the receipt has been altered, the verification page will not match.</p>

      <h2>2. How to verify</h2>
      <ul>
        <li>Open the camera on any smartphone and point it at the QR code.</li>
        <li>Or visit <Link to="/verify" className="underline">the verification page</Link> and scan, upload an image, or paste the receipt code.</li>
      </ul>

      <h2>3. What to look for</h2>
      <ul>
        <li><strong>Status: Paid</strong> — the payment was successfully received.</li>
        <li><strong>Matching reference and amount</strong> to the printed or forwarded receipt.</li>
        <li>Receipt on the domain <span className="font-mono">uniego.lovable.app</span>.</li>
      </ul>

      <h2>4. If verification fails</h2>
      <p>If the QR code does not resolve, or the verification page shows a different amount or status, do not accept the receipt as proof of payment. Report it to <a href="mailto:support@emmtec.ng">support@emmtec.ng</a>.</p>
    </LegalPage>
  ),
});
