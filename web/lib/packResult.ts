import type { PackResult, Sheet } from "./types";
import { calcPackStats } from "./trunkTechEngine";

export function totalMaterialArea(sheets: Sheet[]): number {
  return sheets.reduce(
    (s, sh) => s + (sh.vw ?? 0) * (sh.vh ?? 0),
    0
  );
}

export function buildPackResult(
  sheets: Sheet[],
  label: string,
  mixed: boolean,
  fallbackVw: number,
  fallbackVh: number,
  nRequested: number
): PackResult {
  const totalPlaced = sheets.reduce((s, sh) => s + sh.parts.length, 0);
  const stats = calcPackStats(sheets, fallbackVw, fallbackVh);
  return {
    label,
    sheets,
    sheet_count: sheets.length,
    vw: fallbackVw,
    vh: fallbackVh,
    score: totalMaterialArea(sheets) || sheets.length * fallbackVw * fallbackVh,
    total_parts_placed: totalPlaced,
    total_parts_requested: nRequested,
    utilization_pct: stats.utilization_pct,
    waste_area_mm2: stats.waste_area_mm2,
    mixed,
  };
}

export function formatBoardSummary(result: PackResult): string {
  if (!result.mixed) {
    return `${result.label}板 ${result.sheet_count}枚`;
  }
  const c36 = result.sheets.filter((s) => s.boardLabel === "3x6").length;
  const c48 = result.sheets.filter((s) => s.boardLabel === "4x8").length;
  return `3×6板 ${c36}枚 + 4×8板 ${c48}枚（混在）`;
}
