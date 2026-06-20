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
}

export interface SheetRow {
  y: number;
  h: number;
  used_w: number;
  parts: PlacedPart[];
}

export interface Sheet {
  id: number;
  used_h: number;
  rows: SheetRow[];
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
