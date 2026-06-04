import { Resend } from "resend";
import { siteUrl } from "./config";

// All emails degrade to a no-op (logged) if RESEND_API_KEY is unset, so local
// dev and tests aren't blocked on email config.
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const FROM = process.env.EMAIL_FROM || "GoldenPixel <hello@goldenpixel.co>";

// Quiet, minimal email — same restraint as the site.
function shell(title: string, bodyHtml: string): string {
  return `
  <div style="background:#0a0a0b;color:#e8e6df;font-family:Georgia,serif;padding:40px 24px;">
    <div style="max-width:480px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
        <span style="display:inline-block;width:10px;height:10px;background:#d9b25b;"></span>
        <span style="font-size:18px;letter-spacing:-0.01em;">GoldenPixel</span>
      </div>
      <h1 style="font-weight:300;font-size:26px;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="color:#8a877e;font-size:12px;margin-top:40px;letter-spacing:0.04em;">goldenpixel.co</p>
    </div>
  </div>`;
}

function goldLink(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#d9b25b;color:#14110a;
    text-decoration:none;padding:12px 22px;font-family:Arial,sans-serif;font-size:13px;
    letter-spacing:0.12em;text-transform:uppercase;margin:8px 8px 8px 0;">${label}</a>`;
}

export async function sendConfirmationEmail(params: {
  to: string;
  liveUrl: string;
  editUrl: string;
}): Promise<void> {
  const html = shell(
    "Your square is live",
    `<p style="color:#8a877e;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
      Your art is on the wall. You can swap the image or change the link any time from your
      private edit page.</p>
     ${goldLink(params.liveUrl, "View the wall")}
     ${goldLink(params.editUrl, "Edit your square")}`
  );
  const client = resend();
  if (!client) {
    console.log(`[email:noop] confirmation -> ${params.to} | edit: ${params.editUrl}`);
    return;
  }
  await client.emails.send({ from: FROM, to: params.to, subject: "Your square is live", html });
}

export async function sendEditLinkEmail(params: { to: string; editUrl: string }): Promise<void> {
  const html = shell(
    "Edit your square",
    `<p style="color:#8a877e;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
      Here is your private link to manage your square.</p>
     ${goldLink(params.editUrl, "Edit your square")}`
  );
  const client = resend();
  if (!client) {
    console.log(`[email:noop] edit-link -> ${params.to} | ${params.editUrl}`);
    return;
  }
  await client.emails.send({ from: FROM, to: params.to, subject: "Edit your square", html });
}

export async function sendAdminMagicLink(params: { to: string; url: string }): Promise<void> {
  const html = shell(
    "Admin access",
    `<p style="color:#8a877e;font-family:Arial,sans-serif;font-size:14px;">
      Sign in to the GoldenPixel admin.</p>${goldLink(params.url, "Open admin")}`
  );
  const client = resend();
  if (!client) {
    console.log(`[email:noop] admin-link -> ${params.to} | ${params.url}`);
    return;
  }
  await client.emails.send({ from: FROM, to: params.to, subject: "GoldenPixel admin link", html });
}

export function editUrlFor(blockId: string, token: string): string {
  return `${siteUrl()}/edit?block=${blockId}&token=${encodeURIComponent(token)}`;
}

// ---- Eligibility funnel emails ----

export function applicationUrlFor(id: string, token: string): string {
  return `${siteUrl()}/a/${id}?token=${encodeURIComponent(token)}`;
}

async function sendShell(to: string, subject: string, title: string, body: string): Promise<void> {
  const client = resend();
  const html = shell(title, body);
  if (!client) {
    console.log(`[email:noop] ${subject} -> ${to}`);
    return;
  }
  await client.emails.send({ from: FROM, to, subject, html });
}

const intro = (t: string) =>
  `<p style="color:#8a877e;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${t}</p>`;

// Sent once payment is confirmed — the artist returns here to submit / track.
export async function sendApplicationLinkEmail(params: { to: string; url: string }): Promise<void> {
  await sendShell(
    params.to,
    "Your GoldenPixel application",
    "Application received",
    `${intro(
      "Payment confirmed. Use this private link any time to submit your work and track your review."
    )}${goldLink(params.url, "Open your application")}`
  );
}

export async function sendUnderReviewEmail(params: { to: string; url: string }): Promise<void> {
  await sendShell(
    params.to,
    "Your submission is under review",
    "Under review",
    `${intro(
      "Your work is with our team. We'll email you the moment a decision is made — usually within a few days."
    )}${goldLink(params.url, "Check status")}`
  );
}

export async function sendApprovedEmail(params: { to: string; url: string }): Promise<void> {
  await sendShell(
    params.to,
    "You're in — choose your square",
    "You're in",
    `${intro(
      "Your work was approved. Choose your square on the wall and publish — your spot is waiting."
    )}${goldLink(params.url, "Choose your square")}`
  );
}

export async function sendRejectedEmail(params: { to: string }): Promise<void> {
  await sendShell(
    params.to,
    "About your GoldenPixel submission",
    "Not this time",
    intro(
      "Thank you for applying. Your work wasn't selected for the wall this round, and your payment has been refunded in full. We'd welcome a future submission."
    )
  );
}
