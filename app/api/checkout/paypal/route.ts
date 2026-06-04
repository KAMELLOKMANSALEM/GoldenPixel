import { NextRequest, NextResponse } from "next/server";
import { verifyAccess } from "@/lib/applications";
import { createPaypalOrder } from "@/lib/payments/paypal";
import { priceCentsForSize } from "@/lib/config";

export const dynamic = "force-dynamic";

// Funnel payment (PayPal) — create an order. Amount computed server-side from size.
export async function POST(req: NextRequest) {
  let body: { applicationId?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { applicationId, token } = body;
  if (!applicationId || !token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (app.status !== "eligible") {
    return NextResponse.json({ error: "already paid" }, { status: 409 });
  }

  try {
    const orderId = await createPaypalOrder({
      referenceId: app.id,
      amountCents: priceCentsForSize(app.size),
    });
    return NextResponse.json({ orderId });
  } catch (e) {
    console.error("paypal create failed", e);
    return NextResponse.json({ error: "PayPal unavailable" }, { status: 502 });
  }
}
