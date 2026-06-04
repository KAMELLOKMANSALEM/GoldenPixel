import { NextRequest, NextResponse } from "next/server";
import { getBlockRaw } from "@/lib/blocks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/tokens";
import { MAX_CAPTION_LEN } from "@/lib/config";

export const dynamic = "force-dynamic";

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// Owner edit (magic-link). Updates caption + link only. Position and size are fixed.
export async function POST(req: NextRequest) {
  let body: { blockId?: string; token?: string; caption?: string; linkUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { blockId, token } = body;
  if (!blockId || !token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const block = await getBlockRaw(blockId);
  if (!block || !block.edit_token || !safeEqual(token, block.edit_token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const caption = (body.caption || "").slice(0, MAX_CAPTION_LEN).trim();
  const linkUrl = (body.linkUrl || "").trim();
  if (linkUrl && !isValidUrl(linkUrl)) {
    return NextResponse.json({ error: "invalid link" }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("blocks")
    .update({ caption: caption || null, link_url: linkUrl || null })
    .eq("id", blockId);
  if (error) return NextResponse.json({ error: "update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
