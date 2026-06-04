import { NextRequest, NextResponse } from "next/server";
import { fulfillApplicationPaid } from "@/lib/fulfill";
import { verifyAccess } from "@/lib/applications";

export const dynamic = "force-dynamic";

// DEV ONLY — simulates a payment confirmation so the funnel can be tested without
// live Square/PayPal credentials. Disabled in production.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DEV_PAY !== "1") {
    return NextResponse.json({ error: "not available" }, { status: 403 });
  }
  let body: { applicationId?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { applicationId, token } = body;
  if (!applicationId || !token) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await fulfillApplicationPaid(applicationId, "square", `dev-${applicationId}`);
  return NextResponse.json({ paid: true });
}
