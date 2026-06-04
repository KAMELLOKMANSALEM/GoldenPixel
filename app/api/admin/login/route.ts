import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail, signAdmin } from "@/lib/tokens";
import { sendAdminMagicLink } from "@/lib/email";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

// Request an admin magic link. Always returns ok so we don't reveal who is an admin.
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (email && isAdminEmail(email)) {
    const token = signAdmin(email);
    const url = `${siteUrl()}/api/admin/session?token=${encodeURIComponent(token)}`;
    await sendAdminMagicLink({ to: email, url });
  }
  return NextResponse.json({ ok: true });
}
