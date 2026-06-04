"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TOTAL_SQUARES } from "@/lib/config";

// The only thing at the top of the page: one big gold square with a moving sheen
// so it reads as a precious object you can press. Clicking it reveals everything —
// the platform name, the claimed count, and the links.
const LINKS: { label: string; href: string }[] = [
  { label: "Apply", href: "/apply" },
  { label: "About", href: "/about" },
  { label: "B2B", href: "/b2b" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Terms & Conditions", href: "/terms" },
];

export default function GoldSquareMenu({ claimed }: { claimed: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* The gold piece, centered at the very top. */}
      <button
        aria-label="Open menu"
        aria-expanded={open}
        className="gold-square"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          top: 22,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
        }}
      />

      {/* Everything, revealed on click. */}
      {open && (
        <div
          className="menu-overlay"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 55,
            background: "rgba(10,10,11,0.94)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2.2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <span aria-hidden style={{ width: 16, height: 16, background: "var(--gold)" }} />
            <span className="wordmark" style={{ fontSize: "2.4rem" }}>
              GoldenPixel
            </span>
          </div>

          <div className="label">
            <span className="counter-num">{claimed.toLocaleString()}</span> /{" "}
            {TOTAL_SQUARES.toLocaleString()} claimed
          </div>

          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
              marginTop: "0.6rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="menu-link"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <span className="label" style={{ marginTop: "1rem", color: "var(--muted)" }}>
            goldenpixel.co · press Esc to close
          </span>
        </div>
      )}
    </>
  );
}
