import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/telegram-public-feed";
import { getTelegramPreviewStore, toTelegramPreviewPost } from "@/lib/telegram-preview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (process.env.CONTEXT !== "deploy-preview" || !process.env.NETLIFY) {
    return NextResponse.json({ ok: false, error: "Preview only" }, { status: 404 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const expected = token ? getTelegramWebhookSecret(token) : "";
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401 });
  let update;
  try { update = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  try {
    const store = getTelegramPreviewStore();
    const sources = await store.get("sources-index", { type: "json" });
    const channels = [...new Set(["txtop18", ...(Array.isArray(sources) ? sources.map(item => item?.channel) : [])].filter(Boolean))];
    const post = toTelegramPreviewPost(update, channels);
    if (!post) return NextResponse.json({ ok: true, ignored: true });
    const current = await store.get("posts-index", { type: "json" });
    const posts = Array.isArray(current) ? current : [];
    const key = `${post.channel}:${post.messageId}`;
    const next = [post, ...posts.filter(item => `${item.channel}:${item.messageId}` !== key)].slice(0, 300);
    await store.setJSON("posts-index", next);
    return NextResponse.json({ ok: true, stored: true, channel: post.channel, messageId: post.messageId });
  } catch (error) {
    console.error("[telegram-webhook]", error);
    return NextResponse.json({ ok: false, error: "Preview storage unavailable" }, { status: 503 });
  }
}
