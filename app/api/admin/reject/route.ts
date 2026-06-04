import { NextRequest, NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminAuth";
import { rejectSubmission } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Reject a submission — auto-refunds the payment.
export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { applicationId?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.applicationId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    await rejectSubmission(body.applicationId, admin, (body.notes || "").trim() || null);
  } catch (e) {
    console.error("reject failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "reject failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
