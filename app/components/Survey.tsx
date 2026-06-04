"use client";

import { useState } from "react";
import { dollarsForSize, type BlockSize, type BlockShape } from "@/lib/config";
import SizePicker from "./SizePicker";
import { isValidUrl } from "./CaptionLink";

export type SurveyResult = {
  survey: Record<string, unknown>;
  size: BlockSize;
  shape: BlockShape;
  email: string;
};

type Step =
  | { kind: "intro" }
  | { kind: "text"; id: string; prompt: string; hint?: string; placeholder?: string; required?: boolean; max?: number }
  | { kind: "textarea"; id: string; prompt: string; hint?: string; placeholder?: string; max: number }
  | { kind: "link"; id: string; prompt: string; hint?: string; placeholder?: string }
  | { kind: "email"; id: string; prompt: string; hint?: string }
  | { kind: "size"; prompt: string; hint?: string }
  | { kind: "agree"; prompt: string; hint?: string };

// The application. Long, deliberate, one question at a time — the pacing is the point.
// Each question carries a hint so the applicant knows what kind of answer fits.
const STEPS: Step[] = [
  { kind: "intro" },
  {
    kind: "text",
    id: "name",
    prompt: "What is your name?",
    hint: "Your real name — this is who the work will be credited to.",
    placeholder: "Full name",
    required: true,
    max: 80,
  },
  {
    kind: "text",
    id: "location",
    prompt: "Where do you work?",
    hint: "City and country is enough.",
    placeholder: "City, country",
    max: 80,
  },
  {
    kind: "link",
    id: "portfolio",
    prompt: "Where can we see your work?",
    hint: "A website, Instagram, or Behance — anywhere we can see a body of work.",
    placeholder: "portfolio or profile link",
  },
  {
    kind: "text",
    id: "medium",
    prompt: "What do you make?",
    hint: "Painting, photography, 3D, illustration, generative — in your own words.",
    placeholder: "Your medium or practice",
    max: 120,
  },
  {
    kind: "textarea",
    id: "statement",
    prompt: "Why this wall?",
    hint: "What draws you to a shared wall of art? One or two sentences is plenty.",
    placeholder: "A few sentences.",
    max: 280,
  },
  {
    kind: "size",
    prompt: "How much of the wall?",
    hint: "1, 2, 4, or 9 squares. You'll choose the exact spot after you're approved.",
  },
  {
    kind: "email",
    id: "email",
    prompt: "Where should we reach you?",
    hint: "We'll send your private application link and review updates to this address.",
  },
  {
    kind: "agree",
    prompt: "The terms.",
    hint: "Please read to the end — the accept box unlocks when you reach the bottom.",
  },
];

// Full terms, shown inline in a scrollable panel so applicants read them in place.
const TERMS: { h: string; p: string[] }[] = [
  {
    h: "1. What you're buying",
    p: [
      "A square (or block of squares) on the GoldenPixel wall is a fixed position that displays your artwork and links to a destination of your choosing. Position and size are permanent once published.",
    ],
  },
  {
    h: "2. Review & curation",
    p: [
      "Every application is reviewed before anything is published. Acceptance is at our sole discretion. Paying does not guarantee a place on the wall.",
    ],
  },
  {
    h: "3. Payment & refunds",
    p: [
      "Payment is taken at the application stage. If your submission is not approved, your payment is refunded in full. Once your work is approved and you publish it, the purchase is final.",
    ],
  },
  {
    h: "4. Content rules",
    p: [
      "You may not upload content that is hateful or harassing, sexual or explicit, illegal, or that impersonates another person or brand.",
      "You confirm you own or have the rights to everything you upload, including the artwork and any linked destination.",
    ],
  },
  {
    h: "5. Removal",
    p: [
      "We may remove any square that violates these terms. Removal takes the artwork down; it does not, by itself, entitle you to a refund. Serious or repeated violations may be reversed and refunded at our discretion.",
    ],
  },
  {
    h: "6. Your link",
    p: [
      "The destination you link to must comply with these same rules. We may remove a square whose linked destination becomes harmful, deceptive, or unlawful.",
    ],
  },
  {
    h: "7. Your rights",
    p: [
      "You keep ownership of your artwork. By publishing, you grant GoldenPixel a license to display it on the wall and in related promotion of the wall.",
    ],
  },
  {
    h: "8. Changes",
    p: [
      "We may update these terms; material changes will be communicated to square owners. Continued display constitutes acceptance of the updated terms.",
    ],
  },
];

