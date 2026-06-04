import { NextRequest, NextResponse } from "next/server";
import { verifyAccess } from "@/lib/applications";

export const dynamic = "force-dynamic";

// Token-protected status poll for the funnel (post-payment redirect + waiting screen).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("token");
  if (!id || !token) return NextResponse.json({ error: "missing" }, { status: 400 });

  const app = await verifyAccess(id, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    status: app.status,
    size: app.size,
    shape: app.shape,
    imageUrl: app.image_url,
    caption: app.caption,
  });
}
