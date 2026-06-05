// Server-side data access for the eligibility funnel, on Replit PostgreSQL.
import { db, norm } from "./db";
import { randomToken, safeEqual } from "./tokens";
import type { BlockSize, BlockShape } from "./config";
import type { Cell } from "./types";

export type ApplicationStatus =
  | "eligible"
  | "paid"
  | "submitted"
  | "approved"
  | "rejected"
  | "refunded"
  | "published";

export type ApplicationRow = {
  id: string;
  email: string | null;
  survey: Record<string, unknown>;
  size: BlockSize;
  shape: BlockShape;
  amount_cents: number;
  status: ApplicationStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  paid_at: string | null;
  image_url: string | null;
  original_image_url: string | null;
  cell_images: (string | null)[] | null;
  caption: string | null;
  link_url: string | null;
  flagged: boolean;
  moderation: unknown;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  refunded_at: string | null;
  block_id: string | null;
  access_token: string | null;
  created_at: string;
  updated_at: string;
};

export async function createApplication(params: {
  email: string | null;
  survey: Record<string, unknown>;
  size: BlockSize;
  shape: BlockShape;
  amountCents: number;
}): Promise<{ id: string; token: string }> {
  const sql = db();
  const token = randomToken();
  const rows = await sql`
    insert into applications (email, survey, size, shape, amount_cents, status, access_token)
    values (${params.email}, ${sql.json(params.survey as never)}, ${params.size}::smallint,
            ${params.shape}, ${params.amountCents}::int, 'eligible', ${token})
    returning id`;
  return { id: rows[0].id as string, token };
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const sql = db();
  const rows = await sql`select * from applications where id = ${id}::uuid`;
  return norm<ApplicationRow>(rows)[0] ?? null;
}

export async function getApplicationByPaymentRef(ref: string): Promise<ApplicationRow | null> {
  const sql = db();
  const rows = await sql`select * from applications where payment_ref = ${ref}`;
  return norm<ApplicationRow>(rows)[0] ?? null;
}

export async function verifyAccess(id: string, token: string): Promise<ApplicationRow | null> {
  const app = await getApplication(id);
  if (!app || !app.access_token || !safeEqual(token, app.access_token)) return null;
  return app;
}

export async function setPaymentRef(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<void> {
  const sql = db();
  await sql`update applications set payment_provider = ${provider}, payment_ref = ${ref}, updated_at = now() where id = ${id}::uuid`;
}

export async function confirmApplicationPaid(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<{ firstTime: boolean }> {
  const sql = db();
  const rows = await sql`
    update applications set
      status = 'paid', payment_provider = ${provider}, payment_ref = ${ref},
      paid_at = now(), updated_at = now()
    where id = ${id}::uuid and status = 'eligible'
    returning id`;
  return { firstTime: rows.length > 0 };
}

export async function attachSubmission(
  id: string,
  fields: {
    imageUrl: string;
    originalImageUrl: string;
    caption: string | null;
    linkUrl: string | null;
    email: string;
    flagged: boolean;
    moderation: unknown;
  }
): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update applications set
      image_url = ${fields.imageUrl}, original_image_url = ${fields.originalImageUrl},
      caption = ${fields.caption}, link_url = ${fields.linkUrl}, email = ${fields.email},
      flagged = ${fields.flagged}, moderation = ${sql.json(fields.moderation as never)},
      status = 'submitted', updated_at = now()
    where id = ${id}::uuid and status in ('paid','submitted')
    returning id`;
  return rows.length > 0;
}

// Per-cell upload ("simulation module"): store one cell's image into the array.
export async function setCellImage(
  id: string,
  cellIndex: number,
  url: string,
  total: number,
  cellFlagged: boolean
): Promise<boolean> {
  const app = await getApplication(id);
  if (!app || (app.status !== "paid" && app.status !== "submitted")) return false;
  if (cellIndex < 0 || cellIndex >= total) return false;
  const arr: (string | null)[] = Array.isArray(app.cell_images)
    ? [...(app.cell_images as (string | null)[])]
    : [];
  while (arr.length < total) arr.push(null);
  arr[cellIndex] = url;
  const firstFilled = arr.find((u) => !!u) || url;
  const sql = db();
  await sql`
    update applications set
      cell_images = ${sql.json(arr as never)},
      image_url = ${firstFilled},
      flagged = ${app.flagged || cellFlagged},
      updated_at = now()
    where id = ${id}::uuid`;
  return true;
}

export async function finalizeSubmission(
  id: string,
  fields: { caption: string | null; linkUrl: string; email: string },
  totalCells: number
): Promise<{ ok: boolean; reason?: "not-ready" | "incomplete" }> {
  const app = await getApplication(id);
  if (!app || (app.status !== "paid" && app.status !== "submitted")) {
    return { ok: false, reason: "not-ready" };
  }
  const arr = Array.isArray(app.cell_images) ? (app.cell_images as (string | null)[]) : [];
  if (arr.filter((u) => !!u).length < totalCells) return { ok: false, reason: "incomplete" };
  const sql = db();
  await sql`
    update applications set
      caption = ${fields.caption}, link_url = ${fields.linkUrl}, email = ${fields.email},
      status = 'submitted', updated_at = now()
    where id = ${id}::uuid`;
  return { ok: true };
}

export async function approveApplication(id: string, adminEmail: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update applications set
      status = 'approved', reviewed_by = ${adminEmail}, reviewed_at = now(), updated_at = now()
    where id = ${id}::uuid and status = 'submitted'
    returning id`;
  return rows.length > 0;
}

export async function markRejected(
  id: string,
  adminEmail: string,
  notes: string | null
): Promise<void> {
  const sql = db();
  await sql`
    update applications set
      status = 'rejected', review_notes = ${notes}, reviewed_by = ${adminEmail},
      reviewed_at = now(), refunded_at = now(), updated_at = now()
    where id = ${id}::uuid`;
}

export async function placeApplication(
  id: string,
  cells: Cell[]
): Promise<{ ok: true; blockId: string } | { ok: false; reason: "conflict" | "state" }> {
  const sql = db();
  try {
    const rows = await sql`select * from place_block(${id}::uuid, ${JSON.stringify(cells)}::jsonb)`;
    const block = norm<{ id: string }>(rows)[0];
    if (!block?.id) return { ok: false, reason: "state" };
    return { ok: true, blockId: block.id };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, reason: "conflict" };
    throw e;
  }
}

export async function listApplications(): Promise<ApplicationRow[]> {
  const sql = db();
  const rows = await sql`
    select * from applications
    where status in ('submitted','approved','rejected','published','refunded','paid')
    order by flagged desc, created_at desc`;
  return norm<ApplicationRow>(rows);
}
