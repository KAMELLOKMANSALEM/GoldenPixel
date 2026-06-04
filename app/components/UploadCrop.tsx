"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/config";

type Rect = { x: number; y: number; w: number; h: number };

// Step 4 — Upload + crop. The crop box sits at the block's exact wall position so
// the artist sees the real result before paying. Returns crop rect in natural
// image pixels; the server does the actual extract/optimize/EXIF-strip.
export default function UploadCrop({
  rect,
  blockId,
  onUploaded,
  endpoint = "/api/apply/submit",
  extra,
  confirmLabel = "Use this crop",
  confirmDisabled = false,
}: {
  rect: Rect;
  blockId: string;
  onUploaded: (imageUrl: string) => void;
  endpoint?: string;
  extra?: Record<string, string>;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  const aspect = rect.w / rect.h;

  // Largest rect of the block's aspect that fits inside the source image.
  function baseCrop(w: number, h: number) {
    if (w / h > aspect) return { w: h * aspect, h }; // image wider than target
    return { w, h: w / aspect };
  }

  function clampCenter(cx: number, cy: number, cw: number, ch: number, w: number, h: number) {
    return {
      x: Math.min(w - cw / 2, Math.max(cw / 2, cx)),
      y: Math.min(h - ch / 2, Math.max(ch / 2, cy)),
    };
  }

  const cropRect = (() => {
    if (!nat || !center) return null;
    const base = baseCrop(nat.w, nat.h);
    const cw = base.w / zoom;
    const ch = base.h / zoom;
    const c = clampCenter(center.x, center.y, cw, ch, nat.w, nat.h);
    return { x: c.x - cw / 2, y: c.y - ch / 2, w: cw, h: ch };
  })();

  const acceptFile = useCallback((f: File) => {
    setErr(null);
    if (!ACCEPTED_MIME.includes(f.type as (typeof ACCEPTED_MIME)[number])) {
      setErr("Use a JPG, PNG, or WebP.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setErr("Image must be under 5 MB.");
      return;
    }
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      setNat({ w: im.naturalWidth, h: im.naturalHeight });
      setCenter({ x: im.naturalWidth / 2, y: im.naturalHeight / 2 });
      setZoom(1);
      setFile(f);
      setImgUrl(url);
    };
    im.src = url;
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!center) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, cx: center.x, cy: center.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !nat || !cropRect) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    // screen px -> natural px; dragging right reveals the left of the image
    const k = cropRect.w / rect.w;
    setCenter(
      clampCenter(
        drag.current.cx - dx * k,
        drag.current.cy - dy * (cropRect.h / rect.h),
        cropRect.w,
        cropRect.h,
        nat.w,
        nat.h
      )
    );
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    if (!file || !cropRect) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("blockId", blockId);
    fd.append("cropX", String(Math.round(cropRect.x)));
    fd.append("cropY", String(Math.round(cropRect.y)));
    fd.append("cropW", String(Math.round(cropRect.w)));
    fd.append("cropH", String(Math.round(cropRect.h)));
    if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    try {
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 422) {
        setErr(data.error || "This image can't be published.");
        setBusy(false);
        return;
      }
      if (!res.ok || !data.imageUrl) throw new Error(data.error || "Upload failed");
      onUploaded(data.imageUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  // Preview transform: scale the source so the crop region exactly fills rect.
  const previewStyle: React.CSSProperties | null =
    imgUrl && nat && cropRect
      ? {
          position: "absolute",
          width: rect.w * (nat.w / cropRect.w),
          height: rect.h * (nat.h / cropRect.h),
          left: -cropRect.x * (rect.w / cropRect.w),
          top: -cropRect.y * (rect.h / cropRect.h),
          userSelect: "none",
          pointerEvents: "none",
          maxWidth: "none",
        }
      : null;

  return (
    <>
      {/* The crop box, positioned at the block's real wall location. */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          overflow: "hidden",
          outline: "1px solid var(--gold)",
          cursor: imgUrl ? "grab" : "pointer",
          background: "rgba(217,178,91,0.06)",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {previewStyle && imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="" style={previewStyle} draggable={false} />
        ) : (
          <div
            className="label"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 8,
              color: "var(--gold)",
            }}
          >
            Drop art here
          </div>
        )}
      </div>

      {/* Controls float just below the block. */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y + rect.h + 12,
          width: Math.max(rect.w, 220),
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "var(--canvas)",
          border: "1px solid var(--line)",
          padding: 14,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) acceptFile(f);
        }}
      >
        <label className="btn-ghost" style={{ textAlign: "center", cursor: "pointer" }}>
          {file ? "Replace image" : "Choose image"}
          <input
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
            }}
          />
        </label>

        {imgUrl && (
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="label">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "var(--gold)" }}
            />
          </label>
        )}

        {imgUrl && (
          <button className="btn-gold" onClick={confirm} disabled={busy || confirmDisabled}>
            {busy ? "Uploading…" : confirmLabel}
          </button>
        )}

        {err && (
          <p className="muted" style={{ fontSize: "0.72rem", color: "#c98b8b", margin: 0 }}>
            {err}
          </p>
        )}
        <p className="label" style={{ margin: 0, lineHeight: 1.5 }}>
          No hate, sexual, illegal, or impersonating content. By uploading you agree your square may
          be removed for violations.
        </p>
      </div>
    </>
  );
}
