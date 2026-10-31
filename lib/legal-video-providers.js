const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const VIMEO_API = "https://api.vimeo.com/videos";
const DAILYMOTION_API = "https://api.dailymotion.com/v2";
const MAX_RESULTS = 20;

function safeText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}
function youtubeVideo(item) {
  const id = safeText(item?.id?.videoId, 120);
  const title = safeText(item?.snippet?.title, 240);
  if (!id || !title) return null;
  const thumbnails = item.snippet.thumbnails || {};
  const poster = safeImage(thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url);
  return {
    id: `youtube:${id}`,
    provider: "youtube",
    providerId: id,
    title,
    description: safeText(item.snippet.description, 2000),
    poster,
    embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
    publishedAt: safeText(item.snippet.publishedAt, 40),
    category: "Video"
  };
}
function vimeoVideo(item) {
  const id = safeText(String(item?.uri || "").split("/").filter(Boolean).pop(), 120);
  const title = safeText(item?.name, 240);
  if (!id || !title) return null;
  const pictures = item.pictures?.sizes || [];
  const poster = safeImage(pictures[pictures.length - 1]?.link || pictures[0]?.link);
  const html = safeText(item.embed?.html, 10000);
  const match = html.match(/src=["'](https:\/\/player\.vimeo\.com\/video\/[0-9]+[^"']*)["']/i);
  const embedUrl = match ? safeImage(match[1]) : "";
  return {
    id: `vimeo:${id}`,
    provider: "vimeo",
    providerId: id,
    title,
    description: safeText(item.description, 2000),
    poster,
    embedUrl,
    publishedAt: safeText(item.created_time, 40),
    duration: Number.isFinite(item.duration) ? item.duration : null,
    category: "Video"
  };
}
function dailymotionVideo(item) {
  const id = safeText(item?.video_id, 120);
  const title = safeText(item?.title, 240);
  if (!id || !title) return null;
  const embedEnabled = item?.embedding?.enable_embed === true;
  const rawEmbedUrl = safeText(item?.embedding?.embed_url, 1000);
  let embedUrl = "";
  try {
    const url = new URL(rawEmbedUrl);
    if (url.protocol === "https:" && ["dailymotion.com", "www.dailymotion.com"].includes(url.hostname)
      && url.pathname.startsWith("/embed/video/")) embedUrl = url.toString();
  } catch { /* No trusted player URL: keep the result non-playable. */ }
  return {
    id: `dailymotion:${id}`,
    provider: "dailymotion",
    providerId: id,
    title,
    description: safeText(item?.description, 2000),
    poster: safeImage(item?.thumbnail?.h1080_url || item?.thumbnail?.h720_url || item?.thumbnail?.url),
    embedUrl: embedEnabled ? embedUrl : "",
    publishedAt: safeText(item?.published_at, 40),
    category: "Video"
  };
}

async function requestJson(url, headers) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 60 }
  });
  if (!response.ok) throw new Error(`Provider request failed (HTTP ${response.status})`);
  return response.json();
}

export async function searchLegalProvider(provider, query) {
  const q = safeText(query, 120);
  if (!q) throw new Error("A search query is required");
  if (provider === "youtube") {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("YouTube provider is not configured");
    const url = new URL(YOUTUBE_API);
    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      q,
      maxResults: String(MAX_RESULTS),
      videoEmbeddable: "true",
      safeSearch: "strict",
      key
    }).toString();
    const payload = await requestJson(url, { Accept: "application/json" });
    return {
      provider,
      results: (payload.items || []).map(youtubeVideo).filter(Boolean),
      nextPageToken: safeText(payload.nextPageToken, 500)
    };
  }
  if (provider === "vimeo") {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) throw new Error("Vimeo provider is not configured");
    const url = new URL(VIMEO_API);
    url.search = new URLSearchParams({
      query: q,
      per_page: String(MAX_RESULTS),
      fields: "uri,name,description,duration,pictures,embed,created_time"
    }).toString();
    const payload = await requestJson(url, {
      Accept: "application/vnd.vimeo.*+json;version=3.4",
      Authorization: `Bearer ${token}`
    });
    return {
      provider,
      results: (payload.data || []).map(vimeoVideo).filter(Boolean),
      nextPageToken: ""
    };
  }
  if (provider === "dailymotion") {
    const token = process.env.DAILYMOTION_ACCESS_TOKEN;
    const profileId = safeText(process.env.DAILYMOTION_PROFILE_ID, 120);
    if (!token) throw new Error("Dailymotion API v2 access token is not configured");
    if (!profileId) throw new Error("Dailymotion profile ID is not configured");
    const url = new URL(`${DAILYMOTION_API}/profiles/${encodeURIComponent(profileId)}/videos`);
    url.search = new URLSearchParams({
      page: "1",
      page_size: String(MAX_RESULTS),
      tags: q,
      visibility: "public",
      is_explicit: "false",
      is_for_kids: "false",
      fields: "video_id,title,description,published_at,visibility,is_explicit,is_for_kids,embedding.enable_embed,embedding.embed_url,thumbnail.h1080_url,thumbnail.h720_url"
    }).toString();
    const payload = await requestJson(url, {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    });
    return {
      provider,
      results: (payload.data || []).filter(item =>
        item?.visibility === "public" && item?.is_explicit !== true && item?.is_for_kids !== true
      ).map(dailymotionVideo).filter(Boolean),
      nextPageToken: ""
    };
  }
  throw new Error("Unsupported provider");
}

export function getLegalProviderStatuses() {
  const dailymotionConfigured = Boolean(process.env.DAILYMOTION_ACCESS_TOKEN && process.env.DAILYMOTION_PROFILE_ID);
  return [
    { id: "youtube", name: "YouTube Data API v3", configured: Boolean(process.env.YOUTUBE_API_KEY), status: process.env.YOUTUBE_API_KEY ? "configured" : "pending_credentials" },
    { id: "vimeo", name: "Vimeo API", configured: Boolean(process.env.VIMEO_ACCESS_TOKEN), status: process.env.VIMEO_ACCESS_TOKEN ? "configured" : "pending_credentials" },
    { id: "dailymotion", name: "Dailymotion API v2 (authorized profile)", configured: dailymotionConfigured, status: dailymotionConfigured ? "configured" : "pending_token_and_profile" }
  ];
}
