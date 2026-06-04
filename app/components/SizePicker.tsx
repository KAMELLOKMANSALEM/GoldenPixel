"use client";

import { useState } from "react";
import { SHAPES_FOR_SIZE, dollarsForSize, type BlockSize, type BlockShape } from "@/lib/config";

const SIZES: BlockSize[] = [1, 2, 4, 9];

export default function SizePicker({
  active,
  onPick,
}: {
  active: { size: BlockSize; shape: BlockShape } | null;
  onPick: (size: BlockSize, shape: BlockShape) => void;
}) {
  // Local shape choice for size 2 (tall vs wide); other sizes are fixed.
  const [twoShape, setTwoShape] = useState<BlockShape>("2x1");

  function pick(size: BlockSize) {
    const shape = size === 2 ? twoShape : SHAPES_FOR_SIZE[size][0];
    onPick(size, shape);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        {SIZES.map((size) => {
          const isActive = active?.size === size;
          return (
            <button
              key={size}
              className="btn-ghost"
              aria-pressed={isActive}
              onClick={() => pick(size)}
              style={{ minWidth: 84, display: "flex", flexDirection: "column", gap: 4, padding: "0.7rem 1rem" }}
            >
              <span style={{ letterSpacing: "0.08em", fontWeight: 600 }}>
                {size === 1 ? "1 square" : `${size} squares`}
              </span>
              <span className="muted" style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                ${dollarsForSize(size)}
              </span>
            </button>
          );
        })}
      </div>

      {active?.size === 2 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="label">Shape</span>
          <button
            className="btn-ghost"
            aria-pressed={active.shape === "1x2"}
            onClick={() => {
              setTwoShape("1x2");
              onPick(2, "1x2");
            }}
            style={{ padding: "0.5rem 1rem" }}
          >
            Tall
          </button>
          <button
            className="btn-ghost"
            aria-pressed={active.shape === "2x1"}
            onClick={() => {
              setTwoShape("2x1");
              onPick(2, "2x1");
            }}
            style={{ padding: "0.5rem 1rem" }}
          >
            Wide
          </button>
        </div>
      )}
    </div>
  );
}
