import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
        </div>
        <div className="text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">EMMTEC SECURITIES</span> &middot;
          Providing Solutions Through Tech
        </div>
        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} UniPay NG. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
