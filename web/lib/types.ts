export interface Part {
  n: string;
  w: number;
  d: number;
}

export interface PlacedPart {
  n: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 板内の裁断順（1始まり） */
  seq: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sheet {
  id: number;
  parts: PlacedPart[];
  wasteRects: Rect[];
  utilization: number;
  /** 同寸法グループ（例: 900×450）— 1板1寸法 */
  groupSize?: string;
  /** 同寸法グループ内の連番（例: 2枚目/3枚） */
  groupSheetIndex?: number;
  /** 端材統合で複数種を混載した板 */
  merged?: boolean;
  /** この板の定尺（混在時は板ごとに異なる） */
  boardLabel?: string;
  vw?: number;
  vh?: number;
}

export interface JobMeta {
  作成日: string;
  案件名: string;
  担当者: string;
  /** 印刷用 — 材料名称 */
  材料名称?: string;
  /** 印刷用 — 厚み (mm) */
  厚み?: string;
  /** 印刷用 — 選定方針 */
  選定方針?: string;
  /** 印刷用 — 概算材料費（円） */
  概算材料費?: number;
}

export interface MaterialMeta {
  材料名称: string;
  厚み: string;
  単価3x6: string;
  単価4x8: string;
}

export interface PackResult {
  label: string;
  sheets: Sheet[];
  sheet_count: number;
  /** 単一サイズ時の代表寸法（混在時は 3×6 側） */
  vw: number;
  vh: number;
  score: number;
  total_parts_placed: number;
  total_parts_requested: number;
  utilization_pct: number;
  waste_area_mm2: number;
  /** 3×6 と 4×8 の混在 */
  mixed?: boolean;
}

export interface ShelfRow {
  名称: string;
  長さ: number;
  幅: number;
  枚数: number;
}

export type SizeChoice =
  | "歩留まり率優先（3×6・4×8比較）"
  | "材料価格優先（3×6・4×8比較）"
  | "端材の使いやすさ優先（3×6・4×8比較）"
  | "3×6のみ"
  | "4×8のみ"
  | "フリー板";

export interface BoardSettings {
  v36: number;
  h36: number;
  v48: number;
  h48: number;
  lamW: number;
  lamL: number;
  kerf: number;
  sizeChoice: SizeChoice;
}
