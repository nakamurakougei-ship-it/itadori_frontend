import type { PackResult, Sheet, JobMeta } from "./types";
import { buildDiagramSvg } from "./diagram";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

/**
 * A4 横（297×210mm）印刷用レイアウト計算
 *
 * 縮尺は全枚数を通じて統一する（3×6 と 4×8 が混在しても同スケール）。
 * 1ページに cols×rows で面付けし、収まらなければ次ページへ。
 *
 * A4 横の印刷有効域（margin 8mm）= 281 × 194mm
 * SVG の座標単位は mm そのまま（1unit = 1mm）。
 */

// 印刷有効域 (mm) — margin 8mm
const PAGE_W_MM = 281; // A4 横 297 - 8*2
const PAGE_H_MM = 194; // A4 横 210 - 8*2

// 案件情報ヘッダーの高さ (mm) — 全ページ共通
const JOB_HEADER_H_MM = 10;
// 木取図ページヘッダー高さ (mm)
const PAGE_TITLE_H_MM = 7;
// 図間のギャップ (mm)
const GAP_MM = 3;
const BOARD_NO_H_MM = 4;

interface LayoutResult {
  cols: number;
  rows: number;
  scale: number;
}

/**
 * 板の実寸（vw×vh mm）と有効印刷域から、
 * 3×6は2列×2行=4枚、4×8は3列×1行=3枚 を上限として
 * 縮尺と配置を決める。
 *
 * 縮尺は「1列×1行で入る最大」を基準に、
 * 縦横比を保ったまま cols/rows を増やす。
 * 枚数 > 1 になっても縮尺は 1列基準から下がるだけで
 * 板サイズが変わらなければ全ページ同一縮尺。
 */
function calcLayout(
  svgW: number,
  svgH: number,
  availW: number,
  availH: number,
  maxCols: number,
  maxRows: number
): LayoutResult {
  // 1セルに入る最大縮尺（1列1行）
  const scale1 = Math.min(availW / svgW, availH / svgH);

  // その縮尺で何列×何行並ぶか
  const scaledW = svgW * scale1;
  const scaledH = svgH * scale1;

  const cols = Math.min(maxCols, Math.max(1, Math.floor((availW + GAP_MM) / (scaledW + GAP_MM))));
  const rows = Math.min(maxRows, Math.max(1, Math.floor((availH + GAP_MM) / (scaledH + GAP_MM))));

  return { cols, rows, scale: scale1 };
}

/**
 * 板ラベルごとに最大面付け数を決める。
 * 3×6（短手 908mm 程度）: 2列×2行 = 4
 * 4×8（短手 1218mm 程度）: 3列×1行 = 3
 * 集成材・その他: 2列×2行
 */
function maxColsRows(label: string): [number, number] {
  if (label === "4x8") return [3, 1];
  return [2, 2];
}

