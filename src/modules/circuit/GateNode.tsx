/**
 * @file GateNode.tsx
 * Memoized SVG presentation component for logic gates and terminal nodes.
 * Features ANSI/IEEE gate shapes, inversion bubbles, real focusable pin ports,
 * interactive value toggles for inputs, and high-contrast accessibility rings.
 */

import { memo, type FC, type KeyboardEvent, type MouseEvent } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitNode } from '../../types/circuit';
import { nodeSize, pinPosition } from '../../engine/circuit/geometry';
import { GATE_SYMBOLS, getNodeAccessibleName, getNodeSymbolText } from './gateSymbols';

export interface GateNodeProps {
  readonly node: CircuitNode;
  readonly outputValue: LogicValue;
  readonly isSelected: boolean;
  readonly isFocused: boolean;
  readonly isWiringActive: boolean;
  readonly isWiringSource: boolean;
  readonly activeWiringTargetPin: number | null;
  readonly onSelectNode: (id: string, e: MouseEvent | KeyboardEvent) => void;
  readonly onToggleInput: (id: string) => void;
  readonly onPinClick: (nodeId: string, direction: 'in' | 'out', pinIndex: number, e: MouseEvent) => void;
  readonly onPinKeyDown: (nodeId: string, direction: 'in' | 'out', pinIndex: number, e: KeyboardEvent) => void;
}

