import type { Part, PlacedPart, Rect, Sheet } from "./types";

const MIN_WASTE_DISPLAY = 80; // 80mm 未満の端材は図では省略

function normalizePart(p: Part): Part {
  return { ...p, w: Math.max(p.w, p.d), d: Math.min(p.w, p.d) };
}

function isContained(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - 0.01 &&
    inner.y >= outer.y - 0.01 &&
    inner.x + inner.w <= outer.x + outer.w + 0.01 &&
    inner.y + inner.h <= outer.y + outer.h + 0.01
  );
}

function pruneFreeRects(rects: Rect[]): Rect[] {
  const valid = rects.filter((r) => r.w > 1 && r.h > 1);
  return valid.filter(
    (r, i) =>
      !valid.some((o, j) => i !== j && i !== j && isContained(r, o))
  );
}

function splitFreeRect(free: Rect, pw: number, ph: number, kerf: number): Rect[] {
  const next: Rect[] = [];
  const rightW = free.w - pw - kerf;
  const bottomH = free.h - ph - kerf;

  if (rightW > 1) {
    next.push({
      x: free.x + pw + kerf,
      y: free.y,
      w: rightW,
      h: free.h,
    });
  }
  if (bottomH > 1) {
    next.push({
      x: free.x,
      y: free.y + ph + kerf,
      w: free.w,
      h: bottomH,
    });
  }
  return next;
}

/** Best Short Side Fit: 短辺残りが最小になる空きを選ぶ */
function scoreFit(free: Rect, pw: number, ph: number, kerf: number): number {
  const leftoverW = free.w - pw - kerf;
  const leftoverH = free.h - ph - kerf;
  return Math.min(leftoverW, leftoverH);
}

function packOneSheet(
  parts: Part[],
  vw: number,
  vh: number,
  kerf: number
): { placed: PlacedPart[]; remaining: Part[]; wasteRects: Rect[] } {
  let freeRects: Rect[] = [{ x: 0, y: 0, w: vw, h: vh }];
  const remaining = [...parts];
  const placed: PlacedPart[] = [];
  let seq = 1;
  let improved = true;

  while (improved) {
    improved = false;
    let bestPartIdx = -1;
    let bestRectIdx = -1;
    let bestScore = Infinity;

    for (let pi = 0; pi < remaining.length; pi++) {
      const p = remaining[pi];
      for (let fi = 0; fi < freeRects.length; fi++) {
        const f = freeRects[fi];
        if (p.w <= f.w && p.d <= f.h) {
          const s = scoreFit(f, p.w, p.d, kerf);
          if (s < bestScore) {
            bestScore = s;
            bestPartIdx = pi;
            bestRectIdx = fi;
          }
        }
      }
    }

    if (bestPartIdx < 0) break;

    const part = remaining[bestPartIdx];
    const free = freeRects[bestRectIdx];
    placed.push({
      n: part.n,
      x: free.x,
      y: free.y,
      w: part.w,
      h: part.d,
      seq: seq++,
    });
    remaining.splice(bestPartIdx, 1);

    const splits = splitFreeRect(free, part.w, part.d, kerf);
    freeRects.splice(bestRectIdx, 1, ...splits);
    freeRects = pruneFreeRects(freeRects);
    improved = true;
  }

  const wasteRects = freeRects.filter(
    (r) => r.w >= MIN_WASTE_DISPLAY && r.h >= MIN_WASTE_DISPLAY
  );

  return { placed, remaining, wasteRects };
}

function packMaxRects(parts: Part[], vw: number, vh: number, kerf: number): Sheet[] {
  let remaining = [...parts];
  const sheets: Sheet[] = [];
  const sheetArea = vw * vh;

  while (remaining.length > 0) {
    const { placed, remaining: nextRemaining, wasteRects } = packOneSheet(
      remaining,
      vw,
      vh,
      kerf
    );

    if (placed.length === 0) break;

    const usedArea = placed.reduce((s, p) => s + p.w * p.h, 0);
    sheets.push({
      id: sheets.length + 1,
      parts: placed,
      wasteRects,
      utilization: sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0,
    });
    remaining = nextRemaining;
  }

  return sheets;
}

type SortFn = (parts: Part[]) => Part[];

const SORT_STRATEGIES: SortFn[] = [
  (parts) =>
    [...parts].sort((a, b) => b.w * b.d - a.w * a.d || b.w - a.w || b.d - a.d),
  (parts) => [...parts].sort((a, b) => b.w - a.w || b.d - a.d),
  (parts) => [...parts].sort((a, b) => b.d - a.d || b.w - a.w),
  (parts) =>
    [...parts].sort(
      (a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d) || b.w * b.d - a.w * a.d
    ),
  (parts) =>
    [...parts].sort((a, b) => b.w + b.d - (a.w + a.d) || b.w * b.d - a.w * a.d),
];

function resultRank(
  sheets: Sheet[],
  vw: number,
  vh: number,
  requested: number
): number {
  const placed = sheets.reduce((s, sh) => s + sh.parts.length, 0);
  const sheetArea = sheets.length * vw * vh;
  const usedArea = sheets.reduce(
    (s, sh) => s + sh.parts.reduce((ps, p) => ps + p.w * p.h, 0),
    0
  );
  const waste = sheetArea - usedArea;
  const unplaced = requested - placed;

  return (
    (unplaced > 0 ? 1e12 : 0) +
    sheets.length * 1e9 +
    waste * 1e3 -
    placed * 1e6
  );
}

export class TrunkTechEngine {
  constructor(private kerf: number = 3.0) {}

  packSheets(parts: Part[], vw: number, vh: number): Sheet[] {
    const normalized = parts.map((p) => normalizePart({ ...p }));
    const valid = normalized.filter((p) => p.w <= vw && p.d <= vh && p.w > 0 && p.d > 0);

    let bestSheets: Sheet[] = [];
    let bestRank = Infinity;

    for (const sort of SORT_STRATEGIES) {
      const sorted = sort(valid);
      const result = packMaxRects(sorted, vw, vh, this.kerf);
      const rank = resultRank(result, vw, vh, valid.length);
      if (rank < bestRank) {
        bestRank = rank;
        bestSheets = result;
      }
    }

    return bestSheets;
  }
}

export function calcPackStats(sheets: Sheet[], vw: number, vh: number) {
  const sheetArea = sheets.length * vw * vh;
  const usedArea = sheets.reduce(
    (s, sh) => s + sh.parts.reduce((ps, p) => ps + p.w * p.h, 0),
    0
  );
  const waste_area_mm2 = Math.max(0, sheetArea - usedArea);
  const utilization_pct =
    sheetArea > 0 ? Math.round((usedArea / sheetArea) * 1000) / 10 : 0;

  return { utilization_pct, waste_area_mm2 };
}

export function asLongShort(
  a: number,
  b: number,
  label: string
): [number, number, string] {
  const lo = Math.max(a, b);
  const sh = Math.min(a, b);
  return [lo - 2, sh - 2, label];
}

export function buildAllParts(
  shelfList: { 名称: string; 幅: number; 奥行: number; 枚数: number }[]
): Part[] {
  const allParts: Part[] = [];
  for (const row of shelfList) {
    const qty = row.枚数;
    if (!row.名称 || qty == null || Number.isNaN(qty)) continue;
    const nQty = Math.max(0, Math.floor(Number(qty)));
    for (let i = 0; i < nQty; i++) {
      allParts.push({
        n: row.名称,
        w: Number(row.幅) || 0,
        d: Number(row.奥行) || 0,
      });
    }
  }
  return allParts;
}