function buildSvgCell(
  sheet: Sheet,
  vw: number,
  vh: number,
  label: string,
  kerf: number,
  scale: number,
  x: number,
  y: number,
  boardNo: number
): string {
  const svg = buildDiagramSvg({ sheet, vw, vh, label, kerf });

  // viewBox の totalW/totalH を取り出す
  const vbMatch = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vbMatch) return "";
  const svgW = parseFloat(vbMatch[1]);
  const svgH = parseFloat(vbMatch[2]);

  const scaledW = svgW * scale;
  const scaledH = svgH * scale;

  // SVG を <g transform="translate+scale"> で包み、foreignObject 的に配置
  // 外側の SVG に埋め込むため、内側のXML宣言・SVGタグを除去してcontent部分だけ取り出す
  const inner = svg
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

  return `<g transform="translate(${x},${y})">
  <text x="0" y="-1.2" font-size="3.6" font-weight="700" fill="#222">No.${boardNo}</text>
  <svg width="${scaledW}" height="${scaledH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="wasteHatch_${sheet.id}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#999" stroke-width="1" opacity="0.5"/>
      </pattern>
      <marker id="arrow_${sheet.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#333"/>
      </marker>
    </defs>
    ${inner
      .replace(/url\(#wasteHatch\)/g, `url(#wasteHatch_${sheet.id})`)
      .replace(/url\(#arrow\)/g, `url(#arrow_${sheet.id})`)}
  </svg>
</g>`;
}

function buildPageSvg(
  cells: { sheet: Sheet; vw: number; vh: number; label: string; boardNo: number }[],
  layout: LayoutResult,
  kerf: number,
  svgW: number,
  svgH: number,
  _pageAvailH: number,
  pageIndex: number,
  totalPages: number,
  totalBoards: number,
  best: PackResult,
  job: JobMeta | undefined
): string {
  const { cols, scale } = layout;
  const scaledW = svgW * scale;
  const scaledH = svgH * scale;

  let content = "";

  let hy = 6;
  if (job) {
    const line1 = [
      job.作成日 ? `作成日：${escapeHtml(formatDisplayDate(job.作成日))}` : "",
      job.案件名 ? `案件名：${escapeHtml(job.案件名)}` : "",
      job.担当者 ? `担当者：${escapeHtml(job.担当者)}` : "",
    ]
      .filter(Boolean)
      .join("　　");
    const line2 = [
      job.材料名称 ? `材料：${escapeHtml(job.材料名称)}` : "",
      job.厚み ? `厚み：${escapeHtml(job.厚み)}mm` : "",
      job.選定方針 ? `選定：${escapeHtml(job.選定方針)}` : "",
      job.概算材料費 != null && job.概算材料費 > 0
        ? `概算材料費：${job.概算材料費.toLocaleString()}円`
        : "",
    ]
      .filter(Boolean)
      .join("　　");
    if (line1) {
      content += `<text x="${PAGE_W_MM / 2}" y="${hy}" text-anchor="middle" font-size="4.5" fill="#333">${line1}</text>`;
      hy += 6;
    }
    if (line2) {
      content += `<text x="${PAGE_W_MM / 2}" y="${hy}" text-anchor="middle" font-size="4" fill="#444">${line2}</text>`;
      hy += 6;
    }
  }

  const firstNo = cells[0]?.boardNo ?? 1;
  const lastNo = cells[cells.length - 1]?.boardNo ?? firstNo;
  const boardRange =
    firstNo === lastNo
      ? `板 No.${firstNo}`
      : `板 No.${firstNo}〜${lastNo}`;
  const titleText = `木取図（${escapeHtml(best.label)}）　歩留まり ${best.utilization_pct}%　${boardRange}／全${totalBoards}枚`;
  content += `<text x="2" y="${hy}" text-anchor="start" font-size="4" fill="#555">${titleText}</text>`;
  content += `<text x="${PAGE_W_MM - 2}" y="${hy}" text-anchor="end" font-size="5.5" font-weight="700" fill="#222">${pageIndex + 1} / ${totalPages}</text>`;
  hy += 3;

  // 区切り線
  content += `<line x1="0" y1="${hy}" x2="${PAGE_W_MM}" y2="${hy}" stroke="#ccc" stroke-width="0.3"/>`;
  hy += 5;

  // 各セル
  for (let i = 0; i < cells.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * (scaledW + GAP_MM);
    const cy = hy + row * (scaledH + GAP_MM + BOARD_NO_H_MM);
    const { sheet, vw, vh, label, boardNo } = cells[i];
    content += buildSvgCell(sheet, vw, vh, label, kerf, scale, cx, cy, boardNo);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${PAGE_W_MM}mm" height="${PAGE_H_MM}mm"
  viewBox="0 0 ${PAGE_W_MM} ${PAGE_H_MM}"
  style="display:block">
  ${content}
</svg>`;
}

export function buildPrintHtml(
  best: PackResult,
  kerf: number = 3,
  _maxPerPage?: number,
  job?: JobMeta
): string {
  // 全シートのセル情報を作る
  const allCells = best.sheets.map((s, i) => ({
    sheet: s,
    vw: s.vw ?? best.vw,
    vh: s.vh ?? best.vh,
    label: s.boardLabel ?? best.label,
    boardNo: i + 1,
  }));

  if (allCells.length === 0) return "<html><body>データなし</body></html>";

  const hasJob =
    !!job && Boolean(job.作成日 || job.案件名 || job.担当者);
  const headerH = hasJob
    ? PAGE_TITLE_H_MM + JOB_HEADER_H_MM
    : PAGE_TITLE_H_MM;

  // 全シートの中で最大のSVGサイズを基準に縮尺を決める
  // （3×6と4×8が混在する場合、より大きい4×8基準）
  let maxSvgW = 0;
  let maxSvgH = 0;
  const svgInfos: { svgW: number; svgH: number; maxCols: number; maxRows: number }[] = [];

  for (const cell of allCells) {
    const svg = buildDiagramSvg({ sheet: cell.sheet, vw: cell.vw, vh: cell.vh, label: cell.label, kerf });
    const vbMatch = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const sw = vbMatch ? parseFloat(vbMatch[1]) : 1000;
    const sh = vbMatch ? parseFloat(vbMatch[2]) : 800;
    const [mc, mr] = maxColsRows(cell.label);
    svgInfos.push({ svgW: sw, svgH: sh, maxCols: mc, maxRows: mr });
    if (sw > maxSvgW) maxSvgW = sw;
    if (sh > maxSvgH) maxSvgH = sh;
  }

  const minAvailH = PAGE_H_MM - headerH;
  const firstLabel = allCells[0].label;
  const [globalMaxCols, globalMaxRows] = maxColsRows(firstLabel);
  const layout = calcLayout(maxSvgW, maxSvgH, PAGE_W_MM, minAvailH, globalMaxCols, globalMaxRows);
  const perPage = layout.cols * layout.rows;

  // ページに分割
  const pages: typeof allCells[] = [];
  for (let i = 0; i < allCells.length; i += perPage) {
    pages.push(allCells.slice(i, i + perPage));
  }

  const pageSvgs = pages.map((cells, i) =>
    buildPageSvg(
      cells,
      layout,
      kerf,
      maxSvgW,
      maxSvgH,
      PAGE_H_MM - headerH,
      i,
      pages.length,
      allCells.length,
      best,
      job
    )
  );

  const pageHtml = pageSvgs
    .map(
      (svg, i) => `
<div class="print-page">
${svg}
</div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>木取図 — ${escapeHtml(best.label)}</title>
<style>
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body { margin: 0; }
  .print-page { page-break-after: always; }
  .print-page:last-child { page-break-after: auto; }
}
body {
  margin: 0;
  font-family: "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
  background: #fff;
}
.print-page {
  width: 297mm;
  height: 210mm;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.print-page svg {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>
</head>
<body>
${pageHtml}
</body>
</html>`;
}

export function downloadPrintHtml(
  best: PackResult,
  kerf: number = 3,
  job?: JobMeta
): void {
  const html = buildPrintHtml(best, kerf, undefined, job);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mokudori_print.html";
  a.click();
  URL.revokeObjectURL(url);
}

// DiagramSvg コンポーネントから引き続き使えるよう再エクスポート
export { diagramToDataUrl } from "./diagram";