export const GateNode: FC<GateNodeProps> = memo(
  ({
    node,
    outputValue,
    isSelected,
    isFocused,
    isWiringActive,
    isWiringSource,
    activeWiringTargetPin,
    onSelectNode,
    onToggleInput,
    onPinClick,
    onPinKeyDown,
  }) => {
    const size = nodeSize(node);
    const accessibleName = getNodeAccessibleName(node, String(outputValue));
    const symbolText = getNodeSymbolText(node);

    const isInput = node.kind === 'input';
    const isOutput = node.kind === 'output';
    const isClock = node.kind === 'clock';
    const isConst = node.kind === 'const';
    const isGate = node.kind === 'gate';

    // Color tokens based on value and selection
    const strokeColor = isSelected
      ? '#2563eb' // blue-600
      : isFocused
      ? '#4f46e5' // indigo-600
      : '#4b5563'; // gray-600

    const fillColor =
      outputValue === 1
        ? '#dbeafe' // blue-100
        : outputValue === 0
        ? '#f3f4f6' // gray-100
        : '#fef3c7'; // amber-100 (for X)

    return (
      <g
        id={`node_${node.id}`}
        transform={`translate(${node.x}, ${node.y})`}
        tabIndex={0}
        role="button"
        aria-label={accessibleName}
        aria-pressed={isSelected}
        className="cursor-move outline-none select-none"
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node.id, e);
          if (isInput) {
            onToggleInput(node.id);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (isInput) {
              e.preventDefault();
              onToggleInput(node.id);
            } else {
              onSelectNode(node.id, e);
            }
          }
        }}
      >
        <title>{accessibleName}</title>

        {/* Selection / Focus halo */}
        {(isSelected || isFocused) && (
          <rect
            x={-5}
            y={-5}
            width={size.width + 10}
            height={size.height + 10}
            rx={8}
            fill="none"
            stroke={isSelected ? '#3b82f6' : '#6366f1'}
            strokeWidth={2}
            strokeDasharray={isSelected ? undefined : '4,3'}
            className="pointer-events-none transition-all"
          />
        )}

        {/* Input Toggle Node */}
        {isInput && (
          <g
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggleInput(node.id);
            }}
          >
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              rx={6}
              fill={outputValue === 1 ? '#bfdbfe' : outputValue === 0 ? '#e5e7eb' : '#fde68a'}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={size.width / 2}
              y={size.height / 2 - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[11px] font-bold fill-gray-800 dark:fill-gray-100 select-none"
            >
              {symbolText}
            </text>
            <text
              x={size.width / 2}
              y={size.height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[12px] font-mono font-extrabold fill-blue-700 dark:fill-blue-300 select-none"
            >
              [{outputValue}]
            </text>
          </g>
        )}

        {/* Output Node */}
        {isOutput && (
          <g>
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              rx={6}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={size.width / 2}
              y={size.height / 2 - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[11px] font-bold fill-gray-800 dark:fill-gray-100 select-none"
            >
              {symbolText}
            </text>
            <text
              x={size.width / 2}
              y={size.height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[12px] font-mono font-extrabold fill-emerald-700 dark:fill-emerald-400 select-none"
            >
              {outputValue}
            </text>
          </g>
        )}

        {/* Clock Source Node */}
        {isClock && (
          <g>
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              rx={6}
              fill={outputValue === 1 ? '#c7d2fe' : '#e0e7ff'}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <path
              d="M 12 28 L 22 28 L 22 14 L 32 14 L 32 28 L 42 28"
              fill="none"
              stroke="#4338ca"
              strokeWidth={1.5}
            />
            <text
              x={52}
              y={22}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-mono font-bold fill-indigo-900"
            >
              {outputValue}
            </text>
          </g>
        )}

        {/* Constant Source Node */}
        {isConst && (
          <g>
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              rx={6}
              fill="#f3f4f6"
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={size.width / 2}
              y={size.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[14px] font-mono font-bold fill-gray-900"
            >
              {node.value}
            </text>
          </g>
        )}

        {/* Logic Gate Node */}
        {isGate && (
          <g>
            {/* Base Gate Shape */}
            {(() => {
              const sym = GATE_SYMBOLS[node.gateType];
              const scaleY = size.height / sym.baseHeight;
              return (
                <g transform={`scale(1, ${scaleY})`}>
                  {sym.inputArcPath && (
                    <path
                      d={sym.inputArcPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={1.5}
                    />
                  )}
                  <path
                    d={sym.path}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {sym.hasBubble && (
                    <circle
                      cx={sym.baseWidth + 4}
                      cy={sym.baseHeight / 2}
                      r={3.5}
                      fill="#ffffff"
                      stroke={strokeColor}
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })()}

            {/* Visible Gate Type Label */}
            <text
              x={node.gateType === 'NOT' ? 18 : 22}
              y={size.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-bold uppercase tracking-wider fill-gray-900 dark:fill-gray-900 select-none pointer-events-none"
            >
              {symbolText}
            </text>

            {/* Gate Optional Instance Label */}
            {node.label && (
              <text
                x={size.width / 2}
                y={-6}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-300"
              >
                {node.label}
              </text>
            )}
          </g>
        )}

        {/* Input Pin Targets (on the left edge) */}
        {node.kind !== 'input' &&
          node.kind !== 'clock' &&
          node.kind !== 'const' &&
          Array.from(
            { length: node.kind === 'output' ? 1 : node.inputCount },
            (_, idx) => {
              const pos = pinPosition(node, 'in', idx);
              const relX = pos.x - node.x;
              const relY = pos.y - node.y;
              const isTargetActive = isWiringActive && activeWiringTargetPin === idx;

              return (
                <g
                  key={`pin_in_${idx}`}
                  transform={`translate(${relX}, ${relY})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.id} input ${idx}`}
                  className="cursor-crosshair outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinClick(node.id, 'in', idx, e);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPinKeyDown(node.id, 'in', idx, e);
                    }
                  }}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={isTargetActive ? 7 : 4.5}
                    fill={isTargetActive ? '#22c55e' : '#ffffff'}
                    stroke={isTargetActive ? '#15803d' : '#4b5563'}
                    strokeWidth={1.5}
                    className="transition-all hover:scale-125"
                  />
                </g>
              );
            }
          )}

        {/* Output Driver Pin Target (on the right edge) */}
        {node.kind !== 'output' && (
          <g
            transform={`translate(${size.width}, ${size.height / 2})`}
            tabIndex={0}
            role="button"
            aria-label={`${node.id} output`}
            className="cursor-crosshair outline-none"
            onClick={(e) => {
              e.stopPropagation();
              onPinClick(node.id, 'out', 0, e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPinKeyDown(node.id, 'out', 0, e);
              }
            }}
          >
            <circle
              cx={0}
              cy={0}
              r={isWiringSource ? 7 : 4.5}
              fill={isWiringSource ? '#3b82f6' : '#ffffff'}
              stroke={isWiringSource ? '#1d4ed8' : '#4b5563'}
              strokeWidth={1.5}
              className="transition-all hover:scale-125"
            />
          </g>
        )}
      </g>
    );
  }
);

GateNode.displayName = 'GateNode';
