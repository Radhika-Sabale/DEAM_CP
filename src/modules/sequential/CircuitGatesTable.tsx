/**
 * @file CircuitGatesTable.tsx
 * Accessible tabular alternative for circuit schematics (Stage 10E).
 * Lists all synthesized logic gates, input/output sources, wires, and external flip-flop blocks.
 */

import { type FC, useState } from 'react';
import type { CircuitGraph } from '../../types/circuit';
import type { FlipFlopBlock } from '../../engine/sequential/circuitBuild';

export interface CircuitGatesTableProps {
  readonly graph: CircuitGraph;
  readonly flipFlopBlocks: readonly FlipFlopBlock[];
}

/**
 * Collapsible accessible table component detailing every gate and wire in the schematic.
 */
export const CircuitGatesTable: FC<CircuitGatesTableProps> = ({
  graph,
  flipFlopBlocks,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Map wire connections for accessible listing
  const nodeInputsMap: Record<string, string[]> = {};
  const nodeOutputsMap: Record<string, string[]> = {};

  for (const wire of graph.wires) {
    const fromNode = graph.nodes.find((n) => n.id === wire.from.nodeId);
    const toNode = graph.nodes.find((n) => n.id === wire.to.nodeId);
    const fromLabel = fromNode?.label || wire.from.nodeId;
    const toLabel = toNode?.label || wire.to.nodeId;

    if (!nodeInputsMap[wire.to.nodeId]) nodeInputsMap[wire.to.nodeId] = [];
    nodeInputsMap[wire.to.nodeId]?.push(fromLabel);

    if (!nodeOutputsMap[wire.from.nodeId]) nodeOutputsMap[wire.from.nodeId] = [];
    nodeOutputsMap[wire.from.nodeId]?.push(toLabel);
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        aria-expanded={isOpen}
      >
        <span>Accessible Circuit Netlist & Gate Table ({graph.nodes.length} nodes, {graph.wires.length} wires)</span>
        <span className="text-sm font-semibold">{isOpen ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-6">
          {/* Flip-Flop Register Blocks */}
          {flipFlopBlocks.length > 0 && (
            <div>
              <h5 className="mb-2 text-xs font-bold text-gray-800 dark:text-gray-200">
                Flip-Flop Register Units:
              </h5>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Bit Index</th>
                      <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Flip-Flop Type</th>
                      <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Excitation Inputs</th>
                      <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">State Output</th>
                      <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Descriptor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                    {flipFlopBlocks.map((b) => (
                      <tr key={b.bitIndex}>
                        <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">Bit {b.bitIndex}</td>
                        <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400">{b.type}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.inputNames.join(', ')}</td>
                        <td className="px-3 py-1.5 font-bold text-emerald-600 dark:text-emerald-400">{b.stateName}</td>
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                          {b.type} flip-flop, bit {b.bitIndex}: {b.inputNames.join(', ')} -&gt; {b.stateName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Logic Gates Table */}
          <div>
            <h5 className="mb-2 text-xs font-bold text-gray-800 dark:text-gray-200">
              Combinational Logic Nodes & Gates:
            </h5>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Node</th>
                    <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Type / Gate</th>
                    <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Input Sources</th>
                    <th scope="col" className="px-3 py-1.5 text-left font-bold text-gray-600 dark:text-gray-400">Target Destinations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                  {graph.nodes.map((n) => {
                    const inputs = nodeInputsMap[n.id] ?? [];
                    const outputs = nodeOutputsMap[n.id] ?? [];
                    const typeLabel = n.kind === 'gate' ? `${n.gateType} (${n.inputCount}-in)` : n.kind;

                    return (
                      <tr key={n.id}>
                        <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">
                          {n.label || n.id}
                        </td>
                        <td className="px-3 py-1.5 text-purple-600 dark:text-purple-400">
                          {typeLabel}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">
                          {inputs.length > 0 ? inputs.join(', ') : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">
                          {outputs.length > 0 ? outputs.join(', ') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
