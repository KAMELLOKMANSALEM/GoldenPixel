# GoldenPixel

A dark, gallery-at-night wall of $50 art squares — **curated, by application only**.
Artists apply, are reviewed, pay, submit their work for approval, and only then place
their 1/2/4/9-square block and publish. Clicking a square opens the artist's page.

Live at **goldenpixel.co**.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** — Postgres (blocks + occupancy) and Storage (image bucket)
- **Payments** — Square (hosted checkout) and PayPal (Orders v2). _No Stripe._
- **Resend** — confirmation + magic-link emails
- **OpenAI omni-moderation** — auto-flagging + CSAM-class hard-block
- **sharp** — EXIF strip, crop, web-optimize
- Built for **Replit** hosting

## How it works (the application funnel)

The wall is **curated** — by application only. There is no instant publishing.

1. **Survey** — a long, one-question-at-a-time application (`/apply`). Collects who you
   are, your portfolio, a statement, and your **size + shape** (1 $50 / 2 $100 / 4 $200 /
   9 $450; size 2 toggles tall/wide). Creates an `applications` row (`POST /api/apply/start`).
2. **Eligibility check** — a theatrical "reviewing your application" screen. Everyone passes;
   the real gate is the admin review of the artwork.
3. **Payment** — Square or PayPal for the chosen size. **Amount is computed server-side.**
   An application flips to `paid` **only** via Square's webhook or PayPal's server-side
   capture — never the browser. A magic-link email is sent.
4. **Submission** — upload the artwork (cropped to the chosen shape) + caption + link
   (`POST /api/apply/submit`). Runs through moderation; hard-blocks never enter the queue.
   Status → `submitted`.
5. **Review** — the admin approves or rejects in `/admin`. **Reject auto-refunds** the
   payment (Square/PayPal). Approve → `approved`, and the artist is emailed to return.
6. **Choose your square** — the approved artist returns via the magic link (`/a/[id]`),
   places their block (ghost preview + validity), and publishes (`POST /api/place`).
7. **Live + edit** — the block goes live, the counter increments, and a confirmation email
   links to a private magic-link edit page (`/edit`).

### Race safety

The guard is the `occupied_squares` table with `PRIMARY KEY (row, col)`. Placement runs
inside the `place_block()` Postgres function: it inserts one row per cell, so a second
approved artist racing for the same cell hits a unique-violation and the whole placement
aborts (the client gets a clean "pick another spot"). Payment confirmation flips the
application to `paid` idempotently for webhook retries.

## Setup

### 1. Database

In the Supabase SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

### 2. Storage bucket

Create a **public** Storage bucket named `art` (or set `SUPABASE_STORAGE_BUCKET`).
Public read is required so the wall can display the art.

### 3. Environment

Copy `.env.example` to `.env.local` (or set in Replit Secrets) and fill in:

- Supabase URL + anon key + **service role key** (server-only)
- Square access token, location id, environment, webhook signature key
- PayPal client id/secret + the `NEXT_PUBLIC_PAYPAL_*` values for the buttons
- Resend API key + `EMAIL_FROM`
- `OPENAI_API_KEY` (optional — moderation is skipped/passes if unset)
- `TOKEN_SECRET`, `ADMIN_EMAILS`, `CLEANUP_SECRET`

### 4. Webhooks

- **Square**: subscribe to `payment.updated`, point it at
  `https://goldenpixel.co/api/webhooks/square`, and put the signing key in
  `SQUARE_WEBHOOK_SIGNATURE_KEY`. The notification URL must match exactly.
- **PayPal**: no webhook required — capture is confirmed server-side in
  `/api/checkout/paypal/capture`.

> The funnel has no reservation timer (placement happens after payment + approval), so
> there is no cleanup cron to schedule.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

The wall renders even without Supabase configured (empty wall). To test the full
funnel without live payment credentials, set `NEXT_PUBLIC_DEV_PAY=1` — a
"Simulate payment (dev)" button appears at the payment step and confirms via
`/api/dev/confirm` (disabled in production). Without `RESEND_API_KEY`, the magic
links are logged to the server console instead of emailed.

## Admin

`/admin` is protected by an email magic link (HMAC session cookie). Add your
address to `ADMIN_EMAILS`, go to `/admin/login`, and follow the emailed link. It has
two sections:

- **Applications** — the review queue. Flagged + awaiting-review sort to the top.
  **Approve** (artist may place + publish) or **Reject + refund** (auto-refunds the payment).
- **Live wall** — moderation of published squares:
  - **Remove** — art comes down, the square stays sold/owned, no money moves. (Default.)
  - **Refund + release** — refunds the payment and frees the cells back to `available`.
- Every action is logged to `admin_actions`.

## Design

Near-black `#0a0a0b`, off-white `#e8e6df`, muted `#8a877e`, and a single gold
accent `#d9b25b` used **only** for the claimed counter, the hover highlight, and
the primary button. No gradients (except the caption scrim), no shadows, no
glows. Fraunces display serif for the wordmark; Inter for UI. The art is the
color; the chrome recedes.
