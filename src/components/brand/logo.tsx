import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src="/android-chrome-512x512.png" alt={withText ? "" : "UniEgo"} className="h-11 w-11 shrink-0 rounded-lg object-contain" />
      {withText && (
        <div className="leading-tight">
          <div className="font-display font-bold text-foreground tracking-tight">Uni<span className="text-royal">Ego</span></div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Secure payments</div>
        </div>
      )}
    </div>
  );
}
