import { describe, it, expect } from "vitest";
import { paginateCanvas, type Slice } from "./pdfPagination";

/**
 * "Real layout" pagination tests.
 *
 * Instead of synthetic uniform breaks, here we model dashboards composed of
 * heterogeneous blocks that mirror what html2canvas produces in production:
 *
 *   - Long headers (multi-line title + filter summary)
 *   - KPI card grids (rows of small fixed-height cards)
 *   - Charts (tall, indivisible blocks → no inner break)
 *   - Tables with many rows (lots of close-by row breaks + a thead break)
 *   - Embedded images / iframes (big indivisible rectangles)
 *
 * For each block we declare whether it can be broken across pages. Atomic
 * blocks only emit start/end breaks; row-based blocks (tables) also emit a
 * break per row. This is exactly how the production code collects breaks
 * from the DOM, so the resulting break list is a faithful proxy.
 *
 * Invariants verified per layout:
 *   1. No overlap, no gap — every pixel covered exactly once.
 *   2. Each slice fits in its A4 page budget.
 *   3. No atomic block (chart / image / iframe) is split across pages.
 *   4. A page never starts mid-block (start of a slice is always a registered break).
 */

// ─── A4 geometry ──────────────────────────────────────────────────────────
const A4_W_PT = 595.28;
const A4_H_PT = 841.89;
const MARGIN_PT = 24;
const USABLE_W_PT = A4_W_PT - MARGIN_PT * 2;

interface Block {
  id: string;
  heightPx: number;
  /** Atomic blocks must never be split across pages. */
  atomic: boolean;
  /** For row-based blocks: heights of internal rows (sum ≤ heightPx). */
  rowHeightsPx?: number[];
}

interface Layout {
  name: string;
  cssWidth: number;
  scale: number;
  /** Header/summary block height on page 1 in pt. */
  headerPt: number;
  blocks: Block[];
}

