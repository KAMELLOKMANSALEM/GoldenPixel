"use client";

import { useEffect, useState } from "react";

// "Square held for 9:58" — counts down to reservedUntil, calls onExpire once at 0.
export default function Countdown({
  until,
  onExpire,
}: {
  until: string; // ISO
  onExpire: () => void;
}) {
  const target = new Date(until).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = target - Date.now();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  const secs = Math.max(0, Math.floor(remaining / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <span className="label" style={{ color: "var(--gold)" }}>
      Square held for {mm}:{ss}
    </span>
  );
}
