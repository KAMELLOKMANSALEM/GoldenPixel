// PayPal Orders v2 over REST (no SDK needed). Order creation + capture happen
// server-side; the capture call is the trusted confirmation that flips a square
// to sold — the browser only relays the approval.

function base(): string {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials not set");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal auth failed");
  const data = await res.json();
  return data.access_token as string;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function createPaypalOrder(params: {
  referenceId: string;
  amountCents: number;
}): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.referenceId,
          custom_id: params.referenceId,
          description: "GoldenPixel square",
          amount: { currency_code: "USD", value: dollars(params.amountCents) },
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.message || "PayPal order create failed");
  return data.id as string;
}

// Capture an approved order. Returns the captured details so the caller can
// verify the amount matches the server-computed price before marking sold.
export async function capturePaypalOrder(orderId: string): Promise<{
  completed: boolean;
  captureId: string | null;
  amountCents: number | null;
  referenceId: string | null;
}> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  const pu = data.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  const value = cap?.amount?.value;
  return {
    completed: data.status === "COMPLETED" && cap?.status === "COMPLETED",
    captureId: cap?.id ?? null,
    amountCents: value ? Math.round(parseFloat(value) * 100) : null,
    referenceId: pu?.reference_id ?? pu?.custom_id ?? null,
  };
}

export async function refundPaypalCapture(captureId: string, amountCents: number): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: { value: dollars(amountCents), currency_code: "USD" } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "PayPal refund failed");
  }
}
