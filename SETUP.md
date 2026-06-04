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

## 1. Supabase (database + image storage)  — required

1. Create a project at https://supabase.com (free tier is fine).
2. **Settings → API**: copy the **Project URL**, the **anon** key, and the
   **service_role** key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...     # server-only secret — never expose
   ```
3. **SQL Editor → New query**: run the migrations IN ORDER, one at a time:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_applications.sql`
   - `supabase/migrations/0003_cell_images.sql`
4. **Storage → New bucket**: name it `art`, mark it **Public**. (Matches
   `SUPABASE_STORAGE_BUCKET=art`.)

That alone makes the wall, funnel, admin, and edit pages run with real data.

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
