import type { ReactNode } from "react";

const LAST_UPDATED = "November 2025";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Last updated · {LAST_UPDATED}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {intro ? <p className="text-muted-foreground leading-relaxed">{intro}</p> : null}
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-p:leading-relaxed prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-ul:my-3">
        {children}
      </div>
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        This page is maintained by <span className="font-semibold text-foreground">EMMTEC Securities</span>,
        operator of UniEgo, to answer common questions about how the platform handles payments,
        data, and verification. It reflects app-visible controls and current practices, and is
        not an independent certification. For questions, contact{" "}
        <a href="mailto:support@emmtec.ng" className="underline hover:text-foreground">support@emmtec.ng</a>.
      </div>
    </div>
  );
}
