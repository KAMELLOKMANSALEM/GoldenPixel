"use client";

import { useState } from "react";
import { SHAPES, MAX_CAPTION_LEN, type BlockShape } from "@/lib/config";
import { isValidUrl, normalizeUrl } from "../components/CaptionLink";
import UploadCrop from "../components/UploadCrop";

export default function EditView({
  block,
  token,
}: {
  block: {
    id: string;
    shape: string;
    imageUrl: string | null;
    cellImages: (string | null)[] | null;
    caption: string | null;
    linkUrl: string | null;
  };
  token: string;
}) {
  const shape = block.shape as BlockShape;
  const { w, h } = SHAPES[shape];
  const total = w * h;

  // Seed the grid from existing cell images (fall back to a single image in cell 0).
  const [cells, setCells] = useState<(string | null)[]>(() => {
    const arr: (string | null)[] = block.cellImages ? [...block.cellImages] : [];
    while (arr.length < total) arr.push(null);
    if (!block.cellImages && block.imageUrl) arr[0] = block.imageUrl;
    return arr;
  });
  const [active, setActive] = useState<number | null>(null);
  const [caption, setCaption] = useState(block.caption || "");
  const [link, setLink] = useState(block.linkUrl || "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const CELL = Math.min(280, Math.round(320 / Math.max(w, h)));
  const CROP = 340;
  const linkOk = !link || isValidUrl(link);

  async function saveDetails() {
    setSaving(true);
    setSavedAt(null);
    const res = await fetch("/api/edit/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: block.id,
        token,
        caption: caption.trim(),
        linkUrl: link ? normalizeUrl(link) : "",
      }),
    });
    setSaving(false);
    setSavedAt(res.ok ? "Saved" : "Could not save");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div>
        <span className="label">Your square</span>
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: 6 }}>
          Position and size are fixed.{" "}
          {total > 1 ? "Click any square to swap its image." : "Swap the image or change the link any time."}
        </p>
      </div>

      {/* Per-cell image grid */}
      <div>
        <span className="label">{total > 1 ? "Images" : "Image"}</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${w}, ${CELL}px)`,
            gridAutoRows: `${CELL}px`,
            gap: 6,
            marginTop: 12,
          }}
        >
          {cells.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Swap square ${i + 1}`}
              style={{
                width: CELL,
                height: CELL,
                padding: 0,
                cursor: "pointer",
                border: "1px solid var(--line)",
                background: "#141416",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span className="label" style={{ color: "var(--gold)" }}>+</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Caption + link */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", maxWidth: 360 }}>
        <div>
          <label className="label" htmlFor="cap">Caption</label>
          <input
            id="cap"
            className="field"
            maxLength={MAX_CAPTION_LEN}
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
          />
        </div>
        <div>
          <label className="label" htmlFor="lnk">Link</label>
          <input id="lnk" className="field" value={link} onChange={(e) => setLink(e.target.value)} />
          {!linkOk && (
            <div className="muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>Enter a valid web address.</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button className="btn-gold" onClick={saveDetails} disabled={saving || !linkOk}>
            {saving ? "Saving…" : "Save"}
          </button>
          {savedAt && <span className="label">{savedAt}</span>}
        </div>
      </div>

      {/* Per-cell swap modal */}
      {active !== null && (
        <div
          onClick={() => setActive(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(10,10,11,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4vh 4vw",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: CROP, minHeight: CROP + 240 }}>
            <div className="label" style={{ marginBottom: "0.8rem" }}>
              {total > 1 ? `Swap square ${active + 1} of ${total}` : "Swap image"}
            </div>
            <UploadCrop
              key={active}
              rect={{ x: 0, y: 38, w: CROP, h: CROP }}
              blockId={block.id}
              endpoint="/api/edit/upload-cell"
              extra={{ blockId: block.id, token, cellIndex: String(active) }}
              confirmLabel="Save image"
              onUploaded={(url) => {
                const busted = `${url}?t=${Date.now()}`;
                setCells((prev) => {
                  const nx = [...prev];
                  nx[active] = busted;
                  return nx;
                });
                setActive(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
