import { describe, it, expect } from "vitest";
import { paginateCanvas, pickCut, type Slice } from "./pdfPagination";

/**
 * A4 portrait at 72pt/in:
 *   width  = 595.28pt
 *   height = 841.89pt
 * The export uses margin = 24pt and usableW = 595.28 - 48 = 547.28pt.
 *
 * For each test we model html2canvas output for a given viewport / zoom by
 * choosing canvasWidth (proportional to viewport CSS width × scale) and a
 * canvasHeight derived from a hypothetical document height. That gives us
 * realistic firstPagePx / fullPagePx for the A4 paper.
 */

const A4_W_PT = 595.28;
const A4_H_PT = 841.89;
const MARGIN_PT = 24;
const USABLE_W_PT = A4_W_PT - MARGIN_PT * 2;

interface RenderProfile {
  name: string;
  /** CSS width of the dashboard root in px */
  cssWidth: number;
  /** html2canvas scale (2 = high fidelity, 1 = fallback) */
  scale: number;
  /** Total CSS height of the dashboard in px */
  cssHeight: number;
  /** Header + summary block height on page 1, in pt */
  headerPt: number;
}

const profiles: RenderProfile[] = [
  // Mobile: narrow viewport, very tall layout, high zoom (scale 2)
  { name: "mobile @scale 2", cssWidth: 390, scale: 2, cssHeight: 4200, headerPt: 110 },
  // Tablet: medium viewport, fallback scale 1.5
  { name: "tablet @scale 1.5", cssWidth: 820, scale: 1.5, cssHeight: 3000, headerPt: 90 },
  // Desktop: wide viewport, high fidelity
  { name: "desktop @scale 2", cssWidth: 1400, scale: 2, cssHeight: 2600, headerPt: 80 },
  // Desktop minimum-fallback: low scale (fallback "minimo")
  { name: "desktop fallback @scale 1", cssWidth: 1400, scale: 1, cssHeight: 2600, headerPt: 80 },
  // Pathological: extremely tall content (long table dump)
  { name: "huge report @scale 2", cssWidth: 1280, scale: 2, cssHeight: 12000, headerPt: 140 },
  // Very short — fits in one page
  { name: "single-page", cssWidth: 1280, scale: 2, cssHeight: 600, headerPt: 80 },
];

const computePageBudgets = (p: RenderProfile) => {
  const canvasWidth = p.cssWidth * p.scale;
  const canvasHeight = p.cssHeight * p.scale;
  const pxPerPt = canvasWidth / USABLE_W_PT;
  const firstPagePx = Math.floor((A4_H_PT - (MARGIN_PT + p.headerPt) - MARGIN_PT) * pxPerPt);
  const fullPagePx = Math.floor((A4_H_PT - MARGIN_PT * 2) * pxPerPt);
  return { canvasHeight, firstPagePx, fullPagePx };
};

/**
 * Build a synthetic break list mimicking real DOM cards: sections of varying
 * heights with optional dense rows (tables). seed lets us reproduce.
 */
const buildBreaks = (canvasHeight: number, sectionAvgPx: number, jitter = 0.4): number[] => {
  const breaks = [0];
  let y = 0;
  let i = 0;
  while (y < canvasHeight) {
    // Pseudo-random but deterministic step
    const r = Math.sin(i++ * 12.9898) * 43758.5453;
    const noise = (r - Math.floor(r)) * 2 - 1; // -1..1
    const step = Math.max(40, sectionAvgPx * (1 + noise * jitter));
    y += step;
    if (y < canvasHeight) breaks.push(Math.round(y));
  }
  breaks.push(canvasHeight);
  return breaks;
};

const assertCoversWithoutOverlap = (slices: Slice[], canvasHeight: number) => {
  expect(slices.length).toBeGreaterThan(0);
  expect(slices[0].start).toBe(0);
  expect(slices[slices.length - 1].end).toBe(canvasHeight);
  for (let i = 0; i < slices.length; i++) {
    expect(slices[i].end).toBeGreaterThan(slices[i].start);
    if (i > 0) {
      // No gap, no overlap
      expect(slices[i].start).toBe(slices[i - 1].end);
    }
  }
};

