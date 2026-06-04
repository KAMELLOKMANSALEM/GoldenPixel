import { NextRequest, NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminAuth";
import { removeBlock } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Default moderation action: art comes down, square stays sold, no money moves.
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

  await removeBlock(body.blockId, admin);
  return NextResponse.json({ ok: true });
}
