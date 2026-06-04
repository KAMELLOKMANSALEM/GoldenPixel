import { NextRequest, NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminAuth";
import { approveSubmission } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { applicationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.applicationId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const ok = await approveSubmission(body.applicationId, admin);
  if (!ok) return NextResponse.json({ error: "not in a reviewable state" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
