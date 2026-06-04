// Server-side data access for the eligibility funnel. Service-role only.
import { supabaseAdmin } from "./supabase/admin";
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
  cell_images: (string | null)[] | null; // one image per cell, row-major
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
  const db = supabaseAdmin();
  const token = randomToken();
  const { data, error } = await db
    .from("applications")
    .insert({
      email: params.email,
      survey: params.survey,
      size: params.size,
      shape: params.shape,
      amount_cents: params.amountCents,
      status: "eligible",
      access_token: token,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, token };
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ApplicationRow) ?? null;
}

export async function getApplicationByPaymentRef(ref: string): Promise<ApplicationRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("applications")
    .select("*")
    .eq("payment_ref", ref)
    .maybeSingle();
  if (error) throw error;
  return (data as ApplicationRow) ?? null;
}

export async function verifyAccess(id: string, token: string): Promise<ApplicationRow | null> {
  const app = await getApplication(id);
  if (!app || !app.access_token || !safeEqual(token, app.access_token)) return null;
  return app;
}

// Record the chosen payment provider/order ref before redirecting to checkout,
// so the webhook can map the payment back to the application.
export async function setPaymentRef(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("applications")
    .update({ payment_provider: provider, payment_ref: ref, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Flip eligible -> paid exactly once (idempotent for webhook retries).
export async function confirmApplicationPaid(
  id: string,
  provider: "square" | "paypal",
  ref: string
): Promise<{ firstTime: boolean }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("applications")
    .update({
      status: "paid",
      payment_provider: provider,
      payment_ref: ref,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "eligible")
    .select("id");
  if (error) throw error;
  return { firstTime: (data?.length ?? 0) > 0 };
}

// Attach the submitted artwork. Allowed while paid or re-submitting before review.
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
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("applications")
    .update({
      image_url: fields.imageUrl,
      original_image_url: fields.originalImageUrl,
      caption: fields.caption,
      link_url: fields.linkUrl,
      email: fields.email,
      flagged: fields.flagged,
      moderation: fields.moderation,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["paid", "submitted"])
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Per-cell upload ("simulation module"): store one cell's image into the array.
// Keeps a representative thumbnail in image_url and accumulates the flagged state.
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
  const db = supabaseAdmin();
  const { error } = await db
    .from("applications")
    .update({
      cell_images: arr,
      image_url: firstFilled,
      flagged: app.flagged || cellFlagged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return true;
}

// Finalize the submission once every cell has an image: set caption/link/email
// and move to `submitted`. Returns a reason when it can't proceed.
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
  const filled = arr.filter((u) => !!u).length;
  if (filled < totalCells) return { ok: false, reason: "incomplete" };
  const db = supabaseAdmin();
  const { error } = await db
    .from("applications")
    .update({
      caption: fields.caption,
      link_url: fields.linkUrl,
      email: fields.email,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function approveApplication(id: string, adminEmail: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("applications")
    .update({
      status: "approved",
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "submitted")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function markRejected(
  id: string,
  adminEmail: string,
  notes: string | null
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("applications")
    .update({
      status: "rejected",
      review_notes: notes,
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// Place an approved application onto the wall. Returns:
//   { ok:true } on publish, { ok:false, reason:'conflict' } if a cell was taken,
//   { ok:false, reason:'state' } if not placeable.
export async function placeApplication(
  id: string,
  cells: Cell[]
): Promise<{ ok: true; blockId: string } | { ok: false; reason: "conflict" | "state" }> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("place_block", {
    p_application_id: id,
    p_cells: cells,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, reason: "conflict" };
    throw error;
  }
  if (!data) return { ok: false, reason: "state" };
  return { ok: true, blockId: (data as { id: string }).id };
}

// Admin review queue: everything awaiting/decided, flagged + newest first.
export async function listApplications(): Promise<ApplicationRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("applications")
    .select("*")
    .in("status", ["submitted", "approved", "rejected", "published", "refunded", "paid"])
    .order("flagged", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ApplicationRow[]) ?? [];
}
