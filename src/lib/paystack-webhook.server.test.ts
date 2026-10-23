import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handlePaystackWebhookRequest } from "@/lib/paystack-webhook.server";

function sign(secret: string, body: string) {
  return createHmac("sha512", secret).update(body).digest("hex");
}

function createSupabaseMock(options: {
  insertError?: { code?: string; message?: string } | null;
  rpcOutcome?: string;
  rpcError?: { message: string } | null;
}) {
  const inserts: any[] = [];
  const outcomes: string[] = [];
  const from = (table: string) => {
    if (table === "webhook_events") {
      return {
        insert: async (row: any) => {
          inserts.push(row);
          return { error: options.insertError ?? null };
        },
        update: (payload: any) => {
          const chain: any = {
            eq() { return chain; },
            then(resolve: (value: any) => void) {
              outcomes.push(String(payload.outcome ?? ""));
              resolve({ error: null });
            },
          };
          return chain;
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  };
  const rpc = async () => {
    if (options.rpcError) return { data: null, error: options.rpcError };
    return {
      data: [{ outcome: options.rpcOutcome ?? "already_paid", transaction_id: "txn_1", qr_token: null }],
      error: null,
    };
  };
  return { supabase: { from, rpc }, inserts, outcomes };
}

function makeRequest(secret: string, payload: unknown, signatureOverride?: string) {
  const body = JSON.stringify(payload);
  const signature = signatureOverride ?? sign(secret, body);
  return new Request("https://example.com/api/public/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": signature },
    body,
  });
}

const validPayload = {
  event: "charge.success",
  id: 7001,
  data: {
    id: 9001,
    reference: "UEG-TEST-12345678",
    amount: 500000,
    currency: "NGN",
    paid_at: "2026-01-01T00:00:00.000Z",
    customer: { email: "payer@example.com" },
  },
};

describe("handlePaystackWebhookRequest", () => {
  it("returns 401 for invalid signatures", async () => {
    const { supabase } = createSupabaseMock({});
    const response = await handlePaystackWebhookRequest(
      makeRequest("sk_test_secret", validPayload, "deadbeef"),
      {
        getSecret: () => "sk_test_secret",
        getSupabaseAdmin: async () => supabase as any,
      },
    );
    expect(response.status).toBe(401);
  });

  it("acknowledges duplicate webhook only on unique violation", async () => {
    const { supabase } = createSupabaseMock({ insertError: { code: "23505", message: "duplicate" } });
    const response = await handlePaystackWebhookRequest(makeRequest("sk_test_secret", validPayload), {
      getSecret: () => "sk_test_secret",
      getSupabaseAdmin: async () => supabase as any,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("duplicate");
  });

  it("returns retryable 5xx for non-duplicate replay insert failures", async () => {
    const { supabase } = createSupabaseMock({ insertError: { code: "57P01", message: "db down" } });
    const logError = vi.fn();
    const response = await handlePaystackWebhookRequest(makeRequest("sk_test_secret", validPayload), {
      getSecret: () => "sk_test_secret",
      getSupabaseAdmin: async () => supabase as any,
      logError,
    });
    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalled();
  });

  it("rejects malformed amount payloads", async () => {
    const { supabase } = createSupabaseMock({});
    const payload = {
      ...validPayload,
      data: { ...validPayload.data, amount: "not-a-number" },
    };
    const response = await handlePaystackWebhookRequest(makeRequest("sk_test_secret", payload), {
      getSecret: () => "sk_test_secret",
      getSupabaseAdmin: async () => supabase as any,
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("invalid amount");
  });

  it("keeps repeated webhook finalization idempotent", async () => {
    const { supabase } = createSupabaseMock({ rpcOutcome: "already_paid" });
    const response = await handlePaystackWebhookRequest(makeRequest("sk_test_secret", validPayload), {
      getSecret: () => "sk_test_secret",
      getSupabaseAdmin: async () => supabase as any,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("already_paid");
  });

  it("acknowledges amount mismatch outcomes without retry storm", async () => {
    const { supabase } = createSupabaseMock({ rpcOutcome: "amount_mismatch" });
    const response = await handlePaystackWebhookRequest(makeRequest("sk_test_secret", validPayload), {
      getSecret: () => "sk_test_secret",
      getSupabaseAdmin: async () => supabase as any,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("amount_mismatch");
  });
});
