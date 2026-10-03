import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Home, Loader2, RotateCcw, WifiOff } from "lucide-react";
import { classify, reportClientError } from "@/lib/client-monitor";

const MAX_AUTO = 3;
const KEY = "uniego-recovery-attempts";

/** Branded error screen with automatic retry + visible countdown. */
export function RecoveryScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const info = classify(error);
  const [ref] = useState(() => reportClientError(error));
  const attempts = useRef(0);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    attempts.current = Number(sessionStorage.getItem(KEY) ?? "0");
    if (attempts.current < MAX_AUTO) setLeft(5 * (attempts.current + 1));
  }, []);

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      if (!navigator.onLine) { setLeft(5); return; }
      sessionStorage.setItem(KEY, String(attempts.current + 1));
      // A restart can leave the page holding stale files — a full reload is the safe recovery.
      if (info.restartLike) window.location.reload(); else onRetry();
      return;
    }
    const t = setTimeout(() => setLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const retryNow = () => { sessionStorage.setItem(KEY, "0"); info.restartLike ? window.location.reload() : onRetry(); };
  const offline = info.category === "offline";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-16">
      <div className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-royal-gradient opacity-15 blur-3xl" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <Logo />
        <div className="mt-10 w-full rounded-3xl border bg-card/80 p-8 shadow-elegant glass">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            {offline ? <WifiOff className="h-6 w-6" /> : <Loader2 className={`h-6 w-6 ${left !== null ? "animate-spin" : ""}`} />}
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">{offline ? "You're offline" : info.restartLike ? "UniEgo is reconnecting" : "This page didn't load"}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            {offline ? "Check your internet connection. We'll try again as soon as you're back online." : info.restartLike ? "We were updating in the background. Your data and payments are safe." : "Something interrupted this page. Your data is safe."}
          </p>
          {left !== null ? (
            <p className="mt-4 text-sm font-medium" aria-live="polite">Retrying in {left}…</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Automatic retries didn't work. Try again, or go home.</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={retryNow} className="bg-royal text-royal-foreground hover:opacity-90"><RotateCcw className="mr-2 h-4 w-4" />Try again now</Button>
            <Button asChild variant="outline"><a href="/" onClick={() => sessionStorage.setItem(KEY, "0")}><Home className="mr-2 h-4 w-4" />Go home</a></Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Reference: <span className="font-mono">{ref}</span></p>
        </div>
      </div>
    </div>
  );
}

/** Shown while a page is loading. */
export function BrandedPending() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-royal" />Loading…</div>
    </div>
  );
}

/** Clears the retry counter once a page renders successfully. */
export function useRecoveryReset() {
  useEffect(() => { const t = setTimeout(() => sessionStorage.removeItem(KEY), 3000); return () => clearTimeout(t); }, []);
}
