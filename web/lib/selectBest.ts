import type { PackResult } from "./types";

export type PriorityStrategy = "yield" | "cost" | "scrap";

export interface BoardPrices {
  price36: number;
  price48: number;
}

/** 板ラベルごとの枚数 */
export function countBoards(result: PackResult): { c36: number; c48: number } {
  let c36 = 0;
  let c48 = 0;
  for (const s of result.sheets) {
    const lbl = s.boardLabel ?? result.label;
    if (lbl === "3x6") c36++;
    else if (lbl === "4x8") c48++;
  }
  if (c36 === 0 && c48 === 0) {
    if (result.label === "3x6") c36 = result.sheet_count;
    else if (result.label === "4x8") c48 = result.sheet_count;
  }
  return { c36, c48 };
}

/** 概算材料費（円） */
export function estimateMaterialCost(
  result: PackResult,
  prices: BoardPrices
): number {
  const { c36, c48 } = countBoards(result);
  return c36 * prices.price36 + c48 * prices.price48;
}

/**
 * 端材の使い回しやすさスコア（大きいほど良い）
 * - 長手いっぱいの帯 … 加点
 * - 小さめの四角 … 減点
 */
export function scrapQualityScore(result: PackResult): number {
  let score = 0;
  for (const sheet of result.sheets) {
    const vw = sheet.vw ?? result.vw;
    for (const w of sheet.wasteRects) {
      const area = w.w * w.h;
      const fullWidth = w.w >= vw * 0.85;
      if (fullWidth && w.h >= 280) {
        score += area * 1.5;
      } else if (fullWidth && w.h >= 120) {
        score += area;
      } else {
        const maxSide = Math.max(w.w, w.h);
        const minSide = Math.min(w.w, w.h);
        const squareish =
          maxSide < 750 && minSide > 80 && minSide / maxSide > 0.45;
        if (squareish) score -= area * 1.2;
        else score -= area * 0.3;
      }
    }
  }
  return score;
}

function labelBias(label: string): number {
  if (label.startsWith("混在")) return 0;
  if (label === "3x6") return 1;
  if (label === "4x8") return 2;
  return 3;
}

function baseRank(
  x: PackResult,
  nRequested: number
): readonly [number, number] {
  return [
    x.total_parts_placed === nRequested ? 0 : 1,
    -x.total_parts_placed,
  ];
}

function rankByYield(x: PackResult, nRequested: number): readonly number[] {
  return [
    ...baseRank(x, nRequested),
    -x.utilization_pct,
    x.waste_area_mm2,
    x.sheet_count,
    labelBias(x.label),
  ];
}

function rankByCost(
  x: PackResult,
  nRequested: number,
  prices: BoardPrices
): readonly number[] {
  return [
    ...baseRank(x, nRequested),
    estimateMaterialCost(x, prices),
    -x.utilization_pct,
    x.sheet_count,
    labelBias(x.label),
  ];
}

function rankByScrap(x: PackResult, nRequested: number): readonly number[] {
  return [
    ...baseRank(x, nRequested),
    -scrapQualityScore(x),
    -x.utilization_pct,
    x.waste_area_mm2,
    x.sheet_count,
    labelBias(x.label),
  ];
}

/** @deprecated 旧「効率優先」（総面積最小）— 互換用 */
export function rankPackResult(
  x: PackResult,
  nRequested: number
): readonly number[] {
  return [
    ...baseRank(x, nRequested),
    x.score,
    x.waste_area_mm2,
    x.sheet_count,
    labelBias(x.label),
  ];
}

function rankForStrategy(
  x: PackResult,
  nRequested: number,
  strategy: PriorityStrategy,
  prices?: BoardPrices
): readonly number[] {
  switch (strategy) {
    case "cost":
      return rankByCost(x, nRequested, prices ?? { price36: 0, price48: 0 });
    case "scrap":
      return rankByScrap(x, nRequested);
    case "yield":
    default:
      return rankByYield(x, nRequested);
  }
}

export function pickBestPackResult(
  results: PackResult[],
  nRequested: number,
  strategy: PriorityStrategy = "yield",
  prices?: BoardPrices
): PackResult {
  if (results.length === 0) {
    throw new Error("候補がありません");
  }
  return results.reduce((a, b) => {
    const ka = rankForStrategy(a, nRequested, strategy, prices);
    const kb = rankForStrategy(b, nRequested, strategy, prices);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return a;
      if (ka[i] > kb[i]) return b;
    }
    return a;
  });
}

export function strategyFromSizeChoice(choice: string): PriorityStrategy | null {
  if (choice.startsWith("歩留まり率優先")) return "yield";
  if (choice.startsWith("材料価格優先")) return "cost";
  if (choice.startsWith("端材の使いやすさ優先")) return "scrap";
  return null;
}

export function strategyLabel(strategy: PriorityStrategy): string {
  switch (strategy) {
    case "yield":
      return "歩留まり率優先";
    case "cost":
      return "材料価格優先";
    case "scrap":
      return "端材の使いやすさ優先";
  }
}
