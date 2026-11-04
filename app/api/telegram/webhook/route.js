import { NextResponse } from "next/server";
import { importTelegramUpdate } from "@/lib/telegram-importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || !supplied || supplied.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const update = await request.json();
    const result = await importTelegramUpdate(update);
    if (!result.accepted && result.reason !== "no_video") {
      console.warn("[telegram-import] update skipped:", result.reason);
    }
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-import] update failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, error: "Import failed; Telegram may retry this update." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
