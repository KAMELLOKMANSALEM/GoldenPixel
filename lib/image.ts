import sharp from "sharp";
import { putObject, objectUrl } from "./storage";
import { PIXELS_PER_CELL, SHAPES, type BlockShape } from "./config";

// Process ONE cell's image: crop to a square, optimize, EXIF-strip, store.
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

  const key = `blocks/${appId}/cell-${cellIndex}.webp`;
  await putObject(key, out);
  return objectUrl(key);
}

// Process an uploaded image into a stored original (EXIF-stripped, full-res) and a
// web-optimized cropped version sized to the block's footprint. Returns their URLs.
export async function processAndStore(params: {
  blockId: string;
  buffer: Buffer;
  shape: BlockShape;
  crop: { x: number; y: number; w: number; h: number };
}): Promise<{ imageUrl: string; originalImageUrl: string }> {
  const { blockId, buffer, shape, crop } = params;

  const meta = await sharp(buffer).rotate().metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  const left = Math.max(0, Math.min(crop.x, Math.max(0, srcW - 1)));
  const top = Math.max(0, Math.min(crop.y, Math.max(0, srcH - 1)));
  const width = Math.max(1, Math.min(crop.w, srcW - left));
  const height = Math.max(1, Math.min(crop.h, srcH - top));

  const { w, h } = SHAPES[shape];
  const cropped = await sharp(buffer)
    .rotate()
    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
    .resize(w * PIXELS_PER_CELL, h * PIXELS_PER_CELL, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  const original = await sharp(buffer).rotate().webp({ quality: 90 }).toBuffer();

  const croppedKey = `blocks/${blockId}/cropped.webp`;
  const originalKey = `blocks/${blockId}/original.webp`;
  await putObject(croppedKey, cropped);
  await putObject(originalKey, original);

  return { imageUrl: objectUrl(croppedKey), originalImageUrl: objectUrl(originalKey) };
}
