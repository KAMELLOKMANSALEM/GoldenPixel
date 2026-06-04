import { SquareClient, SquareEnvironment, WebhooksHelper } from "square";
import { siteUrl } from "../config";

function client(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not set");
  return new SquareClient({
    token,
    environment:
      process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

// Create a hosted Square checkout page. We attach `referenceId` to the order so
// the webhook can map the payment back to whatever it represents (an application).
// Returns the checkout URL and the Square order id (stored as payment_ref).
export async function createSquareCheckout(params: {
  referenceId: string;
  amountCents: number;
  note?: string;
  redirectUrl: string;
}): Promise<{ url: string; orderId: string }> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error("SQUARE_LOCATION_ID not set");
  const sq = client();

  const res = await sq.checkout.paymentLinks.create({
    idempotencyKey: `gp-${params.referenceId}`,
    order: {
      locationId,
      referenceId: params.referenceId,
      lineItems: [
        {
          name: "GoldenPixel square",
          quantity: "1",
          basePriceMoney: { amount: BigInt(params.amountCents), currency: "USD" },
        },
      ],
    },
    checkoutOptions: {
      redirectUrl: params.redirectUrl,
      askForShippingAddress: false,
    },
    paymentNote: params.note || "GoldenPixel square",
  });

  const url = res.paymentLink?.url || res.paymentLink?.longUrl;
  const orderId = res.paymentLink?.orderId;
  if (!url || !orderId) throw new Error("Square did not return a checkout URL");
  return { url, orderId };
}

// Verify a Square webhook signature against the raw body.
export async function verifySquareSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signatureHeader) return false;
  try {
    return await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader,
      signatureKey: key,
      notificationUrl: `${siteUrl()}/api/webhooks/square`,
    });
  } catch {
    return false;
  }
}

// Refund a completed Square payment by its payment id (used by admin refund+release).
export async function refundSquarePayment(paymentId: string, amountCents: number): Promise<void> {
  const sq = client();
  await sq.refunds.refundPayment({
    idempotencyKey: `gp-refund-${paymentId}`,
    paymentId,
    amountMoney: { amount: BigInt(amountCents), currency: "USD" },
    reason: "GoldenPixel admin refund",
  });
}

// Look up the completed payment id for an order (refunds need the payment id, not the order id).
export async function getSquarePaymentIdForOrder(orderId: string): Promise<string | null> {
  const sq = client();
  const res = await sq.orders.get({ orderId });
  const tenders = res.order?.tenders ?? [];
  return tenders[0]?.paymentId ?? null;
}
