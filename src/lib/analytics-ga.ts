// Optional Google Analytics 4. Active only when VITE_GA_MEASUREMENT_ID is set.
// Sends page paths only (query strings stripped) — never names, matric numbers or payment data.
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void } }

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
let loaded = false;

export function initGA() {
  if (!GA_ID || loaded || typeof window === "undefined") return;
  loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
}

export function trackPageView(pathname: string) {
  if (!GA_ID || !window.gtag) return;
  // Mask tokens in dynamic paths (receipts, payment links).
  const path = pathname.replace(/\/(p|verify|receipt|pay)\/[^/]+/, "/$1/:id");
  window.gtag("event", "page_view", { page_path: path, page_location: window.location.origin + path });
}
