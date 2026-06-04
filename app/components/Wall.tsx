"use client";

import WallCanvas from "./WallCanvas";
import type { PublicBlock } from "@/lib/types";

// Public, read-only wall. Browsing only — buying happens through the application
// funnel at /apply. Clicking a live square opens the artist's link.
export default function Wall({
  initialBlocks,
  cols,
  rows,
}: {
  initialBlocks: PublicBlock[];
  cols: number;
  rows: number;
}) {
  return (
    <section className="frame">
      <WallCanvas blocks={initialBlocks} cols={cols} rows={rows} mode="browse" />
    </section>
  );
}