// ─── Layout fixtures ──────────────────────────────────────────────────────
const layouts: Layout[] = [
  {
    name: "executive dashboard (charts + KPI grid + iframe)",
    cssWidth: 1280,
    scale: 2,
    headerPt: 130,
    blocks: [
      { id: "header-banner", heightPx: 220, atomic: true },
      { id: "kpi-row-1", heightPx: 180, atomic: true },
      { id: "kpi-row-2", heightPx: 180, atomic: true },
      { id: "funnel-chart", heightPx: 520, atomic: true },
      { id: "trend-chart", heightPx: 520, atomic: true },
      { id: "embedded-iframe-report", heightPx: 700, atomic: true },
      { id: "footer-image", heightPx: 280, atomic: true },
    ],
  },
  {
    name: "tabular report (long table + thumbnails)",
    cssWidth: 1280,
    scale: 2,
    headerPt: 110,
    blocks: [
      { id: "title-block", heightPx: 160, atomic: true },
      { id: "filters-image", heightPx: 240, atomic: true },
      {
        id: "operators-table",
        heightPx: 60 + 48 * 80, // thead + 80 rows
        atomic: false,
        rowHeightsPx: [60, ...Array.from({ length: 80 }, () => 48)],
      },
      { id: "ranking-chart", heightPx: 480, atomic: true },
      {
        id: "stalled-table",
        heightPx: 60 + 56 * 40,
        atomic: false,
        rowHeightsPx: [60, ...Array.from({ length: 40 }, () => 56)],
      },
    ],
  },
  {
    name: "mixed dense layout (mobile @scale 2, narrow + tall)",
    cssWidth: 390,
    scale: 2,
    headerPt: 150,
    blocks: [
      { id: "logo", heightPx: 120, atomic: true },
      { id: "summary-paragraph", heightPx: 360, atomic: true },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `kpi-card-${i}`,
        heightPx: 220,
        atomic: true,
      })),
      { id: "heatmap-image", heightPx: 900, atomic: true }, // very tall image
      {
        id: "deals-table",
        heightPx: 50 + 44 * 30,
        atomic: false,
        rowHeightsPx: [50, ...Array.from({ length: 30 }, () => 44)],
      },
      { id: "trend-chart", heightPx: 480, atomic: true },
    ],
  },
  {
    name: "edge: single chart larger than a page",
    cssWidth: 1280,
    scale: 2,
    headerPt: 100,
    blocks: [
      { id: "intro", heightPx: 160, atomic: true },
      // This chart, once converted to canvas px, will exceed the page budget.
      // The pagination must still progress (hard cut) and not loop.
      { id: "giant-chart", heightPx: 4500, atomic: true },
      { id: "outro", heightPx: 200, atomic: true },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const buildScenario = (layout: Layout) => {
  const totalCssHeight = layout.blocks.reduce((s, b) => s + b.heightPx, 0);
  const canvasWidth = layout.cssWidth * layout.scale;
  const canvasHeight = totalCssHeight * layout.scale;
  const pxPerPt = canvasWidth / USABLE_W_PT;
  const firstPagePx = Math.floor(
    (A4_H_PT - (MARGIN_PT + layout.headerPt) - MARGIN_PT) * pxPerPt,
  );
  const fullPagePx = Math.floor((A4_H_PT - MARGIN_PT * 2) * pxPerPt);

  const breaks: number[] = [0];
  // Atomic ranges (in canvas px) — a slice MUST NOT split any of these.
  const atomicRanges: Array<{ start: number; end: number; id: string }> = [];

  let cursorCss = 0;
  for (const block of layout.blocks) {
    const startPx = Math.round(cursorCss * layout.scale);
    const endPx = Math.round((cursorCss + block.heightPx) * layout.scale);
    breaks.push(startPx, endPx);

    if (block.atomic) {
      atomicRanges.push({ start: startPx, end: endPx, id: block.id });
    } else if (block.rowHeightsPx) {
      // Emit a break at the top of each row (post-thead it's safe to break).
      let rowCss = cursorCss;
      for (const rh of block.rowHeightsPx) {
        rowCss += rh;
        breaks.push(Math.round(rowCss * layout.scale));
      }
    }
    cursorCss += block.heightPx;
  }

  const dedup = Array.from(new Set(breaks))
    .filter((b) => b >= 0 && b <= canvasHeight)
    .sort((a, b) => a - b);

  return { canvasHeight, firstPagePx, fullPagePx, breaks: dedup, atomicRanges };
};

const assertContiguous = (slices: Slice[], canvasHeight: number) => {
  expect(slices.length).toBeGreaterThan(0);
  expect(slices[0].start).toBe(0);
  expect(slices[slices.length - 1].end).toBe(canvasHeight);
  for (let i = 1; i < slices.length; i++) {
    expect(slices[i].start).toBe(slices[i - 1].end);
  }
};

const assertWithinBudget = (
  slices: Slice[],
  firstPagePx: number,
  fullPagePx: number,
) => {
  slices.forEach((s, i) => {
    const limit = i === 0 ? firstPagePx : fullPagePx;
    expect(s.end - s.start).toBeLessThanOrEqual(limit);
  });
};

const assertNoAtomicSplit = (
  slices: Slice[],
  atomicRanges: Array<{ start: number; end: number; id: string }>,
  /** Atomics taller than a full page are unavoidable to cut — exclude them. */
  fullPagePx: number,
) => {
  const cuts = slices.slice(0, -1).map((s) => s.end);
  for (const range of atomicRanges) {
    if (range.end - range.start > fullPagePx) continue;
    for (const c of cuts) {
      const splits = c > range.start && c < range.end;
      expect(splits, `slice cut at ${c} splits atomic block "${range.id}" (${range.start}-${range.end})`).toBe(false);
    }
  }
};

const assertStartsAtBreak = (slices: Slice[], breaks: number[]) => {
  const breakSet = new Set(breaks);
  for (const s of slices) {
    expect(breakSet.has(s.start)).toBe(true);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────
describe("paginateCanvas — realistic layouts", () => {
  for (const layout of layouts) {
    describe(layout.name, () => {
      const scenario = buildScenario(layout);

      it("covers the canvas without gaps or overlaps", () => {
        const slices = paginateCanvas(scenario);
        assertContiguous(slices, scenario.canvasHeight);
      });

      it("respects A4 page budgets on every page", () => {
        const slices = paginateCanvas(scenario);
        assertWithinBudget(slices, scenario.firstPagePx, scenario.fullPagePx);
      });

      it("never splits atomic blocks (charts / images / iframes)", () => {
        const slices = paginateCanvas(scenario);
        assertNoAtomicSplit(slices, scenario.atomicRanges, scenario.fullPagePx);
      });

      it("starts every page at a registered break point", () => {
        const slices = paginateCanvas(scenario);
        assertStartsAtBreak(slices, scenario.breaks);
      });

      it("never repeats a slice (unique [start,end) intervals)", () => {
        const slices = paginateCanvas(scenario);
        const seen = new Set<string>();
        for (const s of slices) {
          const key = `${s.start}-${s.end}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      });
    });
  }
});
