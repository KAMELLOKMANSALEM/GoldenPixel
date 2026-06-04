import { NextResponse } from "next/server";
import { getOccupiedCells } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// Current taken cells (sold + active reservations + blocked). Used by the client
// to recompute placement validity after a race-loss.
export async function GET() {
  const cells = await getOccupiedCells();
  return NextResponse.json({ cells });
}
