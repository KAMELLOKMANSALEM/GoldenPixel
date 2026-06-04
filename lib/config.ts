// Central, server-trusted configuration for the wall.
// Pricing and grid geometry live here so the client and server agree on one source.

// 10,000 squares. Wide aspect: rows fill the screen height, columns extend past
// the viewport so the wall pans left/right.
export const GRID = {
  COLS: 200,
  ROWS: 50,
} as const;

export const TOTAL_SQUARES = GRID.COLS * GRID.ROWS;

// Price per single square, in US cents. Server is the source of truth — never trust the client.
export const PRICE_PER_SQUARE_CENTS = 5000; // $50

export type BlockSize = 1 | 2 | 4 | 9;
export type BlockShape = "1x1" | "1x2" | "2x1" | "2x2" | "3x3";

// Allowed (size, shape) combinations and their cell footprint (width x height in cells).
export const SHAPES: Record<BlockShape, { w: number; h: number; size: BlockSize }> = {
  "1x1": { w: 1, h: 1, size: 1 },
  "1x2": { w: 1, h: 2, size: 2 }, // tall
  "2x1": { w: 2, h: 1, size: 2 }, // wide
  "2x2": { w: 2, h: 2, size: 4 },
  "3x3": { w: 3, h: 3, size: 9 },
};

// Which shapes are offered for a given size. Size 2 offers a toggle; the rest are fixed.
export const SHAPES_FOR_SIZE: Record<BlockSize, BlockShape[]> = {
  1: ["1x1"],
  2: ["1x2", "2x1"],
  4: ["2x2"],
  9: ["3x3"],
};

export const RESERVATION_MINUTES = 10;

// Upload constraints.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_CAPTION_LEN = 40;

// Web-optimized output resolution per cell. A 3x3 block renders larger than a 1x1.
export const PIXELS_PER_CELL = 240;

export function priceCentsForSize(size: BlockSize): number {
  return PRICE_PER_SQUARE_CENTS * size;
}

export function dollarsForSize(size: BlockSize): number {
  return priceCentsForSize(size) / 100;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
