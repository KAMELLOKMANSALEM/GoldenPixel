import { NextRequest } from "next/server";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Serve a stored object (all uploads are webp) from Replit Object Storage.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  const bytes = await getObject(path);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
