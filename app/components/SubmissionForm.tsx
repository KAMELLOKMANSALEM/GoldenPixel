"use client";

import { useState } from "react";
import { SHAPES, MAX_CAPTION_LEN, type BlockShape } from "@/lib/config";
import { isValidUrl } from "./CaptionLink";
import UploadCrop from "./UploadCrop";

// Submission step — the "simulation module". The block is shown as a grid that
// mirrors its real shape; the artist clicks each square and uploads the image for
// that exact position. One image per cell; assembled, they are the artwork.
export default function SubmissionForm({
  applicationId,
  token,
  shape,
  defaultEmail,
  onSubmitted,
}: {
  applicationId: string;
  token: string;
  shape: BlockShape;
  defaultEmail?: string;
  onSubmitted: () => void;
}) {
  const { w, h } = SHAPES[shape];
  const total = w * h;

  const [cells, setCells] = useState<(string | null)[]>(() => Array(total).fill(null));
  const [active, setActive] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const CELL = Math.min(300, Math.round(340 / Math.max(w, h)));
  const CROP = 340;

  const allFilled = cells.every((c) => !!c);
  const linkOk = isValidUrl(link);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = allFilled && linkOk && emailOk && !busy;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/apply/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          token,
          caption: caption.trim(),
          linkUrl: link.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit");
      onSubmitted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit");
      setBusy(false);
    }
  }

  return (
    <div
      className="frame"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 920 }}
    >
      <span className="label" style={{ marginBottom: "0.6rem" }}>
        Your submission
      </span>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", marginBottom: "0.8rem" }}>
        {total === 1 ? "Submit your work for review" : "Build your block, square by square"}
      </h1>
      <p className="muted" style={{ marginBottom: "2rem", maxWidth: 520, lineHeight: 1.7 }}>
        {total === 1
          ? "Upload your artwork and crop it to the square."
          : `Your block is ${w} × ${h}. Click each square and upload the image that belongs in that position. Together they become your piece.`}
      </p>

      <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* The simulation grid — a live mosaic preview as it fills. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${w}, ${CELL}px)`,
            gridAutoRows: `${CELL}px`,
            gap: 6,
          }}
        >
          {cells.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: CELL,
                height: CELL,
                padding: 0,
                cursor: "pointer",
                border: url ? "1px solid var(--line)" : "1px dashed #3a382f",
                background: url ? "transparent" : "rgba(217,178,91,0.04)",
                overflow: "hidden",
                position: "relative",
              }}
              aria-label={`Square ${i + 1}`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span className="label" style={{ color: "var(--gold)" }}>
                  +
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Caption + link + email + submit */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1, minWidth: 280, maxWidth: 360 }}>
          <div className="label">
            {cells.filter(Boolean).length} / {total} squares filled
          </div>
          <div>
            <label className="label" htmlFor="s-cap">Caption</label>
            <input id="s-cap" className="field" maxLength={MAX_CAPTION_LEN} value={caption}
              placeholder="Optional, ≤40 characters"
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))} />
          </div>
          <div>
            <label className="label" htmlFor="s-link">Link</label>
            <input id="s-link" className="field" value={link} inputMode="url"
              placeholder="where your square points"
              onChange={(e) => setLink(e.target.value)} />
            {link && !linkOk && (
              <div className="muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>Enter a valid web address.</div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="s-email">Email</label>
            <input id="s-email" className="field" type="email" value={email}
              placeholder="for your review decision"
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          <button className="btn-gold" disabled={!ready} onClick={submit}>
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          {!allFilled && (
            <p className="label" style={{ margin: 0 }}>Fill every square to submit.</p>
          )}
          {err && <p className="muted" style={{ fontSize: "0.72rem", color: "#c98b8b", margin: 0 }}>{err}</p>}
          <p className="label" style={{ lineHeight: 1.6, margin: 0 }}>
            Our team reviews every square. If it isn&apos;t approved, you&apos;re refunded in full.
          </p>
        </div>
      </div>

      {/* Per-cell crop modal */}
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
              Square {active + 1} of {total}
            </div>
            <UploadCrop
              key={active}
              rect={{ x: 0, y: 38, w: CROP, h: CROP }}
              blockId={applicationId}
              endpoint="/api/apply/submit-cell"
              extra={{ applicationId, token, cellIndex: String(active) }}
              confirmLabel="Use this image"
              onUploaded={(url) => {
                setCells((prev) => {
                  const nx = [...prev];
                  nx[active] = url;
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
