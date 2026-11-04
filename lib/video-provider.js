import { videos as demoVideos } from "@/data/videos";

const text = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function httpsUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function embedUrl(value) {
  const safe = httpsUrl(value);
  if (!safe) return "";
  const hosts = (process.env.VIDEO_EMBED_ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  try {
    const host = new URL(safe).hostname.toLowerCase();
    return hosts.some(allowed => host === allowed || host.endsWith("." + allowed)) ? safe : "";
  } catch { return ""; }
}

function normalize(item) {
  if (!item || typeof item !== "object") return null;
  const id = text(item.id || item.video_id || item.slug);
  const title = text(item.title || item.name);
  if (!id || !title) return null;
  return {
    id: id.slice(0, 120), title: title.slice(0, 240),
    description: text(item.description || item.overview).slice(0, 4000),
    category: text(item.category || item.genre, "Khác").slice(0, 80),
    year: number(item.year, new Date().getFullYear()),
    duration: text(item.duration || item.runtime, "Chưa cập nhật").slice(0, 40),
    rating: text(item.rating || item.age_rating, "NR").slice(0, 20),
    views: number(item.views || item.view_count, 0),
    poster: httpsUrl(item.poster || item.thumbnail_url || item.thumbnail),
    backdrop: httpsUrl(item.backdrop || item.backdrop_url || item.thumbnail_url || item.poster),
    videoUrl: httpsUrl(item.videoUrl || item.video_url || item.file_url || item.mp4_url),
    embedUrl: embedUrl(item.embedUrl || item.embed_url || item.iframe_url),
    updatedAt: text(item.updated_at || item.updatedAt),
    provider: "provider"
  };
}

async function getPublicTelegramVideos() {
  const raw = process.env.TELEGRAM_PUBLIC_POSTS_JSON || "[]";
  let posts;
  try { posts = JSON.parse(raw); }
  catch { throw new Error("TELEGRAM_PUBLIC_POSTS_JSON must be valid JSON."); }
  if (!Array.isArray(posts)) throw new Error("TELEGRAM_PUBLIC_POSTS_JSON must be an array.");

  let received = [];
  if (process.env.CONTEXT === "deploy-preview" && process.env.NETLIFY) {
    try {
      const { getDeployStore } = await import("@netlify/blobs");
      const store = getDeployStore("txtop-telegram-preview");
      received = (await store.get("posts-index", { type: "json" })) || [];
      if (!Array.isArray(received)) received = [];
    } catch (error) {
      console.error("[telegram-preview-feed]", error);
    }
  }
  const merged = [...received, ...posts];
  const unique = [...new Map(merged.map((post) => [`${post.channel}:${post.messageId}`, post])).values()];
  return unique.slice(0, 100).flatMap((post, index) => {
    if (!post || typeof post !== "object") return [];
    const channel = text(post.channel).replace(/^@/, "");
    const messageId = String(post.messageId ?? "");
    if (!/^[A-Za-z0-9_]{5,32}$/.test(channel) || !/^\d{1,12}$/.test(messageId) || Number(messageId) < 1) return [];
    const body = text(post.text || post.caption || post.description);
    const title = text(post.title || body.split("\n")[0], `Bài Telegram #${messageId}`).slice(0, 240);
    const sourceUrl = `https://t.me/${channel}/${messageId}`;
    const id = `telegram-public:${channel}:${messageId}`;
    return [{
      id, title,
      description: body.slice(0, 4000),
      category: text(post.category, "Telegram").slice(0, 80),
      year: number(post.year, new Date().getFullYear()),
      duration: text(post.duration, "Telegram").slice(0, 40),
      rating: text(post.rating, "NR").slice(0, 20),
      views: 0,
      poster: httpsUrl(post.poster),
      backdrop: httpsUrl(post.backdrop || post.poster),
      videoUrl: "",
      embedUrl: `${sourceUrl}?embed=1`,
      sourceUrl,
      updatedAt: "",
      provider: "telegram-public"
    }];
  });
}

export async function getVideoFeed() {
  const telegramVideos = await getPublicTelegramVideos();
  const endpoint = process.env.VIDEO_PROVIDER_API_URL;
  if (!endpoint) {
    const demos = demoVideos.map(normalize).filter(Boolean);
    return { results: [...telegramVideos, ...demos], source: telegramVideos.length ? "telegram+demo" : "demo" };
  }
  let url;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch { throw new Error("VIDEO_PROVIDER_API_URL must be a valid HTTPS URL"); }
  const headers = { Accept: "application/json" };
  if (process.env.VIDEO_PROVIDER_API_KEY) headers.Authorization = `Bearer ${process.env.VIDEO_PROVIDER_API_KEY}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000), next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : payload.results || payload.data || payload.videos;
  if (!Array.isArray(items)) throw new Error("Provider response must contain results, data, or videos array");
  const providerVideos = items.slice(0, 100).map(normalize).filter(Boolean);
  return {
    results: [...telegramVideos, ...providerVideos],
    source: telegramVideos.length ? "provider+telegram" : "provider"
  };
}
