# Dailymotion API v2 — staging adapter

## What this adapter does

- Uses the current Dailymotion API v2 profile videos endpoint:
  `GET https://api.dailymotion.com/v2/profiles/{profile_id}/videos`.
- Filters to public videos, non-explicit and not marked for kids, and filters by the configured profile's tags.
- Requests only metadata, embed permission, embed URL, and thumbnail fields.
- Displays only the official Dailymotion player URL returned by the API and validates its HTTPS host/path.
- Does not download, proxy, mirror, or re-host video files.

## Important limitation

Dailymotion API v2's documented profile endpoint is a profile catalogue, not a global full-text search endpoint. The sandbox's Dailymotion query is therefore a tag filter within the single authorized profile configured by TX.TOP. Do not describe this as global Dailymotion search.

The profile must be owned by TX.TOP or explicitly authorized by its owner. A valid API token and profile ID do not themselves grant redistribution, commercial, or sublicensing rights.

## Staging environment variables

Configure these only in the hosting provider's Preview/Staging secret store:

```env
DAILYMOTION_ACCESS_TOKEN=
DAILYMOTION_PROFILE_ID=
```

Use a Dailymotion API v2 bearer token with the least-privilege read permission required by the account. Keep it server-side; never prefix it with `NEXT_PUBLIC_`, commit it, or paste it into chat. The profile ID must identify a channel TX.TOP is authorized to catalogue.

## Rights and player checks

- API access and embed availability are separate from copyright/licensing permission.
- Only display public videos for which the API explicitly reports `embedding.enable_embed=true` and returns a valid official Dailymotion embed URL.
- Respect privacy, geographic restrictions, age flags, content policies, creator permissions, and takedown requests.
- The current adapter excludes explicit content and content marked as made for kids. A separate age-gate/moderation review is still required before any adult-content use.
- If a result lacks a valid embed URL, it remains non-playable in the UI.

## Official documentation

- API v2 overview: https://developers.dailymotion.com/reference/introduction
- Get video fields / embedding permissions: https://developers.dailymotion.com/reference/get-video
- List profile videos: https://developers.dailymotion.com/reference/listprofilevideos
- Embed player methods: https://faq.dailymotion.com/hc/en-us/articles/4411096679954-Integrate-your-Player-Embed
- API authentication and keys: https://developers.dailymotion.com/reference/perform-an-api-call

## Verification checklist

1. Add a dedicated staging token and authorized profile ID.
2. Verify `GET /api/providers` reports Dailymotion as configured.
3. Test `GET /api/providers/search?provider=dailymotion&q={tag}`.
4. Confirm the response contains no credentials and only public, non-explicit, embeddable videos.
5. Verify official player playback and handle 401, 403, 404, and 429 responses.
6. Keep the feature on a PR/Preview until a human verifies channel rights and playback.

No production environment is modified by this change.
