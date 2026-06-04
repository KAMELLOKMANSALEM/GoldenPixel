import { supabaseAdmin } from "./supabase/admin";
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

// All sold blocks for the moderation queue. Flagged sorted to the top, newest first.
export async function getAdminBlocks(): Promise<AdminBlock[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("blocks")
    .select(
      "id,image_url,cell_images,caption,link_url,owner_email,shape,size,flagged,moderation,status,amount_cents,payment_provider,created_at,paid_at"
    )
    .eq("state", "sold")
    .order("flagged", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    imageUrl: r.image_url as string | null,
    cellImages: (r.cell_images as (string | null)[] | null) ?? null,
    caption: r.caption as string | null,
    linkUrl: r.link_url as string | null,
    ownerEmail: r.owner_email as string | null,
    shape: r.shape as string,
    size: r.size as number,
    flagged: r.flagged as boolean,
    moderation: r.moderation,
    status: r.status as "live" | "removed",
    amountCents: r.amount_cents as number,
    provider: r.payment_provider as string | null,
    createdAt: r.created_at as string,
    paidAt: r.paid_at as string | null,
  }));
}

async function logAction(
  blockId: string | null,
  action: string,
  adminEmail: string,
  detail: unknown
): Promise<void> {
  const db = supabaseAdmin();
  await db.from("admin_actions").insert({
    block_id: blockId,
    action,
    admin_email: adminEmail,
    detail: detail ?? {},
  });
}

// Default action — art comes down, the square stays sold/owned, no money moves.
export async function removeBlock(blockId: string, adminEmail: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("blocks").update({ status: "removed" }).eq("id", blockId);
  if (error) throw error;
  await logAction(blockId, "remove", adminEmail, { at: "removed" });
}

// ---- Funnel review (applications) ----

// Approve a submission so the artist can place + publish. Emails their link.
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

// Reject a submission: refund the payment (Square/PayPal) and email the artist.
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
  // Log before releasing so the block_id is captured in the audit row.
  await logAction(blockId, "refund_release", adminEmail, {
    provider: block.payment_provider,
    amountCents: block.amount_cents,
  });
  await releaseBlock(blockId);
}
