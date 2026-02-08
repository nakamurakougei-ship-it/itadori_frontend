"use client";

import { useState, useEffect, useCallback } from "react";

const API_PACK = "/api/pack";

type PartPlacement = { n: string; x: number; y: number; w: number; h: number };
type Row = { y: number; h: number; parts: PartPlacement[] };
type Sheet = { id: number; rows: Row[] };
type PackResult = {
  label: string;
  vw: number;
  vh: number;
  sheet_count: number;
  total_parts_placed: number;
  total_parts_requested: number;
  sheets: Sheet[];
};

type ShelfRow = { id: number; name: string; w: number; d: number; qty: number };
type SizeChoice = "自動選定 (効率優先)" | "3x6固定" | "4x8固定" | "集成材";

/** 定尺は (長手, 短手) で、鼻切り -2mm */
function asLongShort(a: number, b: number): [number, number] {
  const lo = Math.max(a, b) - 2;
  const sh = Math.min(a, b) - 2;
  return [lo, sh];
}

function partColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 75%)`;
}

function LumberDiagram({
  sheet,
  vw,
  vh,
  label,
}: {
  sheet: Sheet;
  vw: number;
  vh: number;
  label: string;
}) {
  const allParts = sheet.rows.flatMap((row) => row.parts);
  return (
    <div className="flex flex-col rounded-lg border border-amber-800/30 bg-white/90 p-3 shadow">
      <h3 className="mb-2 text-sm font-semibold text-amber-900">
        【木取り図】 ID:{sheet.id} （{label}：{Math.round(vw)}×{Math.round(vh)}）
      </h3>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full max-w-md border border-amber-700/40 bg-[#fdf5e6]"
        preserveAspectRatio="xMidYMid meet"
        style={{ minHeight: 180 }}
      >
        <rect
          x={0}
          y={0}
          width={vw}
          height={vh}
          fill="#fdf5e6"
          stroke="#8b4513"
          strokeWidth={1.5}
        />
        {allParts.map((part, i) => (
          <g key={i}>
            <rect
              x={part.x}
              y={part.y}
              width={part.w}
              height={part.h}
              fill={partColor(part.n)}
              stroke="#333"
              strokeWidth={1}
            />
            <text
              x={part.x + part.w / 2}
              y={part.y + part.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(14, part.h / 4)}
              fill="#1a1a1a"
              fontWeight="bold"
            >
              {part.n}
            </text>
            <text
              x={part.x + part.w / 2}
              y={part.y + part.h / 2 + (part.h / 4 || 10)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(10, part.h / 6)}
              fill="#444"
            >
              {Math.round(part.w)}×{Math.round(part.h)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

async function downloadPrintHtml(result: PackResult) {
  const res = await fetch("/api/diagram/html", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: result.label,
      vw: result.vw,
      vh: result.vh,
      sheets: result.sheets,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate print HTML");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mokudori_print.html";
  a.click();
  URL.revokeObjectURL(url);
}

function PrintDownloadButton({ result }: { result: PackResult }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await downloadPrintHtml(result);
        } finally {
          setLoading(false);
        }
      }}
      className="rounded bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800 disabled:opacity-60"
    >
      🖨️ 木取図を印刷用にダウンロード（A4）
    </button>
  );
}

function NumInput({
  value,
  onChange,
  min = 1,
  step = 1,
  className = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center rounded border border-amber-700/40 bg-white/90">
      <button
        type="button"
        className="px-2 py-1 text-amber-800 hover:bg-amber-100"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="減らす"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className={`border-0 bg-transparent px-2 py-1 text-center ${className}`}
      />
      <button
        type="button"
        className="px-2 py-1 text-amber-800 hover:bg-amber-100"
        onClick={() => onChange(value + step)}
        aria-label="増やす"
      >
        +
      </button>
    </span>
  );
}

export default function Home() {
  const [v36, setV36] = useState(1820);
  const [h36, setH36] = useState(910);
  const [v48, setV48] = useState(2440);
  const [h48, setH48] = useState(1220);
  const [lamW, setLamW] = useState(500);
  const [lamL, setLamL] = useState(3600);
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>("自動選定 (効率優先)");
  const [kerf, setKerf] = useState(3);
  const [shelfList, setShelfList] = useState<ShelfRow[]>([
    { id: 1, name: "部材名", w: 900, d: 450, qty: 4 },
  ]);
  const [result, setResult] = useState<PackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParts = useCallback((): { n: string; w: number; d: number }[] => {
    const out: { n: string; w: number; d: number }[] = [];
    for (const row of shelfList) {
      const qty = Math.max(0, Math.floor(Number(row.qty) || 0));
      const w = Number(row.w) || 0;
      const d = Number(row.d) || 0;
      if (!row.name?.trim() || qty <= 0 || w <= 0 || d <= 0) continue;
      for (let i = 0; i < qty; i++) {
        out.push({ n: row.name.trim(), w, d });
      }
    }
    return out;
  }, [shelfList]);

  const fetchPack = useCallback(async () => {
    const parts = buildParts();
    if (parts.length === 0) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    const [v36L, v36H] = asLongShort(v36, h36);
    const [v48L, v48H] = asLongShort(v48, h48);
    const [lamL_, lamW_] = asLongShort(lamL, lamW);

    const modes: { vw: number; vh: number; label: string }[] = [];
    if (sizeChoice === "自動選定 (効率優先)") {
      modes.push({ vw: v36L, vh: v36H, label: "3x6" });
      modes.push({ vw: v48L, vh: v48H, label: "4x8" });
    } else if (sizeChoice === "3x6固定") {
      modes.push({ vw: v36L, vh: v36H, label: "3x6" });
    } else if (sizeChoice === "4x8固定") {
      modes.push({ vw: v48L, vh: v48H, label: "4x8" });
    } else {
      modes.push({ vw: lamL_, vh: lamW_, label: "集成材" });
    }

    try {
      const results: PackResult[] = [];
      for (const { vw, vh, label } of modes) {
        const res = await fetch(API_PACK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts,
            vw,
            vh,
            kerf: Number(kerf),
            label,
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        results.push(await res.json());
      }
      const nReq = parts.length;
      const best = results.length === 1
        ? results[0]
        : results.reduce((a, b) => {
            // 効率優先: 全配置 → 多く配置 → 総使用面積が小さい → 枚数が少ない
            const totalArea = (r: PackResult) => r.vw * r.vh * r.sheet_count;
            const score = (r: PackResult) => [
              r.total_parts_placed === nReq ? 0 : 1,
              -r.total_parts_placed,
              totalArea(r),
              r.sheet_count,
            ];
            return score(a).join(",") <= score(b).join(",") ? a : b;
          });
      setResult(best);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [v36, h36, v48, h48, lamW, lamL, sizeChoice, kerf, buildParts]);

  const addShelfRow = () => {
    setShelfList((prev) => [
      ...prev,
      { id: Date.now(), name: "", w: 200, d: 100, qty: 1 },
    ]);
  };

  const removeShelfRow = (id: number) => {
    setShelfList((prev) => prev.filter((r) => r.id !== id));
  };

  const updateShelfRow = (
    id: number,
    field: keyof ShelfRow,
    value: string | number
  ) => {
    setShelfList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed text-[#2c1810]"
      style={{ backgroundImage: "url(/itadori.jpg)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:flex-row md:gap-6">
        {/* 左カラム: 設定 + 切板リスト */}
        <div className="flex shrink-0 flex-col md:w-[500px]">
          <header className="mb-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-3xl font-bold text-black">イタドリ</h1>
              <span className="rounded bg-[#333] px-2 py-0.5 text-xs font-normal text-white">
                Powered by TrunkTechEngine
              </span>
            </div>
            <p className="mt-1 text-sm text-black/90">
              定尺板から効率よく木取りを行うためのアプリです。
            </p>
          </header>

          <section className="rounded-lg border border-amber-800/40 bg-white/88 p-4 shadow-sm">
            <h2 className="text-lg font-bold text-black">定尺板寸法設定</h2>
            <p className="mb-3 text-sm text-black/80">
              使用する板の定尺寸法を変更できます
            </p>

            <p className="mb-1 font-bold text-black">■ 3×6寸法</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="pt-2.5 text-sm">縦</span>
              <NumInput value={v36} onChange={setV36} />
              <span className="pt-2.5 text-sm">mm × 横</span>
              <NumInput value={h36} onChange={setH36} />
              <span className="pt-2.5 text-sm">mm</span>
            </div>

            <p className="mb-1 font-bold text-black">■ 4×8寸法</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="pt-2.5 text-sm">縦</span>
              <NumInput value={v48} onChange={setV48} />
              <span className="pt-2.5 text-sm">mm × 横</span>
              <NumInput value={h48} onChange={setH48} />
              <span className="pt-2.5 text-sm">mm</span>
            </div>

            <p className="mb-1 font-bold text-black">■ 集成材</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="pt-2.5 text-sm">幅</span>
              <NumInput value={lamW} onChange={setLamW} min={500} />
              <span className="pt-2.5 text-sm">mm × 長さ</span>
              <NumInput value={lamL} onChange={setLamL} min={3000} />
              <span className="pt-2.5 text-sm">mm</span>
            </div>

            <hr className="my-3 border-amber-800/30" />
            <p className="mb-2 font-bold text-black">板サイズの選定方法</p>
            <div className="mb-3 flex flex-col gap-1.5">
              {(
                [
                  "自動選定 (効率優先)",
                  "3x6固定",
                  "4x8固定",
                  "集成材",
                ] as SizeChoice[]
              ).map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="sizeChoice"
                    checked={sizeChoice === opt}
                    onChange={() => setSizeChoice(opt)}
                    className="pointer-events-auto"
                  />
                  <span className="font-bold text-black">{opt}</span>
                </label>
              ))}
            </div>
            <div className="mb-4 flex items-center gap-2">
              <span className="font-bold text-black">刃物厚 (mm)</span>
              <NumInput value={kerf} onChange={setKerf} min={0} step={0.1} className="w-20" />
            </div>

            <hr className="my-3 border-amber-800/30" />
            <h2 className="mb-2 text-lg font-bold text-black">切板リストの入力</h2>
            <div className="overflow-x-auto rounded-lg border border-amber-800/30 bg-white/90">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-amber-800/30 bg-amber-50/80">
                    <th className="px-2 py-2 text-left font-bold text-black">名称</th>
                    <th className="px-2 py-2 text-left font-bold text-black">幅</th>
                    <th className="px-2 py-2 text-left font-bold text-black">長さ</th>
                    <th className="px-2 py-2 text-left font-bold text-black">枚数</th>
                    <th className="w-12 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shelfList.map((row) => (
                    <tr key={row.id} className="border-b border-amber-100">
                      <td className="px-2 py-1">
                        <input
                          placeholder="部材名"
                          value={row.name}
                          onChange={(e) =>
                            updateShelfRow(row.id, "name", e.target.value)
                          }
                          className="w-full rounded border border-amber-700/30 bg-white/90 px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          value={row.w}
                          onChange={(e) =>
                            updateShelfRow(row.id, "w", Number(e.target.value) || 0)
                          }
                          className="w-20 rounded border border-amber-700/30 bg-white/90 px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          value={row.d}
                          onChange={(e) =>
                            updateShelfRow(row.id, "d", Number(e.target.value) || 0)
                          }
                          className="w-20 rounded border border-amber-700/30 bg-white/90 px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          value={row.qty}
                          onChange={(e) =>
                            updateShelfRow(row.id, "qty", Math.max(0, Math.floor(Number(e.target.value) || 0)))
                          }
                          className="w-16 rounded border border-amber-700/30 bg-white/90 px-2 py-1"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => removeShelfRow(row.id)}
                          className="rounded bg-red-600/90 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addShelfRow}
              className="mt-2 rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800"
            >
              ＋ 行を追加
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchPack()}
                disabled={loading}
                className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
              >
                木取り開始
              </button>
              <button
                type="button"
                onClick={() => fetchPack()}
                disabled={loading || !result}
                className="rounded border-2 border-amber-700 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 disabled:border-amber-400 disabled:text-amber-600"
              >
                木取り結果の更新
              </button>
            </div>
          </section>

          {loading && (
            <p className="mt-3 text-sm italic text-black/80">計算中…</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-700">
              エラー: {error}（バックエンドが起動しているか確認してください）
            </p>
          )}
        </div>

        {/* 右カラム: 木取図 */}
        <div className="min-w-0 flex-1 pt-4 md:pt-0">
          {result && result.sheets.length > 0 && (
            <>
              <div className="mb-3 rounded-lg border border-green-700/40 bg-green-50/90 px-4 py-2">
                <p className="font-semibold text-green-800">
                  💡 木取り完了：<strong>{result.label}板</strong> を{" "}
                  <strong>{result.sheet_count}枚</strong> 使用し、{" "}
                  <strong>{result.total_parts_placed}個</strong> の部品を配置しました。
                </p>
                {result.total_parts_requested > 0 &&
                  result.total_parts_placed < result.total_parts_requested && (
                    <p className="mt-1 text-sm text-amber-800">
                      一部の部品は定尺に収まらなかったため配置していません。板サイズを大きくするか、部品寸法を確認してください。
                    </p>
                  )}
              </div>
              <div className="mb-3">
                <PrintDownloadButton result={result} />
              </div>
              <h2 className="mb-2 text-lg font-bold text-black">🪚 木取図</h2>
              <div className="flex flex-wrap gap-4">
                {result.sheets.map((sheet) => (
                  <LumberDiagram
                    key={sheet.id}
                    sheet={sheet}
                    vw={result.vw}
                    vh={result.vh}
                    label={result.label}
                  />
                ))}
              </div>
            </>
          )}
          {result && result.sheets.length === 0 && !loading && buildParts().length > 0 && (
            <p className="text-sm italic text-black/80">
              部品が定尺に収まりません。板サイズを大きくするか、部品寸法を確認してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
