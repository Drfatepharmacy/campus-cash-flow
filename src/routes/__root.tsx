import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { RecoveryScreen, BrandedPending, useRecoveryReset } from "@/components/feedback/recovery-boundary";
import { reportClientError } from "@/lib/client-monitor";

function NotFoundComponent() {
  return (
    <ErrorState
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or the link has expired."
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return <RecoveryScreen error={error} onRetry={() => { router.invalidate(); reset(); }} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "UniEgo — Premium Campus Payment Infrastructure" },
      { name: "description", content: "Pay with ease and stress free. UniEgo powers payments for universities, faculties, departments, and student organizations across Nigeria. Powered by EMMTEC Securities." },
      { property: "og:title", content: "UniEgo — Premium Campus Payment Infrastructure" },
      { property: "og:description", content: "Pay with ease and stress free. UniEgo powers payments for universities, faculties, departments, and student organizations across Nigeria. Powered by EMMTEC Securities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "UniEgo — Premium Campus Payment Infrastructure" },
      { name: "twitter:description", content: "Pay with ease and stress free. UniEgo powers payments for universities, faculties, departments, and student organizations across Nigeria. Powered by EMMTEC Securities." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b6f28ab2-4bc0-4f7d-8cac-0a43be8daddd" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b6f28ab2-4bc0-4f7d-8cac-0a43be8daddd" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: BrandedPending,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useRecoveryReset();

  useEffect(() => {
    const onRej = (e: PromiseRejectionEvent) => reportClientError(e.reason, "unhandled");
    window.addEventListener("unhandledrejection", onRej);
    return () => window.removeEventListener("unhandledrejection", onRej);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
