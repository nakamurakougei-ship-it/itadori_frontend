import type { Part, PlacedPart, Rect, Sheet } from "./types";

const MIN_WASTE_DISPLAY = 80;
/** 行端ストリップに嵌める最小幅 (mm) */
const MIN_STRIP_FILL = 120;

export function normalizePart(p: Part): Part {
  return { ...p, w: Math.max(p.w, p.d), d: Math.min(p.w, p.d) };
}

function dimKey(p: Part): string {
  return `${Math.round(p.w)}x${Math.round(p.d)}`;
}

interface RowState {
  y: number;
  h: number;
  usedW: number;
  parts: PlacedPart[];
}

interface SheetState {
  rows: RowState[];
  usedH: number;
}

function rowsToPlaced(rows: RowState[]): PlacedPart[] {
  const placed: PlacedPart[] = [];
  let seq = 1;
  for (const r of rows) {
    for (const p of r.parts) {
      placed.push({ ...p, seq: seq++ });
    }
  }
  return placed;
}

function computeWasteRects(
  rows: RowState[],
  usedH: number,
  vw: number,
  vh: number
): Rect[] {
  const waste: Rect[] = [];
  for (const r of rows) {
    const rightW = vw - r.usedW;
    if (rightW >= MIN_WASTE_DISPLAY && r.h >= MIN_WASTE_DISPLAY) {
      waste.push({ x: r.usedW, y: r.y, w: rightW, h: r.h });
    }
  }
  const bottomH = vh - usedH;
  if (bottomH >= MIN_WASTE_DISPLAY) {
    waste.push({ x: 0, y: usedH, w: vw, h: bottomH });
  }
  return waste;
}

function sheetDimLabel(rows: RowState[]): string {
  const keys = new Set<string>();
  for (const r of rows) {
    for (const p of r.parts) {
      keys.add(`${Math.round(p.w)}×${Math.round(p.h)}`);
    }
  }
  return [...keys].sort().join(" + ");
}

function finalizeSheet(
  state: SheetState,
  vw: number,
  vh: number,
  groupSize: string,
  groupSheetIndex: number
): Sheet {
  const parts = rowsToPlaced(state.rows);
  const usedArea = parts.reduce((s, p) => s + p.w * p.h, 0);
  const sheetArea = vw * vh;
  const dims = sheetDimLabel(state.rows);
  const label = dims.includes("+") ? dims : groupSize;
  return {
    id: 0,
    parts,
    wasteRects: computeWasteRects(state.rows, state.usedH, vw, vh),
    utilization: sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0,
    groupSize: label,
    groupSheetIndex,
  };
}

/**
 * 行の右端余り（例: 1500mm 取り後の 300mm 帯）に、
 * 他寸法の部材が入れば嵌める — 職人の「1500+300」判断。
 */
function fillRowStrip(
  row: RowState,
  vw: number,
  pool: Map<string, Part[]>,
  ownerKey: string,
  kerf: number
): void {
  let x = row.usedW;

  while (x + MIN_STRIP_FILL <= vw) {
    let best: { key: string; idx: number; part: Part } | null = null;

    for (const [key, list] of pool.entries()) {
      if (key === ownerKey) continue;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.w <= vw - x && p.d <= row.h) {
          if (!best || p.w > best.part.w) {
            best = { key, idx: i, part: p };
          }
        }
      }
    }

    if (!best) break;

    const list = pool.get(best.key)!;
    const p = list.splice(best.idx, 1)[0];
    row.parts.push({
      n: p.n,
      x,
      y: row.y,
      w: p.w,
      h: p.d,
      seq: 0,
    });
    x += p.w + kerf;
  }

  row.usedW = x;
}

