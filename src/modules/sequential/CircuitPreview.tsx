/**
 * @file CircuitPreview.tsx
 * Read-only interactive circuit schematic preview for sequential designs (Stage 10E).
 *
 * Renders synthesized combinational excitation logic with Stage 8B geometry,
 * ANSI/IEEE gate symbols, external flip-flop register blocks, style and fan-in selectors,
 * gate count badge, self-check status, and accessible netlist table.
 */

import { type FC, useMemo, useState } from 'react';
import type { GeneratorStyle } from '../../engine/circuit/generatorTypes';
import { nodeSize, pinPosition, wirePath } from '../../engine/circuit/geometry';
import { buildCombinationalCircuit } from '../../engine/sequential/circuitBuild';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { GATE_SYMBOLS } from '../circuit/gateSymbols';
import { CircuitGatesTable } from './CircuitGatesTable';
import type { UseSequentialSessionResult } from './useSequentialSession';

export interface CircuitPreviewProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

/**
 * Read-only schematic view displaying synthesized combinational logic and flip-flop blocks.
 */
export const CircuitPreview: FC<CircuitPreviewProps> = ({ session, className = '' }) => {
  const design: SequentialDesign | null =
    (session.activeDesign && session.activeDesign.kind === 'sync'
      ? session.activeDesign.design
      : null) ?? session.referenceDesign;

  const [style, setStyle] = useState<GeneratorStyle>('direct');
  const [maxFanIn, setMaxFanIn] = useState<number>(4);

  const buildResult = useMemo(() => {
    if (!design) return null;
    return buildCombinationalCircuit(design, { style, maxFanIn, shareSubexpressions: true });
  }, [design, style, maxFanIn]);

  if (!design || !buildResult || !buildResult.ok) {
    return (
      <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
        No synthesized circuit available. Complete specification and input equations first.
      </div>
    );
  }

  const { graph, gateCount, flipFlopBlocks, selfCheck } = buildResult;

  // Compute SVG viewport bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of graph.nodes) {
    const sz = nodeSize(n);
    if (n.x + sz.width > maxX) maxX = n.x + sz.width;
    if (n.y + sz.height > maxY) maxY = n.y + sz.height;
  }

  // Position flip-flop blocks to the right of the circuit
  const ffStartX = maxX + 60;
  const ffWidth = 260;
  const ffHeight = 54;
  const totalFfHeight = flipFlopBlocks.length * (ffHeight + 16);
  const svgWidth = Math.max(ffStartX + ffWidth + 40, 720);
  const svgHeight = Math.max(maxY + 60, totalFfHeight + 60, 360);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Synthesized Circuit Schematic
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Combinational steering logic driving external flip-flop register inputs.
          </p>
        </div>

        {/* Controls: Style, Max Fan-In, Gate Count Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>Style:</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as GeneratorStyle)}
              aria-label="Schematic Gate Style"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="direct">Direct Boolean</option>
              <option value="sop-and-or">SOP AND-OR</option>
              <option value="nand-only">NAND-only</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>Max Fan-in:</span>
            <select
              value={maxFanIn}
              onChange={(e) => setMaxFanIn(Number(e.target.value))}
              aria-label="Maximum Gate Fan-In"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </label>

          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            {gateCount} gates
          </span>
        </div>
      </div>

      {/* Self-check Verification Status */}
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-lg p-2.5 text-xs font-semibold ${
          selfCheck.passed
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
        }`}
      >
        {selfCheck.passed ? (
          <>
            <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Circuit matches all {selfCheck.checkedOutputs.length} functions</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.486 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>Circuit self-check failed: {selfCheck.errors.join('; ')}</span>
          </>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-950">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none"
          style={{ minWidth: `${Math.min(svgWidth, 680)}px`, maxHeight: '520px' }}
        >
          <title>Sequential Circuit Schematic</title>
          <desc>Combinational logic schematic and external flip-flop blocks for {design.spec.kind ?? 'counter'}</desc>

          {/* Wires */}
          <g className="text-gray-400 dark:text-gray-500">
            {graph.wires.map((w) => {
              const srcNode = graph.nodes.find((n) => n.id === w.from.nodeId);
              const dstNode = graph.nodes.find((n) => n.id === w.to.nodeId);
              if (!srcNode || !dstNode) return null;
              const pFrom = pinPosition(srcNode, 'out', w.from.pin ?? 0);
              const pTo = pinPosition(dstNode, 'in', w.to.pin ?? 0);
              return (
                <path
                  key={w.id}
                  d={wirePath(pFrom, pTo)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-colors"
                />
              );
            })}
          </g>

          {/* Nodes (Gates, Inputs, Outputs) */}
          {graph.nodes.map((node) => {
            const sz = nodeSize(node);

            if (node.kind === 'input') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect width={sz.width} height={sz.height} rx="4" className="fill-blue-50 stroke-blue-500 stroke-2 dark:fill-blue-950/60 dark:stroke-blue-400" />
                  <text x={sz.width / 2} y={sz.height / 2 + 4} textAnchor="middle" className="fill-blue-900 font-mono text-xs font-bold dark:fill-blue-200">
                    {node.label || node.id}
                  </text>
                </g>
              );
            }

            if (node.kind === 'output') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect width={sz.width} height={sz.height} rx="4" className="fill-amber-50 stroke-amber-500 stroke-2 dark:fill-amber-950/60 dark:stroke-amber-400" />
                  <text x={sz.width / 2} y={sz.height / 2 + 4} textAnchor="middle" className="fill-amber-900 font-mono text-xs font-bold dark:fill-amber-200">
                    {node.label || node.id}
                  </text>
                </g>
              );
            }

            if (node.kind === 'gate') {
              const def = GATE_SYMBOLS[node.gateType];
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <path
                    d={def.path}
                    className="fill-white stroke-gray-800 stroke-2 dark:fill-gray-900 dark:stroke-gray-200"
                  />
                  {def.hasBubble && (
                    <circle
                      cx="59"
                      cy="20"
                      r="3.5"
                      className="fill-white stroke-gray-800 stroke-2 dark:fill-gray-900 dark:stroke-gray-200"
                    />
                  )}
                  <text x="24" y="24" textAnchor="middle" className="fill-gray-700 font-sans text-[10px] font-bold dark:fill-gray-300">
                    {node.gateType}
                  </text>
                </g>
              );
            }

            return null;
          })}

          {/* External Flip-Flop Functional Blocks */}
          <g>
            {flipFlopBlocks.map((b, idx) => {
              const ffY = 24 + idx * (ffHeight + 16);
              const labelText = `${b.type} flip-flop, bit ${b.bitIndex}: ${b.inputNames.join(', ')} -> ${b.stateName}`;

              return (
                <g key={b.bitIndex} transform={`translate(${ffStartX}, ${ffY})`}>
                  <rect
                    width={ffWidth}
                    height={ffHeight}
                    rx="6"
                    className="fill-purple-50/70 stroke-purple-400 stroke-2 dark:fill-purple-950/40 dark:stroke-purple-600"
                  />
                  <text x="12" y="22" className="fill-purple-950 font-bold text-xs dark:fill-purple-200">
                    {b.type} Flip-Flop (Bit {b.bitIndex})
                  </text>
                  <text x="12" y="40" className="fill-purple-800 font-mono text-[11px] dark:text-purple-300">
                    {labelText}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Accessible Netlist Table */}
      <CircuitGatesTable graph={graph} flipFlopBlocks={flipFlopBlocks} />
    </div>
  );
};
