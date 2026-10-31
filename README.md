# PHIM. — Video Streaming Platform

A Vietnamese-language streaming catalogue built with Next.js App Router, React and Tailwind CSS.

## Features
- Responsive dark cinematic homepage and featured title
- Search by title, genre and description
- Genre filters and movie detail pages
- HTML5 video player when a licensed video URL is configured
- Lightweight self-declared age confirmation
- Centralized catalogue in `data/videos.js`

## Requirements
- Node.js 20.9+
- npm

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Add or edit titles
Edit `data/videos.js`. Each entry needs a unique `id`, title, category, year, duration, rating, description and poster URL. Set `videoUrl` to a direct, authorized MP4/HLS-compatible source to enable playback. Keep it empty to show the player setup notice.

## Deployment
Import this repository into Vercel. The framework is detected as Next.js; use `npm run build` for the build command and leave the output directory at its default.

## Content and rights
Only add videos, artwork and streams that you own or are authorized to distribute. The age prompt is a self-declaration UI, not legal age or identity verification.
