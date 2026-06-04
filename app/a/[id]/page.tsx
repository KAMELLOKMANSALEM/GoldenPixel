import Link from "next/link";
import { verifyAccess } from "@/lib/applications";
import { getWallBlocks, getOccupiedCells } from "@/lib/blocks";
import ApplicationFlow from "../ApplicationFlow";
import type { BlockShape, BlockSize } from "@/lib/config";

export const dynamic = "force-dynamic";

// Magic-link hub for an application. Everything post-payment happens here:
// submit -> wait -> (approved) choose square -> live. Access requires the token.
export default async function ApplicationHub({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  const app = token ? await verifyAccess(id, token) : null;

  if (!app || !token) {
    return (
      <main className="frame" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520 }}>
        <h1 className="display" style={{ fontSize: "2rem" }}>
          This link isn&apos;t valid
        </h1>
        <p className="muted" style={{ marginTop: "0.8rem" }}>
          Check your email for the latest link to your application.
        </p>
        <Link href="/" className="btn-ghost" style={{ marginTop: "1.5rem", display: "inline-block", width: "fit-content" }}>
          Back to the wall
        </Link>
      </main>
    );
  }

  // Only load wall context when it's needed (placement step).
  let blocks = [] as Awaited<ReturnType<typeof getWallBlocks>>;
  let occupied = [] as Awaited<ReturnType<typeof getOccupiedCells>>;
  if (app.status === "approved") {
    try {
      [blocks, occupied] = await Promise.all([getWallBlocks(), getOccupiedCells()]);
    } catch (e) {
      console.error("wall context unavailable", e);
    }
  }

  return (
    <ApplicationFlow
      id={app.id}
      token={token}
      initialStatus={app.status}
      shape={app.shape as BlockShape}
      size={app.size as BlockSize}
      imageUrl={app.image_url}
      email={app.email}
      blocks={blocks}
      occupied={occupied}
    />
  );
}
