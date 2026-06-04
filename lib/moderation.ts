// Image moderation via OpenAI omni-moderation. Returns:
//   - hardBlock: a CSAM-class detection — the upload must NOT publish at all.
//   - flagged: a soft violation — publishes, but surfaces in the admin queue.
// If OPENAI_API_KEY is unset, moderation is skipped (pass) so dev isn't blocked.

export type ModerationResult = {
  hardBlock: boolean;
  flagged: boolean;
  detail: unknown;
};

// Soft-flag threshold for borderline categories.
const FLAG_THRESHOLD = 0.5;

export async function moderateImage(
  buffer: Buffer,
  mime: string
): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { hardBlock: false, flagged: false, detail: { skipped: true } };

  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: dataUrl } }],
      }),
    });
    if (!res.ok) {
      // Fail open for availability, but flag for human review.
      console.error("moderation API error", res.status);
      return { hardBlock: false, flagged: true, detail: { error: res.status } };
    }
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return { hardBlock: false, flagged: false, detail: data };

    const cats = r.categories || {};
    const scores = r.category_scores || {};

    // CSAM-class: any sexual/minors detection is an immediate hard block.
    const hardBlock = Boolean(cats["sexual/minors"]) || (scores["sexual/minors"] ?? 0) > 0.2;

    // Soft flag: model flagged overall, or any tracked category crosses threshold.
    const tracked = [
      "sexual",
      "hate",
      "hate/threatening",
      "harassment",
      "harassment/threatening",
      "violence",
      "violence/graphic",
      "self-harm",
    ];
    const overThreshold = tracked.some((c) => (scores[c] ?? 0) >= FLAG_THRESHOLD);
    const flagged = Boolean(r.flagged) || overThreshold;

    return { hardBlock, flagged, detail: { categories: cats, category_scores: scores } };
  } catch (e) {
    console.error("moderation failed", e);
    return { hardBlock: false, flagged: true, detail: { error: String(e) } };
  }
}
