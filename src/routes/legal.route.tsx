import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";

export const Route = createFileRoute("/legal")({
  component: LegalLayout,
});

const NAV: Array<{ to: string; label: string }> = [
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/payment", label: "Payment Policy" },
  { to: "/legal/association-verification", label: "Association Verification" },
  { to: "/legal/refund", label: "Refund Policy" },
  { to: "/legal/security", label: "Security Policy" },
  { to: "/legal/qr-verification", label: "QR Receipt Verification" },
  { to: "/legal/terms", label: "Terms of Service" },
  { to: "/legal/compliance", label: "Compliance Statement" },
];

function LegalLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b glass sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-10 grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 self-start">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Legal &amp; Trust
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="max-w-3xl">
          <Outlet />
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
