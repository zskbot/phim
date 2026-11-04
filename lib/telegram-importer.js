const MAX_BOT_API_FILE_BYTES = 20 * 1024 * 1024;
const BUCKET = process.env.TELEGRAM_STORAGE_BUCKET || "tx-top-videos";

function databaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Staging database is not configured.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
  return { origin: parsed.origin, key };
}
function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is not configured.");
  return { token };
}

function sourceRights(chatId) {
  let sources;
  try { sources = JSON.parse(process.env.TELEGRAM_SOURCE_RIGHTS_JSON || "{}"); }
  catch { throw new Error("TELEGRAM_SOURCE_RIGHTS_JSON must be valid JSON."); }
  const source = sources[String(chatId)];
  if (!source || typeof source !== "object") return null;
  const rightsHolder = typeof source.rightsHolder === "string" ? source.rightsHolder.trim().slice(0, 160) : "";
  const licenseReference = typeof source.licenseReference === "string" ? source.licenseReference.trim().slice(0, 240) : "";
  const licenseExpiresAt = typeof source.licenseExpiresAt === "string" ? source.licenseExpiresAt : "";
  const expiry = Date.parse(licenseExpiresAt);
  if (!rightsHolder || !licenseReference || !Number.isFinite(expiry) || expiry <= Date.now()) return null;
  if (source.adultContentCompliant !== true) return null;
  return {
    rightsHolder, licenseReference, licenseExpiresAt: new Date(expiry).toISOString(),
    category: typeof source.category === "string" ? source.category.trim().slice(0, 80) : "Telegram",
  };
}

async function supabase(path, options = {}) {
  const { origin, key } = databaseConfig();
  const response = await fetch(`${origin}/rest/v1/${path}`, {
    ...options, cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", ...options.headers },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

async function telegram(method, body) {
  const { token } = telegramConfig();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error(`Telegram API ${method} failed.`);
  return payload.result;
}

async function uploadVideo(fileId, fileUniqueId, fileName, mimeType, fileSize) {
  if (!mimeType?.toLowerCase().startsWith("video/")) throw new Error("Only Telegram video files are accepted.");
  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_BOT_API_FILE_BYTES) {
    throw new Error("Video exceeds Telegram Bot API cloud download limit (20 MB) or has invalid size.");
  }
  const file = await telegram("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram did not return a downloadable file path.");
  const { token } = telegramConfig();\n  const { origin, key } = databaseConfig();
  const download = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
    signal: AbortSignal.timeout(25000), cache: "no-store",
  });
  if (!download.ok) throw new Error("Telegram video download failed.");
  const bytes = Buffer.from(await download.arrayBuffer());
  if (bytes.length !== fileSize || bytes.length > MAX_BOT_API_FILE_BYTES) throw new Error("Downloaded video size did not match Telegram metadata.");
  const extension = (fileName || file.file_path.split(".").pop() || "mp4").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "mp4";
  const path = `telegram/${fileUniqueId.replace(/[^a-zA-Z0-9_-]/g, "")}.${extension}`;
  const response = await fetch(`${origin}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: {
      apikey: key, Authorization: `Bearer ${key}`, "Content-Type": mimeType,
      "x-upsert": "false",
    }, body: bytes, signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  if (!response.ok && response.status !== 409) throw new Error(`Staging storage upload failed (${response.status}).`);
  return path;
}

export async function importTelegramUpdate(update) {
  const message = update?.message || update?.channel_post;
  const media = message?.video || (message?.document?.mime_type?.startsWith("video/") ? message.document : null);
  if (!message || !media || !message.chat?.id) return { accepted: false, reason: "no_video" };
  const rights = sourceRights(message.chat.id);
  if (!rights) return { accepted: false, reason: "source_not_authorized" };

  const fileId = media.file_id;
  const fileUniqueId = media.file_unique_id;
  if (!fileId || !fileUniqueId) return { accepted: false, reason: "missing_file_identity" };
  const existing = await supabase(`video_catalog?select=id&telegram_file_unique_id=eq.${encodeURIComponent(fileUniqueId)}&limit=1`);
  if (existing?.length) return { accepted: true, duplicate: true };

  const title = (message.caption || media.file_name || "Telegram video").replace(/\s+/g, " ").trim().slice(0, 240);
  const mimeType = media.mime_type || "video/mp4";
  const storagePath = await uploadVideo(fileId, fileUniqueId, media.file_name || "", mimeType, media.file_size);
  const record = {
    title, description: (message.caption || "").slice(0, 4000), category: rights.category,
    poster_url: null, embed_url: null, rights_holder: rights.rightsHolder,
    license_reference: rights.licenseReference, license_expires_at: rights.licenseExpiresAt,
    status: "published", source: "telegram", telegram_chat_id: String(message.chat.id),
    telegram_message_id: message.message_id, telegram_file_unique_id: fileUniqueId,
    storage_path: storagePath, media_mime_type: mimeType, media_size_bytes: media.file_size,
    adult_content_compliant: true, updated_at: new Date().toISOString(),
  };
  try {
    const inserted = await supabase("video_catalog", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(record),
    });
    return { accepted: true, duplicate: false, id: inserted?.[0]?.id || null };
  } catch (error) {
    const { origin, key } = config();
    await fetch(`${origin}/storage/v1/object/${BUCKET}/${storagePath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    }).catch(() => {});
    if (String(error.message).includes("23505")) return { accepted: true, duplicate: true };
    throw error;
  }
}

export async function getPublishedTelegramVideos() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const now = new Date().toISOString();
  const rows = await supabase(`video_catalog?select=id,title,description,category,license_expires_at,storage_path,media_size_bytes,created_at&source=eq.telegram&status=eq.published&adult_content_compliant=eq.true&license_expires_at=gt.${encodeURIComponent(now)}&order=created_at.desc&limit=100`);
  const { origin, key } = config();
  return Promise.all((rows || []).map(async row => {
    const signed = await fetch(`${origin}/storage/v1/object/sign/${BUCKET}/${row.storage_path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }), cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!signed.ok) return null;
    const payload = await signed.json();
    const signedPath = payload.signedURL || payload.signedUrl;
    if (!signedPath) return null;
    return {
      id: `telegram:${row.id}`, title: row.title, description: row.description || "",
      category: row.category || "Telegram", year: new Date(row.created_at).getFullYear(),
      duration: "Chưa cập nhật", rating: "18+", views: 0, poster: "",
      backdrop: "", videoUrl: new URL(signedPath, origin).toString(), embedUrl: "",
      updatedAt: row.created_at, provider: "telegram",
    };
  })).then(items => items.filter(Boolean));
}
