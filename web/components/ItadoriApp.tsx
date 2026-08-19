"use client";

import { useCallback, useEffect, useState } from "react";
import { DiagramSvg } from "@/components/DiagramSvg";
import { downloadPrintHtml } from "@/lib/print";
import {
  TrunkTechEngine,
  asLongShort,
  buildAllParts,
} from "@/lib/trunkTechEngine";
import { buildPackResult, formatBoardSummary } from "@/lib/packResult";
import { tryPackMixed36And48 } from "@/lib/mixedPack";
import { tryPackCraftsmanAssign } from "@/lib/craftsmanAssign";
import { pickBestPackResult } from "@/lib/selectBest";
import type { PackResult, ShelfRow, SizeChoice, JobMeta } from "@/lib/types";

const SIZE_CHOICES: SizeChoice[] = [
  "効率優先（3×6・4×8混在）",
  "3×6のみ",
  "4×8のみ",
  "集成材",
];

function createEmptyRow(): ShelfRow {
  return { 名称: "", 長さ: 0, 幅: 0, 枚数: 0 };
}

function createDefaultShelf(): ShelfRow[] {
  return Array.from({ length: 8 }, createEmptyRow);
}

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

export default function ItadoriApp() {
  const [v36, setV36] = useState(1820);
  const [h36, setH36] = useState(910);
  const [v48, setV48] = useState(2440);
  const [h48, setH48] = useState(1220);
  const [lamW, setLamW] = useState(500);
  const [lamL, setLamL] = useState(3600);
  const [kerf, setKerf] = useState(3.0);
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>(
    "効率優先（3×6・4×8混在）"
  );
  const [shelfList, setShelfList] = useState<ShelfRow[]>(createDefaultShelf);
  const [result, setResult] = useState<PackResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hasBg, setHasBg] = useState(true);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [jobMeta, setJobMeta] = useState<JobMeta>({
    作成日: todayLocalIso(),
    案件名: "",
    担当者: "",
  });

  useEffect(() => {
    fetch("/itadori.jpg", { method: "HEAD" })
      .then((r) => setHasBg(r.ok))
      .catch(() => setHasBg(false));
  }, []);

  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAboutOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [aboutOpen]);

  const updateShelf = useCallback(
    (index: number, field: keyof ShelfRow, value: string) => {
      setShelfList((prev) => {
        const next = [...prev];
        const row = { ...next[index] };
        if (field === "名称") {
          row.名称 = value;
        } else {
          const num = value === "" ? 0 : Number(value);
          row[field] = Number.isNaN(num) ? 0 : num;
        }
        next[index] = row;
        return next;
      });
    },
    []
  );

  const updateJobMeta = useCallback(
    (field: keyof JobMeta, value: string) => {
      setJobMeta((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addRow = () => setShelfList((prev) => [...prev, createEmptyRow()]);

  const removeRow = (index: number) => {
    setShelfList((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const runCalculation = () => {
    setWarning(null);
    const allParts = buildAllParts(shelfList);

    if (allParts.length === 0) {
      setWarning("切板リストを入力してください。");
      setResult(null);
      return;
    }

    const engine = new TrunkTechEngine(kerf);
    const s36Dim = asLongShort(v36, h36, "3x6");
    const s48Dim = asLongShort(v48, h48, "4x8");
    const sLamDim = asLongShort(lamL, lamW, "集成材");

    const nRequested = allParts.length;
    const simResults: PackResult[] = [];

    const runSingle = (vw: number, vh: number, label: string) => {
      const sheets = engine.packSheets(allParts, vw, vh, label);
      simResults.push(
        buildPackResult(sheets, label, false, vw, vh, nRequested)
      );
    };

    if (sizeChoice.startsWith("効率優先")) {
      runSingle(s36Dim[0], s36Dim[1], s36Dim[2]);
      runSingle(s48Dim[0], s48Dim[1], s48Dim[2]);
      const mixed = tryPackMixed36And48(
        engine,
        allParts,
        s36Dim,
        s48Dim,
        nRequested
      );
      if (mixed) simResults.push(mixed);
      const craftsman = tryPackCraftsmanAssign(
        engine,
        allParts,
        s36Dim,
        s48Dim,
        nRequested
      );
      if (craftsman) simResults.push(craftsman);
    } else if (sizeChoice === "3×6のみ") {
      runSingle(s36Dim[0], s36Dim[1], s36Dim[2]);
    } else if (sizeChoice === "4×8のみ") {
      runSingle(s48Dim[0], s48Dim[1], s48Dim[2]);
    } else {
      runSingle(sLamDim[0], sLamDim[1], sLamDim[2]);
    }

    const best = pickBestPackResult(simResults, nRequested);

    setResult(best);
  };

  const diagramList = result ? (
    result.sheets.map((s) => (
      <div key={s.id} className="diagram-card">
        <DiagramSvg
          sheet={s}
          vw={s.vw ?? result.vw}
          vh={s.vh ?? result.vh}
          label={s.boardLabel ?? result.label}
          kerf={kerf}
        />
      </div>
    ))
  ) : null;

  return (
    <div className={`page${hasBg ? "" : " no-bg"}`}>
      <div className="title-with-badge">
        <span className="title-main">イタドリ</span>
        <span className="powered-badge">Powered by TRAMOYA</span>
      </div>
      <p className="lead">
        定尺板から効率よく木取りを行うためのアプリです。
        <br />
        あくまで木取りの参考としてご活用ください。
      </p>
      <p className="about-link-row">
        <button
          type="button"
          className="about-link"
          onClick={() => setAboutOpen(true)}
        >
          ご利用前にご確認ください！
        </button>
      </p>

      <div className="main-layout">
        <div className="main-column">
          <section className="panel settings-panel">
            <table className="form-table">
              <tbody>
                <tr>
                  <th colSpan={2} className="form-table-heading">
                    <div className="form-table-heading-inner">
                      <span>定尺寸法設定</span>
                      <button
                        type="button"
                        className="btn btn-ghost board-settings-toggle"
                        onClick={() => setBoardSettingsOpen((open) => !open)}
                        aria-expanded={boardSettingsOpen}
                        aria-controls="board-settings-form"
                      >
                        {boardSettingsOpen ? "閉じる" : "変更"}
                      </button>
                    </div>
                  </th>
                </tr>
                <tr className="board-summary-highlight-row">
                  <th>3×6</th>
                  <td>
                    {v36}×{h36}
                  </td>
                </tr>
                <tr className="board-summary-highlight-row">
                  <th>4×8</th>
                  <td>
                    {v48}×{h48}
                  </td>
                </tr>
                <tr>
                  <th colSpan={2} className="form-table-subheading">
                    使用材の選択
                  </th>
                </tr>
                <tr>
                  <td colSpan={2} className="material-choice-cell">
                    <div className="radio-group radio-group-wrap">
                      {SIZE_CHOICES.map((choice) => (
                        <label key={choice}>
                          <input
                            type="radio"
                            name="sizeChoice"
                            value={choice}
                            checked={sizeChoice === choice}
                            onChange={() => setSizeChoice(choice)}
                          />
                          {choice}
                        </label>
                      ))}
                    </div>
                    {sizeChoice === "集成材" && (
                      <div className="lam-inline">
                        <div className="field">
                          <label htmlFor="lam-w">集成材 幅 (mm)</label>
                          <input
                            id="lam-w"
                            type="number"
                            min={500}
                            max={600}
                            step={1}
                            value={lamW}
                            onChange={(e) => setLamW(Number(e.target.value))}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="lam-l">集成材 長さ (mm)</label>
                          <input
                            id="lam-l"
                            type="number"
                            min={3000}
                            max={4200}
                            step={1}
                            value={lamL}
                            onChange={(e) => setLamL(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {boardSettingsOpen && (
              <div
                id="board-settings-form"
                className="board-settings-form"
              >
                <p className="board-settings-lead">
                  使用する板の定尺寸法を変更できます
                </p>

                <h3>■ 3×6寸法</h3>
                <div className="dim-row">
                  <span>縦</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={v36}
                    onChange={(e) => setV36(Number(e.target.value))}
                  />
                  <span>mm × 横</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={h36}
                    onChange={(e) => setH36(Number(e.target.value))}
                  />
                  <span>mm</span>
                </div>

                <h3>■ 4×8寸法</h3>
                <div className="dim-row">
                  <span>縦</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={v48}
                    onChange={(e) => setV48(Number(e.target.value))}
                  />
                  <span>mm × 横</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={h48}
                    onChange={(e) => setH48(Number(e.target.value))}
                  />
                  <span>mm</span>
                </div>

                <div className="field">
                  <label htmlFor="kerf">刃物厚 (mm)</label>
                  <input
                    id="kerf"
                    type="number"
                    step={0.1}
                    value={kerf}
                    onChange={(e) => setKerf(Number(e.target.value))}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary board-settings-done"
                  onClick={() => setBoardSettingsOpen(false)}
                >
                  設定を反映
                </button>
              </div>
            )}
          </section>

          <section className="panel shelf-panel">
            <div className="shelf-table-wrap">
              <table className="shelf-table">
                <tbody>
                  <tr className="meta-row">
                    <th>作成日</th>
                    <td colSpan={4}>
                      <input
                        type="date"
                        value={jobMeta.作成日}
                        onChange={(e) =>
                          updateJobMeta("作成日", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                  <tr className="meta-row">
                    <th>案件名</th>
                    <td colSpan={4}>
                      <input
                        type="text"
                        value={jobMeta.案件名}
                        placeholder="案件名を入力"
                        onChange={(e) =>
                          updateJobMeta("案件名", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                  <tr className="meta-row">
                    <th>担当者</th>
                    <td colSpan={4}>
                      <input
                        type="text"
                        value={jobMeta.担当者}
                        placeholder="担当者名を入力"
                        onChange={(e) =>
                          updateJobMeta("担当者", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                  <tr className="section-title-row">
                    <th colSpan={5}>切板リストの入力</th>
                  </tr>
                  <tr className="column-header-row">
                    <th>名称</th>
                    <th>長さ</th>
                    <th>幅</th>
                    <th>枚数</th>
                    <th></th>
                  </tr>
                  {shelfList.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          className="input-ja"
                          lang="ja"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          placeholder="名称"
                          value={row.名称}
                          onChange={(e) =>
                            updateShelf(i, "名称", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.長さ || ""}
                          onChange={(e) =>
                            updateShelf(i, "長さ", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.幅 || ""}
                          onChange={(e) =>
                            updateShelf(i, "幅", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={row.枚数 || ""}
                          onChange={(e) =>
                            updateShelf(i, "枚数", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removeRow(i)}
                          aria-label="行を削除"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={addRow}>
                ＋ 行を追加
              </button>
            </div>
          </section>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={runCalculation}
            >
              木取り図を作成する
            </button>
          </div>

          {warning && <div className="alert alert-warning">{warning}</div>}

          {result && (
            <>
              {(jobMeta.作成日 || jobMeta.案件名 || jobMeta.担当者) && (
                <div className="alert alert-info">
                  {jobMeta.作成日 && (
                    <>
                      作成日 <strong>{formatDisplayDate(jobMeta.作成日)}</strong>
                      {"　"}
                    </>
                  )}
                  {jobMeta.案件名 && (
                    <>
                      案件名 <strong>{jobMeta.案件名}</strong>
                      {"　"}
                    </>
                  )}
                  {jobMeta.担当者 && (
                    <>
                      担当者 <strong>{jobMeta.担当者}</strong>
                    </>
                  )}
                </div>
              )}
              <div className="alert alert-success">
                💡 木取り完了：<strong>{formatBoardSummary(result)}</strong> を使用し、
                <strong>{result.total_parts_placed}個</strong> の部品を配置しました。
                <br />
                歩留まり <strong>{result.utilization_pct}%</strong>
                {result.waste_area_mm2 > 0 && (
                  <>（端材 約 {Math.round(result.waste_area_mm2 / 1e6 * 10) / 10} m²）</>
                )}
              </div>
              {result.sheets.some((s) => s.merged) && (
                <div className="alert alert-success" style={{ marginTop: "0.5rem" }}>
                  ♻️ 端材統合: 尻板同士を1枚にまとめました（混載板あり）
                </div>
              )}
              {result.total_parts_requested > 0 &&
                result.total_parts_placed < result.total_parts_requested && (
                  <div className="alert alert-warning">
                    一部の部品は定尺に収まらなかったため配置していません。板サイズを大きくするか、部品寸法を確認してください。
                  </div>
                )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => downloadPrintHtml(result, kerf, jobMeta)}
              >
                🖨️ 木取図を印刷用にダウンロード（A4）
              </button>
            </>
          )}
        </div>

        {result && (
          <aside className="diagram-panel desktop-diagrams">
            <h2>🪚 木取図</h2>
            {diagramList}
          </aside>
        )}
      </div>

      {result && (
        <section className="diagram-panel mobile-diagrams">
          <h2>🪚 木取り図</h2>
          {diagramList}
        </section>
      )}

      {aboutOpen && (
        <div
          className="modal-overlay"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="about-title">イタドリについて</h2>
              <button
                type="button"
                className="btn btn-ghost modal-close"
                onClick={() => setAboutOpen(false)}
                aria-label="閉じる"
              >
                閉じる
              </button>
            </div>
            <div className="modal-body">
              <h3>イタドリ 取扱説明書</h3>
              <p>
                「イタドリ」は、木工・家具製作における煩わしくも重要な
                <strong>棚板の歩留まり（木取り）検討を素早くアシストするアプリ</strong>
                です。
              </p>
              <h4>基本仕様と設計思想</h4>
              <ul>
                <li>
                  <strong>定尺寸法</strong>
                  ：設定変更で使用する材料の寸法に変更できます。
                </li>
                <li>
                  <strong>ダメ切り・刃物厚</strong>
                  ：四方5mmずつのダメ切り（有効寸法は縦横-10mm）、刃厚3mm（設定で変更可能）を見込んで計算しています。
                </li>
                <li>
                  <strong>木目の保護</strong>
                  ：板の長手方向に対して
                  <strong>部材の回転は行いません</strong>
                  。
                </li>
              </ul>
              <h4>ご利用にあたって（免責事項）</h4>
              <ul>
                <li>
                  本アプリは端材が少なくなるように、また定規の移動を少なくするように計算して結果を出力していますが、必ずしも皆さんの感覚通りの最適解にならない場合があります。
                </li>
                <li>
                  あくまで<strong>「木取り計画・発注枚数の目安」</strong>
                  としてご活用ください。
                </li>
                <li>
                  本アプリの計算結果に基づいて生じた材料の過不足、加工ミス、損害等については責任を負いかねますので、最終的なカット計画は現物と現場の状況に合わせてご判断ください。
                </li>
              </ul>

              <hr className="modal-divider" />

              <div className="modal-feedback">
                <p>
                  このアプリにはまだ改善の余地があると思っています。
                  <br />
                  利用する皆さんのご意見を伺い、さらに良いアプリになるよう改善していきたいと考えています。
                  <br />
                  ぜひご意見を聞かせてください。
                </p>
                <p className="modal-feedback-signature">
                  TORAMOYA代表　ナカムラ
                  <br />
                  <a
                    href={`mailto:nakamura@tramoya.jp?subject=${encodeURIComponent("イタドリについて")}`}
                  >
                    nakamura@tramoya.jp
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
