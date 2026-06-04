// Server-side data access for blocks + occupancy. All functions use the service-role
// client and are safe to call from API routes and Server Components only.

import { supabaseAdmin } from "./supabase/admin";
import type { Block, PublicBlock, Cell } from "./types";
import type { BlockSize, BlockShape } from "./config";

type BlockRow = {
  id: string;
  squares: Cell[];
  size: BlockSize;
  shape: BlockShape;
  image_url: string | null;
  original_image_url: string | null;
  cell_images: (string | null)[] | null;
  caption: string | null;
  link_url: string | null;
  owner_email: string | null;
  state: "reserved" | "sold";
  reserved_until: string | null;
  status: "live" | "removed";
  flagged: boolean;
  moderation: unknown;
  amount_cents: number;
  payment_provider: string | null;
  payment_ref: string | null;
  edit_token: string | null;
  created_at: string;
  paid_at: string | null;
};

function rowToBlock(r: BlockRow): Block {
  return {
    id: r.id,
    squares: r.squares,
    size: r.size,
    shape: r.shape,
    imageUrl: r.image_url,
    originalImageUrl: r.original_image_url,
    caption: r.caption,
    linkUrl: r.link_url,
    ownerEmail: r.owner_email,
    state: r.state,
    reservedUntil: r.reserved_until,
    status: r.status,
    flagged: r.flagged,
    createdAt: r.created_at,
  };
}

function rowToPublic(r: BlockRow): PublicBlock {
  // Only PAID (sold + live) blocks show art publicly. Reserved-but-unpaid blocks
  // occupy the wall as blank cells — their uploaded art must not leak before
  // payment. Removed blocks also show blank.
  const reveal = r.state === "sold" && r.status === "live";
  return {
    id: r.id,
    squares: r.squares,
    shape: r.shape,
    imageUrl: reveal ? r.image_url : null,
    cellImages: reveal ? r.cell_images : null,
    caption: reveal ? r.caption : null,
    linkUrl: reveal ? r.link_url : null,
    state: r.state,
    status: r.status,
  };
}

// Free any reservations whose timer has elapsed. Cheap to call before reads.
export async function sweepExpired(): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("sweep_expired_reservations");
  if (error) {
    console.error("sweepExpired failed", error);
    return 0;
  }
  return (data as number) ?? 0;
}

// Everything that occupies the wall: sold (live or removed) + active reservations.
// Used to render the wall. Reserved blocks render as occupied-but-blank.
export async function getWallBlocks(): Promise<PublicBlock[]> {
  await sweepExpired();
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("blocks")
    .select(
      "id,squares,size,shape,image_url,cell_images,caption,link_url,state,status,reserved_until,original_image_url,owner_email,flagged,moderation,amount_cents,payment_provider,payment_ref,edit_token,created_at,paid_at"
    )
    .or("state.eq.sold,state.eq.reserved");
  if (error) throw error;
  return (data as BlockRow[]).map(rowToPublic);
}

// The set of taken cells for placement validity: sold + reserved + blocked.
export async function getOccupiedCells(): Promise<Cell[]> {
  await sweepExpired();
  const db = supabaseAdmin();
  const { data, error } = await db.from("occupied_squares").select("row,col");
  if (error) throw error;
  return data as Cell[];
}

// Atomic reservation via the Postgres function. Returns the created Block or
// throws on cell conflict (someone else grabbed an overlapping cell first).
export async function reserveBlock(params: {
  cells: Cell[];
  size: BlockSize;
  shape: BlockShape;
  amountCents: number;
  minutes: number;
}): Promise<{ ok: true; block: Block } | { ok: false; reason: "conflict" | "error" }> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("reserve_block", {
    p_cells: params.cells,
    p_size: params.size,
    p_shape: params.shape,
    p_amount: params.amountCents,
    p_minutes: params.minutes,
  });
  if (error) {
    // 23505 = unique_violation => a cell was already taken.
    if ((error as { code?: string }).code === "23505") return { ok: false, reason: "conflict" };
    console.error("reserveBlock failed", error);
    return { ok: false, reason: "error" };
  }
  return { ok: true, block: rowToBlock(data as BlockRow) };
}

export async function getBlock(id: string): Promise<Block | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("blocks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToBlock(data as BlockRow) : null;
}

export async function getBlockRaw(id: string): Promise<BlockRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("blocks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as BlockRow) ?? null;
}

export async function getBlockByPaymentRef(ref: string): Promise<BlockRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("blocks")
    .select("*")
    .eq("payment_ref", ref)
    .maybeSingle();
  if (error) throw error;
  return (data as BlockRow) ?? null;
}

// Attach the uploaded art to a still-reserved block (step 4).
export async function attachImage(
  id: string,
  fields: {
    imageUrl: string;
    originalImageUrl: string;
    flagged: boolean;
    moderation: unknown;
  }
): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("blocks")
    .update({
      image_url: fields.imageUrl,
      original_image_url: fields.originalImageUrl,
      flagged: fields.flagged,
      moderation: fields.moderation,
    })
    .eq("id", id)
    .eq("state", "reserved")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0; // false if the reservation no longer exists
}

// Attach caption / link / owner email (step 5).
export async function attachDetails(
  id: string,
  fields: { caption: string | null; linkUrl: string | null; ownerEmail: string }
): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("blocks")
    .update({
      caption: fields.caption,
      link_url: fields.linkUrl,
      owner_email: fields.ownerEmail,
    })
    .eq("id", id)
    .eq("state", "reserved")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Confirm payment (webhook / server capture only). Returns block or null if it
// could not be honored (expired & cells gone) — caller should refund.
export async function confirmPaid(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<Block | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("confirm_block_paid", {
    p_block_id: id,
    p_provider: provider,
    p_ref: ref,
  });
  if (error) throw error;
  return data ? rowToBlock(data as BlockRow) : null;
}

// Owner edit: replace one cell's image on a sold block. Keeps a representative
// thumbnail in image_url and accumulates flagged state for re-review.
export async function setBlockCellImage(
  blockId: string,
  cellIndex: number,
  url: string,
  total: number,
  cellFlagged: boolean
): Promise<boolean> {
  const block = await getBlockRaw(blockId);
  if (!block) return false;
  if (cellIndex < 0 || cellIndex >= total) return false;
  const arr: (string | null)[] = Array.isArray(block.cell_images)
    ? [...(block.cell_images as (string | null)[])]
    : [];
  while (arr.length < total) arr.push(null);
  arr[cellIndex] = url;
  const firstFilled = arr.find((u) => !!u) || url;
  const db = supabaseAdmin();
  const { error } = await db
    .from("blocks")
    .update({ cell_images: arr, image_url: firstFilled, flagged: block.flagged || cellFlagged })
    .eq("id", blockId);
  if (error) throw error;
  return true;
}

export async function setEditToken(id: string, token: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("blocks").update({ edit_token: token }).eq("id", id);
  if (error) throw error;
}

export async function countSold(): Promise<number> {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("state", "sold");
  if (error) throw error;
  return count ?? 0;
}
