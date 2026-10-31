import { NextResponse } from "next/server";
import { isAdminAuthorized, updateCatalogStatus } from "@/lib/admin-cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (!["approved", "published", "rejected", "archived"].includes(body.status)) {
      return NextResponse.json({ success: false, error: "Unsupported status transition." }, { status: 400 });
    }
    const result = await updateCatalogStatus(id, body.status);
    if (!result) return NextResponse.json({ success: false, error: "Content not found." }, { status: 404 });
    return NextResponse.json({ success: true, result: result[0] || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CMS update failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