const assertWithinPageLimits = (
  slices: Slice[],
  firstPagePx: number,
  fullPagePx: number,
) => {
  slices.forEach((s, idx) => {
    const limit = idx === 0 ? firstPagePx : fullPagePx;
    expect(s.end - s.start).toBeLessThanOrEqual(limit);
  });
};

describe("paginateCanvas — A4 invariants across viewports & zoom", () => {
  for (const profile of profiles) {
    describe(profile.name, () => {
      const { canvasHeight, firstPagePx, fullPagePx } = computePageBudgets(profile);

      // Three break "densities" simulate different content layouts /
      // browser zoom levels (which change rendered card heights).
      const densities: Array<{ label: string; avg: number }> = [
        { label: "sparse breaks (zoom out)", avg: fullPagePx * 0.9 },
        { label: "medium breaks", avg: fullPagePx * 0.45 },
        { label: "dense breaks (zoom in / tables)", avg: fullPagePx * 0.12 },
      ];

      for (const d of densities) {
        it(`${d.label}: covers canvas without gap or overlap`, () => {
          const breaks = buildBreaks(canvasHeight, d.avg);
          const slices = paginateCanvas({
            canvasHeight,
            breaks,
            firstPagePx,
            fullPagePx,
          });
          assertCoversWithoutOverlap(slices, canvasHeight);
        });

        it(`${d.label}: respects A4 page height limits`, () => {
          const breaks = buildBreaks(canvasHeight, d.avg);
          const slices = paginateCanvas({
            canvasHeight,
            breaks,
            firstPagePx,
            fullPagePx,
          });
          assertWithinPageLimits(slices, firstPagePx, fullPagePx);
        });

        it(`${d.label}: terminates with a finite number of pages`, () => {
          const breaks = buildBreaks(canvasHeight, d.avg);
          const slices = paginateCanvas({
            canvasHeight,
            breaks,
            firstPagePx,
            fullPagePx,
          });
          // Upper bound: ceil(H / fullPage) + 2 (first page can be smaller)
          const upper = Math.ceil(canvasHeight / fullPagePx) + 2;
          expect(slices.length).toBeLessThanOrEqual(upper);
        });
      }
    });
  }
});

describe("paginateCanvas — edge cases", () => {
  it("returns a single slice when content fits in the first page", () => {
    const slices = paginateCanvas({
      canvasHeight: 500,
      breaks: [0, 500],
      firstPagePx: 1000,
      fullPagePx: 1500,
    });
    expect(slices).toEqual([{ start: 0, end: 500 }]);
  });

  it("falls back to a hard cut when no break fits the minimum fill", () => {
    // Only candidates are very near the start — minFill 0.15 should reject them
    // and force a hard cut at the page limit.
    const slices = paginateCanvas({
      canvasHeight: 3000,
      breaks: [0, 50, 80, 3000],
      firstPagePx: 1000,
      fullPagePx: 1000,
    });
    expect(slices[0]).toEqual({ start: 0, end: 1000 });
    assertCoversWithoutOverlap(slices, 3000);
  });

  it("never produces overlapping pages even with duplicated breaks", () => {
    const breaks = [0, 100, 100, 100, 500, 500, 1200, 1800, 1800, 2400];
    const slices = paginateCanvas({
      canvasHeight: 2400,
      breaks,
      firstPagePx: 800,
      fullPagePx: 1000,
    });
    assertCoversWithoutOverlap(slices, 2400);
    assertWithinPageLimits(slices, 800, 1000);
  });

  it("returns [] for degenerate input", () => {
    expect(paginateCanvas({ canvasHeight: 0, breaks: [], firstPagePx: 100, fullPagePx: 100 })).toEqual([]);
    expect(paginateCanvas({ canvasHeight: 100, breaks: [], firstPagePx: 0, fullPagePx: 100 })).toEqual([]);
  });

  it("pickCut prefers the largest break within the limit", () => {
    expect(pickCut(0, 1000, [0, 200, 500, 900, 1100, 2000], 2000)).toBe(900);
  });

  it("pickCut returns a hard limit when the only candidate is too small", () => {
    // Best break is 50 (5% of maxLen) — below default 15% minFill → hard cut
    expect(pickCut(0, 1000, [0, 50, 2000], 2000)).toBe(1000);
  });
});