function placePrimaryInSheet(
  parts: Part[],
  pw: number,
  ph: number,
  state: SheetState,
  vw: number,
  vh: number,
  kerf: number,
  ownerKey: string,
  pool: Map<string, Part[]> | null
): boolean {
  const placeInRow = (r: RowState): boolean => {
    if (parts.length === 0 || r.h !== ph || vw - r.usedW < pw) return false;
    const p = parts.shift()!;
    r.parts.push({
      n: p.n,
      x: r.usedW,
      y: r.y,
      w: pw,
      h: ph,
      seq: 0,
    });
    r.usedW += pw + kerf;
    if (pool) fillRowStrip(r, vw, pool, ownerKey, kerf);
    return true;
  };

  for (const r of state.rows) {
    if (placeInRow(r)) return true;
  }

  if (vh - state.usedH >= ph && parts.length > 0) {
    const p = parts.shift()!;
    const row: RowState = {
      y: state.usedH,
      h: ph,
      usedW: pw + kerf,
      parts: [{ n: p.n, x: 0, y: state.usedH, w: pw, h: ph, seq: 0 }],
    };
    if (pool) fillRowStrip(row, vw, pool, ownerKey, kerf);
    state.rows.push(row);
    state.usedH += ph + kerf;
    return true;
  }

  return false;
}

/**
 * 同寸法・行割り配置（ストリップ充填なし）
 */
function packHomogeneousGroup(
  parts: Part[],
  vw: number,
  vh: number,
  kerf: number,
  groupSize: string
): Sheet[] {
  if (parts.length === 0) return [];

  const queue = [...parts];
  const pw = queue[0].w;
  const ph = queue[0].d;
  const sheets: SheetState[] = [];

  while (queue.length > 0) {
    let placed = false;
    for (const s of sheets) {
      if (placePrimaryInSheet(queue, pw, ph, s, vw, vh, kerf, groupSize, null)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newSheet: SheetState = { rows: [], usedH: 0 };
      placePrimaryInSheet(queue, pw, ph, newSheet, vw, vh, kerf, groupSize, null);
      sheets.push(newSheet);
    }
  }

  return sheets.map((s, i) => finalizeSheet(s, vw, vh, groupSize, i + 1));
}

/** 主グループ配置 + 行端ストリップに他寸法を嵌める */
function packHomogeneousGroupWithStripFill(
  vw: number,
  vh: number,
  kerf: number,
  ownerKey: string,
  pool: Map<string, Part[]>
): Sheet[] {
  const parts = pool.get(ownerKey)!;
  if (parts.length === 0) return [];

  const pw = parts[0].w;
  const ph = parts[0].d;
  const sheets: SheetState[] = [];

  while (parts.length > 0) {
    let placed = false;
    for (const s of sheets) {
      if (
        placePrimaryInSheet(parts, pw, ph, s, vw, vh, kerf, ownerKey, pool)
      ) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newSheet: SheetState = { rows: [], usedH: 0 };
      placePrimaryInSheet(parts, pw, ph, newSheet, vw, vh, kerf, ownerKey, pool);
      sheets.push(newSheet);
    }
  }

  return sheets.map((s, i) => finalizeSheet(s, vw, vh, ownerKey, i + 1));
}

function groupByDimension(parts: Part[]): Map<string, Part[]> {
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    const key = dimKey(p);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  return groups;
}

/** 長手方向の長さが大きいグループから（1500 の行を先に確保） */
function sortGroupKeys(groups: Map<string, Part[]>): string[] {
  return [...groups.keys()].sort((a, b) => {
    const pa = groups.get(a)!;
    const pb = groups.get(b)!;
    return pb[0].w - pa[0].w || pb[0].d - pa[0].d;
  });
}

/**
 * 職人向け木取り:
 * 1) 大きい寸法グループを行割り
 * 2) 行端ストリップに小さい寸法を嵌める（1500+300）
 * 3) 残りを同寸法で取る
 */
function packGroupedGuillotine(
  parts: Part[],
  vw: number,
  vh: number,
  kerf: number
): Sheet[] {
  const groups = groupByDimension(parts);
  const orderedKeys = sortGroupKeys(groups);
  const pool = new Map<string, Part[]>();
  for (const [k, v] of groups) pool.set(k, [...v]);

  const allSheets: Sheet[] = [];
  let id = 1;

  for (const key of orderedKeys) {
    if ((pool.get(key)?.length ?? 0) === 0) continue;
    const groupSheets = packHomogeneousGroupWithStripFill(
      vw,
      vh,
      kerf,
      key,
      pool
    );
    for (const s of groupSheets) {
      allSheets.push({ ...s, id: id++ });
    }
  }

  for (const key of orderedKeys) {
    const remaining = pool.get(key)!;
    if (remaining.length === 0) continue;
    for (const s of packHomogeneousGroup(
      remaining,
      vw,
      vh,
      kerf,
      key
    )) {
      allSheets.push({ ...s, id: id++ });
    }
  }

  return allSheets;
}

// ─── 端材統合（尻板マージ）用 MaxRects ─────────────────────────

function isContainedRect(inner: Rect, outer: Rect): boolean {
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
    (r, i) => !valid.some((o, j) => i !== j && isContainedRect(r, o))
  );
}

