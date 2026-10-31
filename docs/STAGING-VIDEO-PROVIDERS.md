# Legal video providers — staging only

## Scope and safety boundary

This integration is for a general-purpose video catalogue. It does not download or re-host provider media. Search results are metadata plus the provider's official player URL. A result appearing in a public API is **not** proof that TX.TOP has a separate redistribution, commercial, or sublicensing right. Respect each provider's terms, creator permissions, privacy settings, embed restrictions, and takedown requests.

All changes are isolated on `feat/legal-video-provider-staging`. Do not merge or deploy to Production as part of this work.

## Implemented adapters

| Provider | API | State |
| --- | --- | --- |
| YouTube | Data API v3 `search.list`, filters to video + embeddable + strict SafeSearch | Ready for staging key |
| Vimeo | Videos API search with bearer token; uses returned embed HTML to extract the official player URL | Ready for staging token |
| Dailymotion | API v2 | Pending: validate a supported search/list endpoint and OAuth scopes before enabling |

Official references:
- YouTube search.list: https://developers.google.com/youtube/data/reference/rest/v3/search/list
- Vimeo videos API: https://developer.vimeo.com/api/reference/videos
- Vimeo authentication: https://developer.vimeo.com/api/authentication
- Dailymotion API v2: https://developers.dailymotion.com/docs/welcome
- Dailymotion API calls and bearer auth: https://developers.dailymotion.com/reference/perform-an-api-call

## Staging configuration

Set the following in the Vercel Preview environment or local `.env.local`. Do not put credentials in GitHub files or expose them to browser code.

```env
YOUTUBE_API_KEY=
VIMEO_ACCESS_TOKEN=
VIDEO_EMBED_ALLOWED_HOSTS=youtube-nocookie.com,player.vimeo.com
```

The tracked `.env.staging.example` is a template only. Use separate staging credentials and quota budgets. Do not use production database credentials.

## API

- `GET /api/providers` returns non-secret provider configuration states.
- `GET /api/providers/search?provider=youtube&q=...`
- `GET /api/providers/search?provider=vimeo&q=...`
- Dailymotion returns HTTP 503 until its v2 search contract is validated.

The server validates provider names and query length, calls fixed HTTPS API origins, applies a 10-second timeout, caps results at 20, and caches successful reads for 60 seconds. Credentials stay server-side.

## Embedding and rights

- YouTube search requests `videoEmbeddable=true` and `safeSearch=strict`. The provider may still change availability or embed settings later.
- Vimeo embed URLs are accepted only when returned as an official `player.vimeo.com` iframe URL in the API's embed HTML.
- The player must still handle provider-side privacy, geographic, account, and domain restrictions.
- Do not download, proxy, or persist provider video files. Store only the metadata needed for the catalogue and link to the provider's player.
- Before enabling commercial use, confirm the applicable platform terms and creator/license permissions for the intended display and territory.

## Staging checklist

1. Create separate API credentials with least-privilege scopes.
2. Add credentials only to Vercel Preview environment variables.
3. Open `/api/providers` and verify configured/pending states.
4. Test each search endpoint with a small query and confirm HTTP status, response schema, and embed playback.
5. Verify no secrets appear in response bodies, client bundles, logs, or Git history.
6. Test missing credentials, invalid query, provider timeout, rate limiting, and non-embeddable/private videos.
7. Review CI and Preview deployment. Keep Production untouched.

## Rollback

Remove the Preview credentials to disable live provider search. The existing `/api/videos` demo feed remains independent. Revert this feature branch if the PR fails review; do not alter Production settings.