export default function Survey({
  onComplete,
  initialStep = 0,
}: {
  onComplete: (r: SurveyResult) => void;
  initialStep?: number;
}) {
  const [i, setI] = useState(initialStep);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [size, setSize] = useState<{ size: BlockSize; shape: BlockShape } | null>(null);
  const [agree, setAgree] = useState(false);
  const [readTerms, setReadTerms] = useState(false);

  const step = STEPS[i];
  const total = STEPS.length - 1; // exclude intro from the count

  function set(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
  }

  function valid(): boolean {
    switch (step.kind) {
      case "intro":
        return true;
      case "text":
        return step.required ? (answers[step.id] || "").trim().length > 0 : true;
      case "textarea":
        return (answers[step.id] || "").trim().length > 0;
      case "link":
        return isValidUrl(answers[step.id] || "");
      case "email":
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((answers[step.id] || "").trim());
      case "size":
        return size !== null;
      case "agree":
        return agree;
    }
  }

  function next() {
    if (!valid()) return;
    if (i < STEPS.length - 1) {
      setI(i + 1);
    } else {
      const survey: Record<string, unknown> = { ...answers };
      if (size) {
        survey.size = size.size;
        survey.shape = size.shape;
      }
      survey.agreedToTerms = true;
      onComplete({
        survey,
        size: size!.size,
        shape: size!.shape,
        email: (answers["email"] || "").trim(),
      });
    }
  }

  const hint = "hint" in step ? step.hint : undefined;

  return (
    <div
      className="frame"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 720,
      }}
    >
      {step.kind !== "intro" && (
        <div className="label" style={{ marginBottom: "2rem" }}>
          {String(i).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      )}

      <div key={i} className="fade-up" style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
        {step.kind === "intro" && (
          <>
            <h1 className="display" style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)" }}>
              Apply to the wall.
            </h1>
            <p className="muted" style={{ fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 520 }}>
              GoldenPixel is a curated wall of art. Every square is reviewed before it goes up. This
              takes a few minutes. Answer honestly.
            </p>
            <div>
              <button className="btn-gold" onClick={next}>
                Begin
              </button>
            </div>
          </>
        )}

        {(step.kind === "text" || step.kind === "link" || step.kind === "email") && (
          <>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
              {step.prompt}
            </h2>
            {hint && <Hint>{hint}</Hint>}
            <input
              autoFocus
              className="field"
              style={{ fontSize: "1.3rem" }}
              type={step.kind === "email" ? "email" : "text"}
              inputMode={step.kind === "link" ? "url" : undefined}
              placeholder={"placeholder" in step ? step.placeholder : undefined}
              maxLength={step.kind === "text" ? step.max : undefined}
              value={answers[(step as { id: string }).id] || ""}
              onChange={(e) => set((step as { id: string }).id, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
            <Nav i={i} setI={setI} next={next} canGo={valid()} last={i === STEPS.length - 1} />
          </>
        )}

        {step.kind === "textarea" && (
          <>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
              {step.prompt}
            </h2>
            {hint && <Hint>{hint}</Hint>}
            <textarea
              autoFocus
              className="field"
              style={{ fontSize: "1.15rem", resize: "none", minHeight: 120 }}
              maxLength={step.max}
              placeholder={step.placeholder}
              value={answers[step.id] || ""}
              onChange={(e) => set(step.id, e.target.value.slice(0, step.max))}
            />
            <div className="muted" style={{ fontSize: "0.72rem", textAlign: "right" }}>
              {(answers[step.id] || "").length}/{step.max}
            </div>
            <Nav i={i} setI={setI} next={next} canGo={valid()} last={i === STEPS.length - 1} />
          </>
        )}

        {step.kind === "size" && (
          <>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
              {step.prompt}
            </h2>
            {hint && <Hint>{hint}</Hint>}
            <SizePicker active={size} onPick={(s, sh) => setSize({ size: s, shape: sh })} />
            {size && (
              <p className="label">
                {size.size === 1 ? "1 square" : `${size.size} squares`} · ${dollarsForSize(size.size)}
              </p>
            )}
            <Nav i={i} setI={setI} next={next} canGo={valid()} last={i === STEPS.length - 1} />
          </>
        )}

        {step.kind === "agree" && (
          <>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
              {step.prompt}
            </h2>
            {hint && <Hint>{hint}</Hint>}

            {/* Read the full terms in place, then accept. */}
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadTerms(true);
              }}
              style={{
                maxHeight: 300,
                overflowY: "auto",
                border: "1px solid var(--line)",
                padding: "1.2rem 1.4rem",
              }}
            >
              {TERMS.map((s) => (
                <div key={s.h} style={{ marginBottom: "1.1rem" }}>
                  <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem", fontWeight: 600 }}>{s.h}</h3>
                  {s.p.map((p, k) => (
                    <p
                      key={k}
                      className="muted"
                      style={{ fontSize: "0.88rem", lineHeight: 1.7, margin: "0 0 0.5rem" }}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ))}
              <p className="label" style={{ marginTop: "0.5rem" }}>
                End of terms
              </p>
            </div>

            <label
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                cursor: readTerms ? "pointer" : "not-allowed",
                opacity: readTerms ? 1 : 0.45,
              }}
            >
              <input
                type="checkbox"
                disabled={!readTerms}
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ marginTop: 4, accentColor: "var(--gold)", width: 18, height: 18 }}
              />
              <span>I have read and accept these terms.</span>
            </label>
            {!readTerms && <Hint>Scroll to the end of the terms to continue.</Hint>}

            <Nav i={i} setI={setI} next={next} canGo={valid()} last={i === STEPS.length - 1} />
          </>
        )}
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.6, marginTop: "-0.4rem" }}>
      {children}
    </p>
  );
}

function Nav({
  i,
  setI,
  next,
  canGo,
  last,
}: {
  i: number;
  setI: (n: number) => void;
  next: () => void;
  canGo: boolean;
  last: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.5rem" }}>
      <button className="btn-gold" onClick={next} disabled={!canGo}>
        {last ? "Submit application" : "Continue"}
      </button>
      {i > 1 && (
        <button className="btn-ghost" onClick={() => setI(i - 1)} style={{ padding: "0.6rem 1rem" }}>
          Back
        </button>
      )}
    </div>
  );
}
