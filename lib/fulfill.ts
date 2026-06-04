import { confirmPaid, getBlockRaw, setEditToken } from "./blocks";
import { randomToken } from "./tokens";
import { sendConfirmationEmail, editUrlFor, applicationUrlFor, sendApplicationLinkEmail } from "./email";
import { siteUrl } from "./config";
import { confirmApplicationPaid, getApplication } from "./applications";

// Single fulfillment path for BOTH providers. Only ever called from trusted
// server contexts (Square webhook / PayPal server-side capture / dev confirm).
// Idempotent: safe to call twice for the same block (webhook retries).
export async function fulfillPaid(
  blockId: string,
  provider: "square" | "paypal",
  ref: string
): Promise<{ ok: boolean; honored: boolean }> {
  // confirm_block_paid flips reserved -> sold (or returns the already-sold block).
  const block = await confirmPaid(blockId, provider, ref);
  if (!block) {
    // Reservation could no longer be honored (expired & cells gone). Caller refunds.
    return { ok: true, honored: false };
  }

  // Set an edit token + send the confirmation email exactly once.
  const raw = await getBlockRaw(blockId);
  if (raw && !raw.edit_token && raw.owner_email) {
    const token = randomToken();
    await setEditToken(blockId, token);
    await sendConfirmationEmail({
      to: raw.owner_email,
      liveUrl: `${siteUrl()}/?b=${blockId}`,
      editUrl: editUrlFor(blockId, token),
    });
  }

  return { ok: true, honored: true };
}

// Funnel payment confirmation. Flips an application eligible -> paid (idempotent)
// and emails the artist their private link to submit + track. Only ever called
// from trusted server contexts (Square webhook / PayPal capture / dev confirm).
export async function fulfillApplicationPaid(
  applicationId: string,
  provider: "square" | "paypal",
  ref: string
): Promise<{ ok: boolean }> {
  const { firstTime } = await confirmApplicationPaid(applicationId, provider, ref);
  if (firstTime) {
    const app = await getApplication(applicationId);
    if (app?.email && app.access_token) {
      await sendApplicationLinkEmail({
        to: app.email,
        url: applicationUrlFor(app.id, app.access_token),
      });
    }
  }
  return { ok: true };
}
