import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

const LEGAL_LINKS: Array<{ to: string; label: string }> = [
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/payment", label: "Payment Policy" },
  { to: "/legal/association-verification", label: "Association Verification" },
  { to: "/legal/refund", label: "Refund Policy" },
  { to: "/legal/security", label: "Security Policy" },
  { to: "/legal/qr-verification", label: "QR Receipt Verification" },
  { to: "/legal/terms", label: "Terms of Service" },
  { to: "/legal/compliance", label: "Compliance Statement" },
];

export function SiteFooter() {
  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-3">
        <div className="space-y-4">
          <Logo />
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            UniEgo is a secure digital platform that simplifies association payments, student
            financial management, and transparent transaction tracking across institutions.
          </p>
          <div className="text-xs text-muted-foreground">
            Built by <span className="font-semibold text-foreground">EMMTEC Securities</span>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Legal &amp; Trust
          </div>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-muted-foreground">
          <div>&copy; {new Date().getFullYear()} UniEgo. All rights reserved.</div>
          <div>Powered by EMMTEC Securities &middot; Providing Solutions Through Tech</div>
        </div>
      </div>
    </footer>
  );
}
