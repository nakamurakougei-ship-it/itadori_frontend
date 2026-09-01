import type { Part, PackResult } from "./types";
import { buildPackResult } from "./packResult";
import { tryPackCraftsmanAssign } from "./craftsmanAssign";
import { tryPackMixed36And48 } from "./mixedPack";
import { TrunkTechEngine } from "./trunkTechEngine";

/** 3×6 と 4×8 を比較する自動選定モードか */
export function isCompareMode(choice: string): boolean {
  return (
    choice.startsWith("歩留まり率優先") ||
    choice.startsWith("材料価格優先") ||
    choice.startsWith("端材の使いやすさ優先")
  );
}

/** 比較モード用に複数候補を生成する */
export function buildCompareCandidates(
  engine: TrunkTechEngine,
  parts: Part[],
  s36: [number, number, string],
  s48: [number, number, string],
  nRequested: number
): PackResult[] {
  const simResults: PackResult[] = [];

  const runSingle = (vw: number, vh: number, label: string) => {
    const sheets = engine.packSheets(parts, vw, vh, label);
    simResults.push(buildPackResult(sheets, label, false, vw, vh, nRequested));
  };

  runSingle(s36[0], s36[1], s36[2]);
  runSingle(s48[0], s48[1], s48[2]);

  const mixed = tryPackMixed36And48(engine, parts, s36, s48, nRequested);
  if (mixed) simResults.push(mixed);

  const craftsman = tryPackCraftsmanAssign(
    engine,
    parts,
    s36,
    s48,
    nRequested
  );
  if (craftsman) simResults.push(craftsman);

  return simResults;
}
