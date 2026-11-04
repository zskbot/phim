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
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (!expected || expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let update;
  try { update = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  const post = toTelegramPreviewPost(update);
  if (!post) return NextResponse.json({ ok: true, ignored: true });
  try {
    const store = getTelegramPreviewStore();
    const current = await store.get("posts-index", { type: "json" });
    const posts = Array.isArray(current) ? current : [];
    const next = [post, ...posts.filter(item => item.messageId !== post.messageId)].slice(0, 200);
    await store.setJSON("posts-index", next);
    return NextResponse.json({ ok: true, stored: true, messageId: post.messageId });
  } catch (error) {
    console.error("[telegram-webhook]", error);
    return NextResponse.json({ ok: false, error: "Preview storage unavailable" }, { status: 503 });
  }
}
