import type { Part, PackResult } from "./types";
import { buildPackResult } from "./packResult";
import {
  TrunkTechEngine,
  normalizePart,
  renumberSheets,
  usableBoardSize,
} from "./trunkTechEngine";

/**
 * 混在選定（オーケストレーション層）
 *
 * 既存の packSheets（同寸法グループ → 行割り → 端材統合）を
 * 3×6 用 / 4×8 用に分けて2回呼ぶだけ。コアロジックは変更しない。
 */
export function tryPackMixed36And48(
  engine: TrunkTechEngine,
  parts: Part[],
  s36: [number, number, string],
  s48: [number, number, string],
  nRequested: number
): PackResult | null {
  const [vw36, vh36, label36] = s36;
  const [vw48, vh48, label48] = s48;
  const [u36w, u36h] = usableBoardSize(vw36, vh36);

  const normalized = parts
    .map((p) => normalizePart({ ...p }))
    .filter((p) => p.w > 0 && p.d > 0);

  const fits36 = (p: Part) => p.w <= u36w && p.d <= u36h;
  const for36 = normalized.filter(fits36);
  const for48 = normalized.filter((p) => !fits36(p));

  // 混在が意味を持つのは「両方に部材がある」ときだけ
  if (for36.length === 0 || for48.length === 0) return null;

  const sheets36 = engine.packSheets(for36, vw36, vh36, label36);
  const sheets48 = engine.packSheets(for48, vw48, vh48, label48);

  const placed36 = sheets36.reduce((s, sh) => s + sh.parts.length, 0);
  const placed48 = sheets48.reduce((s, sh) => s + sh.parts.length, 0);

  if (placed36 !== for36.length || placed48 !== for48.length) return null;

  const allSheets = renumberSheets([...sheets36, ...sheets48]);

  return buildPackResult(
    allSheets,
    "混在(3×6+4×8)",
    true,
    vw36,
    vh36,
    nRequested
  );
}
