/**
 * @file StateDiagramView.tsx
 * Read-only State Diagram SVG rendering component (Stage 10D).
 *
 * Uses layoutStateDiagram to position nodes circularly with state circles, (Moore) outputs,
 * curved directed edges, oriented arrowheads, text labels, an initial-state "start" pointer,
 * accessible SVG metadata (<title>, <desc>), and a collapsible HTML table of all transitions.
 */

import { type FC, useId, useMemo, useState } from 'react';
import { layoutStateDiagram } from '../../engine/sequential/stateDiagramLayout';
import type { StateDiagramData } from '../../types/sequential';

export interface StateDiagramViewProps {
  readonly diagram: StateDiagramData;
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}

/** Computes SVG points string for a rotated triangular arrowhead. */
function getArrowPoints(tipX: number, tipY: number, angleRad: number, size = 7): string {
  const p1X = tipX - size * Math.cos(angleRad - Math.PI / 6);
  const p1Y = tipY - size * Math.sin(angleRad - Math.PI / 6);
  const p2X = tipX - size * Math.cos(angleRad + Math.PI / 6);
  const p2Y = tipY - size * Math.sin(angleRad + Math.PI / 6);
  return `${tipX},${tipY} ${p1X},${p1Y} ${p2X},${p2Y}`;
}

