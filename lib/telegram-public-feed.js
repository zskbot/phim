import { createHash } from "node:crypto";

const CHANNEL = "txtop18";
let registrationAttempt;

export function getTelegramWebhookSecret(token) {
  return createHash("sha256").update("txtop-preview-webhook:" + token).digest("hex");
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(html) {
  return decodeHtml(html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
  ).trim().slice(0, 4000);
}

function extractVideoPosts(html) {
  const segments = html.split(/<div class="tgme_widget_message_wrap\b/i).slice(1);
  const posts = [];
  for (const segment of segments) {
    const idMatch = segment.match(/data-post=["']txtop18\/(\d+)["']/i);
    if (!idMatch) continue;
    if (!/tgme_widget_message_(?:video|document|roundvideo)/i.test(segment)) continue;
    const messageId = Number(idMatch[1]);
    if (!Number.isSafeInteger(messageId) || messageId < 1) continue;
    const captionMatch = segment.match(/<div[^>]*class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const caption = captionMatch ? plainText(captionMatch[1]) : "";
    const imageMatch = segment.match(/background-image:\s*url\(["']?([^"'\)]+)["']?\)/i)
      || segment.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
    const poster = imageMatch ? imageMatch[1].replace(/&amp;/g, "&") : "";
    posts.push({
      channel: CHANNEL,
      messageId,
      text: caption,
      caption,
      type: "video",
      date: 0,
      poster,
      permalink: `https://t.me/${CHANNEL}/${messageId}`,
      embedUrl: `https://t.me/${CHANNEL}/${messageId}?embed=1`,
    });
  }
  return posts;
}

async function fetchPublicChannelVideos() {
  const collected = new Map();
  let before = "";
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(`https://t.me/s/${CHANNEL}`);
    if (before) url.searchParams.set("before", before);
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 TXTOPPreviewFeed/1.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`Telegram public channel returned HTTP ${response.status}`);
    const html = await response.text();
    const posts = extractVideoPosts(html);
    for (const post of posts) collected.set(post.messageId, post);
    const ids = [...html.matchAll(/data-post=["']txtop18\/(\d+)["']/gi)].map(match => Number(match[1]));
    if (!ids.length) break;
    const oldest = Math.min(...ids);
    if (!Number.isSafeInteger(oldest) || oldest < 1 || oldest === Number(before)) break;
    before = String(oldest);
    if (posts.length === 0 && page > 0) break;
  }
  return [...collected.values()].sort((a, b) => b.messageId - a.messageId).slice(0, 60);
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
    const api = `https://api.telegram.org/bot${token}`;
    const infoResponse = await fetch(`${api}/getWebhookInfo`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const info = await infoResponse.json();
    if (!infoResponse.ok || !info.ok) return { configured: false, reason: "telegram-info-failed" };
    const currentUrl = String(info.result?.url || "");
    const currentHost = (() => { try { return new URL(currentUrl).hostname; } catch { return ""; } })();
    const isTxtopPreview = currentHost.startsWith("deploy-preview-") && currentHost.endsWith("--txtop.netlify.app");
    if (currentUrl && currentUrl !== webhookUrl && !isTxtopPreview) {
      return { configured: false, reason: "existing-webhook-outside-txtop-preview" };
    }
    const setResponse = await fetch(`${api}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: getTelegramWebhookSecret(token),
        allowed_updates: ["channel_post", "edited_channel_post"],
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
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
    const [posts] = await Promise.all([
      fetchPublicChannelVideos(),
      ensureTelegramPreviewWebhook(),
    ]);
    return posts;
  } catch (error) {
    console.error("[telegram-public-feed]", error);
    return [];
  }
}
