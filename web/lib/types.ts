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
  幅: number;
  奥行: number;
  枚数: number;
}

export type SizeChoice =
  | "自動選定 (効率優先)"
  | "3x6固定"
  | "4x8固定"
  | "集成材";

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
