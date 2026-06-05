# GoldenPixel — setup & go-live

Do these once. Copy `.env.example` → `.env.local` and fill values as you go.
The app degrades gracefully when a key is missing (empty/dummy wall, email becomes
a console no-op, moderation passes), so you can wire things up incrementally.

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

To exercise the whole funnel WITHOUT real payments, set in `.env.local`:
```
NEXT_PUBLIC_DEV_PAY=1
```
This shows a "Simulate payment" path that calls the same server-side fulfillment
the real webhook/capture uses (no money moves).

---

## 1. Database + image storage (Replit-native)  — required

Everything lives inside your Repl — no external account.

1. **Add a database:** in Replit, open **Tools → Database** (or "Add a database")
   → **PostgreSQL**. Replit creates it and injects `DATABASE_URL` automatically.
2. **Add object storage:** **Tools → Object Storage** → create the default bucket.
   This is where uploaded artwork is stored (served via `/api/img/...`).
3. **Run the migrations** once, from the Replit **Shell**:
   ```bash
   npm run migrate
   ```
   This applies `supabase/migrations/0001…0003` (tables + the SQL functions) to
   your Replit database. (The folder is named `supabase/` for history; the SQL is
   plain PostgreSQL and runs anywhere.)

That alone makes the wall, funnel, admin, and edit pages run with real data —
no keys to copy, no external dashboard.

## 2. Square (card / Apple Pay / Google Pay)  — required for live payment

1. https://developer.squareup.com/apps → create an app.
2. Use the **Sandbox** credentials first:
   ```
   SQUARE_ACCESS_TOKEN=...           # Sandbox access token
   SQUARE_LOCATION_ID=...            # Sandbox location id
   SQUARE_ENVIRONMENT=sandbox
   ```
3. **Webhooks** → add a subscription to event `payment.updated`, URL:
   `https://YOUR_DOMAIN/api/webhooks/square` → copy the **Signature key**:
   ```
   SQUARE_WEBHOOK_SIGNATURE_KEY=...
   ```
   (For local webhook testing, expose localhost with a tunnel, e.g. `ngrok http 3000`,
   and use that URL as both `NEXT_PUBLIC_SITE_URL` and the webhook URL.)

## 3. PayPal  — required for the PayPal button

1. https://developer.paypal.com/dashboard/applications → create an app (Sandbox).
   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_ENVIRONMENT=sandbox
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=...      # same client id, exposed to the button
   NEXT_PUBLIC_PAYPAL_ENVIRONMENT=sandbox
   ```
   PayPal is confirmed by a server-side capture (no webhook needed).

## 4. Resend (emails)  — recommended

```
RESEND_API_KEY=...
EMAIL_FROM="GoldenPixel <hello@goldenpixel.co>"
```
Verify your domain in Resend so mail from `@goldenpixel.co` isn't spam-filtered.
Without a key, emails are logged to the server console instead of sent.

## 5. OpenAI moderation  — recommended

```
OPENAI_API_KEY=...
```
Auto-flags borderline uploads into the admin queue and hard-blocks CSAM-class
images. Without a key, moderation passes everything (fine for local dev).

## 6. Admin + secrets

```
TOKEN_SECRET=<long random string>           # signs admin/magic-link tokens
ADMIN_EMAILS=kamellokman.s@gmail.com         # who can reach /admin
CLEANUP_SECRET=<long random string>          # auth for the cleanup endpoint
NEXT_PUBLIC_SITE_URL=https://goldenpixel.co  # used in emails/redirects/webhooks
```
Admin sign-in is a magic link: go to `/admin/login`, enter an `ADMIN_EMAILS`
address, open the emailed link (or the console log if Resend is unset).

---

## Deploy (Replit)

- The repo includes `.replit` (build = `npm run build`, run = `npm run start`).
- Add every variable above to the Replit **Secrets** panel (not a committed file).
- Set `NEXT_PUBLIC_SITE_URL` to the deployed URL and point the Square webhook there.
- Go-live is webhook/capture driven: only server-side confirmation flips an
  application to `paid` — never the browser.

## End-to-end smoke test

1. `/apply` → survey (pick a size) → eligibility → pay (sandbox, or Simulate in dev).
2. Magic link → submission "simulation module": upload an image per square → submit.
3. `/admin` → approve (or reject → auto-refund).
4. Approved magic link → choose a square on the wall → publish.
5. Home wall shows the assembled mosaic; click it → enlarge → "About the work".
