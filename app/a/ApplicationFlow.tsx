"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SubmissionForm from "../components/SubmissionForm";
import SelectSquare from "./SelectSquare";
import type { ApplicationStatus } from "@/lib/applications";
import type { BlockShape, BlockSize } from "@/lib/config";
import type { Cell, PublicBlock } from "@/lib/types";

// The post-payment hub, reachable from the magic link. Renders the right step for
// the application's current status and polls to auto-advance through review.
export default function ApplicationFlow({
  id,
  token,
  initialStatus,
  shape,
  imageUrl,
  email,
  blocks,
  occupied,
}: {
  id: string;
  token: string;
  initialStatus: ApplicationStatus;
  shape: BlockShape;
  size: BlockSize;
  imageUrl: string | null;
  email: string | null;
  blocks: PublicBlock[];
  occupied: Cell[];
}) {
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [celebrate, setCelebrate] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/application-status?id=${id}&token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status) setStatus(data.status as ApplicationStatus);
    } catch {
      /* ignore */
    }
  }, [id, token]);

  // Poll while waiting on the webhook (eligible) or the admin (submitted).
  useEffect(() => {
    if (status !== "eligible" && status !== "submitted") return;
    const interval = status === "eligible" ? 2500 : 8000;
    const t = setInterval(poll, interval);
    return () => clearInterval(t);
  }, [status, poll]);

  if (status === "paid") {
    return (
      <SubmissionForm
        applicationId={id}
        token={token}
        shape={shape}
        defaultEmail={email || undefined}
        onSubmitted={() => {
          setStatus("submitted");
          setCelebrate(true);
        }}
      />
    );
  }

  // The moment after a successful submission — celebrate before showing the wait.
  if (celebrate) {
    return (
      <Centered>
        <span
          aria-hidden
          className="seal"
          style={{ width: 44, height: 44, background: "var(--gold)", marginBottom: "0.4rem" }}
        />
        <span className="label">Step one of two · complete</span>
        <Title gold>Your application is in</Title>
        <Muted>
          Nicely done. Your work is now with our team. We review every square by hand and will email
          you the moment there&apos;s a decision. We wish you luck.
        </Muted>
        <button className="btn-gold" style={{ marginTop: "0.6rem" }} onClick={() => setCelebrate(false)}>
          See my status
        </button>
      </Centered>
    );
  }

  if (status === "approved") {
    return (
      <SelectSquare
        applicationId={id}
        token={token}
        shape={shape}
        blocks={blocks}
        initialOccupied={occupied}
        onPublished={() => setStatus("published")}
      />
    );
  }

  // Centered single-message states
  return (
    <Centered>
      {status === "eligible" && (
        <>
          <Title>Finalizing your payment…</Title>
          <Muted>This takes a few seconds. Keep this page open.</Muted>
        </>
      )}
      {status === "submitted" && (
        <>
          <span className="label">Under review</span>
          <Title>Your work is with our team</Title>
          <Muted>
            We review every square by hand. We&apos;ll email you the moment there&apos;s a decision —
            usually within a few days. You can close this page.
          </Muted>
          {imageUrl && <Preview src={imageUrl} />}
        </>
      )}
      {status === "published" && (
        <>
          <Title gold>Your square is live</Title>
          <Muted>We emailed your receipt and a private edit link.</Muted>
          <Link href="/" className="btn-ghost" style={{ marginTop: "1rem" }}>
            View the wall
          </Link>
        </>
      )}
      {(status === "rejected" || status === "refunded") && (
        <>
          <Title>Not this time</Title>
          <Muted>
            Thank you for applying. Your work wasn&apos;t selected this round and your payment has been
            refunded in full. We&apos;d welcome a future submission.
          </Muted>
          <Link href="/" className="btn-ghost" style={{ marginTop: "1rem" }}>
            Back to the wall
          </Link>
        </>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
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
        gap: "1.2rem",
        maxWidth: 560,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
        <span style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
        <span className="wordmark" style={{ fontSize: "1.4rem" }}>
          GoldenPixel
        </span>
      </div>
      {children}
    </main>
  );
}

function Title({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <h1
      className="display"
      style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", color: gold ? "var(--gold)" : undefined }}
    >
      {children}
    </h1>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ lineHeight: 1.7, maxWidth: 440 }}>{children}</p>;
}

function Preview({ src }: { src: string }) {
  return (
    <div style={{ width: 160, height: 160, overflow: "hidden", outline: "1px solid var(--line)", marginTop: "0.5rem" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}
