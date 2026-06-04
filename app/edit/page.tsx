import { getBlockRaw } from "@/lib/blocks";
import { safeEqual } from "@/lib/tokens";
import EditView from "./EditView";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Magic-link owner edit. Access is the per-block edit token from the receipt email.
export default async function EditPage({
  searchParams,
}: {
  searchParams: Promise<{ block?: string; token?: string }>;
}) {
  const { block: blockId, token } = await searchParams;

  let ok = false;
  let data: {
    id: string;
    shape: string;
    imageUrl: string | null;
    cellImages: (string | null)[] | null;
    caption: string | null;
    linkUrl: string | null;
  } | null = null;

  if (blockId && token) {
    const b = await getBlockRaw(blockId);
    if (b && b.edit_token && safeEqual(token, b.edit_token) && b.state === "sold") {
      ok = true;
      data = {
        id: b.id,
        shape: b.shape,
        imageUrl: b.image_url,
        cellImages: b.cell_images,
        caption: b.caption,
        linkUrl: b.link_url,
      };
    }
  }

  return (
    <main className="frame" style={{ paddingTop: "3rem", paddingBottom: "4rem", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2.5rem" }}>
        <span style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
        <span className="wordmark" style={{ fontSize: "1.4rem" }}>
          GoldenPixel
        </span>
      </div>

      {ok && data ? (
        <EditView block={data} token={token!} />
      ) : (
        <div>
          <h1 className="display" style={{ fontSize: "2rem" }}>
            This link isn&apos;t valid
          </h1>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Edit links are private and don&apos;t expire — check your receipt email for the latest one.
          </p>
          <Link href="/" className="btn-ghost" style={{ marginTop: "1.5rem", display: "inline-block" }}>
            Back to the wall
          </Link>
        </div>
      )}
    </main>
  );
}
