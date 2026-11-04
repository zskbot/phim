# Telegram Video Importer — Preview/Staging only

The importer accepts Telegram Bot API updates from groups explicitly configured in `TELEGRAM_SOURCE_RIGHTS_JSON`. Public visibility of a group is not a distribution license. A source is eligible only when its configuration contains a rights holder, license reference, future expiry date, and `adultContentCompliant: true`.

## Data flow

Telegram Bot webhook → secret-header verification → configured chat-ID and license gate → Telegram Bot API file download → private Supabase Storage bucket → `video_catalog` record → short-lived signed URL in the published video feed.

The importer does not scrape Telegram, join groups, bypass access controls, or fetch messages outside updates delivered to a bot that has been added to the group. The bot must be added to each source group and have permission to receive the relevant messages.

## Current limits

- Telegram Bot API cloud file downloads are limited to 20 MB. Larger files are rejected; do not work around this with unauthorized scraping. A separately operated Local Bot API Server or authorized MTProto worker can be evaluated later.
- Webhook processing runs synchronously in a Node.js Vercel Function (maximum duration configured to 60 seconds). Large/slow uploads may be retried by Telegram.
- The importer accepts video MIME types only. It does not transcode HLS yet; browser playback depends on the uploaded media format being supported by the browser.
- Published feed URLs are signed for one hour and generated server-side. Do not expose the bot token or Supabase service-role key to the browser.

## Preview configuration

Configure these variables in the **Preview environment only** for the TX.TOP Preview project, using a dedicated staging Supabase project:

- `TELEGRAM_BOT_TOKEN`: bot token, secret.
- `TELEGRAM_WEBHOOK_SECRET`: random secret (1–256 chars; Telegram webhook secret-token charset: A–Z, a–z, 0–9, underscore, hyphen).
- `TELEGRAM_SOURCE_RIGHTS_JSON`: JSON object keyed by Telegram numeric chat ID, for example:
  ```json
  {
    "-1001234567890": {
      "rightsHolder": "Rights holder legal name",
      "licenseReference": "Signed license or consent record reference",
      "licenseExpiresAt": "2030-12-31T23:59:59Z",
      "category": "Telegram",
      "adultContentCompliant": true
    }
  }
  ```
  Only add groups for which the operator has documented distribution rights and adult-content compliance.
- `TELEGRAM_STORAGE_BUCKET`: optional; defaults to `tx-top-videos`.
- Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: staging-only values.

Apply `supabase/migrations/202611040001_telegram_video_importer.sql` to the staging Supabase database. Do not point Preview variables at production data.

## Configure Telegram webhook

After Preview is deployed and the environment variables are set, register the exact Preview endpoint with Telegram `setWebhook`, passing the same secret as `secret_token`. The webhook URL is `https://<verified-preview-host>/api/telegram/webhook`; do not guess or use a Production domain. Subscribe to `message` and `channel_post` updates. Add the bot to each configured public group and verify it can receive video posts.

## Automatic publication rules

A video is automatically published only if its source chat ID has an explicit rights entry, the license has not expired, and adult-content compliance is explicitly true. Unknown groups, expired/missing licenses, and unconfigured sources are skipped. Duplicate Telegram file IDs are rejected by a unique index. A source configuration is an operator attestation; retain the underlying license/consent evidence and honor takedown requests.

## Rollback

Remove the webhook using Telegram `deleteWebhook` and remove Preview-only Telegram variables. Do not delete storage objects or catalog rows automatically; retain them for audit/takedown handling. No Production deployment or Vercel project changes are part of this PR.
