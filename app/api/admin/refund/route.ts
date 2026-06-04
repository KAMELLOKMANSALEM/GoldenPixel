import { NextRequest, NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminAuth";
import { refundAndRelease } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Heavier action: refund the payment AND free the cells back to available.
export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { blockId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.blockId) return NextResponse.json({ error: "missing blockId" }, { status: 400 });

  try {
    await refundAndRelease(body.blockId, admin);
  } catch (e) {
    console.error("refund+release failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "refund failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
