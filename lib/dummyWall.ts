// Demo data — fills the wall with colorful placeholder "art" so the homepage
// looks alive before any real squares are sold. Used only as a fallback when
// the DB has no live blocks. The art is the only color on the page.

import { SHAPES, GRID, type BlockShape } from "./config";
import { cellKey, cellsForPlacement } from "./grid";
import type { PublicBlock } from "./types";

// Deterministic PRNG so the demo wall is stable across renders (no hydration drift).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grades of gold/yellow only — the demo wall reads as one warm tone, not a rainbow.
const PALETTE = [
  "#d9b25b", "#e8c574", "#c79a3e", "#f0d896", "#b8862f", "#eac35e",
  "#a87f2c", "#f5e6b8", "#caa24a", "#ddbb6b", "#9c7423", "#f2dca0",
  "#e0bd66", "#bf963a", "#ecd189", "#cfa84a",
];

// A small set of abstract SVG tiles (reused across blocks; the image cache loads
// each only once, so the payload stays tiny).
function tile(a: string, b: string, kind: number): string {
  const inner =
    kind === 0
      ? `<circle cx="120" cy="120" r="74" fill="${b}"/>`
      : kind === 1
      ? `<path d="M0 0 H240 L0 240 Z" fill="${b}"/>`
      : kind === 2
      ? `<rect x="0" y="0" width="240" height="80" fill="${b}"/><rect x="0" y="160" width="240" height="80" fill="${b}"/>`
      : `<circle cx="120" cy="120" r="86" fill="none" stroke="${b}" stroke-width="34"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="${a}"/>${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ART: string[] = [];
for (let i = 0; i < 16; i++) {
  ART.push(tile(PALETTE[i % PALETTE.length], PALETTE[(i * 7 + 3) % PALETTE.length], i % 4));
}

const CAPTIONS = [
  "Untitled", "Field no. 4", "Morning", "Static", "Bloom", "Reservoir",
  "Hours", "Citrus", "Tide", "Concrete poem", "Signal", "Afterglow",
];

const ARTISTS = [
  "Mara Vance", "Tomas Iwai", "Lena Okafor", "Said Rahimi", "Yuki Tanaka",
  "Noa Eldar", "Priya Menon", "Ivo Costa", "Hana Brandt", "Omar Sleiman",
];
const BIOS = [
  "Works between paint and pixels from a small studio. Interested in noise, repetition, and the moment a pattern breaks.",
  "Self-taught. Makes quiet, saturated work about cities at night and the light that leaks out of them.",
  "A printmaker turned digital colorist. Believes restraint is a kind of loudness.",
  "Photographer and collagist. Collects textures the way other people collect receipts.",
  "Draws every day. Most of it never leaves the desk; this one did.",
];
const ABOUTS = [
  "Part of an ongoing series on color fields. Built from a single gesture, repeated until it became a place.",
  "Made in one sitting. The shape kept arguing with the background and eventually they agreed.",
  "A study in two colors that shouldn't work together. They do, just barely.",
  "From a set about tides — things that arrive, hold, and pull back without asking.",
  "An attempt to make stillness look fast.",
];

// Optional avatar — a simple colored initials tile (most artists have none).
function avatar(initials: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${color}"/><text x="60" y="76" font-family="Georgia,serif" font-size="48" fill="#0a0a0b" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Sizes weighted toward singles with a sprinkle of larger blocks.
const SIZE_BAG: BlockShape[] = [
  "1x1", "1x1", "1x1", "1x1", "1x1", "1x1",
  "2x1", "1x2", "2x1", "1x2",
  "2x2", "2x2", "2x2",
  "3x3",
];

export function generateDummyWall(seed = 7): PublicBlock[] {
  const rand = mulberry32(seed);
  const taken = new Set<string>();
  const blocks: PublicBlock[] = [];
  const targetCoverage = Math.floor(GRID.COLS * GRID.ROWS * 0.28);
  let covered = 0;
  let attempts = 0;

  while (covered < targetCoverage && attempts < 20000) {
    attempts++;
    const shape = SIZE_BAG[Math.floor(rand() * SIZE_BAG.length)];
    const { w, h } = SHAPES[shape];
    const col = Math.floor(rand() * (GRID.COLS - w + 1));
    const row = Math.floor(rand() * (GRID.ROWS - h + 1));
    const cells = cellsForPlacement(row, col, shape);
    if (cells.some((c) => taken.has(cellKey(c.row, c.col)))) continue;
    for (const c of cells) taken.add(cellKey(c.row, c.col));
    const hasCaption = rand() < 0.4;
    const artist = ARTISTS[Math.floor(rand() * ARTISTS.length)];
    const initials = artist.split(" ").map((s) => s[0]).join("");
    const hasAvatar = rand() < 0.45;
    blocks.push({
      id: `dummy-${blocks.length}`,
      squares: cells,
      shape,
      imageUrl: ART[Math.floor(rand() * ART.length)],
      // One tile per cell so multi-square blocks render as an assembled mosaic.
      cellImages: cells.map(() => ART[Math.floor(rand() * ART.length)]),
      caption: hasCaption ? CAPTIONS[Math.floor(rand() * CAPTIONS.length)] : null,
      linkUrl: "https://goldenpixel.co",
      state: "sold",
      status: "live",
      profile: {
        artist,
        bio: BIOS[Math.floor(rand() * BIOS.length)],
        about: ABOUTS[Math.floor(rand() * ABOUTS.length)],
        avatarUrl: hasAvatar
          ? avatar(initials, PALETTE[Math.floor(rand() * PALETTE.length)])
          : null,
      },
    });
    covered += cells.length;
  }
  return blocks;
}
