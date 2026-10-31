# TX.TOP 18+ — Video Streaming Platform

TX.TOP 18+ is a Vietnamese streaming catalogue built with Next.js App Router, React and Tailwind CSS.

## Features
- Dynamic video feed through internal `GET /api/videos`
- Provider response normalization (array, `results`, `data`, or `videos`)
- Search, category filtering, featured title and dynamic detail routes
- HTML5 playback for direct HTTPS media URLs
- Iframe playback only for HTTPS hosts explicitly allowlisted
- Browser feed refresh every five minutes; provider cache for 60 seconds
- Demo catalogue fallback when no provider endpoint is configured
- 18+ self-attestation gate; this is not identity or age verification

## Local development
Requires Node.js 20.9+.
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## Configure a provider
Set these variables in `.env.local` or Vercel Project Settings → Environment Variables:
- `VIDEO_PROVIDER_API_URL`: HTTPS JSON endpoint owned by, or contractually provided to, your project.
- `VIDEO_PROVIDER_API_KEY`: optional bearer token.
- `VIDEO_EMBED_ALLOWED_HOSTS`: comma-separated hostnames authorized to serve iframe players.

The provider may return a JSON array or an object containing `results`, `data`, or `videos`. Each item should include `id` (or `video_id`/`slug`), `title`, and optional `description`, `category`, `year`, `duration`, `rating`, `views`, `poster`/`thumbnail_url`, `backdrop`, `videoUrl`/`video_url`, and `embedUrl`/`embed_url`.

Only HTTPS media URLs are accepted. Iframe URLs are ignored unless their hostname matches `VIDEO_EMBED_ALLOWED_HOSTS`. Keep API credentials private; never commit real secrets. Only ingest and stream content you own or are licensed to distribute, with documented consent and appropriate adult-content safeguards.

## API
- `GET /api/videos` returns the normalized feed.
- `GET /api/videos?id=<video-id>` returns one video or 404.

Provider responses are cached for 60 seconds. The browser refreshes the feed every five minutes.
