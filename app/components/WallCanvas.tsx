"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHAPES, type BlockShape } from "@/lib/config";
import { cellKey, cellsForPlacement, isPlacementValid } from "@/lib/grid";
import type { Cell, PublicBlock } from "@/lib/types";

// One canvas wall used in two modes:
//   'browse' — public wall; hover shows captions, click opens the artist's link.
//   'place'  — approved artist picks a spot; ghost preview + click to claim.
export default function WallCanvas({
  blocks,
  cols,
  rows,
  mode,
  shape,
  occupied,
  busy,
  onPlace,
}: {
  blocks: PublicBlock[];
  cols: number;
  rows: number;
  mode: "browse" | "place";
  shape?: BlockShape;
  occupied?: Cell[];
  busy?: boolean;
  onPlace?: (row: number, col: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const [cellSize, setCellSize] = useState(12);
  const [ghost, setGhost] = useState<{ row: number; col: number; valid: boolean } | null>(null);
  const [hover, setHover] = useState<{ block: PublicBlock; x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);

  const wallW = cellSize * cols;
  const wallH = cellSize * rows;

  const occupiedSet = useMemo(
    () => new Set((occupied || []).map((c) => cellKey(c.row, c.col))),
    [occupied]
  );

  const cellToBlock = useMemo(() => {
    const m = new Map<string, PublicBlock>();
    for (const b of blocks) for (const c of b.squares) m.set(cellKey(c.row, c.col), b);
    return m;
  }, [blocks]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setCellSize(Math.max(5, Math.floor(el.clientWidth / cols)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols]);

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

    if (mode === "place" && ghost && shape) {
      const { w, h } = SHAPES[shape];
      const x = ghost.col * cellSize;
      const y = ghost.row * cellSize;
      ctx.fillStyle = ghost.valid ? "rgba(217,178,91,0.28)" : "rgba(196,80,80,0.30)";
      ctx.fillRect(x, y, w * cellSize, h * cellSize);
      ctx.strokeStyle = ghost.valid ? "#d9b25b" : "#c45050";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w * cellSize - 1.5, h * cellSize - 1.5);
    }
  }, [blocks, cellSize, wallW, wallH, cols, rows, ghost, mode, shape, getImage, tick]);

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
    const cell = cellFromEvent(e);
    if (!cell) {
      setGhost(null);
      setHover(null);
      return;
    }
    if (mode === "place" && shape) {
      setGhost({
        row: cell.row,
        col: cell.col,
        valid: isPlacementValid(cell.row, cell.col, shape, occupiedSet),
      });
    } else {
      const b = cellToBlock.get(cellKey(cell.row, cell.col));
      if (b && b.status === "live" && (b.caption || b.linkUrl)) {
        const cont = containerRef.current?.getBoundingClientRect();
        setHover({ block: b, x: e.clientX - (cont?.left ?? 0), y: e.clientY - (cont?.top ?? 0) });
      } else setHover(null);
    }
  }

  function onClick(e: React.MouseEvent) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (mode === "place" && shape && onPlace && !busy) {
      if (isPlacementValid(cell.row, cell.col, shape, occupiedSet)) onPlace(cell.row, cell.col);
    } else if (mode === "browse") {
      const b = cellToBlock.get(cellKey(cell.row, cell.col));
      if (b && b.status === "live" && b.linkUrl)
        window.open(b.linkUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", userSelect: "none" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: wallW,
          height: wallH,
          display: "block",
          cursor: mode === "place" ? "crosshair" : "default",
        }}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setGhost(null);
          setHover(null);
        }}
        onClick={onClick}
      />
      {hover && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hover.x + 14, wallW - 200),
            top: hover.y + 14,
            maxWidth: 220,
            padding: "8px 10px",
            background: "var(--scrim)",
            color: "var(--ink)",
            pointerEvents: "none",
            fontSize: "0.78rem",
          }}
        >
          {hover.block.caption && <div>{hover.block.caption}</div>}
          {hover.block.linkUrl && (
            <div className="muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
              {new URL(hover.block.linkUrl).hostname}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
