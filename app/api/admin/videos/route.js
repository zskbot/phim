import { NextResponse } from "next/server";
import { createCatalogItem, isAdminAuthorized, listCatalog, validateVideoInput } from "@/lib/admin-cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(error) {
  const message = error instanceof Error ? error.message : "CMS service unavailable.";
  const status = message.includes("not configured") ? 503 : 502;
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const results = await listCatalog();
    return NextResponse.json({ success: true, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const validated = validateVideoInput(body);
    if (validated.error) return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    const result = await createCatalogItem(validated.data);
    return NextResponse.json({ success: true, result: result?.[0] || null }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
