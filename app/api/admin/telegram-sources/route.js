import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-cms";
import { fetchPublicTelegramVideos, normalizeTelegramPublicLink } from "@/lib/telegram-public-feed";
import { getTelegramPreviewStore } from "@/lib/telegram-preview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function previewOnly() {
  return process.env.CONTEXT === "deploy-preview" && Boolean(process.env.NETLIFY);
}
function denied() {
  return NextResponse.json({ success: false, error: "Preview only" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
async function readSources(store) {
  const value = await store.get("sources-index", { type: "json" });
  return Array.isArray(value) ? value : [];
}

export async function GET(request) {
  if (!previewOnly()) return denied();
  if (!isAdminAuthorized(request)) return unauthorized();
  try {
    const store = getTelegramPreviewStore();
    return NextResponse.json({ success: true, sources: await readSources(store) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-sources]", error);
    return NextResponse.json({ success: false, error: "Preview source storage unavailable" }, { status: 503 });
  }
}

export async function POST(request) {
  if (!previewOnly()) return denied();
  if (!isAdminAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const action = body?.action || "add";
    const store = getTelegramPreviewStore();
    const sources = await readSources(store);
    if (action === "sync") {
      const channel = typeof body.channel === "string" ? body.channel.toLowerCase() : "";
      if (!sources.some(item => item.channel === channel) && channel !== "txtop18") {
        return NextResponse.json({ success: false, error: "Nguồn chưa được đăng ký." }, { status: 404 });
      }
      const posts = await fetchPublicTelegramVideos(channel);
      const current = await store.get("posts-index", { type: "json" });
      const existing = Array.isArray(current) ? current : [];
      const keys = new Set(posts.map(post => `${post.channel}:${post.messageId}`));
      const merged = [...posts, ...existing.filter(post => !keys.has(`${post.channel}:${post.messageId}`))].slice(0, 300);
      await store.setJSON("posts-index", merged);
      return NextResponse.json({ success: true, imported: posts.length, channel });
    }
    const normalized = normalizeTelegramPublicLink(body?.url);
    if (!normalized) return NextResponse.json({ success: false, error: "Link phải là kênh hoặc nhóm Telegram công khai dạng https://t.me/ten_nguon." }, { status: 400 });
    if (sources.some(item => item.channel === normalized.channel)) {
      return NextResponse.json({ success: true, duplicate: true, sources });
    }
    const next = [...sources, { ...normalized, addedAt: new Date().toISOString(), status: "active" }].slice(0, 50);
    await store.setJSON("sources-index", next);
    return NextResponse.json({ success: true, sources: next }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-sources]", error);
    return NextResponse.json({ success: false, error: "Không thể cập nhật nguồn trên Preview." }, { status: 503 });
  }
}

export async function DELETE(request) {
  if (!previewOnly()) return denied();
  if (!isAdminAuthorized(request)) return unauthorized();
  const channel = new URL(request.url).searchParams.get("channel") || "";
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(channel) || channel === "txtop18") {
    return NextResponse.json({ success: false, error: "Nguồn không hợp lệ hoặc là nguồn mặc định." }, { status: 400 });
  }
  try {
    const store = getTelegramPreviewStore();
    const sources = await readSources(store);
    const next = sources.filter(item => item.channel !== channel);
    await store.setJSON("sources-index", next);
    return NextResponse.json({ success: true, sources: next }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-sources]", error);
    return NextResponse.json({ success: false, error: "Không thể xóa nguồn trên Preview." }, { status: 503 });
  }
}
