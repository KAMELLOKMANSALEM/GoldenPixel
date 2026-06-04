import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="frame"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "1.4rem",
      }}
    >
      <span aria-hidden style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
      <h1 className="display" style={{ fontSize: "clamp(2.4rem, 8vw, 4.5rem)" }}>
        Off the wall.
      </h1>
      <p className="muted" style={{ maxWidth: 360, lineHeight: 1.7 }}>
        That page isn&apos;t here. The wall, however, always is.
      </p>
      <Link href="/" className="btn-gold" style={{ marginTop: "0.4rem" }}>
        Back to the wall
      </Link>
    </main>
  );
}
