"use client";

import { useState } from "react";
import { MAX_CAPTION_LEN } from "@/lib/config";

export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function isValidUrl(raw: string): boolean {
  if (!raw.trim()) return false;
  try {
    const u = new URL(normalizeUrl(raw));
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// Two fields only: caption (<=40) and a URL. Plus the owner email (for the
// confirmation + magic-link). Nothing else.
export default function CaptionLink({
  onContinue,
  busy,
}: {
  onContinue: (data: { caption: string; linkUrl: string; email: string }) => void;
  busy?: boolean;
}) {
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");

  const linkOk = isValidUrl(link);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canGo = linkOk && emailOk && !busy;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", width: "100%", maxWidth: 360 }}>
      <div>
        <label className="label" htmlFor="caption">
          Caption
        </label>
        <input
          id="caption"
          className="field"
          maxLength={MAX_CAPTION_LEN}
          value={caption}
          placeholder="Optional, ≤40 characters"
          onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
        />
        <div className="muted" style={{ fontSize: "0.7rem", textAlign: "right", marginTop: 4 }}>
          {caption.length}/{MAX_CAPTION_LEN}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="link">
          Link
        </label>
        <input
          id="link"
          className="field"
          value={link}
          inputMode="url"
          placeholder="yoursite.com"
          onChange={(e) => setLink(e.target.value)}
        />
        {link && !linkOk && (
          <div className="muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>
            Enter a valid web address.
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="field"
          type="email"
          value={email}
          placeholder="for your receipt + edit link"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button
        className="btn-gold"
        disabled={!canGo}
        onClick={() =>
          onContinue({ caption: caption.trim(), linkUrl: normalizeUrl(link), email: email.trim() })
        }
      >
        Continue to payment
      </button>
    </div>
  );
}
