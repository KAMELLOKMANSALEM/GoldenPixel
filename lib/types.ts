import type { BlockSize, BlockShape } from "./config";

export type Cell = { row: number; col: number };

export type BlockState = "reserved" | "sold";
export type BlockStatus = "live" | "removed";

// Mirrors the `blocks` table. snake_case columns are mapped in lib/blocks.ts.
export interface Block {
  id: string;
  squares: Cell[];
  size: BlockSize;
  shape: BlockShape;
  imageUrl: string | null;
  originalImageUrl: string | null;
  caption: string | null;
  linkUrl: string | null;
  ownerEmail: string | null;
  state: BlockState;
  reservedUntil: string | null; // ISO timestamp
  status: BlockStatus;
  flagged: boolean;
  createdAt: string;
}

// Shown on the "about the work" panel when a square is enlarged.
export interface ArtistProfile {
  artist: string;
  bio: string;
  about: string;
  avatarUrl: string | null; // null => default avatar (initials)
}

// The minimal public projection sent to the browser for rendering the wall.
// No owner email, no original image, no reservation internals.
export interface PublicBlock {
  id: string;
  squares: Cell[];
  shape: BlockShape;
  imageUrl: string | null;
  // One image per cell (row-major, same order as `squares`); used to render the
  // assembled mosaic. Null/absent => use imageUrl across the whole block.
  cellImages?: (string | null)[] | null;
  caption: string | null;
  linkUrl: string | null;
  state: BlockState; // 'reserved' cells render as occupied but blank
  status: BlockStatus;
  profile?: ArtistProfile | null;
}
