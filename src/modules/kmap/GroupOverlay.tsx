/**
 * @file GroupOverlay.tsx
 * Accessible SVG overlay rendering Karnaugh map implicant groups,
 * decomposed into toroidal wrap-around rectangles with open-ended brackets,
 * direction arrow glyphs, multi-layer continuation labels, distinct non-color
 * stroke patterns (solid, dashed, dotted, dash-dot), and text legend.
 */

import { type FC, useMemo } from 'react';
import type { Cube, KMapOverlayRect } from '../../engine/kmap/layout';
import { cellsToCube, decomposeCubeToRectangles } from '../../engine/kmap/layout';

export interface VisualGroup {
  readonly id: string;
  readonly cube?: Cube;
  readonly cellIndices: readonly number[];
  readonly termString: string;
  readonly isEssential?: boolean;
}

export interface GroupOverlayProps {
  readonly groups: readonly VisualGroup[];
  readonly variableCount: number;
  readonly layerFilter?: number;
  readonly showLegend?: boolean;
}

export interface GroupStyle {
  readonly label: string;
  readonly stroke: string;
  readonly fill: string;
  readonly dashArray: string;
  readonly strokeStyleName: string;
}

export const GROUP_STYLES: readonly GroupStyle[] = [
  { label: 'G1', stroke: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)', dashArray: 'none', strokeStyleName: 'solid' },
  { label: 'G2', stroke: '#059669', fill: 'rgba(5, 150, 105, 0.12)', dashArray: '10 6', strokeStyleName: 'dashed' },
  { label: 'G3', stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.12)', dashArray: '3 5', strokeStyleName: 'dotted' },
  { label: 'G4', stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.12)', dashArray: '12 5 3 5', strokeStyleName: 'dash-dot' },
  { label: 'G5', stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.12)', dashArray: '16 6', strokeStyleName: 'long-dash' },
  { label: 'G6', stroke: '#0891b2', fill: 'rgba(8, 145, 178, 0.12)', dashArray: '6 4', strokeStyleName: 'short-dash' },
  { label: 'G7', stroke: '#db2777', fill: 'rgba(219, 39, 119, 0.12)', dashArray: '14 4 4 4', strokeStyleName: 'dash-double-dot' },
  { label: 'G8', stroke: '#4b5563', fill: 'rgba(75, 85, 99, 0.12)', dashArray: '8 8', strokeStyleName: 'medium-dash' },
];

export function getGroupStyle(index: number): GroupStyle {
  const base = GROUP_STYLES[index % GROUP_STYLES.length];
  const safeBase: GroupStyle = base ?? {
    label: `G${index + 1}`,
    stroke: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.12)',
    dashArray: 'none',
    strokeStyleName: 'solid',
  };
  return {
    ...safeBase,
    label: `G${index + 1}`,
  };
}

