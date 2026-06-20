import type { PackResult } from "./types";
import { buildDiagramSvg, diagramToDataUrl } from "./diagram";

export function buildPrintHtml(
  best: PackResult,
  kerf: number = 3,
  maxPerPage?: number
): string {
  const images = best.sheets.map((s) =>
    diagramToDataUrl(buildDiagramSvg({ sheet: s, vw: best.vw, vh: best.vh, label: best.label, kerf }))
  );

  const chunk = maxPerPage != null && maxPerPage >= 1 ? maxPerPage : 1;
  const pages: string[][] = [];
  for (let i = 0; i < images.length; i += chunk) {
    pages.push(images.slice(i, i + chunk));
  }

  const pageHtml = pages
    .map(
      (pageImgs, i) => `
    <div class="diagram-page">
      <h1>木取図（${best.label}）— ${i + 1}ページ目　歩留まり ${best.utilization_pct}%</h1>
      ${pageImgs.map((src, j) => `<img class="diagram-img" src="${src}" alt="木取図${j + 1}"/>`).join("")}
    </div>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@media print { @page { size: A4 landscape; margin: 8mm; } body { margin: 0; } }
body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; }
.diagram-page { page-break-after: always; padding: 0; }
.diagram-page:last-child { page-break-after: auto; }
.diagram-img { width: 100%; max-height: 88vh; object-fit: contain; }
h1 { font-size: 12pt; margin-bottom: 3mm; color: #333; }
</style></head><body>${pageHtml}</body></html>`;
}

export function downloadPrintHtml(best: PackResult, kerf: number = 3): void {
  const html = buildPrintHtml(best, kerf);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mokudori_print.html";
  a.click();
  URL.revokeObjectURL(url);
}
