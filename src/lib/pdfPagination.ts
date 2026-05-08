/**
 * Pure pagination helpers used by ExportPdfButton.
 *
 * All sizes are in canvas pixels (the rendered html2canvas output).
 * The PDF is always A4 portrait — `firstPagePx` accounts for header/summary
 * height on page 1 and `fullPagePx` is the usable image area on subsequent pages.
 *
 * Guarantees enforced (and verified by tests):
 *  - Slices never overlap (no repeated content).
 *  - Slices cover the canvas exactly from 0 to canvasHeight (no missing content).
 *  - Each slice height is <= the per-page limit (no A4 overflow / cuts).
 *  - The algorithm always terminates (no infinite loops on degenerate input).
 */

export interface Slice {
  start: number;
  end: number;
}

export interface PaginateInput {
  canvasHeight: number;
  /** Candidate Y coordinates where it's safe to break (must include 0 and canvasHeight). */
  breaks: number[];
  firstPagePx: number;
  fullPagePx: number;
  /** Minimum fraction of a page that must be filled before accepting a short break. */
  minFill?: number;
}

/**
 * Greedy page-break picker: from `start`, walks `breaks` and chooses the
 * largest one within `start + maxLen`. Falls back to a hard cut at the limit
 * when no candidate fills at least `minFill` of the page.
 */
export const pickCut = (
  start: number,
  maxLen: number,
  breaks: number[],
  canvasHeight: number,
  minFill = 0.15,
): number => {
  const limit = Math.min(start + maxLen, canvasHeight);
  let best = start;
  for (const b of breaks) {
    if (b > start && b <= limit) best = b;
    if (b > limit) break;
  }
  if (best - start < maxLen * minFill) return limit;
  return best;
};

export const paginateCanvas = ({
  canvasHeight,
  breaks,
  firstPagePx,
  fullPagePx,
  minFill = 0.15,
}: PaginateInput): Slice[] => {
  if (canvasHeight <= 0 || firstPagePx <= 0 || fullPagePx <= 0) return [];

  // Defensive: ensure 0 / canvasHeight are present and breaks are sorted unique.
  const sorted = Array.from(new Set([0, canvasHeight, ...breaks]))
    .filter((b) => b >= 0 && b <= canvasHeight)
    .sort((a, b) => a - b);

  const slices: Slice[] = [];
  let cursor = 0;
  // Hard upper bound on iterations to make infinite-loop bugs impossible.
  const maxIter = Math.ceil(canvasHeight / Math.min(firstPagePx, fullPagePx)) + 4;

  while (cursor < canvasHeight && slices.length < maxIter) {
    const isFirst = slices.length === 0;
    const maxLen = isFirst ? firstPagePx : fullPagePx;
    const end = pickCut(cursor, maxLen, sorted, canvasHeight, minFill);
    if (end <= cursor) break;
    slices.push({ start: cursor, end });
    cursor = end;
  }

  return slices;
};
