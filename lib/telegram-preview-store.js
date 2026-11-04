import { getDeployStore } from "@netlify/blobs";

export function getTelegramPreviewStore() {
  if (process.env.CONTEXT !== "deploy-preview" || !process.env.NETLIFY) {
    throw new Error("Telegram preview storage is available only in Netlify Deploy Previews.");
  }
  return getDeployStore("txtop-telegram-preview");
}

export function toTelegramPreviewPost(update) {
  const message = update?.channel_post || update?.edited_channel_post;
  if (!message || message.chat?.type !== "channel") return null;
  const username = String(message.chat.username || "").replace(/^@/, "").toLowerCase();
  if (username !== "txtop18" || !Number.isSafeInteger(message.message_id)) return null;
  const text = String(message.text || message.caption || "").trim().slice(0, 4000);
  const video = message.video || (message.document?.mime_type?.startsWith("video/") ? message.document : null);
  if (!text && !video) return null;
  return {
    channel: "txtop18",
    messageId: message.message_id,
    text,
    caption: text,
    date: Number(message.date || 0),
    editedAt: Number(message.edit_date || 0),
    type: video ? "video" : "text",
    video: video ? {
      duration: Number(video.duration || 0),
      width: Number(video.width || 0),
      height: Number(video.height || 0),
      mimeType: String(video.mime_type || "video/mp4").slice(0, 80),
    } : null,
    permalink: `https://t.me/txtop18/${message.message_id}`,
    embedUrl: `https://t.me/txtop18/${message.message_id}?embed=1`,
  };
}
