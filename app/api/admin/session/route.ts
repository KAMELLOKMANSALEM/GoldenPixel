import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, isAdminEmail } from "@/lib/tokens";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

// Magic-link landing — verifies the token and sets an httpOnly session cookie.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const email = verifyAdmin(token);
  if (!email || !isAdminEmail(email)) {
    return NextResponse.redirect(`${siteUrl()}/admin/login?error=1`);
  }
  const res = NextResponse.redirect(`${siteUrl()}/admin`);
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
