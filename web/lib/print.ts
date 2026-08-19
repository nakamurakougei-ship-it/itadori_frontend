import type { PackResult, JobMeta } from "./types";
import { buildDiagramSvg, diagramToDataUrl } from "./diagram";

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

function formatJobHeader(job?: JobMeta): string {
  if (!job) return "";
  const lines = [
    job.作成日 ? `作成日：${escapeHtml(formatDisplayDate(job.作成日))}` : "",
    job.案件名 ? `案件名：${escapeHtml(job.案件名)}` : "",
    job.担当者 ? `担当者：${escapeHtml(job.担当者)}` : "",
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `<div class="job-meta">${lines.join("　")}</div>`;
}

export function buildPrintHtml(
  best: PackResult,
  kerf: number = 3,
  maxPerPage?: number,
  job?: JobMeta
): string {
  const images = best.sheets.map((s) =>
    diagramToDataUrl(
      buildDiagramSvg({
        sheet: s,
        vw: s.vw ?? best.vw,
        vh: s.vh ?? best.vh,
        label: s.boardLabel ?? best.label,
        kerf,
      })
    )
  );

  const chunk = maxPerPage != null && maxPerPage >= 1 ? maxPerPage : 1;
  const pages: string[][] = [];
  for (let i = 0; i < images.length; i += chunk) {
    pages.push(images.slice(i, i + chunk));
  }

  const jobHeader = formatJobHeader(job);
  const pageHtml = pages
    .map(
      (pageImgs, i) => `
    <div class="diagram-page">
      <h1>木取図（${best.label}）— ${i + 1}ページ目　歩留まり ${best.utilization_pct}%</h1>
      ${jobHeader}
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
.job-meta { font-size: 10pt; margin-bottom: 3mm; color: #444; }
</style></head><body>${pageHtml}</body></html>`;
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
