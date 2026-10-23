export class PaystackInitError extends Error {
  reason: string;

  constructor(reason: string, message = "Paystack init failed") {
    super(message);
    this.reason = reason;
  }
}

export async function initializePaystackCheckout(args: {
  secret: string;
  payload: Record<string, unknown>;
}): Promise<{ authorization_url: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + args.secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.payload),
    });
  } catch {
    throw new PaystackInitError("network_error");
  }

  let json: { status?: boolean; message?: string; data?: { authorization_url?: string } };
  try {
    json = await res.json();
  } catch {
    throw new PaystackInitError("bad_provider_response");
  }

  if (!res.ok || !json.status || !json.data?.authorization_url) {
    throw new PaystackInitError(json.message || `provider_http_${res.status}`, json.message || "Paystack init failed");
  }
  return { authorization_url: json.data.authorization_url };
}
