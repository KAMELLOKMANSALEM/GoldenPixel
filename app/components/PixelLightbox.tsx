"use client";

import { useEffect, useState } from "react";
import { SHAPES } from "@/lib/config";
import type { PublicBlock } from "@/lib/types";

// Clicking a live square opens this: the artwork enlarges, with an "About the
// work" tab on the side. Clicking it slides right to the artist profile; a back
// arrow returns to the work; the X (top-center) closes everything.
export default function PixelLightbox({
  block,
  onClose,
  initialView = "art",
}: {
  block: PublicBlock;
  onClose: () => void;
  initialView?: "art" | "about";
}) {
  const [view, setView] = useState<"art" | "about">(initialView);
  const p = block.profile;
  const { w, h } = SHAPES[block.shape];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setView("art");
      if (e.key === "ArrowRight") setView("about");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = (p?.artist || "")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(10,10,11,0.94)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5vh 4vw",
      }}
    >
      {/* X — center top — cancels. */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="lb-x"
        style={{ position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)", zIndex: 90 }}
      >
        ✕
      </button>

      <div
        className="lb-stage"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(960px, 92vw)", overflow: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            width: "200%",
            transform: view === "about" ? "translateX(-50%)" : "translateX(0)",
            transition: "transform 460ms var(--ease)",
          }}
        >
          {/* Panel 1 — the work */}
          <div style={{ width: "50%", flexShrink: 0, position: "relative" }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${w} / ${h}`,
                maxHeight: "72vh",
                margin: "0 auto",
                background: "#141416",
              }}
            >
              {block.cellImages && block.cellImages.length ? (
                // Assembled mosaic — each cell image in its position.
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    gridTemplateColumns: `repeat(${w}, 1fr)`,
                    gridTemplateRows: `repeat(${h}, 1fr)`,
                  }}
                >
                  {block.cellImages.map((u, i) =>
                    u ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div key={i} style={{ background: "#141416" }} />
                    )
                  )}
                </div>
              ) : block.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.imageUrl}
                  alt={block.caption || "Artwork"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : null}

              {/* About-the-work tab, on the right edge. */}
              <button className="lb-tab" onClick={() => setView("about")}>
                About the work →
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
                marginTop: "0.9rem",
                flexWrap: "wrap",
              }}
            >
              <span className="serif" style={{ fontSize: "1.1rem" }}>
                {block.caption || p?.artist || "Untitled"}
              </span>
              {block.linkUrl && (
                <a
                  href={block.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label"
                  style={{ color: "var(--gold)" }}
                >
                  Visit site →
                </a>
              )}
            </div>
          </div>

          {/* Panel 2 — the artist */}
          <div style={{ width: "50%", flexShrink: 0, paddingLeft: "clamp(1.5rem, 5vw, 4rem)" }}>
            <button className="lb-back" onClick={() => setView("art")}>
              ← Back to the work
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.4rem 0" }}>
              {p?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatarUrl}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontFamily: "var(--font-serif), serif",
                    fontSize: "1.4rem",
                  }}
                >
                  {initials || "—"}
                </span>
              )}
              <div>
                <div className="label">Artist</div>
                <div className="serif" style={{ fontSize: "1.6rem" }}>
                  {p?.artist || "Anonymous"}
                </div>
              </div>
            </div>

            {p?.bio && (
              <>
                <div className="label" style={{ marginBottom: "0.5rem" }}>
                  Biography
                </div>
                <p className="muted" style={{ lineHeight: 1.8, marginBottom: "1.6rem", maxWidth: 460 }}>
                  {p.bio}
                </p>
              </>
            )}

            {p?.about && (
              <>
                <div className="label" style={{ marginBottom: "0.5rem" }}>
                  About the work
                </div>
                <p className="muted" style={{ lineHeight: 1.8, maxWidth: 460 }}>
                  {p.about}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
