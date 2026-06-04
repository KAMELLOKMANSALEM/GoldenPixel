import sharp from "sharp";
import { supabaseAdmin, STORAGE_BUCKET } from "./supabase/admin";
import { PIXELS_PER_CELL, SHAPES, type BlockShape } from "./config";

// Process ONE cell's image: crop to a square, optimize, EXIF-strip, and store.
// Used by the per-cell "simulation module" — one image per square of a block.
export async function processCellAndStore(params: {
  appId: string;
  cellIndex: number;
  buffer: Buffer;
  crop: { x: number; y: number; w: number; h: number };
}): Promise<string> {
  const { appId, cellIndex, buffer, crop } = params;

  const meta = await sharp(buffer).rotate().metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  const left = Math.max(0, Math.min(crop.x, Math.max(0, srcW - 1)));
  const top = Math.max(0, Math.min(crop.y, Math.max(0, srcH - 1)));
  const width = Math.max(1, Math.min(crop.w, srcW - left));
  const height = Math.max(1, Math.min(crop.h, srcH - top));

  const out = await sharp(buffer)
    .rotate()
    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
    .resize(PIXELS_PER_CELL, PIXELS_PER_CELL, { fit: "cover" })
    .webp({ quality: 84 })
    .toBuffer();

  const db = supabaseAdmin();
  const bucket = db.storage.from(STORAGE_BUCKET);
  const path = `blocks/${appId}/cell-${cellIndex}.webp`;
  const up = await bucket.upload(path, out, { contentType: "image/webp", upsert: true });
  if (up.error) throw up.error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

// Process an uploaded image into a stored original (EXIF-stripped, full-res) and
// a web-optimized cropped version sized to the block's footprint, then upload
// both to Supabase Storage. Returns their public URLs.
export async function processAndStore(params: {
  blockId: string;
  buffer: Buffer;
  shape: BlockShape;
  crop: { x: number; y: number; w: number; h: number };
}): Promise<{ imageUrl: string; originalImageUrl: string }> {
  const { blockId, buffer, shape, crop } = params;

  // Auto-orient using EXIF, then re-encode. sharp drops metadata by default,
  // so EXIF (incl. GPS) is stripped from both outputs.
  const meta = await sharp(buffer).rotate().metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;

  // Clamp the requested crop to the actual (oriented) image bounds.
  const left = Math.max(0, Math.min(crop.x, Math.max(0, srcW - 1)));
  const top = Math.max(0, Math.min(crop.y, Math.max(0, srcH - 1)));
  const width = Math.max(1, Math.min(crop.w, srcW - left));
  const height = Math.max(1, Math.min(crop.h, srcH - top));

  const { w, h } = SHAPES[shape];
  const outW = w * PIXELS_PER_CELL;
  const outH = h * PIXELS_PER_CELL;

  const cropped = await sharp(buffer)
    .rotate()
    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
    .resize(outW, outH, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  // Original kept full-res but EXIF-stripped and re-encoded.
  const original = await sharp(buffer).rotate().webp({ quality: 90 }).toBuffer();

  const db = supabaseAdmin();
  const bucket = db.storage.from(STORAGE_BUCKET);

  const croppedPath = `blocks/${blockId}/cropped.webp`;
  const originalPath = `blocks/${blockId}/original.webp`;

  const up1 = await bucket.upload(croppedPath, cropped, {
    contentType: "image/webp",
    upsert: true,
  });
  if (up1.error) throw up1.error;
  const up2 = await bucket.upload(originalPath, original, {
    contentType: "image/webp",
    upsert: true,
  });
  if (up2.error) throw up2.error;

  return {
    imageUrl: bucket.getPublicUrl(croppedPath).data.publicUrl,
    originalImageUrl: bucket.getPublicUrl(originalPath).data.publicUrl,
  };
}
