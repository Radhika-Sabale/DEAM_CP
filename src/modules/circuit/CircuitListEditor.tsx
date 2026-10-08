/**
 * @file CircuitListEditor.tsx
 * Accessible tabular circuit editor providing a full keyboard-operable alternative to the SVG canvas.
 * Allows adding nodes, configuring pin wiring sources from dropdowns, and updating parameters.
 */

import { useState, type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, GateType } from '../../types/circuit';
import {
  addNode,
  addWire,
  nextNodeId,
  removeNode,
  removeWire,
  updateNode,
} from '../../engine/circuit';
import { Button } from '../../components/ui/Button';

export interface CircuitListEditorProps {
  readonly graph: CircuitGraph;
  readonly values: Readonly<Record<string, LogicValue>>;
  readonly onCommitGraph: (nextGraph: CircuitGraph) => void;
  readonly onToggleInput: (nodeId: string) => void;
}

export const CircuitListEditor: FC<CircuitListEditorProps> = ({
  graph,
  values,
  onCommitGraph,
  onToggleInput,
}) => {
  // New node form state
  const [newKind, setNewKind] = useState<CircuitNode['kind']>('gate');
  const [newGateType, setNewGateType] = useState<GateType>('AND');
  const [newLabel, setNewLabel] = useState<string>('');

  // Available driver options (nodes that have an output pin 0)
  const driverNodes = graph.nodes.filter((n) => n.kind !== 'output');

  // Handle adding a node
  const handleAddNode = () => {
    let nextGraph = graph;
    const count = graph.nodes.length;
    const x = 100 + (count % 4) * 160;
    const y = 80 + Math.floor(count / 4) * 120;
    const id = nextNodeId(graph, newKind);

    if (newKind === 'gate') {
      nextGraph = addNode(nextGraph, {
        id,
        kind: 'gate',
        gateType: newGateType,
        inputCount: newGateType === 'NOT' ? 1 : 2,
        label: newLabel.trim() || undefined,
        x,
        y,
      });
    } else if (newKind === 'input') {
      nextGraph = addNode(nextGraph, {
        id,
        kind: 'input',
        label: newLabel.trim() || `IN_${count + 1}`,
        value: 0,
        x,
        y,
      });
    } else if (newKind === 'output') {
      nextGraph = addNode(nextGraph, {
        id,
        kind: 'output',
        label: newLabel.trim() || `OUT_${count + 1}`,
        x,
        y,
      });
    } else if (newKind === 'clock') {
      nextGraph = addNode(nextGraph, {
        id,
        kind: 'clock',
        label: newLabel.trim() || `CLK_${count + 1}`,
        halfPeriod: 5,
        startValue: 0,
        x,
        y,
      });
    } else if (newKind === 'const') {
      nextGraph = addNode(nextGraph, {
        id,
        kind: 'const',
        value: 1,
        label: newLabel.trim() || undefined,
        x,
        y,
      });
    }

    setNewLabel('');
    onCommitGraph(nextGraph);
  };

  // Handle updating gate input source
  const handleWireSourceChange = (targetNodeId: string, targetPin: number, sourceNodeId: string) => {
    let nextGraph = graph;

    // 1. Remove existing wire targeting this specific pin if any
    const existingWire = graph.wires.find(
      (w) => w.to.nodeId === targetNodeId && w.to.pin === targetPin
    );
    if (existingWire) {
      nextGraph = removeWire(nextGraph, existingWire.id);
    }

    // 2. Add new wire if source selected
    if (sourceNodeId && sourceNodeId !== 'none') {
      const res = addWire(nextGraph, {
        from: { nodeId: sourceNodeId, pin: 0 },
        to: { nodeId: targetNodeId, pin: targetPin },
      });
      if (res.ok) {
        nextGraph = res.graph;
      }
    }

    onCommitGraph(nextGraph);
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Circuit Netlist & Pin Table Editor
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
          Accessible keyboard alternative to the graphical canvas. Add components, rename labels, and configure pin connections.
        </p>
      </div>

      {/* Add New Node Form */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex flex-col gap-1">
          <label htmlFor="list-add-kind" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Node Kind
          </label>
          <select
            id="list-add-kind"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as CircuitNode['kind'])}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="gate">Logic Gate</option>
            <option value="input">Input Switch</option>
            <option value="output">Output Probe</option>
            <option value="clock">Clock Source</option>
            <option value="const">Constant (0/1)</option>
          </select>
        </div>

        {newKind === 'gate' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="list-add-gate-type" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Gate Type
            </label>
            <select
              id="list-add-gate-type"
              value={newGateType}
              onChange={(e) => setNewGateType(e.target.value as GateType)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="AND">AND</option>
              <option value="NAND">NAND</option>
              <option value="OR">OR</option>
              <option value="NOR">NOR</option>
              <option value="XOR">XOR</option>
              <option value="XNOR">XNOR</option>
              <option value="NOT">NOT</option>
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
          <label htmlFor="list-add-label" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Label (optional)
          </label>
          <input
            id="list-add-label"
            type="text"
            value={newLabel}
            placeholder="e.g. A, S, Cout"
            onChange={(e) => setNewLabel(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <Button variant="primary" size="sm" onClick={handleAddNode} aria-label="Add component to netlist">
          + Add Node
        </Button>
      </div>

      {/* Nodes & Connections Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/75 dark:border-gray-800 dark:bg-gray-800/40">
              <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-gray-500 dark:text-gray-400">
                Node ID / Kind
              </th>
              <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-gray-500 dark:text-gray-400">
                Label / Name
              </th>
              <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-gray-500 dark:text-gray-400">
                Live State
              </th>
              <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-gray-500 dark:text-gray-400">
                Input Pin Driver Connections
              </th>
              <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-gray-500 dark:text-gray-400 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {graph.nodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm italic text-gray-500">
                  No components in the circuit netlist. Add nodes using the form above or the Palette.
                </td>
              </tr>
            ) : (
              graph.nodes.map((node) => {
                const nodeVal = values[node.id] ?? 'X';
                const inputCount =
                  node.kind === 'gate' ? node.inputCount : node.kind === 'output' ? 1 : 0;

                return (
                  <tr key={node.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="p-2.5 font-mono font-medium">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{node.id}</span>
                      <span className="block text-[10px] text-gray-500 uppercase">
                        {node.kind === 'gate' ? `${node.gateType} Gate` : node.kind}
                      </span>
                    </td>

                    <td className="p-2.5">
                      <input
                        type="text"
                        value={node.label || ''}
                        aria-label={`Label for node ${node.id}`}
                        onChange={(e) => {
                          const updated = updateNode(graph, node.id, { label: e.target.value });
                          onCommitGraph(updated);
                        }}
                        className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>

                    <td className="p-2.5 font-mono">
                      {node.kind === 'input' ? (
                        <button
                          type="button"
                          onClick={() => onToggleInput(node.id)}
                          aria-label={`Toggle input ${node.id}, currently ${nodeVal}`}
                          className="rounded-md border border-blue-400 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        >
                          [{nodeVal}] Toggle
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold ${
                            nodeVal === 1
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                              : nodeVal === 0
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          }`}
                        >
                          {nodeVal}
                        </span>
                      )}
                    </td>

                    <td className="p-2.5">
                      {inputCount === 0 ? (
                        <span className="text-[11px] italic text-gray-400">Driver Source (no inputs)</span>
                      ) : (
                        <div className="space-y-1.5">
                          {Array.from({ length: inputCount }, (_, pinIdx) => {
                            const currentWire = graph.wires.find(
                              (w) => w.to.nodeId === node.id && w.to.pin === pinIdx
                            );
                            const currentSourceId = currentWire ? currentWire.from.nodeId : 'none';

                            return (
                              <div key={`pin_${pinIdx}`} className="flex items-center gap-2">
                                <label
                                  htmlFor={`wire_${node.id}_pin_${pinIdx}`}
                                  className="text-[10px] font-semibold text-gray-500 w-12"
                                >
                                  Pin {pinIdx}:
                                </label>
                                <select
                                  id={`wire_${node.id}_pin_${pinIdx}`}
                                  value={currentSourceId}
                                  onChange={(e) =>
                                    handleWireSourceChange(node.id, pinIdx, e.target.value)
                                  }
                                  aria-label={`${node.id} input pin ${pinIdx} driver source`}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                >
                                  <option value="none">-- None (Floating) --</option>
                                  {driverNodes
                                    .filter((d) => d.id !== node.id)
                                    .map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.label ? `${d.label} (${d.id})` : d.id}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="p-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = removeNode(graph, node.id);
                          onCommitGraph(updated);
                        }}
                        aria-label={`Remove node ${node.id}`}
                      >
                        ✕
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
