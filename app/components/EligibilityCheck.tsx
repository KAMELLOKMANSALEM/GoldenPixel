"use client";

import { useEffect, useState } from "react";

const CHECKS = [
  "Reviewing your portfolio",
  "Confirming originality",
  "Assessing fit for the wall",
  "Reserving your place in the queue",
];

// Theatrical — everyone passes. The real gate is the admin review of the artwork.
// Kept monochrome: gold is reserved for the counter, hover, and primary button.
export default function EligibilityCheck({ onPass }: { onPass: () => void }) {
  const [done, setDone] = useState(0);
  const [pass, setPass] = useState(false);

  useEffect(() => {
    if (done < CHECKS.length) {
      const t = setTimeout(() => setDone((d) => d + 1), 850);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPass(true), 700);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div
      className="frame"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 560,
      }}
    >
      {!pass ? (
        <>
          <span className="label" style={{ marginBottom: "2.5rem" }}>
            Reviewing your application
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
            {CHECKS.map((c, idx) => {
              const complete = idx < done;
              const active = idx === done;
              return (
                <div
                  key={c}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    opacity: complete || active ? 1 : 0.25,
                    transition: "opacity 400ms var(--ease)",
                  }}
                >
                  <Mark complete={complete} active={active} />
                  <span style={{ fontSize: "1.05rem", color: complete ? "var(--ink)" : "var(--muted)" }}>
                    {c}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
            You&apos;re eligible.
          </h1>
          <p className="muted" style={{ maxWidth: 440, lineHeight: 1.7 }}>
            Secure your place with payment. You&apos;ll submit your work next, and our team will review
            it before it goes on the wall.
          </p>
          <div>
            <button className="btn-gold" onClick={onPass}>
              Continue to payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// A thin off-white check / spinner. Monochrome by design.
function Mark({ complete, active }: { complete: boolean; active: boolean }) {
  if (complete) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M3 9.5 L7 13 L15 4" fill="none" stroke="#e8e6df" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "1.5px solid var(--muted)",
        borderTopColor: active ? "var(--ink)" : "var(--muted)",
        display: "inline-block",
        animation: active ? "gp-spin 0.8s linear infinite" : "none",
      }}
    />
  );
}
