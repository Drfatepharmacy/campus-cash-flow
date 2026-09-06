import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export function ErrorState({
  code,
  title,
  description,
  onRetry,
}: {
  code?: string;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-16">
      <div className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-royal-gradient opacity-15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-gold-gradient opacity-15 blur-3xl" />

      <div className="relative mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center text-center">
        <Logo />
        <div className="mt-10 w-full rounded-3xl border bg-card/80 p-8 shadow-elegant glass">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          {code && (
            <div className="mt-5 font-display text-5xl font-bold tracking-tight text-royal">{code}</div>
          )}
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">{description}</p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="bg-royal text-royal-foreground hover:opacity-90">
                <RotateCcw className="mr-2 h-4 w-4" /> Try again
              </Button>
            )}
            <Button asChild variant="outline">
              <a href="/"><Home className="mr-2 h-4 w-4" /> Go home</a>
            </Button>
          </div>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Need help? Contact your association or the UniEgo support team.
        </p>
      </div>
    </div>
  );
}
