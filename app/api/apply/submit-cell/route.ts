import { NextRequest, NextResponse } from "next/server";
import { verifyAccess, setCellImage } from "@/lib/applications";
import { processCellAndStore } from "@/lib/image";
import { moderateImage } from "@/lib/moderation";
import { SHAPES, MAX_UPLOAD_BYTES, ACCEPTED_MIME, type BlockShape } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// One cell of the "simulation module": receive a single square's image + crop,
// moderate, process to a square tile, store, and record it on the application.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const applicationId = String(form.get("applicationId") || "");
  const token = String(form.get("token") || "");
  const cellIndex = Number(form.get("cellIndex"));

  if (!(file instanceof File) || !applicationId || !token || Number.isNaN(cellIndex)) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (app.status !== "paid" && app.status !== "submitted") {
    return NextResponse.json({ error: "not ready to submit" }, { status: 409 });
  }

  const { w, h } = SHAPES[app.shape as BlockShape];
  const total = w * h;
  if (cellIndex < 0 || cellIndex >= total) {
    return NextResponse.json({ error: "bad cell" }, { status: 400 });
  }

  const crop = {
    x: Number(form.get("cropX") || 0),
    y: Number(form.get("cropY") || 0),
    w: Number(form.get("cropW") || 0),
    h: Number(form.get("cropH") || 0),
  };
  const buffer = Buffer.from(await file.arrayBuffer());

  const mod = await moderateImage(buffer, file.type);
  if (mod.hardBlock) {
    return NextResponse.json({ error: "This image can't be submitted." }, { status: 422 });
  }

  let imageUrl: string;
  try {
    imageUrl = await processCellAndStore({ appId: app.id, cellIndex, buffer, crop });
  } catch (e) {
    console.error("cell image processing failed", e);
    return NextResponse.json({ error: "Could not process image." }, { status: 500 });
  }

  const ok = await setCellImage(app.id, cellIndex, imageUrl, total, mod.flagged);
  if (!ok) return NextResponse.json({ error: "not ready to submit" }, { status: 409 });

  return NextResponse.json({ imageUrl });
}
