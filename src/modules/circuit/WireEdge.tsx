/**
 * @file WireEdge.tsx
 * Memoized SVG presentation component for electrical circuit wires.
 * Displays logic state via three redundant channels: stroke geometry, value badge, and title tooltip.
 */

import { memo, type FC, type MouseEvent, type KeyboardEvent } from 'react';
import type { LogicValue } from '../../types/ast';
import { wireMidpoint, wirePath, type Point } from '../../engine/circuit/geometry';

export interface WireEdgeProps {
  readonly id: string;
  readonly fromNodeId: string;
  readonly fromPin: number;
  readonly toNodeId: string;
  readonly toPin: number;
  readonly fromPos: Point;
  readonly toPos: Point;
  readonly value: LogicValue;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly zoom: number;
  readonly onSelectWire: (id: string, e: MouseEvent | KeyboardEvent) => void;
  readonly onHoverWire?: (id: string | null) => void;
}

export const WireEdge: FC<WireEdgeProps> = memo(
  ({
    id,
    fromNodeId,
    fromPin,
    toNodeId,
    toPin,
    fromPos,
    toPos,
    value,
    isSelected,
    isHovered,
    zoom,
    onSelectWire,
    onHoverWire,
  }) => {
    const d = wirePath(fromPos, toPos);
    const mid = wireMidpoint(fromPos, toPos);

    const isHigh = value === 1;
    const isLow = value === 0;
    const isUnknown = value === 'X';

    // 1. Channel 1: Stroke styling (1 = thick solid, 0 = thin solid, X = dashed)
    const strokeWidth = isSelected ? 3.5 : isHigh ? 2.5 : 1.5;
    const strokeDasharray = isUnknown ? '4,4' : undefined;

    const strokeColor = isSelected
      ? '#2563eb' // blue-600
      : isHovered
      ? '#3b82f6' // blue-500
      : isHigh
      ? '#1d4ed8' // blue-700
      : isLow
      ? '#4b5563' // gray-600
      : '#b45309'; // amber-700 for X

    // 2. Channel 2: Badge visibility
    const showBadge = zoom >= 0.6 || isSelected || isHovered;

    const tooltipText = `Wire ${id} (${fromNodeId}:${fromPin} → ${toNodeId}:${toPin}): Value = ${value}`;

    return (
      <g
        id={`wire_${id}`}
        tabIndex={0}
        role="button"
        aria-label={tooltipText}
        aria-pressed={isSelected}
        className="cursor-pointer outline-none"
        onClick={(e) => {
          e.stopPropagation();
          onSelectWire(id, e);
        }}
        onMouseEnter={() => onHoverWire?.(id)}
        onMouseLeave={() => onHoverWire?.(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectWire(id, e);
          }
        }}
      >
        {/* 3. Channel 3: Tooltip title */}
        <title>{tooltipText}</title>

        {/* Thick invisible hit target for easy mouse clicking */}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          className="pointer-events-stroke"
        />

        {/* Selection/Hover Halo */}
        {(isSelected || isHovered) && (
          <path
            d={d}
            fill="none"
            stroke="#93c5fd"
            strokeWidth={strokeWidth + 4}
            strokeOpacity={0.6}
            className="pointer-events-none"
          />
        )}

        {/* Visible Wire Path */}
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className="transition-colors pointer-events-none"
        />

        {/* Midpoint Value Badge */}
        {showBadge && (
          <g transform={`translate(${mid.x}, ${mid.y})`} className="pointer-events-none">
            <rect
              x={-8}
              y={-8}
              width={16}
              height={16}
              rx={4}
              fill={isHigh ? '#dbeafe' : isLow ? '#f3f4f6' : '#fef3c7'}
              stroke={strokeColor}
              strokeWidth={1}
            />
            <text
              x={0}
              y={1}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[9px] font-mono font-bold select-none ${
                isHigh ? 'fill-blue-800' : isLow ? 'fill-gray-700' : 'fill-amber-800'
              }`}
            >
              {value}
            </text>
          </g>
        )}
      </g>
    );
  }
);

WireEdge.displayName = 'WireEdge';
