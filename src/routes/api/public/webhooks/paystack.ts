import { createFileRoute } from "@tanstack/react-router";
import { handlePaystackWebhookRequest } from "@/lib/paystack-webhook.server";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePaystackWebhookRequest(request),
    },
  },
});
