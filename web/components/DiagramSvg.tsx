"use client";

import type { Sheet } from "@/lib/types";

interface DiagramSvgProps {
  sheet: Sheet;
  vwFull: number;
  vhFull: number;
  label: string;
  className?: string;
}

export function DiagramSvg({
  sheet,
  vwFull,
  vhFull,
  label,
  className,
}: DiagramSvgProps) {
  const viewW = vwFull;
  const viewH = vhFull + 28;

  return (
    <svg
      className={className ?? "diagram-svg"}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`木取図 ID ${sheet.id}`}
    >
      <title>
        【木取り図】 ID:{sheet.id} ({label}：{Math.round(vwFull)}x
        {Math.round(vhFull)})
      </title>
      <text
        x={viewW / 2}
        y={16}
        textAnchor="middle"
        fontSize={Math.max(10, viewW * 0.012)}
        fontWeight="bold"
      >
        【木取り図】 ID:{sheet.id} ({label}：{Math.round(vwFull)}x
        {Math.round(vhFull)})
      </text>
      <g transform="translate(0, 24)">
        <rect
          x={0}
          y={0}
          width={vwFull}
          height={vhFull}
          fill="#fdf5e6"
          stroke="#8b4513"
          strokeWidth={2}
        />
        {sheet.rows.flatMap((r) =>
          r.parts.map((p, idx) => {
            const cx = p.x + p.w / 2;
            const cy = vhFull - p.y - p.h / 2;
            const fontSize = Math.max(6, Math.min(p.w, p.h) * 0.12);
            return (
              <g key={`${sheet.id}-${idx}-${p.x}-${p.y}`}>
                <rect
                  x={p.x}
                  y={vhFull - p.y - p.h}
                  width={p.w}
                  height={p.h}
                  fill="#deb887"
                  stroke="black"
                  strokeWidth={1}
                  opacity={0.85}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight="bold"
                >
                  <tspan x={cx} dy="-0.35em">
                    {p.n}
                  </tspan>
                  <tspan x={cx} dy="1.1em">
                    {Math.round(p.w)}x{Math.round(p.h)}
                  </tspan>
                </text>
              </g>
            );
          })
        )}
      </g>
    </svg>
  );
}
