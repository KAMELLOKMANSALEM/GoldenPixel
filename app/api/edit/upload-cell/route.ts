import { NextRequest, NextResponse } from "next/server";
import { getBlockRaw, setBlockCellImage } from "@/lib/blocks";
import { processCellAndStore } from "@/lib/image";
import { moderateImage } from "@/lib/moderation";
import { safeEqual } from "@/lib/tokens";
import { SHAPES, MAX_UPLOAD_BYTES, ACCEPTED_MIME, type BlockShape } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner cell swap (magic-link). Replaces one square's image on a sold block.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const blockId = String(form.get("blockId") || "");
  const token = String(form.get("token") || "");
  const cellIndex = Number(form.get("cellIndex"));

  if (!(file instanceof File) || !blockId || !token || Number.isNaN(cellIndex)) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const block = await getBlockRaw(blockId);
  if (!block || !block.edit_token || !safeEqual(token, block.edit_token) || block.state !== "sold") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { w, h } = SHAPES[block.shape as BlockShape];
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
    return NextResponse.json({ error: "This image can't be published." }, { status: 422 });
  }

  let imageUrl: string;
  try {
    imageUrl = await processCellAndStore({
      appId: `block-${blockId}`,
      cellIndex,
      buffer,
      crop,
    });
  } catch (e) {
    console.error("edit cell processing failed", e);
    return NextResponse.json({ error: "Could not process image." }, { status: 500 });
  }

  const ok = await setBlockCellImage(blockId, cellIndex, imageUrl, total, mod.flagged);
  if (!ok) return NextResponse.json({ error: "update failed" }, { status: 500 });

  return NextResponse.json({ imageUrl, flagged: mod.flagged });
}
