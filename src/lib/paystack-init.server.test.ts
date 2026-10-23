import { afterEach, describe, expect, it, vi } from "vitest";
import { initializePaystackCheckout, PaystackInitError } from "@/lib/paystack-init.server";

describe("initializePaystackCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns authorization url for a valid provider response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: true,
      data: { authorization_url: "https://paystack.example/authorize" },
    }), { status: 200 })) as any);

    const result = await initializePaystackCheckout({
      secret: "sk_test_secret",
      payload: { email: "payer@example.com", amount: 5000 },
    });
    expect(result.authorization_url).toBe("https://paystack.example/authorize");
  });

  it("throws recoverable network_error when request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }) as any);

    await expect(initializePaystackCheckout({
      secret: "sk_test_secret",
      payload: { email: "payer@example.com", amount: 5000 },
    })).rejects.toMatchObject<Partial<PaystackInitError>>({ reason: "network_error" });
  });

  it("throws provider_http reason when response is unsuccessful", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: false,
      message: "gateway declined",
    }), { status: 502 })) as any);

    await expect(initializePaystackCheckout({
      secret: "sk_test_secret",
      payload: { email: "payer@example.com", amount: 5000 },
    })).rejects.toMatchObject<Partial<PaystackInitError>>({ reason: "gateway declined" });
  });
});
