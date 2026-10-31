const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const VIMEO_API = "https://api.vimeo.com/videos";
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
    throw new Error("Dailymotion is pending API v2 search contract and staging credentials");
  }
  throw new Error("Unsupported provider");
}

export function getLegalProviderStatuses() {
  return [
    { id: "youtube", name: "YouTube Data API v3", configured: Boolean(process.env.YOUTUBE_API_KEY), status: process.env.YOUTUBE_API_KEY ? "configured" : "pending_credentials" },
    { id: "vimeo", name: "Vimeo API", configured: Boolean(process.env.VIMEO_ACCESS_TOKEN), status: process.env.VIMEO_ACCESS_TOKEN ? "configured" : "pending_credentials" },
    { id: "dailymotion", name: "Dailymotion API v2", configured: false, status: "pending_api_contract" }
  ];
}
