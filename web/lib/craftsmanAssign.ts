import type { Part, PackResult, Sheet } from "./types";
import { buildPackResult } from "./packResult";
import {
  TrunkTechEngine,
  normalizePart,
  renumberSheets,
} from "./trunkTechEngine";

/**
 * 職人の寸法別選定（オーケストレーション層）
 *
 * 既存 packSheets は寸法グループ単位で呼ぶだけ。コアは変更しない。
 *
 * 判断:
 * 1. 同寸法は混ぜず、グループごとに定尺を選ぶ（定規の付け替えを減らす）
 * 2. 尻板に「長手いっぱいの端材」が残るなら 3×6 を優先（次回使いやすい）
 * 3. 3×6 だと満杯の板が複数枚になり、4×8 なら1枚に収まるなら 4×8
 */
function dimKey(p: Part): string {
  return `${Math.round(p.w)}x${Math.round(p.d)}`;
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

function placedCount(sheets: Sheet[]): number {
  return sheets.reduce((s, sh) => s + sh.parts.length, 0);
}

function materialArea(sheets: Sheet[]): number {
  return sheets.reduce((s, sh) => s + (sh.vw ?? 0) * (sh.vh ?? 0), 0);
}

/** 尻板の、長手方向いっぱいの余り高さ (mm) */
function tailLongLeftoverH(sheet: Sheet | undefined, vw: number, vh: number): number {
  if (!sheet) return 0;
  if (sheet.parts.length === 0) return vh;
  const maxBottom = Math.max(...sheet.parts.map((p) => p.y + p.h));
  const leftoverH = vh - maxBottom;
  const fullWidthWaste = (sheet.wasteRects ?? []).some(
    (r) => r.x <= 1 && r.w >= vw * 0.9 && r.h >= leftoverH * 0.8
  );
  if (leftoverH < 80) return 0;
  if (sheet.wasteRects.length > 0 && !fullWidthWaste && leftoverH < 200) {
    return 0;
  }
  return leftoverH;
}

const USEFUL_LONG_LEFTOVER_MM = 280;

type BoardPick = {
  sheets: Sheet[];
  label: "3x6" | "4x8";
};

function pickBoardForGroup(
  sheets36: Sheet[] | null,
  sheets48: Sheet[] | null,
  qty: number,
  vw36: number,
  vh36: number,
  vw48: number,
  vh48: number
): BoardPick | null {
  const ok36 = sheets36 && placedCount(sheets36) === qty;
  const ok48 = sheets48 && placedCount(sheets48) === qty;
  if (!ok36 && !ok48) return null;
  if (ok36 && !ok48) return { sheets: sheets36, label: "3x6" };
  if (!ok36 && ok48) return { sheets: sheets48, label: "4x8" };

  const s36 = sheets36!;
  const s48 = sheets48!;
  const n36 = s36.length;
  const n48 = s48.length;
  const area36 = materialArea(s36);
  const area48 = materialArea(s48);
  const tail36 = s36[s36.length - 1];
  const leftover36 = tailLongLeftoverH(tail36, vw36, vh36);
  const usefulTail36 = leftover36 >= USEFUL_LONG_LEFTOVER_MM;
  const last36Full = leftover36 < 80 && n36 >= 1;

  if (n36 === 1) return { sheets: s36, label: "3x6" };

  // 尻板に長手いっぱいの端材が残る → 3×6（面積が少し多くても）
  if (usefulTail36 && area36 <= area48 * 1.25) {
    return { sheets: s36, label: "3x6" };
  }

  // 3×6 は満杯が続くが、4×8 なら1枚で収まる
  if (n48 === 1 && last36Full && n36 >= 2 && area48 <= area36) {
    return { sheets: s48, label: "4x8" };
  }

  if (area36 <= area48) return { sheets: s36, label: "3x6" };
  return { sheets: s48, label: "4x8" };
}

export function tryPackCraftsmanAssign(
  engine: TrunkTechEngine,
  parts: Part[],
  s36: [number, number, string],
  s48: [number, number, string],
  nRequested: number
): PackResult | null {
  const [vw36, vh36, label36] = s36;
  const [vw48, vh48, label48] = s48;

  const normalized = parts
    .map((p) => normalizePart({ ...p }))
    .filter((p) => p.w > 0 && p.d > 0);

  const groups = groupByDimension(normalized);
  if (groups.size === 0) return null;

  const allSheets: Sheet[] = [];
  let used36 = false;
  let used48 = false;

  for (const groupParts of groups.values()) {
    const fits36 = groupParts.every((p) => p.w <= vw36 && p.d <= vh36);
    const fits48 = groupParts.every((p) => p.w <= vw48 && p.d <= vh48);

    const sheets36 = fits36
      ? engine.packSheets(groupParts, vw36, vh36, label36)
      : null;
    const sheets48 = fits48
      ? engine.packSheets(groupParts, vw48, vh48, label48)
      : null;

    const picked = pickBoardForGroup(
      sheets36,
      sheets48,
      groupParts.length,
      vw36,
      vh36,
      vw48,
      vh48
    );
    if (!picked) return null;

    if (picked.label === "3x6") used36 = true;
    else used48 = true;
    allSheets.push(...picked.sheets);
  }

  if (allSheets.length === 0) return null;

  const mixed = used36 && used48;
  const labeled = mixed ? "混在(寸法別選定)" : used36 ? "3x6" : "4x8";

  return buildPackResult(
    renumberSheets(allSheets),
    labeled,
    mixed,
    vw36,
    vh36,
    nRequested
  );
}
