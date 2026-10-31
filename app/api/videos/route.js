import { NextResponse } from "next/server";
import { getVideoFeed } from "@/lib/video-provider";

export const revalidate = 60;
export async function GET(request) {
  try {
    const { results, source } = await getVideoFeed();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const result = results.find(video => video.id === id);
      if (!result) return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
      return NextResponse.json({ success: true, result, source }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    }
    return NextResponse.json({ success: true, results, source, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[videos-api]", error);
    return NextResponse.json({ success: false, error: "Video feed is temporarily unavailable" }, { status: 502 });
  }
}