/** L字3分割 — 右帯を板全体高にすると下帯と重なり部品が載る */
function splitFreeRect(free: Rect, pw: number, ph: number, kerf: number): Rect[] {
  const next: Rect[] = [];
  const rightW = free.w - pw - kerf;
  const bottomH = free.h - ph - kerf;
  if (rightW > 1) {
    next.push({ x: free.x + pw + kerf, y: free.y, w: rightW, h: ph });
  }
  if (bottomH > 1) {
    next.push({ x: free.x, y: free.y + ph + kerf, w: pw, h: bottomH });
  }
  if (rightW > 1 && bottomH > 1) {
    next.push({
      x: free.x + pw + kerf,
      y: free.y + ph + kerf,
      w: rightW,
      h: bottomH,
    });
  }
  return next;
}

function placedPartsOverlap(a: PlacedPart, b: PlacedPart): boolean {
  return (
    a.x < b.x + b.w - 0.01 &&
    a.x + a.w > b.x + 0.01 &&
    a.y < b.y + b.h - 0.01 &&
    a.y + a.h > b.y + 0.01
  );
}

function placedFitsBoard(p: PlacedPart, vw: number, vh: number): boolean {
  return (
    p.x >= -0.01 &&
    p.y >= -0.01 &&
    p.x + p.w <= vw + 0.01 &&
    p.y + p.h <= vh + 0.01
  );
}

function isValidPlacement(
  candidate: PlacedPart,
  placed: PlacedPart[],
  vw: number,
  vh: number
): boolean {
  if (!placedFitsBoard(candidate, vw, vh)) return false;
  return !placed.some((p) => placedPartsOverlap(p, candidate));
}

function scoreFit(free: Rect, pw: number, ph: number, kerf: number): number {
  return Math.min(free.w - pw - kerf, free.h - ph - kerf);
}

/** 1枚板に全部載るか試す（混載用） */
function tryPackOnSingleSheet(
  parts: Part[],
  vw: number,
  vh: number,
  kerf: number
): Sheet | null {
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
          const candidate: PlacedPart = {
            n: p.n,
            x: f.x,
            y: f.y,
            w: p.w,
            h: p.d,
            seq: 0,
          };
          if (!isValidPlacement(candidate, placed, vw, vh)) continue;
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
    freeRects.splice(bestRectIdx, 1, ...splitFreeRect(free, part.w, part.d, kerf));
    freeRects = pruneFreeRects(freeRects);
    improved = true;
  }

  if (remaining.length > 0) return null;

  const sheetArea = vw * vh;
  const usedArea = placed.reduce((s, p) => s + p.w * p.h, 0);
  const wasteRects = freeRects.filter(
    (r) => r.w >= MIN_WASTE_DISPLAY && r.h >= MIN_WASTE_DISPLAY
  );
  const sizes = [...new Set(parts.map(dimKey))].sort().join(" + ");

  return {
    id: 0,
    parts: placed,
    wasteRects,
    utilization: sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0,
    groupSize: sizes,
    merged: true,
  };
}

function placedToParts(placed: PlacedPart[]): Part[] {
  return placed.map((p) => ({ n: p.n, w: p.w, d: p.h }));
}

export function renumberSheets(sheets: Sheet[]): Sheet[] {
  return sheets.map((s, i) => ({ ...s, id: i + 1 }));
}