export const StateDiagramView: FC<StateDiagramViewProps> = ({
  diagram,
  width = 540,
  height = 420,
  className = '',
}) => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  const [tableOpen, setTableOpen] = useState<boolean>(false);

  const layout = useMemo(
    () => layoutStateDiagram(diagram, { width, height }),
    [diagram, width, height]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* SVG Canvas Container */}
      <div className="relative flex justify-center overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="max-h-[460px] w-auto select-none"
        >
          <title id={titleId}>Finite State Machine Transition Diagram</title>
          <desc id={descId}>
            Circular layout of {diagram.nodes.length} states and {diagram.edges.length} directed
            transitions with initial state marker and edge condition text labels.
          </desc>

          {/* Edges & Arrowheads */}
          <g aria-label="State transitions">
            {layout.edges.map((edge) => (
              <g key={edge.id} className="transition-edge">
                {/* Curved edge path */}
                <path
                  d={edge.pathD}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-600 dark:text-gray-400"
                />

                {/* Oriented terminal arrowhead */}
                <polygon
                  points={getArrowPoints(
                    edge.arrowhead.tipX,
                    edge.arrowhead.tipY,
                    edge.arrowhead.angleRad
                  )}
                  fill="currentColor"
                  className="text-gray-700 dark:text-gray-300"
                />

                {/* Text Label with background badge for readability */}
                <rect
                  x={edge.labelPosition.x - 16}
                  y={edge.labelPosition.y - 9}
                  width="32"
                  height="18"
                  rx="3"
                  className="fill-white/90 stroke-gray-200 stroke-1 dark:fill-gray-900/90 dark:stroke-gray-700"
                />
                <text
                  x={edge.labelPosition.x}
                  y={edge.labelPosition.y + 4}
                  textAnchor="middle"
                  className="fill-gray-900 font-mono text-[11px] font-bold dark:fill-gray-100"
                >
                  {edge.label}
                </text>
              </g>
            ))}
          </g>

          {/* State Nodes */}
          <g aria-label="States">
            {layout.nodes.map((node) => {
              const isMoore =
                diagram.machineKind === 'moore' || node.mooreOutput !== undefined;

              return (
                <g key={node.id} className="state-node">
                  {/* Initial state pointer with 'start' text */}
                  {node.isInitial && (
                    <g className="initial-marker" aria-label="Initial state marker">
                      <line
                        x1={node.x}
                        y1={node.y - node.radius - 32}
                        x2={node.x}
                        y2={node.y - node.radius - 2}
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-blue-600 dark:text-blue-400"
                      />
                      <polygon
                        points={getArrowPoints(
                          node.x,
                          node.y - node.radius - 1,
                          Math.PI / 2,
                          6
                        )}
                        fill="currentColor"
                        className="text-blue-600 dark:text-blue-400"
                      />
                      <text
                        x={node.x}
                        y={node.y - node.radius - 36}
                        textAnchor="middle"
                        className="fill-blue-700 font-sans text-[11px] font-extrabold uppercase tracking-wider dark:fill-blue-300"
                      >
                        start
                      </text>
                    </g>
                  )}

                  {/* State Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    className={`stroke-2 transition-colors ${
                      node.isInitial
                        ? 'fill-blue-50 stroke-blue-600 dark:fill-blue-950/60 dark:stroke-blue-400'
                        : 'fill-gray-50 stroke-gray-700 dark:fill-gray-800/80 dark:stroke-gray-300'
                    }`}
                  />

                  {/* State Name & Binary Code / Moore Output */}
                  {isMoore ? (
                    <>
                      <text
                        x={node.x}
                        y={node.y - 4}
                        textAnchor="middle"
                        className="fill-gray-900 font-mono text-xs font-bold dark:fill-gray-100"
                      >
                        {node.name}
                      </text>
                      <line
                        x1={node.x - node.radius + 6}
                        y1={node.y}
                        x2={node.x + node.radius - 6}
                        y2={node.y}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-gray-300 dark:text-gray-600"
                      />
                      <text
                        x={node.x}
                        y={node.y + 13}
                        textAnchor="middle"
                        className="fill-gray-600 font-mono text-[10px] dark:fill-gray-400"
                      >
                        {node.mooreOutput !== undefined ? node.mooreOutput : 0}
                      </text>
                    </>
                  ) : (
                    <>
                      <text
                        x={node.x}
                        y={node.y - 1}
                        textAnchor="middle"
                        className="fill-gray-900 font-mono text-xs font-bold dark:fill-gray-100"
                      >
                        {node.name}
                      </text>
                      <text
                        x={node.x}
                        y={node.y + 13}
                        textAnchor="middle"
                        className="fill-gray-500 font-mono text-[9px] dark:fill-gray-400"
                      >
                        {node.binaryCode}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Accessible Transitions Alternative Collapsible Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setTableOpen((prev) => !prev)}
          aria-expanded={tableOpen}
          aria-controls={`${baseId}-transitions-table`}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-gray-800 dark:text-gray-200"
        >
          <span>
            {tableOpen ? 'Hide' : 'Show'} Accessible Transition Table ({diagram.edges.length} Transitions)
          </span>
          <span className="text-gray-400">{tableOpen ? 'Hide' : 'Show'}</span>
        </button>

        {tableOpen && (
          <div
            id={`${baseId}-transitions-table`}
            className="mt-3 overflow-x-auto border-t border-gray-100 pt-3 dark:border-gray-800"
          >
            <table className="w-full text-left font-mono text-xs" aria-label="Accessible State Transitions Table">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                  <th scope="col" className="px-3 py-1.5 font-bold">From State</th>
                  <th scope="col" className="px-3 py-1.5 font-bold">Transition Condition</th>
                  <th scope="col" className="px-3 py-1.5 font-bold">To State</th>
                  <th scope="col" className="px-3 py-1.5 font-bold">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {diagram.edges.map((edge) => {
                  const fromNode = diagram.nodes.find((n) => n.code === edge.fromCode);
                  const toNode = diagram.nodes.find((n) => n.code === edge.toCode);
                  const fromLabel = fromNode ? `${fromNode.name} (${fromNode.binaryCode})` : `S${edge.fromCode}`;
                  const toLabel = toNode ? `${toNode.name} (${toNode.binaryCode})` : `S${edge.toCode}`;

                  return (
                    <tr key={edge.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-1.5 font-bold text-gray-900 dark:text-gray-100">{fromLabel}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {edge.conditions.map((c) => `IN=${c.inputValue}`).join(', ')}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400">{toLabel}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{edge.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
