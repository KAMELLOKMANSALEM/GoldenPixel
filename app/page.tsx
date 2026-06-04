import { getWallBlocks } from "@/lib/blocks";
import { GRID } from "@/lib/config";
import { generateDummyWall } from "@/lib/dummyWall";
import WallFullscreen from "./components/WallFullscreen";
import GoldSquareMenu from "./components/GoldSquareMenu";
import BottomBanner from "./components/BottomBanner";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Load the real wall; fall back to a demo wall so the page is never empty.
  let blocks = [] as Awaited<ReturnType<typeof getWallBlocks>>;
  try {
    blocks = await getWallBlocks();
  } catch (e) {
    console.error("wall data unavailable (is Supabase configured?)", e);
  }
  if (blocks.length === 0) blocks = generateDummyWall();

  const claimed = blocks.reduce((n, b) => n + b.squares.length, 0);

  return (
    <main>
      {/* Full-screen wall — pan left/right with the mouse. */}
      <WallFullscreen blocks={blocks} cols={GRID.COLS} rows={GRID.ROWS} />

      {/* The single gold square at top-center opens the name + links. */}
      <GoldSquareMenu claimed={claimed} />

      {/* Apply now — fades in and out at the bottom. */}
      <BottomBanner />
    </main>
  );
}
