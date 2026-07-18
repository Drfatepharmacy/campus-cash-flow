import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-9 w-9 rounded-xl bg-royal-gradient shadow-elegant grid place-items-center">
        <span className="font-display font-bold text-gold text-lg leading-none">U</span>
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald border-2 border-background" />
      </div>
      {withText && (
        <div className="leading-tight">
          <div className="font-display font-bold text-foreground tracking-tight">Uni<span className="text-royal">Ego</span></div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Secure payments</div>
        </div>
      )}
    </div>
  );
}
