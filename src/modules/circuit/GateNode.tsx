/**
 * @file GateNode.tsx
 * Memoized SVG presentation component for logic gates and terminal nodes.
 * Features ANSI/IEEE gate shapes, inversion bubbles, real focusable pin ports,
 * interactive value toggles for inputs, and high-contrast accessibility rings.
 */

import { memo, type FC, type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitNode } from '../../types/circuit';
import { CIRCUIT_GATE_SYMBOL_HEIGHT, CIRCUIT_GATE_SYMBOL_WIDTH, CIRCUIT_PORT_RADIUS, nodeSize, pinPosition } from '../../engine/circuit/geometry';
import { getNodeAccessibleName, getNodeSymbolText } from './gateSymbols';
import { GateSymbolGraphic } from './GateSymbolGraphic';

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
  readonly onPinPointerDown?: (nodeId: string, direction: 'in' | 'out', pinIndex: number, e: PointerEvent<SVGGElement>) => void;
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
    onPinPointerDown,
    onPinKeyDown,
  }) => {
    const previousOutput = useRef(outputValue);
    const [valueChanged, setValueChanged] = useState(false);
    useEffect(() => {
      if (previousOutput.current === outputValue) return;
      previousOutput.current = outputValue;
      setValueChanged(true);
      const timer = window.setTimeout(() => setValueChanged(false), 180);
      return () => window.clearTimeout(timer);
    }, [outputValue]);
    const size = nodeSize(node);
    const accessibleName = getNodeAccessibleName(node, String(outputValue));
    const symbolText = getNodeSymbolText(node);

    const isInput = node.kind === 'input';
    const nodeLabel = node.kind === 'gate'
      ? `${node.gateType} ${node.label || node.id}`
      : node.kind === 'input'
        ? `${node.label || node.id} = ${String(outputValue)}`
        : node.kind === 'output'
          ? node.label || node.id
          : node.kind === 'clock'
            ? node.label || node.id
            : `${node.id} = ${String(node.value)}`;

    // Color tokens based on value and selection
    const strokeColor = isSelected ? 'var(--teal)' : isFocused ? 'var(--lavender)' : 'var(--muted)';

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
            stroke={isSelected ? 'var(--teal)' : 'var(--lavender)'}
            strokeWidth={2}
            strokeDasharray={isSelected ? undefined : '4,3'}
            className="pointer-events-none transition-all"
          />
        )}

        {/* Standard symbol, current value, and label for every component type */}
        <g className={`circuit-node-motion${isSelected ? ' circuit-node-motion-selected' : ''}${valueChanged ? ' circuit-node-value-changed' : ''}${isInput ? ' cursor-pointer' : ''}`} onClick={isInput ? (e) => { e.stopPropagation(); onToggleInput(node.id); } : undefined}>
          <rect x={0} y={0} width={size.width} height={size.height} rx={8} className="circuit-node-frame" stroke={strokeColor} strokeWidth={isSelected ? 2.5 : 1.5} />
          <GateSymbolGraphic
            symbol={node.kind === 'gate' ? node.gateType : node.kind === 'input' ? 'INPUT' : node.kind === 'output' ? 'OUTPUT' : node.kind === 'clock' ? 'CLOCK' : node.value === 0 ? 'CONST0' : 'CONST1'}
            x={(size.width - CIRCUIT_GATE_SYMBOL_WIDTH) / 2}
            y={4}
            width={CIRCUIT_GATE_SYMBOL_WIDTH}
            height={CIRCUIT_GATE_SYMBOL_HEIGHT}
            className="circuit-symbol-svg"
          />
          {node.kind === 'output' && <g className={`circuit-output-led${outputValue === 1 ? ' circuit-output-led-on' : ''}`} aria-label={`Output ${String(outputValue)}`}>
            <circle cx={size.width / 2 - 7} cy={50} r={4} />
            <text x={size.width / 2 + 2} y={51} dominantBaseline="middle">{String(outputValue)}</text>
          </g>}
          <text x={size.width / 2} y={node.kind === 'output' ? 68 : 61} textAnchor="middle" dominantBaseline="middle" className="circuit-node-label">{nodeLabel || symbolText}</text>
        </g>
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
                  data-circuit-pin="true"
                  data-node-id={node.id}
                  data-pin-direction="in"
                  data-pin-index={idx}
                  onPointerDown={(e) => onPinPointerDown?.(node.id, 'in', idx, e)}
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
                    r={isTargetActive ? 7 : CIRCUIT_PORT_RADIUS}
                    fill={isTargetActive ? '#22c55e' : 'var(--card)'}
                    stroke={isTargetActive ? '#15803d' : 'var(--muted)'}
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
            data-circuit-pin="true"
            data-node-id={node.id}
            data-pin-direction="out"
            data-pin-index={0}
            onPointerDown={(e) => onPinPointerDown?.(node.id, 'out', 0, e)}
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
              r={isWiringSource ? 7 : CIRCUIT_PORT_RADIUS}
              fill={isWiringSource ? '#3b82f6' : 'var(--card)'}
              stroke={isWiringSource ? '#1d4ed8' : 'var(--muted)'}
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
