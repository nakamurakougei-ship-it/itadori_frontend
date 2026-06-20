"use client";

import type { Sheet } from "@/lib/types";
import { buildDiagramSvg } from "@/lib/diagram";

interface DiagramSvgProps {
  sheet: Sheet;
  vw: number;
  vh: number;
  label: string;
  kerf?: number;
  className?: string;
}

export function DiagramSvg({
  sheet,
  vw,
  vh,
  label,
  kerf = 3,
  className,
}: DiagramSvgProps) {
  const svg = buildDiagramSvg({ sheet, vw, vh, label, kerf });

  return (
    <div
      className={className ?? "diagram-svg-wrap"}
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={`木取図 No.${sheet.id}`}
    />
  );
}
