// Server-side data access for blocks + occupancy, on Replit PostgreSQL.
import { db, norm } from "./db";
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

export async function sweepExpired(): Promise<number> {
  try {
    const sql = db();
    const [r] = await sql`select sweep_expired_reservations() as n`;
    return (r?.n as number) ?? 0;
  } catch (e) {
    console.error("sweepExpired failed", e);
    return 0;
  }
}

export async function getWallBlocks(): Promise<PublicBlock[]> {
  await sweepExpired();
  const sql = db();
  const rows = await sql`select * from blocks where state in ('sold','reserved')`;
  return norm<BlockRow>(rows).map(rowToPublic);
}

export async function getOccupiedCells(): Promise<Cell[]> {
  await sweepExpired();
  const sql = db();
  const rows = await sql`select row, col from occupied_squares`;
  return rows.map((r) => ({ row: r.row as number, col: r.col as number }));
}

export async function reserveBlock(params: {
  cells: Cell[];
  size: BlockSize;
  shape: BlockShape;
  amountCents: number;
  minutes: number;
}): Promise<{ ok: true; block: Block } | { ok: false; reason: "conflict" | "error" }> {
  const sql = db();
  try {
    const rows = await sql`
      select * from reserve_block(
        ${JSON.stringify(params.cells)}::jsonb,
        ${params.size}::smallint,
        ${params.shape},
        ${params.amountCents}::int,
        ${params.minutes}::int
      )`;
    const block = norm<BlockRow>(rows)[0];
    if (!block?.id) return { ok: false, reason: "error" };
    return { ok: true, block: rowToBlock(block) };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, reason: "conflict" };
    console.error("reserveBlock failed", e);
    return { ok: false, reason: "error" };
  }
}

export async function getBlock(id: string): Promise<Block | null> {
  const sql = db();
  const rows = await sql`select * from blocks where id = ${id}::uuid`;
  const r = norm<BlockRow>(rows)[0];
  return r ? rowToBlock(r) : null;
}

export async function getBlockRaw(id: string): Promise<BlockRow | null> {
  const sql = db();
  const rows = await sql`select * from blocks where id = ${id}::uuid`;
  return norm<BlockRow>(rows)[0] ?? null;
}

export async function getBlockByPaymentRef(ref: string): Promise<BlockRow | null> {
  const sql = db();
  const rows = await sql`select * from blocks where payment_ref = ${ref}`;
  return norm<BlockRow>(rows)[0] ?? null;
}

export async function attachImage(
  id: string,
  fields: { imageUrl: string; originalImageUrl: string; flagged: boolean; moderation: unknown }
): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update blocks set
      image_url = ${fields.imageUrl},
      original_image_url = ${fields.originalImageUrl},
      flagged = ${fields.flagged},
      moderation = ${sql.json(fields.moderation as never)}
    where id = ${id}::uuid and state = 'reserved'
    returning id`;
  return rows.length > 0;
}

export async function attachDetails(
  id: string,
  fields: { caption: string | null; linkUrl: string | null; ownerEmail: string }
): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update blocks set
      caption = ${fields.caption},
      link_url = ${fields.linkUrl},
      owner_email = ${fields.ownerEmail}
    where id = ${id}::uuid and state = 'reserved'
    returning id`;
  return rows.length > 0;
}

export async function confirmPaid(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<Block | null> {
  const sql = db();
  const rows = await sql`select * from confirm_block_paid(${id}::uuid, ${provider}, ${ref})`;
  const r = norm<BlockRow>(rows)[0];
  return r?.id ? rowToBlock(r) : null;
}

// Owner swaps one cell's image on a sold block (per-cell edit grid).
export async function setBlockCellImage(
  blockId: string,
  cellIndex: number,
  url: string,
  total: number,
  cellFlagged: boolean
): Promise<boolean> {
  const block = await getBlockRaw(blockId);
  if (!block || block.state !== "sold") return false;
  if (cellIndex < 0 || cellIndex >= total) return false;
  const arr: (string | null)[] = Array.isArray(block.cell_images)
    ? [...(block.cell_images as (string | null)[])]
    : [];
  while (arr.length < total) arr.push(null);
  arr[cellIndex] = url;
  const firstFilled = arr.find((u) => !!u) || url;
  const sql = db();
  await sql`
    update blocks set
      cell_images = ${sql.json(arr as never)},
      image_url = ${firstFilled},
      flagged = ${block.flagged || cellFlagged}
    where id = ${blockId}::uuid`;
  return true;
}

export async function setEditToken(id: string, token: string): Promise<void> {
  const sql = db();
  await sql`update blocks set edit_token = ${token} where id = ${id}::uuid`;
}

export async function countSold(): Promise<number> {
  const sql = db();
  const [r] = await sql`select count(*)::int as count from blocks where state = 'sold'`;
  return (r?.count as number) ?? 0;
}
