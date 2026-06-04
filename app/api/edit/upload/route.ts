import { NextRequest, NextResponse } from "next/server";
import { getBlockRaw } from "@/lib/blocks";
import { processAndStore } from "@/lib/image";
import { moderateImage } from "@/lib/moderation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/tokens";
import { MAX_UPLOAD_BYTES, ACCEPTED_MIME, type BlockShape } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner image swap (magic-link). Re-crops to the SAME shape — position/size fixed.
// Goes through the same moderation gate as the original upload.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const blockId = String(form.get("blockId") || "");
  const token = String(form.get("token") || "");
  if (!(file instanceof File) || !blockId || !token) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const block = await getBlockRaw(blockId);
  if (!block || !block.edit_token || !safeEqual(token, block.edit_token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const urls = await processAndStore({
    blockId,
    buffer,
    shape: block.shape as BlockShape,
    crop,
  });

  const { error } = await supabaseAdmin()
    .from("blocks")
    .update({
      image_url: urls.imageUrl,
      original_image_url: urls.originalImageUrl,
      flagged: mod.flagged,
      moderation: mod.detail,
    })
    .eq("id", blockId);
  if (error) return NextResponse.json({ error: "update failed" }, { status: 500 });

  // A swap re-opens an unflagged block to review only if newly flagged.
  return NextResponse.json({ imageUrl: urls.imageUrl, flagged: mod.flagged });
}
