import type { Part, Sheet } from "./types";

function normalizePart(p: Part): Part {
  return { ...p, w: Math.max(p.w, p.d), d: Math.min(p.w, p.d) };
}

export class TrunkTechEngine {
  constructor(private kerf: number = 3.0) {}

  packSheets(parts: Part[], vw: number, vh: number): Sheet[] {
    const normalized = parts.map((p) => normalizePart({ ...p }));
    const valid = normalized.filter((p) => p.w <= vw && p.d <= vh);
    const sortedParts = [...valid].sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      return b.d - a.d;
    });

    const sheets: Sheet[] = [];

    const pack = (p: Part): boolean => {
      for (const s of sheets) {
        for (const r of s.rows) {
          if (r.h >= p.d && vw - r.used_w >= p.w) {
            r.parts.push({
              n: p.n,
              x: r.used_w,
              y: r.y,
              w: p.w,
              h: p.d,
            });
            r.used_w += p.w + this.kerf;
            return true;
          }
        }
        if (vh - s.used_h >= p.d) {
          s.rows.push({
            y: s.used_h,
            h: p.d,
            used_w: p.w + this.kerf,
            parts: [{ n: p.n, x: 0, y: s.used_h, w: p.w, h: p.d }],
          });
          s.used_h += p.d + this.kerf;
          return true;
        }
      }
      return false;
    };

    for (const p of sortedParts) {
      if (!pack(p)) {
        if (p.w <= vw && p.d <= vh) {
          sheets.push({
            id: sheets.length + 1,
            used_h: p.d + this.kerf,
            rows: [
              {
                y: 0,
                h: p.d,
                used_w: p.w + this.kerf,
                parts: [{ n: p.n, x: 0, y: 0, w: p.w, h: p.d }],
              },
            ],
          });
        }
      }
    }

    return sheets;
  }
}

export function asLongShort(
  a: number,
  b: number,
  label: string
): [number, number, string] {
  const lo = Math.max(a, b);
  const sh = Math.min(a, b);
  return [lo - 2, sh - 2, label];
}

export function buildAllParts(shelfList: { 名称: string; 幅: number; 奥行: number; 枚数: number }[]): Part[] {
  const allParts: Part[] = [];
  for (const row of shelfList) {
    const qty = row.枚数;
    if (!row.名称 || qty == null || Number.isNaN(qty)) continue;
    const nQty = Math.max(0, Math.floor(Number(qty)));
    for (let i = 0; i < nQty; i++) {
      allParts.push({
        n: row.名称,
        w: Number(row.幅) || 0,
        d: Number(row.奥行) || 0,
      });
    }
  }
  return allParts;
}
