import type { Sheet } from "./types";
import { DAME_TRIM_MM } from "./trunkTechEngine";

const COLORS = {
  sheet: "#f8f0e3",
  sheetBorder: "#5c3d1e",
  margin: "#c9a66b",
  partFill: ["#e8c9a0", "#ddb98a", "#d4ad7a", "#caa06e"],
  partStroke: "#2c1810",
  cutLine: "#c0392b",
  waste: "#e8e8e8",
  wasteStroke: "#999",
  dim: "#333",
  title: "#1a1a1a",
  badge: "#2d6a4f",
};

export interface DiagramOptions {
  sheet: Sheet;
  vw: number;
  vh: number;
  label: string;
  kerf?: number;
  /** 印刷用にスケール指定 */
  scale?: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dimLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset: number,
  horizontal: boolean
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ox = horizontal ? 0 : offset;
  const oy = horizontal ? offset : 0;
  const lx1 = x1 + ox;
  const ly1 = y1 + oy;
  const lx2 = x2 + ox;
  const ly2 = y2 + oy;

  return `
    <line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${COLORS.dim}" stroke-width="0.8"/>
    <line x1="${x1}" y1="${y1}" x2="${lx1}" y2="${ly1}" stroke="${COLORS.dim}" stroke-width="0.5"/>
    <line x1="${x2}" y1="${y2}" x2="${lx2}" y2="${ly2}" stroke="${COLORS.dim}" stroke-width="0.5"/>
    <text x="${horizontal ? mx + ox : lx1 + (offset > 0 ? 8 : -8)}" y="${horizontal ? ly1 + (offset > 0 ? 12 : -6) : my + oy}" 
      text-anchor="middle" font-size="11" fill="${COLORS.dim}" font-weight="600">${label}</text>`;
}

