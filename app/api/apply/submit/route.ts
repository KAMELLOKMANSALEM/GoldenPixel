import { NextRequest, NextResponse } from "next/server";
import { verifyAccess, finalizeSubmission } from "@/lib/applications";
import { sendUnderReviewEmail, applicationUrlFor } from "@/lib/email";
import { SHAPES, MAX_CAPTION_LEN, type BlockShape } from "@/lib/config";
import { normalizeUrl } from "@/app/components/CaptionLink";

export const dynamic = "force-dynamic";

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// Finalize the submission. Cell images were uploaded individually via
// /api/apply/submit-cell; this sets caption/link/email and, once every cell is
// filled, moves the application to `submitted`.
export async function POST(req: NextRequest) {
  let body: {
    applicationId?: string;
    token?: string;
    caption?: string;
    linkUrl?: string;
    email?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const applicationId = body.applicationId || "";
  const token = body.token || "";
  const caption = (body.caption || "").slice(0, MAX_CAPTION_LEN).trim();
  const email = (body.email || "").trim();
  const linkUrl = body.linkUrl ? normalizeUrl(body.linkUrl) : "";

  if (!applicationId || !token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isValidUrl(linkUrl)) return NextResponse.json({ error: "Enter a valid link." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const app = await verifyAccess(applicationId, token);
  if (!app) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { w, h } = SHAPES[app.shape as BlockShape];
  const result = await finalizeSubmission(
    app.id,
    { caption: caption || null, linkUrl, email },
    w * h
  );
  if (!result.ok) {
    if (result.reason === "incomplete") {
      return NextResponse.json({ error: "Add an image to every square first." }, { status: 400 });
    }
    return NextResponse.json({ error: "not ready to submit" }, { status: 409 });
  }

  await sendUnderReviewEmail({ to: email, url: applicationUrlFor(app.id, token) });
  return NextResponse.json({ ok: true });
}
