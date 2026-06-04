"use client";

import { useState } from "react";
import Mosaic from "../components/Mosaic";

export type AdminApplication = {
  id: string;
  email: string | null;
  status: string;
  size: number;
  shape: string;
  imageUrl: string | null;
  cellImages: (string | null)[] | null;
  caption: string | null;
  linkUrl: string | null;
  flagged: boolean;
  amountCents: number;
  createdAt: string;
  survey: Record<string, unknown>;
};

export default function ApplicationsQueue({ applications }: { applications: AdminApplication[] }) {
  const [items, setItems] = useState(applications);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Reject this submission and refund the artist in full?"))
      return;
    setBusy(id);
    const res = await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: id }),
    });
    setBusy(null);
    if (res.ok) {
      setItems((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a))
      );
    } else {
      const d = await res.json().catch(() => ({}));
      alert(`${action} failed. ${d.error || ""}`);
    }
  }

  const pending = items.filter((a) => a.status === "submitted");

  return (
    <div style={{ marginBottom: "3.5rem" }}>
      <div className="label" style={{ marginBottom: "1.5rem" }}>
        Applications ·{" "}
        <span style={{ color: pending.length ? "var(--gold)" : "var(--muted)" }}>
          {pending.length} awaiting review
        </span>
      </div>

      {items.length === 0 && <p className="muted">No applications yet.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {items.map((a) => (
          <div
            key={a.id}
            style={{
              border: `1px solid ${a.flagged && a.status === "submitted" ? "var(--gold)" : "var(--line)"}`,
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.7rem",
            }}
          >
            {a.imageUrl || a.cellImages ? (
              <Mosaic shape={a.shape} imageUrl={a.imageUrl} cellImages={a.cellImages} />
            ) : (
              <div style={{ aspectRatio: "1 / 1", background: "#141416", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="label">no submission yet</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="label">{a.status}</span>
              {a.flagged && a.status === "submitted" && (
                <span className="label" style={{ color: "var(--gold)" }}>
                  flagged
                </span>
              )}
            </div>

            {a.caption && <div style={{ fontSize: "0.9rem" }}>{a.caption}</div>}

            <div className="muted" style={{ fontSize: "0.72rem", lineHeight: 1.7, wordBreak: "break-word" }}>
              {a.survey?.name ? <div>{String(a.survey.name)}</div> : null}
              {a.survey?.location ? <div>{String(a.survey.location)}</div> : null}
              {a.survey?.medium ? <div>{String(a.survey.medium)}</div> : null}
              {a.survey?.portfolio ? (
                <div>
                  <a href={String(a.survey.portfolio)} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>
                    {String(a.survey.portfolio)}
                  </a>
                </div>
              ) : null}
              {a.survey?.statement ? (
                <div style={{ marginTop: 4, fontStyle: "italic" }}>“{String(a.survey.statement)}”</div>
              ) : null}
              {a.linkUrl ? (
                <div style={{ marginTop: 4 }}>
                  → <a href={a.linkUrl} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>{a.linkUrl}</a>
                </div>
              ) : null}
              <div style={{ marginTop: 4 }}>{a.email}</div>
              <div>
                {a.size}-square · ${(a.amountCents / 100).toFixed(0)} · {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>

            {a.status === "submitted" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                <button
                  className="btn-gold"
                  style={{ flex: 1, padding: "0.55rem" }}
                  disabled={busy === a.id}
                  onClick={() => decide(a.id, "approve")}
                >
                  Approve
                </button>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, padding: "0.55rem", borderColor: "#5a3b3b" }}
                  disabled={busy === a.id}
                  onClick={() => decide(a.id, "reject")}
                >
                  Reject + refund
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
