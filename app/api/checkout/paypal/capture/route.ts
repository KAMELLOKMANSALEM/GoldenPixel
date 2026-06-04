import { NextRequest, NextResponse } from "next/server";
import { verifyAccess } from "@/lib/applications";
import { capturePaypalOrder, refundPaypalCapture } from "@/lib/payments/paypal";
import { fulfillApplicationPaid } from "@/lib/fulfill";
import { priceCentsForSize } from "@/lib/config";

export const dynamic = "force-dynamic";

// Funnel payment (PayPal) — server-side capture is the trusted confirmation that
// flips an application to paid. The browser only relays the order id.
export async function POST(req: NextRequest) {
  let body: { applicationId?: string; token?: string; orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { applicationId, token, orderId } = body;
  if (!applicationId || !token || !orderId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const expected = priceCentsForSize(app.size);
  const cap = await capturePaypalOrder(orderId);
  if (!cap.completed || !cap.captureId) {
    return NextResponse.json({ paid: false, error: "payment not completed" }, { status: 402 });
  }
  // Guard against amount / reference tampering.
  if (cap.amountCents !== expected || cap.referenceId !== applicationId) {
    try {
      await refundPaypalCapture(cap.captureId, cap.amountCents ?? expected);
    } catch (e) {
      console.error("paypal mismatch refund failed", e);
    }
    return NextResponse.json({ paid: false, error: "amount mismatch" }, { status: 400 });
  }

  await fulfillApplicationPaid(applicationId, "paypal", cap.captureId);
  return NextResponse.json({ paid: true });
}
