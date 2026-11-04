import { getDeployStore } from "@netlify/blobs";

export function isTxtopDeployPreview() {
  if (process.env.NETLIFY !== "true" && !process.env.NETLIFY) return false;
  try {
    const url = new URL(process.env.DEPLOY_PRIME_URL || "");
    return url.protocol === "https:" &&
      /^deploy-preview-\d+--txtop\.netlify\.app$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function getTelegramPreviewStore() {
  if (!isTxtopDeployPreview()) {
    throw new Error("Telegram preview storage is available only in TX.TOP Deploy Previews.");
  }
  return getDeployStore("txtop-telegram-preview");
}

export function toTelegramPreviewPost(update) {
  const message = update?.channel_post || update?.edited_channel_post || update?.message || update?.edited_message;
  if (!message || !["channel", "supergroup", "group"].includes(message.chat?.type)) return null;

  // Only public groups/channels can be embedded on the public website.
  const username = String(message.chat.username || "").replace(/^@/, "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(username) || !Number.isSafeInteger(message.message_id)) return null;

  const text = String(message.text || message.caption || "").trim().slice(0, 4000);
  const video = message.video || (message.document?.mime_type?.startsWith("video/") ? message.document : null);
  if (!video) return null;

  return {
    channel: username,
    chatType: message.chat.type,
    messageId: message.message_id,
    text,
    caption: text,
    date: Number(message.date || 0),
    editedAt: Number(message.edit_date || 0),
    type: "video",
    video: {
      duration: Number(video.duration || 0),
      width: Number(video.width || 0),
      height: Number(video.height || 0),
      mimeType: String(video.mime_type || "video/mp4").slice(0, 80)
    },
    permalink: `https://t.me/${username}/${message.message_id}`,
    embedUrl: `https://t.me/${username}/${message.message_id}?embed=1`
  };
}
