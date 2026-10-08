import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  QrCode,
  Wallet,
  Building2,
  Users,
  TrendingUp,
  Receipt,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UniEgo — Premium Campus Payment Infrastructure" },
      { name: "description", content: "Pay with ease and stress free. UniEgo powers payments for universities, faculties, departments, and student organizations across Nigeria. Powered by EMMTEC Securities." },
      { property: "og:title", content: "UniEgo — Premium Campus Payment Infrastructure" },
      { property: "og:description", content: "Pay with ease and stress free. UniEgo powers payments for universities, faculties, departments, and student organizations across Nigeria. Powered by EMMTEC Securities." },
      { property: "og:url", content: "https://uniego.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://uniego.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", name: "UniEgo", url: "https://uniego.lovable.app/", description: "Campus payment infrastructure for Nigerian universities, faculties, departments and student associations." },
          { "@type": "WebSite", name: "UniEgo", url: "https://uniego.lovable.app/" },
        ],
      }),
    }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Trust />
      <Modules />
      <HowItWorks />
      <CtaStrip />
      <SiteFooter />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#modules" className="hover:text-foreground">Platform</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <Link to="/verify" className="hover:text-foreground">Verify receipt</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth" search={{ mode: "signup" } as never}><Button size="sm" className="bg-royal text-royal-foreground hover:opacity-90">Get started</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.06_295/_0.4),transparent_60%)]" />
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
            Now live at University of Benin
          </div>
          <h1 className="mt-6 font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Campus payments,<br/>
            <span className="text-royal">re-engineered</span> for trust.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            UniEgo is the institutional-grade payment, treasury, and settlement platform built for universities, faculties, departments, and student organizations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button size="lg" className="bg-royal text-royal-foreground hover:opacity-90 shadow-elegant">
                Pay as a student <ArrowRight className="ml-1 h-4 w-4"/>
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline">Explore the platform</Button>
            </a>
          </div>
          <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
            <Stat label="Verified receipts" value="100%"/>
            <span className="h-8 w-px bg-border"/>
            <Stat label="Settlement audit" value="Immutable"/>
            <span className="h-8 w-px bg-border"/>
            <Stat label="Built for" value="Multi-campus"/>
          </div>
        </div>
        <div className="lg:col-span-5">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display font-semibold text-foreground text-base">{value}</div>
      <div className="uppercase tracking-wider">{label}</div>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gold-gradient opacity-20 blur-2xl rounded-3xl"/>
      <div className="relative rounded-3xl border bg-card p-6 shadow-elegant">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Payment receipt</div>
          <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald">
            <CheckCircle2 className="h-3.5 w-3.5"/> Verified
          </div>
        </div>
        <div className="mt-4 font-display text-3xl font-bold">₦12,500.00</div>
        <div className="mt-1 text-sm text-muted-foreground">Faculty of Engineering · Departmental dues</div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Row label="Matric" value="ENG2006960"/>
          <Row label="Level" value="400L"/>
          <Row label="Reference" value="UPN-9X4F2B"/>
          <Row label="Date" value="Today, 11:42"/>
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary p-3">
          <div className="h-14 w-14 rounded-xl bg-foreground grid place-items-center">
            <QrCode className="h-8 w-8 text-background"/>
          </div>
          <div className="text-xs text-muted-foreground">
            Scan to verify on <span className="text-foreground font-semibold">verify.uniego.lovable.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Trust() {
  return (
    <section className="border-y bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-6 text-sm text-muted-foreground">
        <div className="font-medium">Built for institutional trust</div>
        <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-wider">
          <span>Paystack secured</span><span>·</span>
          <span>Immutable audit</span><span>·</span>
          <span>RLS-enforced data</span><span>·</span>
          <span>Webhook verified</span>
        </div>
      </div>
    </section>
  );
}

const modules = [
  { icon: Wallet, title: "Student Payment Engine", desc: "Pay departmental dues, congress fees, and faculty levies with instant verification." },
  { icon: Building2, title: "Department Treasury", desc: "Real-time collection tracking, balances, and exportable reports for every department." },
  { icon: Users, title: "Faculty Oversight", desc: "Read-only executive view across faculty-wide collections and performance." },
  { icon: ShieldCheck, title: "Admin Control Center", desc: "End-to-end control over campuses, organizations, fees, and settlements." },
  { icon: Receipt, title: "Receipt + QR Verification", desc: "Every receipt is signed, scannable, and verifiable from anywhere." },
  { icon: TrendingUp, title: "Analytics Engine", desc: "Revenue, transactions, service charges, and department rankings at a glance." },
];

function Modules() {
  return (
    <section id="modules" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.2em] text-royal font-semibold">The platform</div>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">
          One operating system for campus money.
        </h2>
        <p className="mt-4 text-muted-foreground">
          From the moment a student pays to the second a settlement clears the bank — every action is traced, every receipt verifiable, every naira accounted for.
        </p>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="group rounded-2xl border bg-card p-6 hover:shadow-elegant transition-shadow">
            <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center text-royal group-hover:bg-royal group-hover:text-royal-foreground transition-colors">
              <Icon className="h-5 w-5"/>
            </div>
            <h3 className="mt-4 font-display font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Student pays", body: "Student logs in, picks a payment, and checks out via Paystack — total computed in real time." },
    { n: "02", title: "Funds verified", body: "Webhook verifies the payment, generates a signed receipt and a QR token." },
    { n: "03", title: "Treasury settled", body: "Admin approves a settlement batch, bank runners execute, deposit slips audited." },
  ];
  return (
    <section id="how" className="bg-royal text-royal-foreground">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Operating model</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">
            From pay-in to settlement, fully traced.
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="font-display text-gold text-sm font-semibold">{s.n}</div>
              <div className="mt-2 font-display text-xl font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-royal-foreground/80">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaStrip() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="rounded-3xl bg-card border p-10 md:p-14 shadow-elegant flex flex-col md:flex-row gap-8 md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Ready to pay or run your faculty's payments?</h3>
          <p className="mt-2 text-muted-foreground max-w-xl">Create an account in seconds and start collecting or paying with full receipt verification.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg" className="bg-royal text-royal-foreground hover:opacity-90">Create an account</Button>
          </Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </div>
    </section>
  );
}
