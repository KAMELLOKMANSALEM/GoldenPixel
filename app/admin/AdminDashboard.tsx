"use client";

import { useState } from "react";
import type { AdminBlock } from "@/lib/admin";
import Mosaic from "../components/Mosaic";

export default function AdminDashboard({ blocks }: { blocks: AdminBlock[] }) {
  const [items, setItems] = useState(blocks);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Take this art down? The square stays sold. No refund.")) return;
    setBusy(id);
    const res = await fetch("/api/admin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: id }),
    });
    setBusy(null);
    if (res.ok) {
      setItems((prev) => prev.map((b) => (b.id === id ? { ...b, status: "removed" } : b)));
    } else alert("Remove failed.");
  }

  async function refund(id: string) {
    if (!confirm("Refund the buyer AND free the square back to available? This reverses the sale."))
      return;
    setBusy(id);
    const res = await fetch("/api/admin/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: id }),
    });
    setBusy(null);
    if (res.ok) {
      setItems((prev) => prev.filter((b) => b.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(`Refund failed. ${d.error || ""}`);
    }
  }

  const flaggedCount = items.filter((b) => b.flagged && b.status === "live").length;

  return (
    <div>
      <div className="label" style={{ marginBottom: "1.5rem" }}>
        {items.length} sold ·{" "}
        <span style={{ color: flaggedCount ? "var(--gold)" : "var(--muted)" }}>
          {flaggedCount} flagged for review
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {items.map((b) => (
          <div
            key={b.id}
            style={{
              border: `1px solid ${b.flagged && b.status === "live" ? "var(--gold)" : "var(--line)"}`,
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.7rem",
              opacity: b.status === "removed" ? 0.5 : 1,
            }}
          >
            {b.status === "removed" ? (
              <div style={{ aspectRatio: "1 / 1", background: "#141416", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="label">removed</span>
              </div>
            ) : b.imageUrl || b.cellImages ? (
              <Mosaic shape={b.shape} imageUrl={b.imageUrl} cellImages={b.cellImages} />
            ) : (
              <div style={{ aspectRatio: "1 / 1", background: "#141416", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="label">no image</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "0.85rem" }}>{b.caption || <span className="muted">—</span>}</span>
              {b.flagged && b.status === "live" && (
                <span className="label" style={{ color: "var(--gold)" }}>
                  flagged
                </span>
              )}
            </div>

            <div className="muted" style={{ fontSize: "0.72rem", lineHeight: 1.6, wordBreak: "break-all" }}>
              {b.linkUrl && (
                <div>
                  <a href={b.linkUrl} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>
                    {b.linkUrl}
                  </a>
                </div>
              )}
              <div>{b.ownerEmail}</div>
              <div>
                {b.size}-square · {b.provider || "—"} · ${(b.amountCents / 100).toFixed(0)}
              </div>
              <div>{new Date(b.createdAt).toLocaleString()}</div>
            </div>

            {b.status === "live" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, padding: "0.5rem" }}
                  disabled={busy === b.id}
                  onClick={() => remove(b.id)}
                >
                  Remove
                </button>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, padding: "0.5rem", borderColor: "#5a3b3b" }}
                  disabled={busy === b.id}
                  onClick={() => refund(b.id)}
                >
                  Refund + release
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && <p className="muted">No squares sold yet.</p>}
    </div>
  );
}
