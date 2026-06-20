import type { PackResult, Sheet } from "./types";

export function sheetToSvgDataUrl(
  sheet: Sheet,
  vwFull: number,
  vhFull: number,
  label: string
): string {
  const scale = 0.25;
  const width = vwFull * scale;
  const height = vhFull * scale;
  const fontFamily =
    "'IPAexGothic', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";

  let partsSvg = "";
  for (const r of sheet.rows) {
    for (const p of r.parts) {
      const x = p.x * scale;
      const y = (vhFull - p.y - p.h) * scale;
      const w = p.w * scale;
      const h = p.h * scale;
      partsSvg += `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#deb887" stroke="black" stroke-width="1" opacity="0.9"/>
        <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="bold" font-family="${fontFamily}">
          <tspan x="${x + w / 2}" dy="-0.4em">${escapeXml(p.n)}</tspan>
          <tspan x="${x + w / 2}" dy="1.2em">${Math.round(p.w)}x${Math.round(p.h)}</tspan>
        </text>`;
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#fdf5e6" stroke="#8b4513" stroke-width="2"/>
  <text x="${width / 2}" y="14" text-anchor="middle" font-size="11" font-weight="bold" font-family="${fontFamily}">
    【木取り図】 ID:${sheet.id} (${label}：${Math.round(vwFull)}x${Math.round(vhFull)})
  </text>
  <g transform="translate(0, 20)">
    ${partsSvg}
  </g>
</svg>`;

  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPrintHtml(best: PackResult, maxPerPage?: number): string {
  const vwFull = best.vw + 2;
  const vhFull = best.vh + 2;
  const label = best.label;
  const images = best.sheets.map((s) =>
    sheetToSvgDataUrl(s, vwFull, vhFull, label)
  );

  const chunk =
    maxPerPage != null && maxPerPage >= 1 ? maxPerPage : 1;
  const pages: string[][] = [];
  for (let i = 0; i < images.length; i += chunk) {
    pages.push(images.slice(i, i + chunk));
  }

  const pageHtml = pages
    .map(
      (pageImgs, i) => `
    <div class="diagram-page">
      <h1>木取図（${label}）— ${i + 1}ページ目</h1>
      ${pageImgs.map((src, j) => `<img class="diagram-img" src="${src}" alt="木取図${j + 1}"/>`).join("")}
    </div>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@media print { @page { size: A4; margin: 10mm; } body { margin: 0; } }
.diagram-page { page-break-after: always; padding: 0; }
.diagram-page:last-child { page-break-after: auto; }
.diagram-img { width: 100%; max-height: 32%; object-fit: contain; margin-bottom: 2mm; }
h1 { font-size: 14pt; margin-bottom: 4mm; font-family: sans-serif; }
</style></head><body>${pageHtml}</body></html>`;
}

export function downloadPrintHtml(best: PackResult): void {
  const html = buildPrintHtml(best);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mokudori_print.html";
  a.click();
  URL.revokeObjectURL(url);
}
