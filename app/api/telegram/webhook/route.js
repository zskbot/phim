import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/telegram-public-feed";
import { getTelegramPreviewStore, isTxtopDeployPreview, toTelegramPreviewPost } from "@/lib/telegram-preview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isTxtopDeployPreview()) {
    return NextResponse.json({ ok: false, error: "Preview only" }, { status: 404 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const expected = token ? getTelegramWebhookSecret(token) : "";
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const store = getTelegramPreviewStore();
    const post = toTelegramPreviewPost(update);
    if (!post) return NextResponse.json({ ok: true, ignored: true });

    // A video posted in a group/channel where the bot is present becomes
    // an active public source automatically; no manual source registration.
    const currentSources = await store.get("sources-index", { type: "json" });
    const sources = Array.isArray(currentSources) ? currentSources : [];
    if (!sources.some(item => item?.channel === post.channel)) {
      sources.push({
        channel: post.channel,
        url: `https://t.me/${post.channel}`,
        chatType: post.chatType,
        addedAt: new Date().toISOString(),
        status: "active",
        discoveredBy: "telegram-webhook"
      });
      await store.setJSON("sources-index", sources.slice(-100));
    }

    const current = await store.get("posts-index", { type: "json" });
    const posts = Array.isArray(current) ? current : [];
    const key = `${post.channel}:${post.messageId}`;
    const next = [post, ...posts.filter(item => `${item.channel}:${item.messageId}` !== key)].slice(0, 500);
    await store.setJSON("posts-index", next);

    return NextResponse.json({
      ok: true,
      stored: true,
      discoveredSource: post.channel,
      chatType: post.chatType,
      messageId: post.messageId
    });
  } catch (error) {
    console.error("[telegram-webhook]", error);
    return NextResponse.json({ ok: false, error: "Preview storage unavailable" }, { status: 503 });
  }
}
