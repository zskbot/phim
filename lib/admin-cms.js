import { timingSafeEqual } from "node:crypto";

const TABLE = "video_catalog";
const ALLOWED_EMBED_HOSTS = new Set([
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  ...(process.env.VIDEO_EMBED_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
]);
const STATES = new Set(["draft", "pending_review", "approved", "published", "rejected", "archived"]);

export function isAdminAuthorized(request) {
  const expected = process.env.ADMIN_CMS_TOKEN || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function databaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CMS database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
  return { url: parsed.origin, key };
}

async function databaseRequest(path, options = {}) {
  const { url, key } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    console.error("[admin-cms-db]", response.status, body.slice(0, 500));
    throw new Error("CMS database request failed.");
  }
  return body ? JSON.parse(body) : null;
}

export function validateEmbedUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_EMBED_HOSTS.has(host)) return null;
    if (host.includes("youtube")) {
      if (!/^\/embed\/[A-Za-z0-9_-]{6,20}\/?$/.test(url.pathname)) return null;
    } else if (host === "player.vimeo.com") {
      if (!/^\/video\/\d+\/?$/.test(url.pathname)) return null;
    } else if (!url.pathname.startsWith("/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanText(value, max, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const result = value.trim().slice(0, max);
  return required && !result ? null : result;
}

export function validateVideoInput(input, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid request body." };
  const output = {};
  const fields = ["title", "description", "category", "poster_url", "embed_url", "rights_holder", "license_reference", "license_expires_at"];
  for (const field of fields) {
    if (partial && !(field in input)) continue;
    if (field === "embed_url") {
      const safe = validateEmbedUrl(input[field]);
      if (!safe) return { error: "Embed URL must be an approved HTTPS YouTube or Vimeo player URL." };
      output[field] = safe;
    } else if (field === "poster_url") {
      const raw = cleanText(input[field], 2048);
      if (raw) {
        try {
          const url = new URL(raw);
          if (url.protocol !== "https:" || url.username || url.password) return { error: "Poster URL must use HTTPS." };
          output[field] = url.toString();
        } catch { return { error: "Poster URL is invalid." }; }
      } else output[field] = null;
    } else if (field === "license_expires_at") {
      const raw = cleanText(input[field], 40);
      if (raw && !Number.isFinite(Date.parse(raw))) return { error: "License expiry date is invalid." };
      output[field] = raw || null;
    } else {
      const max = field === "description" ? 4000 : field === "title" ? 240 : field === "license_reference" ? 180 : 120;
      const required = ["title", "category", "rights_holder", "license_reference"].includes(field);
      const value = cleanText(input[field], max, required && !partial);
      if (required && !partial && value === null) return { error: `${field} is required.` };
      output[field] = value ?? "";
    }
  }
  if (!partial && !output.license_expires_at) return { error: "A license expiry date is required." };
  return { data: output };
}

export async function listCatalog() {
  return databaseRequest(`${TABLE}?select=*&order=updated_at.desc&limit=200`);
}

export async function createCatalogItem(data) {
  return databaseRequest(TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...data, status: "pending_review" }),
  });
}

export async function updateCatalogStatus(id, status) {
  if (!STATES.has(status)) throw new Error("Invalid content status.");
  if (!/^[0-9a-f-]{16,64}$/i.test(id)) throw new Error("Invalid content id.");
  const current = await databaseRequest(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!current?.[0]) return null;
  if (status === "published") {
    const item = current[0];
    if (!item.rights_holder || !item.license_reference || !item.license_expires_at || Date.parse(item.license_expires_at) <= Date.now()) {
      throw new Error("Cannot publish: valid rights holder, license reference and future expiry are required.");
    }
    if (!validateEmbedUrl(item.embed_url)) throw new Error("Cannot publish: embed URL is not allowlisted.");
  }
  return databaseRequest(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
}

export async function getCmsHealth() {
  const { url } = databaseConfig();
  return { configured: true, database: new URL(url).host, authConfigured: Boolean(process.env.ADMIN_CMS_TOKEN) };
}
