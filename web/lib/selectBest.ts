import type { PackResult } from "./types";

/** 板サイズの優先度（同条件なら小さい定尺を選ぶ） */
function labelBias(label: string): number {
  if (label === "3x6") return 0;
  if (label === "4x8") return 1;
  return 2;
}

/**
 * 自動選定の評価順位（数値が小さいほど良い）
 * 1. 全件配置できる
 * 2. 配置数が多い
 * 3. 総材料面積（枚数×板面積）が小さい ← 職人目線の「効率」
 * 4. 端材面積が小さい
 * 5. 枚数が少ない
 * 6. 同点なら 3×6 を優先
 */
export function rankPackResult(
  x: PackResult,
  nRequested: number
): readonly number[] {
  return [
    x.total_parts_placed === nRequested ? 0 : 1,
    -x.total_parts_placed,
    x.score,
    x.waste_area_mm2,
    x.sheet_count,
    labelBias(x.label),
  ];
}

export function pickBestPackResult(
  results: PackResult[],
  nRequested: number
): PackResult {
  return results.reduce((a, b) => {
    const ka = rankPackResult(a, nRequested);
    const kb = rankPackResult(b, nRequested);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return a;
      if (ka[i] > kb[i]) return b;
    }
    return a;
  });
}
