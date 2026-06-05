import { db, norm } from "./db";
import { getBlockRaw } from "./blocks";
import { releaseBlock } from "./release";
import { refundSquarePayment } from "./payments/square";
import { refundPaypalCapture } from "./payments/paypal";
import { getApplication, approveApplication, markRejected } from "./applications";
import { sendApprovedEmail, sendRejectedEmail, applicationUrlFor } from "./email";

export type AdminBlock = {
  id: string;
  imageUrl: string | null;
  cellImages: (string | null)[] | null;
  caption: string | null;
  linkUrl: string | null;
  ownerEmail: string | null;
  shape: string;
  size: number;
  flagged: boolean;
  moderation: unknown;
  status: "live" | "removed";
  amountCents: number;
  provider: string | null;
  createdAt: string;
  paidAt: string | null;
};

type AdminBlockRow = {
  id: string;
  image_url: string | null;
  cell_images: (string | null)[] | null;
  caption: string | null;
  link_url: string | null;
  owner_email: string | null;
  shape: string;
  size: number;
  flagged: boolean;
  moderation: unknown;
  status: "live" | "removed";
  amount_cents: number;
  payment_provider: string | null;
  created_at: string;
  paid_at: string | null;
};

// All sold blocks for the moderation queue. Flagged sorted to the top, newest first.
export async function getAdminBlocks(): Promise<AdminBlock[]> {
  const sql = db();
  const rows = await sql`
    select id, image_url, cell_images, caption, link_url, owner_email, shape, size,
           flagged, moderation, status, amount_cents, payment_provider, created_at, paid_at
    from blocks
    where state = 'sold'
    order by flagged desc, created_at desc`;
  return norm<AdminBlockRow>(rows).map((r) => ({
    id: r.id,
    imageUrl: r.image_url,
    cellImages: r.cell_images ?? null,
    caption: r.caption,
    linkUrl: r.link_url,
    ownerEmail: r.owner_email,
    shape: r.shape,
    size: r.size,
    flagged: r.flagged,
    moderation: r.moderation,
    status: r.status,
    amountCents: r.amount_cents,
    provider: r.payment_provider,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));
}

async function logAction(
  blockId: string | null,
  action: string,
  adminEmail: string,
  detail: unknown
): Promise<void> {
  const sql = db();
  await sql`
    insert into admin_actions (block_id, action, admin_email, detail)
    values (${blockId}::uuid, ${action}, ${adminEmail}, ${sql.json((detail ?? {}) as never)})`;
}

// Default action — art comes down, the square stays sold/owned, no money moves.
export async function removeBlock(blockId: string, adminEmail: string): Promise<void> {
  const sql = db();
  await sql`update blocks set status = 'removed' where id = ${blockId}::uuid`;
  await logAction(blockId, "remove", adminEmail, { at: "removed" });
}

// ---- Funnel review (applications) ----

export async function approveSubmission(applicationId: string, adminEmail: string): Promise<boolean> {
  const ok = await approveApplication(applicationId, adminEmail);
  if (!ok) return false;
  await logAction(null, "approve_application", adminEmail, { applicationId });
  const app = await getApplication(applicationId);
  if (app?.email && app.access_token) {
    await sendApprovedEmail({ to: app.email, url: applicationUrlFor(app.id, app.access_token) });
  }
  return true;
}

export async function rejectSubmission(
  applicationId: string,
  adminEmail: string,
  notes: string | null
): Promise<void> {
  const app = await getApplication(applicationId);
  if (!app) throw new Error("application not found");

  if (app.payment_ref && app.payment_provider && app.paid_at) {
    if (app.payment_provider === "square") {
      await refundSquarePayment(app.payment_ref, app.amount_cents);
    } else if (app.payment_provider === "paypal") {
      await refundPaypalCapture(app.payment_ref, app.amount_cents);
    }
  }
  await markRejected(applicationId, adminEmail, notes);
  await logAction(null, "reject_application", adminEmail, {
    applicationId,
    provider: app.payment_provider,
    amountCents: app.amount_cents,
  });
  if (app.email) await sendRejectedEmail({ to: app.email });
}

// Heavier action — refund the payment AND free the cells back to available.
export async function refundAndRelease(blockId: string, adminEmail: string): Promise<void> {
  const block = await getBlockRaw(blockId);
  if (!block) throw new Error("block not found");

  if (block.payment_ref && block.payment_provider) {
    if (block.payment_provider === "square") {
      await refundSquarePayment(block.payment_ref, block.amount_cents);
    } else if (block.payment_provider === "paypal") {
      await refundPaypalCapture(block.payment_ref, block.amount_cents);
    }
  }
  await logAction(blockId, "refund_release", adminEmail, {
    provider: block.payment_provider,
    amountCents: block.amount_cents,
  });
  await releaseBlock(blockId);
}