export const GroupOverlay: FC<GroupOverlayProps> = ({
  groups,
  variableCount,
  layerFilter,
  showLegend = false,
}) => {
  const totalRows = variableCount === 2 || variableCount === 3 ? 2 : 4;
  const totalCols = variableCount === 2 ? 2 : 4;
  const svgWidth = totalCols * 100;
  const svgHeight = totalRows * 100;

  // Decompose each visual group into coordinate rectangles
  const processedGroups = useMemo(() => {
    return groups.map((g, gIdx) => {
      let cube = g.cube;
      if (!cube) {
        const cRes = cellsToCube(g.cellIndices, variableCount);
        if (cRes.ok) cube = cRes.cube;
      }
      const rects = cube ? decomposeCubeToRectangles(cube, variableCount) : [];
      const spansBothLayers = variableCount === 5 && rects.some((r) => r.layer === 0) && rects.some((r) => r.layer === 1);
      const style = getGroupStyle(gIdx);
      return {
        ...g,
        style,
        rects,
        spansBothLayers,
      };
    });
  }, [groups, variableCount]);

  const renderRectPiece = (
    rect: KMapOverlayRect,
    style: GroupStyle,
    key: string,
    spansBothLayers: boolean,
    currentLayer?: number
  ) => {
    const pad = 6;
    const x = rect.col * 100 + pad;
    const y = rect.row * 100 + pad;
    const w = rect.width * 100 - 2 * pad;
    const h = rect.height * 100 - 2 * pad;
    const x2 = x + w;
    const y2 = y + h;

    let pathD = '';
    let wrapText = '';
    let textX = x + 16;
    let textY = y + 24;

    switch (rect.wrap) {
      case 'none':
        pathD = `M ${x + 8},${y} L ${x2 - 8},${y} Q ${x2},${y} ${x2},${y + 8} L ${x2},${y2 - 8} Q ${x2},${y2} ${x2 - 8},${y2} L ${x + 8},${y2} Q ${x},${y2} ${x},${y2 - 8} L ${x},${y + 8} Q ${x},${y} ${x + 8},${y} Z`;
        break;
      case 'left':
        pathD = `M 0,${y} L ${x2 - 8},${y} Q ${x2},${y} ${x2},${y + 8} L ${x2},${y2 - 8} Q ${x2},${y2} ${x2 - 8},${y2} L 0,${y2}`;
        wrapText = '← wrap';
        textX = x2 - 40;
        break;
      case 'right':
        pathD = `M ${svgWidth},${y} L ${x + 8},${y} Q ${x},${y} ${x},${y + 8} L ${x},${y2 - 8} Q ${x},${y2} ${x + 8},${y2} L ${svgWidth},${y2}`;
        wrapText = 'wrap →';
        textX = x + 8;
        break;
      case 'top':
        pathD = `M ${x},0 L ${x},${y2 - 8} Q ${x},${y2} ${x + 8},${y2} L ${x2 - 8},${y2} Q ${x2},${y2} ${x2},${y2 - 8} L ${x2},0`;
        wrapText = '↑ wrap';
        textY = y2 - 12;
        break;
      case 'bottom':
        pathD = `M ${x},${svgHeight} L ${x},${y + 8} Q ${x},${y} ${x + 8},${y} L ${x2 - 8},${y} Q ${x2},${y} ${x2},${y + 8} L ${x2},${svgHeight}`;
        wrapText = '↓ wrap';
        textY = y + 24;
        break;
      case 'top-left':
        pathD = `M 0,${y2} L ${x2 - 8},${y2} Q ${x2},${y2} ${x2},${y2 - 8} L ${x2},0`;
        wrapText = '↖ corner wrap';
        textX = x2 - 50;
        textY = y2 - 12;
        break;
      case 'top-right':
        pathD = `M ${x},0 L ${x},${y2 - 8} Q ${x},${y2} ${x + 8},${y2} L ${svgWidth},${y2}`;
        wrapText = '↗ corner wrap';
        textX = x + 8;
        textY = y2 - 12;
        break;
      case 'bottom-left':
        pathD = `M 0,${y} L ${x2 - 8},${y} Q ${x2},${y} ${x2},${y + 8} L ${x2},${svgHeight}`;
        wrapText = '↙ corner wrap';
        textX = x2 - 50;
        textY = y + 24;
        break;
      case 'bottom-right':
        pathD = `M ${x},${svgHeight} L ${x},${y + 8} Q ${x},${y} ${x + 8},${y} L ${svgWidth},${y}`;
        wrapText = '↘ corner wrap';
        textX = x + 8;
        textY = y + 24;
        break;
    }

    const otherLayer = currentLayer === 0 ? 1 : 0;

    return (
      <g key={key} className="implicant-piece">
        {/* Open or closed outline */}
        <path
          d={pathD}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth="3.5"
          strokeDasharray={style.dashArray === 'none' ? undefined : style.dashArray}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Group Distinct Text Identifier */}
        <text
          x={textX}
          y={textY}
          fill={style.stroke}
          fontSize="14"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {style.label}
        </text>

        {/* Explicit Text Wrap-Around Indicator */}
        {wrapText && (
          <text
            x={textX}
            y={textY + 16}
            fill={style.stroke}
            fontSize="10"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            {wrapText}
          </text>
        )}

        {/* 5-Variable Inter-Layer Continuation Badge */}
        {spansBothLayers && currentLayer !== undefined && (
          <text
            x={x + 10}
            y={y + h - 10}
            fill={style.stroke}
            fontSize="9"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            continues in layer A={otherLayer}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* SVG Canvas Over Grid */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="h-full w-full pointer-events-none select-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {processedGroups.map((g) => {
          const visibleRects =
            layerFilter !== undefined
              ? g.rects.filter((r) => r.layer === layerFilter)
              : g.rects;

          return visibleRects.map((rect, rIdx) =>
            renderRectPiece(
              rect,
              g.style,
              `rect-${g.id}-${rIdx}`,
              g.spansBothLayers,
              layerFilter
            )
          );
        })}
      </svg>

      {/* Accessible Text Legend (Always distinguishable without color) */}
      {showLegend && groups.length > 0 && (
        <div
          role="region"
          aria-label="K-Map Groups Legend"
          className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Implicant Groups Legend
          </h4>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {processedGroups.map((g) => (
              <div
                key={`legend-${g.id}`}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2 shadow-2xs dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Visual Stroke Style Swatch */}
                <div
                  className="flex h-6 w-8 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-bold"
                  style={{
                    backgroundColor: g.style.fill,
                    border: `2px ${g.style.strokeStyleName === 'dashed' ? 'dashed' : g.style.strokeStyleName === 'dotted' ? 'dotted' : 'solid'} ${g.style.stroke}`,
                    color: g.style.stroke,
                  }}
                >
                  {g.style.label}
                </div>

                {/* Group Details */}
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {g.termString}
                    </span>
                    {g.isEssential && (
                      <span className="rounded-xs bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        Essential PI
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Cells: [{g.cellIndices.join(', ')}] ({g.style.strokeStyleName})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
