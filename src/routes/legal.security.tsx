import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

export const Route = createFileRoute("/legal/security")({
  head: () => ({
    meta: [
      { title: "Security Policy — UniEgo" },
      { name: "description", content: "The security controls UniEgo uses to protect your account and payments." },
    ],
  }),
  component: () => (
    <LegalPage
      title="Security Policy"
      intro="Security is central to how UniEgo is built and operated. Below are the enabled controls and current practices."
    >
      <h2>1. Encryption</h2>
      <p>All traffic between your device and UniEgo is protected with HTTPS/TLS. Data is encrypted in transit and at rest by our cloud database provider.</p>

      <h2>2. Authentication</h2>
      <p>UniEgo supports email and Google sign-in. Sessions are managed with rotating secure tokens. Passwords are never stored in plain text.</p>

      <h2>3. Access control</h2>
      <p>UniEgo uses row-level security so each user, association, and role only sees data they are entitled to. Administrative actions are recorded in an audit log.</p>

      <h2>4. Payment security</h2>
      <p>Card and bank details are processed by a licensed payment partner. UniEgo does not store full card numbers, CVVs, or bank credentials.</p>

      <h2>5. Vulnerability reporting</h2>
      <p>Responsible disclosure is welcome. Report suspected security issues to <a href="mailto:security@emmtec.ng">security@emmtec.ng</a>. Please do not test on live production data.</p>

      <h2>6. Incident response</h2>
      <p>In the event of a confirmed security incident affecting your data, we will notify affected users and the relevant authorities in line with applicable Nigerian law.</p>

      <h2>7. Shared responsibility</h2>
      <p>Keep your password private, use a strong unique password, and sign out on shared devices. UniEgo staff will never ask for your password or OTP.</p>
    </LegalPage>
  ),
});
