import { NextResponse } from "next/server";
import { searchLegalProvider } from "@/lib/legal-video-providers";

export const revalidate = 60;
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const provider = (params.get("provider") || "").toLowerCase();
  const query = params.get("q") || "";
  if (!["youtube", "vimeo", "dailymotion"].includes(provider)) {
    return NextResponse.json({ success: false, error: "Unsupported provider" }, { status: 400 });
  }
  if (!query.trim() || query.length > 120) {
    return NextResponse.json({ success: false, error: "Query must contain 1–120 characters" }, { status: 400 });
  }
  try {
    const result = await searchLegalProvider(provider, query);
    return NextResponse.json({ success: true, ...result }, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=60, stale-while-revalidate=120" }
    });
  } catch (error) {
    const message = error.message || "Provider request failed";
    const status = /not configured|pending/i.test(message) ? 503 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
