import { NextRequest, NextResponse } from "next/server";
import { verifyAccess, setPaymentRef } from "@/lib/applications";
import { createSquareCheckout } from "@/lib/payments/square";
import { priceCentsForSize, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

// Funnel payment (Square) — hosted checkout for an application. Amount is
// recomputed server-side from the application's size; the client cannot set price.
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

  const amountCents = priceCentsForSize(app.size);
  try {
    const { url, orderId } = await createSquareCheckout({
      referenceId: app.id,
      amountCents,
      note: "GoldenPixel application",
      redirectUrl: `${siteUrl()}/a/${app.id}?token=${encodeURIComponent(token)}&paid=1`,
    });
    await setPaymentRef(app.id, "square", orderId);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("square checkout failed", e);
    return NextResponse.json({ error: "Square checkout unavailable" }, { status: 502 });
  }
}
