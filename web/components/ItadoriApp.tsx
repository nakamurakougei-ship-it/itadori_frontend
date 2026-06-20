"use client";

import { useCallback, useEffect, useState } from "react";
import { DiagramSvg } from "@/components/DiagramSvg";
import { downloadPrintHtml } from "@/lib/print";
import {
  TrunkTechEngine,
  asLongShort,
  buildAllParts,
} from "@/lib/trunkTechEngine";
import type { PackResult, ShelfRow, SizeChoice } from "@/lib/types";

const DEFAULT_SHELF: ShelfRow[] = [
  { 名称: "部材名", 幅: 900, 奥行: 450, 枚数: 4 },
];

const SIZE_CHOICES: SizeChoice[] = [
  "自動選定 (効率優先)",
  "3x6固定",
  "4x8固定",
  "集成材",
];

function createEmptyRow(): ShelfRow {
  return { 名称: "", 幅: 0, 奥行: 0, 枚数: 0 };
}

export default function ItadoriApp() {
  const [v36, setV36] = useState(1820);
  const [h36, setH36] = useState(910);
  const [v48, setV48] = useState(2440);
  const [h48, setH48] = useState(1220);
  const [lamW, setLamW] = useState(500);
  const [lamL, setLamL] = useState(3600);
  const [kerf, setKerf] = useState(3.0);
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>("自動選定 (効率優先)");
  const [shelfList, setShelfList] = useState<ShelfRow[]>(DEFAULT_SHELF);
  const [result, setResult] = useState<PackResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hasBg, setHasBg] = useState(true);

  useEffect(() => {
    fetch("/itadori.jpg", { method: "HEAD" })
      .then((r) => setHasBg(r.ok))
      .catch(() => setHasBg(false));
  }, []);

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
      setWarning("棚板リストを入力してください。");
      setResult(null);
      return;
    }

    const engine = new TrunkTechEngine(kerf);
    const s36Dim = asLongShort(v36, h36, "3x6");
    const s48Dim = asLongShort(v48, h48, "4x8");
    const sLamDim = asLongShort(lamL, lamW, "集成材");

    let testModes: [number, number, string][];
    if (sizeChoice.includes("自動")) {
      testModes = [s36Dim, s48Dim];
    } else if (sizeChoice.includes("3x6")) {
      testModes = [s36Dim];
    } else if (sizeChoice.includes("4x8")) {
      testModes = [s48Dim];
    } else {
      testModes = [sLamDim];
    }

    const nRequested = allParts.length;
    const simResults: PackResult[] = testModes.map(([vw, vh, label]) => {
      const sheets = engine.packSheets(allParts, vw, vh);
      const totalPlaced = sheets.reduce(
        (sum, s) => sum + s.rows.reduce((rs, r) => rs + r.parts.length, 0),
        0
      );
      const totalArea = sheets.length * (vw * vh);
      return {
        label,
        sheets,
        sheet_count: sheets.length,
        vw,
        vh,
        score: totalArea,
        total_parts_placed: totalPlaced,
        total_parts_requested: nRequested,
      };
    });

    const rank = (x: PackResult) =>
      [
        x.total_parts_placed === nRequested ? 0 : 1,
        -x.total_parts_placed,
        x.sheet_count,
        x.score,
      ] as const;

    const best = simResults.reduce((a, b) => {
      const ka = rank(a);
      const kb = rank(b);
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return a;
        if (ka[i] > kb[i]) return b;
      }
      return a;
    });

    setResult(best);
  };

  const vwFull = result ? result.vw + 2 : 0;
  const vhFull = result ? result.vh + 2 : 0;

  const diagramList = result ? (
    result.sheets.map((s) => (
      <div key={s.id} className="diagram-card">
        <DiagramSvg
          sheet={s}
          vwFull={vwFull}
          vhFull={vhFull}
          label={result.label}
        />
      </div>
    ))
  ) : null;

  return (
    <div className={`page${hasBg ? "" : " no-bg"}`}>
      <div className="title-with-badge">
        <span className="title-main">イタドリ</span>
        <span className="powered-badge">Powered by TrunkTechEngine</span>
      </div>
      <p className="lead">定尺板から効率よく木取りを行うためのアプリです。</p>

      <div className="main-layout">
        <div className="main-column">
          <section className="panel">
            <h2>定尺板寸法設定</h2>
            <p>使用する板の定尺寸法を変更できます</p>

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

            <h3>■ 集成材</h3>
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

            <hr className="divider" />

            <div className="field">
              <span style={{ fontWeight: "bold" }}>板サイズの選定方法</span>
              <div className="radio-group" style={{ marginTop: "0.5rem" }}>
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
          </section>

          <section>
            <h2>切板リストの入力</h2>
            <div className="shelf-table-wrap">
              <table className="shelf-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>幅</th>
                    <th>奥行</th>
                    <th>枚数</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shelfList.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          value={row.名称}
                          onChange={(e) =>
                            updateShelf(i, "名称", e.target.value)
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
                          value={row.奥行 || ""}
                          onChange={(e) =>
                            updateShelf(i, "奥行", e.target.value)
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
              <div className="alert alert-success">
                💡 木取り完了：<strong>{result.label}板</strong> を{" "}
                <strong>{result.sheet_count}枚</strong> 使用し、
                <strong>{result.total_parts_placed}個</strong> の部品を配置しました。
              </div>
              {result.total_parts_requested > 0 &&
                result.total_parts_placed < result.total_parts_requested && (
                  <div className="alert alert-warning">
                    一部の部品は定尺に収まらなかったため配置していません。板サイズを大きくするか、部品寸法を確認してください。
                  </div>
                )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => downloadPrintHtml(result)}
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
    </div>
  );
}
