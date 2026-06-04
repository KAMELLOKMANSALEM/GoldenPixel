"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  return (
    <main
      className="frame"
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 420,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
        <span style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
        <span className="wordmark" style={{ fontSize: "1.4rem" }}>
          GoldenPixel
        </span>
      </div>
      <span className="label">Admin</span>
      {sent ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          If that address is an admin, a sign-in link is on its way.
        </p>
      ) : (
        <form onSubmit={submit} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}>
          <input
            className="field"
            type="email"
            placeholder="admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn-gold" type="submit">
            Email me a link
          </button>
        </form>
      )}
    </main>
  );
}