export function stampSheets(
  sheets: Sheet[],
  vw: number,
  vh: number,
  boardLabel: string
): Sheet[] {
  return sheets.map((s) => ({ ...s, vw, vh, boardLabel }));
}

/** 各グループの最終板＋低歩留まり板を端材統合候補にする */
function tailCandidateIndices(sheets: Sheet[]): number[] {
  const lastByGroup = new Map<string, number>();
  sheets.forEach((s, i) => {
    if (!s.merged && s.groupSize) {
      lastByGroup.set(s.groupSize, i);
    }
  });
  const indices = new Set<number>();
  for (const i of lastByGroup.values()) {
    if (sheets[i].utilization < 72) indices.add(i);
  }
  sheets.forEach((s, i) => {
    if (s.merged) return;
    if (s.utilization < 52) indices.add(i);
  });
  return [...indices];
}

/**
 * 尻板同士を1枚に統合できるか試す（職人の「端材同士を合わせる」判断）
 */
function mergeTailSheets(
  sheets: Sheet[],
  vw: number,
  vh: number,
  kerf: number
): Sheet[] {
  let current = [...sheets];
  let improved = true;

  while (improved) {
    improved = false;
    const candidates = tailCandidateIndices(current);
    if (candidates.length < 2) break;

    let bestPair: [number, number] | null = null;
    let bestMerged: Sheet | null = null;
    let bestScore = Infinity;

    for (let a = 0; a < candidates.length; a++) {
      for (let b = a + 1; b < candidates.length; b++) {
        const i = candidates[a];
        const j = candidates[b];
        const sa = current[i];
        const sb = current[j];
        if (!sa || !sb || i === j) continue;

        const combined = [
          ...placedToParts(sa.parts),
          ...placedToParts(sb.parts),
        ];
        const merged = tryPackOnSingleSheet(combined, vw, vh, kerf);
        if (!merged) continue;

        const savedArea = vw * vh;
        const newUtil = merged.utilization;
        const score = -savedArea + (100 - newUtil);

        if (score < bestScore) {
          bestScore = score;
          bestPair = [i, j];
          bestMerged = merged;
        }
      }
    }

    if (bestPair && bestMerged) {
      const [i, j] = bestPair;
      const next = current.filter((_, idx) => idx !== i && idx !== j);
      next.push(bestMerged);
      current = renumberSheets(next);
      improved = true;
    }
  }

  return current;
}

function packGroupedGuillotineWithMerge(
  parts: Part[],
  vw: number,
  vh: number,
  kerf: number
): Sheet[] {
  const grouped = packGroupedGuillotine(parts, vw, vh, kerf);
  return mergeTailSheets(grouped, vw, vh, kerf);
}

export class TrunkTechEngine {
  constructor(private kerf: number = 3.0) {}

  packSheets(
    parts: Part[],
    vw: number,
    vh: number,
    boardLabel?: string
  ): Sheet[] {
    const normalized = parts.map((p) => normalizePart({ ...p }));
    const valid = normalized.filter(
      (p) => p.w <= vw && p.d <= vh && p.w > 0 && p.d > 0
    );
    const sheets = packGroupedGuillotineWithMerge(valid, vw, vh, this.kerf);
    return boardLabel ? stampSheets(sheets, vw, vh, boardLabel) : sheets;
  }
}

export function calcPackStats(
  sheets: Sheet[],
  fallbackVw?: number,
  fallbackVh?: number
) {
  const sheetArea = sheets.reduce((s, sh) => {
    const w = sh.vw ?? fallbackVw ?? 0;
    const h = sh.vh ?? fallbackVh ?? 0;
    return s + w * h;
  }, 0);
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
  shelfList: { 名称: string; 長さ: number; 幅: number; 枚数: number }[]
): Part[] {
  const allParts: Part[] = [];
  for (const row of shelfList) {
    const qty = row.枚数;
    if (!row.名称 || qty == null || Number.isNaN(qty)) continue;
    const nQty = Math.max(0, Math.floor(Number(qty)));
    for (let i = 0; i < nQty; i++) {
      allParts.push({
        n: row.名称,
        w: Number(row.長さ) || 0,
        d: Number(row.幅) || 0,
      });
    }
  }
  return allParts;
}
