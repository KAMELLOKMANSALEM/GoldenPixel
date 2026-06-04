import { SHAPES, type BlockShape } from "@/lib/config";

// Renders a block's art: an assembled per-cell mosaic when cellImages are present,
// otherwise a single image across the whole block. Shared by admin + edit views.
export default function Mosaic({
  shape,
  imageUrl,
  cellImages,
  style,
}: {
  shape: string;
  imageUrl: string | null;
  cellImages?: (string | null)[] | null;
  style?: React.CSSProperties;
}) {
  const { w, h } = SHAPES[shape as BlockShape] ?? { w: 1, h: 1 };
  const has = cellImages && cellImages.length > 0;
  return (
    <div
      style={{
        aspectRatio: `${w} / ${h}`,
        background: "#141416",
        display: "grid",
        gridTemplateColumns: `repeat(${w}, 1fr)`,
        gridTemplateRows: `repeat(${h}, 1fr)`,
        overflow: "hidden",
        ...style,
      }}
    >
      {has ? (
        cellImages!.map((u, i) =>
          u ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div key={i} style={{ background: "#141416" }} />
          )
        )
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ gridColumn: "1 / -1", gridRow: "1 / -1", width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}
    </div>
  );
}
