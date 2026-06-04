"use client";

import { useState } from "react";
import WallCanvas from "../components/WallCanvas";
import { GRID, type BlockShape } from "@/lib/config";
import type { Cell, PublicBlock } from "@/lib/types";

// Final step for an approved artist — pick a spot and publish. Already paid, so
// there's no hold timer; the click publishes directly (race-guarded server-side).
export default function SelectSquare({
  applicationId,
  token,
  shape,
  blocks,
  initialOccupied,
  onPublished,
}: {
  applicationId: string;
  token: string;
  shape: BlockShape;
  blocks: PublicBlock[];
  initialOccupied: Cell[];
  onPublished: () => void;
}) {
  const [occupied, setOccupied] = useState<Cell[]>(initialOccupied);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshOccupied() {
    try {
      const res = await fetch("/api/occupied", { cache: "no-store" });
      const data = await res.json();
      setOccupied(data.cells as Cell[]);
    } catch {
      /* keep */
    }
  }

  async function place(row: number, col: number) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, token, row, col }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setMsg("That spot was just taken — pick another.");
        await refreshOccupied();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not place your square");
      onPublished();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not place your square");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="frame" style={{ padding: "1.6rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
          <span className="wordmark" style={{ fontSize: "1.4rem" }}>
            GoldenPixel
          </span>
        </div>
      </header>

      <div className="frame" style={{ marginBottom: "1rem", textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
          Choose your square
        </h1>
        <p className="label" style={{ marginTop: 8 }}>
          {busy ? "Publishing…" : "Hover the wall, then click an open spot to publish"}
        </p>
        {msg && (
          <p className="muted" style={{ color: "#c98b8b", marginTop: 6 }}>
            {msg}
          </p>
        )}
      </div>

      <section className="frame">
        <WallCanvas
          blocks={blocks}
          cols={GRID.COLS}
          rows={GRID.ROWS}
          mode="place"
          shape={shape}
          occupied={occupied}
          busy={busy}
          onPlace={place}
        />
      </section>
    </main>
  );
}