/** 職人向け木取図 SVG を生成 */
export function buildDiagramSvg({
  sheet,
  vw,
  vh,
  label,
  kerf = 3,
}: DiagramOptions): string {
  const padL = 52;
  const padT = 56;
  const padR = 16;
  const padB = 28;
  // vw/vh は定尺。配置座標は長短各1面のダメ切りを除いた有効寸法上。
  const boardW = vw;
  const boardH = vh;
  const usableW = Math.max(0, vw - DAME_TRIM_MM);
  const usableH = Math.max(0, vh - DAME_TRIM_MM);
  const totalW = boardW + padL + padR;
  const totalH = boardH + padT + padB;
  // ダメ切りは左辺・下辺（長短各1面）
  const ox = padL + DAME_TRIM_MM;
  const oy = padT;

  const toSvgY = (y: number, h: number) => oy + (usableH - y - h);

  let partsSvg = "";
  for (const p of sheet.parts) {
    const x = ox + p.x;
    const y = toSvgY(p.y, p.h);
    const fill = COLORS.partFill[(p.seq - 1) % COLORS.partFill.length];
    const fontSize = Math.max(7, Math.min(p.w, p.h) * 0.11);
    const showDims = p.w >= 120 && p.h >= 80;

    partsSvg += `
      <g>
        <rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" fill="${fill}" stroke="${COLORS.partStroke}" stroke-width="1.2"/>
        <rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" fill="none" stroke="${COLORS.cutLine}" stroke-width="0.6" stroke-dasharray="4,3"/>
        <circle cx="${x + 10}" cy="${y + 10}" r="9" fill="${COLORS.badge}" opacity="0.92"/>
        <text x="${x + 10}" y="${y + 10}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#fff" font-weight="bold">${p.seq}</text>
        <text x="${x + p.w / 2}" y="${y + p.h / 2 - (showDims ? 5 : 0)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="bold" fill="${COLORS.partStroke}">
          ${escapeXml(p.n)}
        </text>
        ${showDims ? `<text x="${x + p.w / 2}" y="${y + p.h / 2 + fontSize}" text-anchor="middle" font-size="${fontSize * 0.85}" fill="${COLORS.dim}">${Math.round(p.w)}×${Math.round(p.h)}</text>` : ""}
      </g>`;
  }

  let wasteSvg = "";
  for (const w of sheet.wasteRects) {
    const x = ox + w.x;
    const y = toSvgY(w.y, w.h);
    const label =
      w.w >= 150 && w.h >= 60
        ? `<text x="${x + w.w / 2}" y="${y + w.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="${COLORS.wasteStroke}">端材 ${Math.round(w.w)}×${Math.round(w.h)}</text>`
        : "";
    wasteSvg += `
      <rect x="${x}" y="${y}" width="${w.w}" height="${w.h}" fill="url(#wasteHatch)" stroke="${COLORS.wasteStroke}" stroke-width="0.5" stroke-dasharray="3,2"/>
      ${label}`;
  }

  const utilLabel = `${sheet.utilization.toFixed(1)}%`;
  const groupLine = sheet.merged
    ? `混載（端材統合）${sheet.groupSize ? " " + sheet.groupSize + "mm" : ""}`
    : sheet.groupSize
      ? `部材 ${sheet.groupSize}mm（同寸法${sheet.groupSheetIndex ? ` ${sheet.groupSheetIndex}枚目` : ""}）`
      : "";

  // 行割り定規線（板幅いっぱいの水平裁断線）
  const rowYs = new Map<number, number>();
  for (const p of sheet.parts) {
    rowYs.set(p.y, p.h);
  }
  let rowCutSvg = "";
  for (const [ry, rh] of rowYs) {
    const bottomY = toSvgY(ry, rh) + rh;
    rowCutSvg += `<line x1="${ox}" y1="${bottomY}" x2="${ox + usableW}" y2="${bottomY}" stroke="#2980b9" stroke-width="1.5" opacity="0.75"/>`;
    rowCutSvg += `<text x="${ox + usableW + 4}" y="${bottomY + 3}" font-size="8" fill="#2980b9">定規</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <defs>
    <pattern id="wasteHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="${COLORS.wasteStroke}" stroke-width="1" opacity="0.5"/>
    </pattern>
    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="${COLORS.dim}"/>
    </marker>
  </defs>

  <!-- タイトル -->
  <text x="${totalW / 2}" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="${COLORS.title}">
    木取図 No.${sheet.id}　${escapeXml(label)}　${Math.round(boardW)}×${Math.round(boardH)}mm
  </text>
  <text x="${totalW / 2}" y="34" text-anchor="middle" font-size="10" fill="${COLORS.dim}">
    ${groupLine ? escapeXml(groupLine) + "　" : ""}歩留まり ${utilLabel}　刃厚 ${kerf}mm　長手 →
  </text>

  <!-- 定尺板 -->
  <rect x="${padL}" y="${padT}" width="${boardW}" height="${boardH}" fill="${COLORS.sheet}" stroke="${COLORS.sheetBorder}" stroke-width="2.5" rx="1"/>
  <!-- ダメ切り（長短各1面・左辺と下辺）後の有効域 -->
  <rect x="${ox}" y="${oy}" width="${usableW}" height="${usableH}" fill="none" stroke="${COLORS.margin}" stroke-width="0.8" stroke-dasharray="6,4"/>

  <!-- 長手方向矢印 -->
  <line x1="${ox + 12}" y1="${oy - 6}" x2="${ox + usableW - 12}" y2="${oy - 6}" stroke="${COLORS.dim}" stroke-width="1" marker-end="url(#arrow)"/>
  <text x="${ox + usableW / 2}" y="${oy - 10}" text-anchor="middle" font-size="8" fill="${COLORS.dim}">長手</text>

  ${wasteSvg}
  ${partsSvg}
  ${rowCutSvg}

  <!-- 外形寸法 -->
  ${dimLine(padL, padT, padL + boardW, padT, `${Math.round(boardW)}`, -14, true)}
  ${dimLine(padL, padT, padL, padT + boardH, `${Math.round(boardH)}`, -14, false)}

  <!-- 凡例 -->
  <g transform="translate(${padL}, ${totalH - 18})">
    <rect x="0" y="0" width="10" height="10" fill="${COLORS.partFill[0]}" stroke="${COLORS.partStroke}" stroke-width="0.8"/>
    <text x="14" y="9" font-size="8" fill="${COLORS.dim}">部材</text>
    <rect x="50" y="0" width="10" height="10" fill="url(#wasteHatch)" stroke="${COLORS.wasteStroke}" stroke-width="0.5"/>
    <text x="64" y="9" font-size="8" fill="${COLORS.dim}">端材</text>
    <line x1="100" y1="5" x2="118" y2="5" stroke="#2980b9" stroke-width="1.5"/>
    <text x="122" y="9" font-size="8" fill="${COLORS.dim}">定規線</text>
    <line x1="165" y1="5" x2="183" y2="5" stroke="${COLORS.cutLine}" stroke-width="1" stroke-dasharray="3,2"/>
    <text x="187" y="9" font-size="8" fill="${COLORS.dim}">裁断線</text>
    <circle cx="175" cy="5" r="5" fill="${COLORS.badge}"/>
    <text x="184" y="9" font-size="8" fill="${COLORS.dim}">裁断順</text>
  </g>
</svg>`;
}

export function diagramToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
