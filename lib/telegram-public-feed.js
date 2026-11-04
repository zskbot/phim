import { createHash } from "node:crypto";
import { getTelegramPreviewStore } from "@/lib/telegram-preview-store";

let registrationAttempt;

export function getTelegramWebhookSecret(token) {
  return createHash("sha256").update("txtop-preview-webhook:" + token).digest("hex");
}

export function normalizeTelegramPublicLink(value) {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) ||
        !["t.me", "www.t.me", "telegram.me", "www.telegram.me"].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const channel = (parts[0] || "").replace(/^@/, "").toLowerCase();
    if (!/^[a-z][a-z0-9_]{4,31}$/.test(channel) || ["s", "c", "joinchat"].includes(channel) || channel.startsWith("+")) return null;
    return { channel, url: "https://t.me/" + channel };
  } catch { return null; }
}

function decodeHtml(value) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(html) {
  return decodeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim().slice(0, 4000);
}

function extractVideoPosts(html, channel) {
  const segments = html.split(/<div class="tgme_widget_message_wrap\b/i).slice(1);
  const posts = [];
  for (const segment of segments) {
    const idMatch = segment.match(new RegExp("data-post=[\"']" + channel + "/(\\d+)[\"']", "i"));
    if (!idMatch || !/tgme_widget_message_(?:video|document|roundvideo)/i.test(segment)) continue;
    const messageId = Number(idMatch[1]);
    if (!Number.isSafeInteger(messageId) || messageId < 1) continue;
    const captionMatch = segment.match(/<div[^>]*class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const caption = captionMatch ? plainText(captionMatch[1]) : "";
    const imageMatch = segment.match(/background-image:\s*url\(["']?([^"'\)]+)["']?\)/i) ||
      segment.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
    const poster = imageMatch ? imageMatch[1].replace(/&amp;/g, "&") : "";
    posts.push({
      channel, messageId, text: caption, caption, type: "video", date: 0, poster,
      permalink: "https://t.me/" + channel + "/" + messageId,
      embedUrl: "https://t.me/" + channel + "/" + messageId + "?embed=1"
    });
  }
  return posts;
}

export async function fetchPublicTelegramVideos(channel) {
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(channel)) throw new Error("Invalid Telegram public source.");
  const collected = new Map();
  let before = "";
  for (let page = 0; page < 3; page += 1) {
    const url = new URL("https://t.me/s/" + channel);
    if (before) url.searchParams.set("before", before);
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 TXTOPPreviewFeed/1.0" },
      signal: AbortSignal.timeout(8000), cache: "no-store"
    });
    if (!response.ok) throw new Error("Telegram public source @" + channel + " returned HTTP " + response.status);
    const html = await response.text();
    for (const post of extractVideoPosts(html, channel)) collected.set(post.messageId, post);
    const ids = [...html.matchAll(new RegExp("data-post=[\"']" + channel + "/(\\d+)[\"']", "gi"))].map(match => Number(match[1]));
    if (!ids.length) break;
    const oldest = Math.min(...ids);
    if (!Number.isSafeInteger(oldest) || oldest < 1 || oldest === Number(before)) break;
    before = String(oldest);
    if (page > 0 && collected.size === 0) break;
  }
  return [...collected.values()].sort((a, b) => b.messageId - a.messageId).slice(0, 60);
}

async function getConfiguredSources() {
  const store = getTelegramPreviewStore();
  const saved = await store.get("sources-index", { type: "json" });
  const list = Array.isArray(saved) ? saved : [];
  const sources = list.filter(item => item && /^[a-z][a-z0-9_]{4,31}$/.test(item.channel));
  if (!sources.some(item => item.channel === "txtop18")) {
    sources.unshift({ channel: "txtop18", url: "https://t.me/txtop18", addedAt: null, default: true });
  }
  return sources;
}

export async function ensureTelegramPreviewWebhook() {
  if (process.env.CONTEXT !== "deploy-preview" || !process.env.NETLIFY) return { configured: false, reason: "not-preview" };
  if (registrationAttempt) return registrationAttempt;
  registrationAttempt = (async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN || "";
    const previewBase = process.env.DEPLOY_PRIME_URL || "";
    if (!token || !previewBase) return { configured: false, reason: "missing-preview-config" };
    let base;
    try { base = new URL(previewBase); } catch { return { configured: false, reason: "invalid-preview-url" }; }
    if (base.protocol !== "https:" || !base.hostname.startsWith("deploy-preview-") || !base.hostname.endsWith("--txtop.netlify.app")) {
      return { configured: false, reason: "not-txtop-deploy-preview" };
    }
    const webhookUrl = new URL("/api/telegram/webhook", base).toString();
    const api = "https://api.telegram.org/bot" + token;
    const infoResponse = await fetch(api + "/getWebhookInfo", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const info = await infoResponse.json();
    if (!infoResponse.ok || !info.ok) return { configured: false, reason: "telegram-info-failed" };
    const currentUrl = String(info.result?.url || "");
    const currentHost = (() => { try { return new URL(currentUrl).hostname; } catch { return ""; } })();
    const isTxtopPreview = currentHost.startsWith("deploy-preview-") && currentHost.endsWith("--txtop.netlify.app");
    if (currentUrl && currentUrl !== webhookUrl && !isTxtopPreview) {
      return { configured: false, reason: "existing-webhook-outside-txtop-preview" };
    }
    const setResponse = await fetch(api + "/setWebhook", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl, secret_token: getTelegramWebhookSecret(token),
        allowed_updates: ["channel_post", "edited_channel_post", "message", "edited_message"]
      }),
      signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    const result = await setResponse.json();
    return { configured: Boolean(setResponse.ok && result.ok), reason: setResponse.ok && result.ok ? "ready" : "telegram-set-webhook-failed" };
  })().catch(error => {
    console.error("[telegram-preview-webhook-setup]", error);
    return { configured: false, reason: "setup-error" };
  });
  return registrationAttempt;
}

export async function getPublicTelegramVideoPosts() {
  try {
    const [sources] = await Promise.all([getConfiguredSources(), ensureTelegramPreviewWebhook()]);
    const batches = await Promise.all(sources.map(source =>
      fetchPublicTelegramVideos(source.channel).catch(error => {
        console.error("[telegram-public-feed]", source.channel, error);
        return [];
      })
    ));
    return batches.flat().sort((a, b) => b.messageId - a.messageId).slice(0, 10);
  } catch (error) {
    console.error("[telegram-public-feed]", error);
    return [];
  }
}
