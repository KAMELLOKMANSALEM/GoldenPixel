import { NextRequest, NextResponse } from "next/server";
import { verifyAccess, placeApplication } from "@/lib/applications";
import { setEditToken } from "@/lib/blocks";
import { randomToken } from "@/lib/tokens";
import { sendConfirmationEmail, editUrlFor } from "@/lib/email";
import { SHAPES, siteUrl, type BlockShape } from "@/lib/config";
import { cellsForPlacement, inBounds } from "@/lib/grid";

export const dynamic = "force-dynamic";

// Final step — an approved + paid application places its block on the wall.
// The occupied_squares PK guards the race; a conflict means pick another spot.
export async function POST(req: NextRequest) {
  let body: { applicationId?: string; token?: string; row?: number; col?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { applicationId, token, row, col } = body;
  if (!applicationId || !token || typeof row !== "number" || typeof col !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (app.status === "published") {
    return NextResponse.json({ error: "already placed" }, { status: 409 });
  }
  if (app.status !== "approved") {
    return NextResponse.json({ error: "not approved yet" }, { status: 409 });
  }

  const shape = app.shape as BlockShape;
  if (!(shape in SHAPES) || !inBounds(row, col, shape)) {
    return NextResponse.json({ error: "out of bounds" }, { status: 400 });
  }
  const cells = cellsForPlacement(row, col, shape);

  const result = await placeApplication(app.id, cells);
  if (!result.ok) {
    if (result.reason === "conflict") {
      return NextResponse.json({ error: "cells taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "could not place" }, { status: 409 });
  }

  // Give the new block an edit token and email the live + edit links.
  const editToken = randomToken();
  await setEditToken(result.blockId, editToken);
  if (app.email) {
    await sendConfirmationEmail({
      to: app.email,
      liveUrl: `${siteUrl()}/?b=${result.blockId}`,
      editUrl: editUrlFor(result.blockId, editToken),
    });
  }

  return NextResponse.json({ ok: true, blockId: result.blockId });
}
