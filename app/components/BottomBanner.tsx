"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// "Apply now" — fades in and out at the bottom-center, on a loop.
export default function BottomBanner() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const cycle = (visible: boolean) => {
      setShown(visible);
      timer = setTimeout(() => cycle(!visible), visible ? 4500 : 2800);
    };
    timer = setTimeout(() => cycle(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        pointerEvents: shown ? "auto" : "none",
        opacity: shown ? 1 : 0,
        transition: "opacity 900ms var(--ease)",
      }}
    >
      <Link
        href="/apply"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          padding: "0.7rem 1.4rem",
          background: "rgba(10,10,11,0.7)",
          border: "1px solid var(--line)",
          backdropFilter: "blur(6px)",
        }}
      >
        <span className="label" style={{ color: "var(--muted)" }}>
          Applications open
        </span>
        <span className="label" style={{ color: "var(--gold)", letterSpacing: "0.18em" }}>
          Apply now →
        </span>
      </Link>
    </div>
  );
}
