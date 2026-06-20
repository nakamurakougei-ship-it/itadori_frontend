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
  /** 配置後に残った端材領域（一定サイズ以上） */
  wasteRects: Rect[];
  /** この板の歩留まり (%) */
  utilization: number;
}

export interface PackResult {
  label: string;
  sheets: Sheet[];
  sheet_count: number;
  vw: number;
  vh: number;
  score: number;
  total_parts_placed: number;
  total_parts_requested: number;
  /** 全体の歩留まり (%) */
  utilization_pct: number;
  /** 端材面積の合計 (mm²) */
  waste_area_mm2: number;
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
