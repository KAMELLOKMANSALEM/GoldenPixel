"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

// Funnel payment. The amount is computed SERVER-SIDE from the application's size;
// nothing here sends a price. Square redirects to a hosted page; PayPal captures
// server-side. An application only flips to `paid` on server confirmation.
export default function Checkout({
  applicationId,
  token,
  amountLabel,
  onPaid,
}: {
  applicationId: string;
  token: string;
  amountLabel: string; // e.g. "$200"
  onPaid: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const devPay = process.env.NEXT_PUBLIC_DEV_PAY === "1";

  const auth = { applicationId, token };

  async function startSquare() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout/square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Square checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Square checkout failed");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!paypalClientId || !paypalRef.current) return;
    const id = "paypal-sdk";
    function render() {
      if (!window.paypal || !paypalRef.current) return;
      paypalRef.current.innerHTML = "";
      window.paypal
        .Buttons({
          style: { color: "black", shape: "rect", label: "pay", height: 44 },
          createOrder: async () => {
            const res = await fetch("/api/checkout/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(auth),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "create order failed");
            return data.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            setBusy(true);
            const res = await fetch("/api/checkout/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...auth, orderId: data.orderID }),
            });
            const out = await res.json();
            setBusy(false);
            if (res.ok && out.paid) onPaid();
            else setErr(out.error || "Payment could not be confirmed");
          },
          onError: () => setErr("PayPal error. Try card instead."),
        })
        .render(paypalRef.current);
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing && window.paypal) {
      render();
      return;
    }
    if (!existing) {
      const s = document.createElement("script");
      s.id = id;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        paypalClientId
      )}&currency=USD`;
      s.onload = render;
      document.body.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, token, paypalClientId]);

  async function devConfirm() {
    setBusy(true);
    const res = await fetch("/api/dev/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auth),
    });
    setBusy(false);
    if (res.ok) onPaid();
    else setErr("Dev confirm failed (only works in dev).");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: 320 }}>
      <button className="btn-gold" onClick={startSquare} disabled={busy}>
        Pay {amountLabel} with card
      </button>
      {paypalClientId ? (
        <div ref={paypalRef} />
      ) : (
        <p className="muted" style={{ fontSize: "0.72rem" }}>
          PayPal not configured.
        </p>
      )}
      {devPay && (
        <button className="btn-ghost" onClick={devConfirm} disabled={busy}>
          Simulate payment (dev)
        </button>
      )}
      {err && (
        <p className="muted" style={{ fontSize: "0.72rem", color: "#c98b8b" }}>
          {err}
        </p>
      )}
    </div>
  );
}
