import { NextRequest, NextResponse } from "next/server";
import { verifySquareSignature } from "@/lib/payments/square";
import { getApplicationByPaymentRef } from "@/lib/applications";
import { fulfillApplicationPaid } from "@/lib/fulfill";

export const dynamic = "force-dynamic";

// The ONLY thing that flips a Square-paid application to `paid`. A forged browser
// call can never reach here: we verify the HMAC signature.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");

  if (!(await verifySquareSignature(raw, sig))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: {
    data?: { object?: { payment?: { id?: string; order_id?: string; status?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const payment = event.data?.object?.payment;
  if (!payment || payment.status !== "COMPLETED" || !payment.order_id) {
    return NextResponse.json({ received: true });
  }

  // payment_ref was set to the Square order id at checkout creation.
  const app = await getApplicationByPaymentRef(payment.order_id);
  if (!app) return NextResponse.json({ received: true });

  await fulfillApplicationPaid(app.id, "square", payment.id || payment.order_id);
  return NextResponse.json({ received: true });
}
