import { NextResponse } from "next/server";
import { fetchPublicTelegramVideos, normalizeTelegramPublicLink } from "@/lib/telegram-public-feed";
import { getTelegramPreviewStore, isTxtopDeployPreview } from "@/lib/telegram-preview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function previewOnly() {
  return isTxtopDeployPreview();
}
function denied() {
  return NextResponse.json({ success: false, error: "Preview only" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
async function readSources(store) {
  const value = await store.get("sources-index", { type: "json" });
  return Array.isArray(value) ? value : [];
}

export async function GET() {
  if (!previewOnly()) return denied();
  try {
    const store = getTelegramPreviewStore();
    const sources = await readSources(store);
    if (!sources.some(item => item.channel === "txtop18")) sources.unshift({ channel: "txtop18", url: "https://t.me/txtop18", default: true });
    return NextResponse.json({ success: true, sources }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-sources]", error);
    return NextResponse.json({ success: false, error: "Preview source storage unavailable" }, { status: 503 });
  }
}

export async function POST(request) {
  if (!previewOnly()) return denied();
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
    if (!normalized) return NextResponse.json({ success: false, error: "Chỉ nhận link Telegram công khai dạng https://t.me/ten_nguon." }, { status: 400 });
    if (sources.some(item => item.channel === normalized.channel)) {
      return NextResponse.json({ success: true, duplicate: true, sources });
    }
    if (sources.length >= 10) return NextResponse.json({ success: false, error: "Preview chỉ hỗ trợ tối đa 10 nguồn." }, { status: 429 });
    const next = [...sources, { ...normalized, addedAt: new Date().toISOString(), status: "active" }];
    await store.setJSON("sources-index", next);
    return NextResponse.json({ success: true, sources: next }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-sources]", error);
    return NextResponse.json({ success: false, error: "Không thể cập nhật nguồn trên Preview." }, { status: 503 });
  }
}

export async function DELETE(request) {
  if (!previewOnly()) return denied();
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
