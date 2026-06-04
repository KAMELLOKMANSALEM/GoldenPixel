"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dollarsForSize, type BlockSize, type BlockShape } from "@/lib/config";
import Survey, { type SurveyResult } from "../components/Survey";
import EligibilityCheck from "../components/EligibilityCheck";
import Checkout from "../components/Checkout";

type Phase = "survey" | "eligibility" | "payment";

// The funnel up to payment. Everything after payment lives on /a/[id] (the
// magic-link hub) so it's reachable from the email too.
export default function Apply() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("survey");
  const [app, setApp] = useState<{ id: string; token: string } | null>(null);
  const [size, setSize] = useState<{ size: BlockSize; shape: BlockShape } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSurvey(r: SurveyResult) {
    setErr(null);
    try {
      const res = await fetch("/api/apply/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey: r.survey, size: r.size, shape: r.shape, email: r.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start your application");
      setApp({ id: data.id, token: data.token });
      setSize({ size: r.size, shape: r.shape });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gp_app", JSON.stringify({ id: data.id, token: data.token }));
      }
      setPhase("eligibility");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function goToHub() {
    if (app) router.push(`/a/${app.id}?token=${encodeURIComponent(app.token)}`);
  }

  if (phase === "survey") {
    return (
      <>
        <Survey onComplete={onSurvey} />
        {err && (
          <p className="frame muted" style={{ color: "#c98b8b", paddingBottom: "2rem" }}>
            {err}
          </p>
        )}
      </>
    );
  }

  if (phase === "eligibility") {
    return <EligibilityCheck onPass={() => setPhase("payment")} />;
  }

  // payment
  return (
    <div
      className="frame"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 560 }}
    >
      <span className="label" style={{ marginBottom: "0.6rem" }}>
        Secure your place
      </span>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)", marginBottom: "1rem" }}>
        {size ? `$${dollarsForSize(size.size)}` : ""}
      </h1>
      <p className="muted" style={{ marginBottom: "2rem", lineHeight: 1.7, maxWidth: 440 }}>
        Payment is taken now. You&apos;ll submit your work next; if it isn&apos;t approved, you&apos;re refunded
        in full.
      </p>
      {app && (
        <Checkout
          applicationId={app.id}
          token={app.token}
          amountLabel={size ? `$${dollarsForSize(size.size)}` : ""}
          onPaid={goToHub}
        />
      )}
    </div>
  );
}
