"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHAPES } from "@/lib/config";
import { cellKey } from "@/lib/grid";
import type { PublicBlock } from "@/lib/types";
import PixelLightbox from "./PixelLightbox";

// The homepage wall: full-screen, taller-than-wide cells filling the viewport
// height, wider than the screen so it pans left/right. Move the mouse toward the
// left/right edge to glide the wall; wheel and drag also pan. Click a live square
// to open the artist's link.
export default function WallFullscreen({
  blocks,
  cols,
  rows,
}: {
  blocks: PublicBlock[];
  cols: number;
  rows: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const velRef = useRef(0);
  const dragRef = useRef<{ x: number; scroll: number } | null>(null);

  const [cellSize, setCellSize] = useState(16);
  const [hover, setHover] = useState<{ block: PublicBlock; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<PublicBlock | null>(null);
  const [tick, setTick] = useState(0);

  const wallW = cellSize * cols;
  const wallH = cellSize * rows;

  const cellToBlock = useMemo(() => {
    const m = new Map<string, PublicBlock>();
    for (const b of blocks) for (const c of b.squares) m.set(cellKey(c.row, c.col), b);
    return m;
  }, [blocks]);

  // Cell size fills the viewport height.
  useEffect(() => {
    const measure = () => setCellSize(Math.max(8, Math.floor(window.innerHeight / rows)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows]);

  // Start centered.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (wallW - el.clientWidth) / 2;
  }, [wallW]);

  // Edge-pan loop.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const el = scrollRef.current;
      if (el && velRef.current !== 0) el.scrollLeft += velRef.current;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const getImage = useCallback((url: string): HTMLImageElement | null => {
    const cache = imgCache.current;
    const hit = cache.get(url);
    if (hit) return hit.complete && hit.naturalWidth > 0 ? hit : null;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => setTick((t) => t + 1);
    im.src = url;
    cache.set(url, im);
    return null;
  }, []);

  // Draw (independent of scroll position — the canvas is the full wall).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cellSize === 0) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = wallW * dpr;
    canvas.height = wallH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, wallW, wallH);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      ctx.moveTo(c * cellSize + 0.5, 0);
      ctx.lineTo(c * cellSize + 0.5, wallH);
    }
    for (let r = 0; r <= rows; r++) {
      ctx.moveTo(0, r * cellSize + 0.5);
      ctx.lineTo(wallW, r * cellSize + 0.5);
    }
    ctx.stroke();

    for (const b of blocks) {
      const minRow = Math.min(...b.squares.map((s) => s.row));
      const minCol = Math.min(...b.squares.map((s) => s.col));
      const { w, h } = SHAPES[b.shape];
      const x = minCol * cellSize;
      const y = minRow * cellSize;
      const bw = w * cellSize;
      const bh = h * cellSize;
      if (b.status === "live") {
        const ci = b.cellImages;
        if (ci && ci.length) {
          // Assembled mosaic: one image per cell, drawn in its position.
          for (let i = 0; i < b.squares.length; i++) {
            const cell = b.squares[i];
            const cx = cell.col * cellSize;
            const cy = cell.row * cellSize;
            const url = ci[i];
            const im = url ? getImage(url) : null;
            if (im) ctx.drawImage(im, cx, cy, cellSize, cellSize);
            else {
              ctx.fillStyle = "#141416";
              ctx.fillRect(cx, cy, cellSize, cellSize);
            }
          }
        } else if (b.imageUrl) {
          const im = getImage(b.imageUrl);
          if (im) ctx.drawImage(im, x, y, bw, bh);
          else {
            ctx.fillStyle = "#141416";
            ctx.fillRect(x, y, bw, bh);
          }
        } else {
          ctx.fillStyle = "#141416";
          ctx.fillRect(x, y, bw, bh);
        }
      } else {
        ctx.fillStyle = b.status === "removed" ? "#0f0f10" : "#141416";
        ctx.fillRect(x, y, bw, bh);
      }
    }
  }, [blocks, cellSize, wallW, wallH, cols, rows, getImage, tick]);

  function cellFromEvent(e: React.MouseEvent): { row: number; col: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
    return { row, col };
  }

  function onMove(e: React.MouseEvent) {
    // Edge pan velocity.
    const w = window.innerWidth;
    const edge = Math.min(180, w * 0.16);
    const speed = 16;
    if (e.clientX < edge) velRef.current = -speed * (1 - e.clientX / edge);
    else if (e.clientX > w - edge) velRef.current = speed * (1 - (w - e.clientX) / edge);
    else velRef.current = 0;

    // Drag pan overrides edge pan.
    if (dragRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = dragRef.current.scroll - (e.clientX - dragRef.current.x);
      velRef.current = 0;
      setHover(null);
      return;
    }

    const cell = cellFromEvent(e);
    if (!cell) return setHover(null);
    const b = cellToBlock.get(cellKey(cell.row, cell.col));
    if (b && b.status === "live" && (b.caption || b.linkUrl)) {
      setHover({ block: b, x: e.clientX, y: e.clientY });
    } else setHover(null);
  }

  function onClick(e: React.MouseEvent) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    const b = cellToBlock.get(cellKey(cell.row, cell.col));
    if (b && b.status === "live") {
      setHover(null);
      setSelected(b); // enlarge → artwork + profile
    }
  }

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar"
      style={{
        position: "fixed",
        inset: 0,
        overflowX: "auto",
        overflowY: "hidden",
        background: "var(--canvas)",
        cursor: dragRef.current ? "grabbing" : "default",
      }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        velRef.current = 0;
        setHover(null);
      }}
      onWheel={(e) => {
        if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY + e.deltaX;
      }}
      onPointerDown={(e) => {
        dragRef.current = { x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 };
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: wallW, height: wallH, display: "block" }}
        onClick={onClick}
      />
      {hover && (
        <div
          style={{
            position: "fixed",
            left: Math.min(hover.x + 14, window.innerWidth - 220),
            top: hover.y + 14,
            maxWidth: 220,
            padding: "8px 10px",
            background: "var(--scrim)",
            color: "var(--ink)",
            pointerEvents: "none",
            fontSize: "0.78rem",
            zIndex: 20,
          }}
        >
          {hover.block.caption && <div>{hover.block.caption}</div>}
          {hover.block.profile?.artist && (
            <div className="muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
              {hover.block.profile.artist}
            </div>
          )}
        </div>
      )}

      {selected && <PixelLightbox block={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
