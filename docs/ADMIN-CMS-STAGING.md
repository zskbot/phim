# TX.TOP Admin CMS — staging

This feature is intentionally isolated behind a server-side admin token and a Supabase service-role key. It is not enabled until staging credentials and the SQL migration are configured.

## Data flow

Admin page → authenticated Next.js route handlers → Supabase REST API → `video_catalog`.

The browser never receives the Supabase service-role key. The admin token is held only in page memory and sent as a Bearer token. Do not put either secret in `NEXT_PUBLIC_*`, source code, commits, screenshots, or chat messages.

## Staging setup

1. Create or select a **separate staging** Supabase project. Do not point this preview at production data.
2. Run `supabase/migrations/202610310001_video_catalog.sql` in the staging SQL editor.
3. In Netlify → site `txtop` → Site configuration → Environment variables, add:
   - `ADMIN_CMS_TOKEN`: a long random secret (32+ random bytes).
   - `SUPABASE_URL`: staging project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: staging service-role key.
4. Scope variables to Deploy Previews only where Netlify supports deploy-context scoping. Trigger a new deploy preview.
5. Open `/admin`, enter the admin token, then load the catalog.

Do not paste secrets into GitHub or this conversation.

## Content workflow

- New submissions enter `pending_review`.
- A reviewer can mark an item `approved`, `rejected`, or `archived`.
- Publishing requires a valid allowlisted official player URL, rights holder, license reference, and a future license expiry.
- Expired licenses cannot be published.
- No crawler, arbitrary iframe, video download, stream proxy, or automatic republishing is implemented.

The initial embed allowlist is YouTube's privacy-enhanced player and Vimeo's official player. Additional hosts must be deliberately added to `VIDEO_EMBED_ALLOWED_HOSTS` and reviewed before use.

## API

- `GET /api/admin/videos` — authenticated catalog list.
- `POST /api/admin/videos` — create a pending review item.
- `PATCH /api/admin/videos/:id` — transition to approved, published, rejected, or archived.

All routes require `Authorization: Bearer <ADMIN_CMS_TOKEN>` and send `Cache-Control: no-store`.

## Rollback

Remove the staging-only CMS environment variables to disable the service. Keep the table and records intact. No production environment or existing video feed is modified by this PR.
