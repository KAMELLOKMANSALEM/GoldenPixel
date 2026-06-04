import Link from "next/link";

// Minimal content pages for the menu links. Placeholder copy — replace with real
// legal/marketing text before launch.
type Slug = "about" | "b2b" | "contact" | "privacy" | "cookies" | "terms";

const CONTENT: Record<Slug, { title: string; body: string[] }> = {
  about: {
    title: "About",
    body: [
      "GoldenPixel is a single wall of art, sold one square at a time. Every square is reviewed before it goes up, so the wall stays a place worth looking at.",
      "It is flat by design: no tiers, no jury seats, no advertising. Just artists, their work, and a link to where their world continues.",
    ],
  },
  b2b: {
    title: "B2B",
    body: [
      "Galleries, studios, and brands can reserve a block of squares for a collection or campaign.",
      "Tell us what you have in mind and we'll be in touch.",
    ],
  },
  contact: {
    title: "Contact",
    body: ["Questions, press, or partnerships: hello@goldenpixel.co."],
  },
  privacy: {
    title: "Privacy",
    body: [
      "We collect only what we need to process your application, take payment, and email you about your square.",
      "We do not sell your data. This is placeholder text — replace with your full privacy policy before launch.",
    ],
  },
  cookies: {
    title: "Cookies",
    body: [
      "We use a small number of essential cookies to keep your session and remember your application.",
      "Placeholder text — replace with your full cookie policy before launch.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    body: [
      "By uploading, you confirm you own the rights to your work and agree it may be removed for violating the content rules.",
      "Placeholder text — replace with your full terms before launch.",
    ],
  },
};

export default function InfoPage({ slug }: { slug: Slug }) {
  const c = CONTENT[slug];
  return (
    <main
      className="frame"
      style={{ maxWidth: 680, minHeight: "80vh", padding: "clamp(3rem, 12vh, 8rem) 0 4rem" }}
    >
      <Link href="/" className="label" style={{ display: "inline-block", marginBottom: "2.5rem" }}>
        ← GoldenPixel
      </Link>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)", marginBottom: "1.6rem" }}>
        {c.title}
      </h1>
      {c.body.map((p, i) => (
        <p key={i} className="muted" style={{ fontSize: "1.02rem", lineHeight: 1.8, marginBottom: "1.1rem" }}>
          {p}
        </p>
      ))}
    </main>
  );
}

export type { Slug };
