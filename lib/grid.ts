// Pure grid geometry + validity logic. Shared by client (ghost preview) and server
// (reserve re-check). No I/O here so both sides compute identically.

import { GRID, SHAPES, type BlockShape } from "./config";
import type { Cell } from "./types";

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

// The cells a block of `shape` would cover with its top-left at (row, col).
export function cellsForPlacement(row: number, col: number, shape: BlockShape): Cell[] {
  const { w, h } = SHAPES[shape];
  const cells: Cell[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      cells.push({ row: row + dr, col: col + dc });
    }
  }
  return cells;
}

export function inBounds(row: number, col: number, shape: BlockShape): boolean {
  const { w, h } = SHAPES[shape];
  return row >= 0 && col >= 0 && row + h <= GRID.ROWS && col + w <= GRID.COLS;
}

// `occupied` is the set of cellKeys that are taken (sold + reserved + blocked).
export function isPlacementValid(
  row: number,
  col: number,
  shape: BlockShape,
  occupied: Set<string>
): boolean {
  if (!inBounds(row, col, shape)) return false;
  for (const cell of cellsForPlacement(row, col, shape)) {
    if (occupied.has(cellKey(cell.row, cell.col))) return false;
  }
  return true;
}

// Build the occupied set from a list of taken cells.
export function occupiedSet(cells: Cell[]): Set<string> {
  const s = new Set<string>();
  for (const c of cells) s.add(cellKey(c.row, c.col));
  return s;
}
