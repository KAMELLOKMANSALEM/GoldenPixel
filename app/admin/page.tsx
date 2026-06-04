import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/adminAuth";
import { getAdminBlocks } from "@/lib/admin";
import { listApplications } from "@/lib/applications";
import { TOTAL_SQUARES } from "@/lib/config";
import AdminDashboard from "./AdminDashboard";
import ApplicationsQueue, { type AdminApplication } from "./ApplicationsQueue";

export const dynamic = "force-dynamic";

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div
        className="serif"
        style={{
          fontSize: "1.9rem",
          color: gold ? "var(--gold)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const [blocks, apps] = await Promise.all([getAdminBlocks(), listApplications()]);
  const applications: AdminApplication[] = apps.map((a) => ({
    id: a.id,
    email: a.email,
    status: a.status,
    size: a.size,
    shape: a.shape,
    imageUrl: a.image_url,
    cellImages: a.cell_images,
    caption: a.caption,
    linkUrl: a.link_url,
    flagged: a.flagged,
    amountCents: a.amount_cents,
    createdAt: a.created_at,
    survey: a.survey,
  }));

  // Overview stats.
  const claimed = blocks.reduce((n, b) => n + b.size, 0);
  const liveCount = blocks.filter((b) => b.status === "live").length;
  const flaggedLive = blocks.filter((b) => b.flagged && b.status === "live").length;
  const pending = applications.filter((a) => a.status === "submitted").length;
  const earningStatuses = new Set(["paid", "submitted", "approved", "published"]);
  const revenue = applications
    .filter((a) => earningStatuses.has(a.status))
    .reduce((n, a) => n + a.amountCents, 0);
  const refunds = applications.filter((a) => a.status === "rejected" || a.status === "refunded").length;

  return (
    <main className="frame" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, background: "var(--gold)", display: "inline-block" }} />
          <span className="wordmark" style={{ fontSize: "1.4rem" }}>
            GoldenPixel
          </span>
          <span className="label" style={{ marginLeft: 12 }}>
            Admin
          </span>
        </div>
        <span className="label">{admin}</span>
      </div>

      {/* Overview — at-a-glance health of the wall. */}
      <div
        style={{
          display: "flex",
          gap: "clamp(1.5rem, 5vw, 3.5rem)",
          flexWrap: "wrap",
          padding: "1.4rem 0 2rem",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          marginBottom: "2.5rem",
        }}
      >
        <Stat value={`${claimed.toLocaleString()} / ${TOTAL_SQUARES.toLocaleString()}`} label="Squares claimed" gold />
        <Stat value={money(revenue)} label="Revenue (held)" />
        <Stat value={String(pending)} label="Awaiting review" gold={pending > 0} />
        <Stat value={String(flaggedLive)} label="Flagged live" gold={flaggedLive > 0} />
        <Stat value={String(liveCount)} label="Live squares" />
        <Stat value={String(refunds)} label="Refunded" />
      </div>

      <ApplicationsQueue applications={applications} />

      <hr className="hair" style={{ margin: "1rem 0 2.5rem" }} />
      <div className="label" style={{ marginBottom: "1.5rem" }}>
        Live wall
      </div>
      <AdminDashboard blocks={blocks} />
    </main>
  );
}
