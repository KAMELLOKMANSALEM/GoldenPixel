import { NextRequest, NextResponse } from "next/server";
import { createApplication } from "@/lib/applications";
import {
  SHAPES,
  SHAPES_FOR_SIZE,
  priceCentsForSize,
  type BlockShape,
  type BlockSize,
} from "@/lib/config";

export const dynamic = "force-dynamic";

// Create an application from the survey answers + chosen size/shape. Returns the
// id + access token so the client can drive payment and later return via magic link.
export async function POST(req: NextRequest) {
  let body: {
    survey?: Record<string, unknown>;
    size?: number;
    shape?: string;
    email?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const size = body.size as BlockSize;
  const shape = body.shape as BlockShape;
  if (![1, 2, 4, 9].includes(size) || !shape || !(shape in SHAPES)) {
    return NextResponse.json({ error: "invalid size/shape" }, { status: 400 });
  }
  if (!SHAPES_FOR_SIZE[size].includes(shape)) {
    return NextResponse.json({ error: "invalid shape for size" }, { status: 400 });
  }

  const email = (body.email || "").trim() || null;

  const { id, token } = await createApplication({
    email,
    survey: body.survey || {},
    size,
    shape,
    amountCents: priceCentsForSize(size),
  });

  return NextResponse.json({ id, token });
}
