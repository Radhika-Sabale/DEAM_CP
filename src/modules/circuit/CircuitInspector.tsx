/**
 * @file CircuitInspector.tsx
 * Property inspector and parameter editor for selected schematic nodes and wires.
 * Validates identifier formats and provides node-specific parameter controls.
 */

import { useState, type FC, useEffect } from 'react';
import type { CircuitGraph } from '../../types/circuit';
import {
  removeNode,
  removeWire,
  setGateInputCount,
  updateNode,
} from '../../engine/circuit';
import { VALID_LABEL_REGEX } from '../../engine/circuit/validateRules';
import { Button } from '../../components/ui/Button';

export interface CircuitInspectorProps {
  readonly graph: CircuitGraph;
  readonly selectedNodeId: string | null;
  readonly selectedWireId: string | null;
  readonly onCommitGraph: (nextGraph: CircuitGraph) => void;
  readonly onDeselect: () => void;
}

export const CircuitInspector: FC<CircuitInspectorProps> = ({
  graph,
  selectedNodeId,
  selectedWireId,
  onCommitGraph,
  onDeselect,
}) => {
  const selectedNode = selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedWire = selectedWireId ? graph.wires.find((w) => w.id === selectedWireId) : null;

  const [labelDraft, setLabelDraft] = useState<string>('');
  const [labelError, setLabelError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNode) {
      setLabelDraft(selectedNode.label || '');
      setLabelError(null);
    }
  }, [selectedNode]);

  const handleLabelChange = (newText: string) => {
    setLabelDraft(newText);
    const trimmed = newText.trim();
    if (trimmed.length > 0) {
      if (!VALID_LABEL_REGEX.test(trimmed)) {
        setLabelError("Label must start with a letter and contain only alphanumeric characters or '_'.");
        return;
      }
      const duplicate = graph.nodes.find((n) => n.id !== selectedNode?.id && n.label === trimmed);
      if (duplicate) {
        setLabelError(`Label '${trimmed}' is already used by node ${duplicate.id}.`);
        return;
      }
    }
    setLabelError(null);
    if (selectedNode) {
      const updated = updateNode(graph, selectedNode.id, { label: trimmed || undefined });
      onCommitGraph(updated);
    }
  };

  const handleInputCountChange = (count: number) => {
    if (!selectedNode || selectedNode.kind !== 'gate') return;
    const res = setGateInputCount(graph, selectedNode.id, count);
    onCommitGraph(res.graph);
  };

  const handleDelayChange = (delay: number) => {
    if (!selectedNode || selectedNode.kind !== 'gate') return;
    const updated = updateNode(graph, selectedNode.id, { delay: Math.max(0, delay) });
    onCommitGraph(updated);
  };

  const handleClockPeriodChange = (halfPeriod: number) => {
    if (!selectedNode || selectedNode.kind !== 'clock') return;
    const updated = updateNode(graph, selectedNode.id, { halfPeriod: Math.max(1, halfPeriod) });
    onCommitGraph(updated);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    const updated = removeNode(graph, selectedNode.id);
    onCommitGraph(updated);
    onDeselect();
  };

  const handleDeleteWire = () => {
    if (!selectedWire) return;
    const updated = removeWire(graph, selectedWire.id);
    onCommitGraph(updated);
    onDeselect();
  };

  // 1. Selected Wire View
  if (selectedWire) {
    const fromNode = graph.nodes.find((n) => n.id === selectedWire.from.nodeId);
    const toNode = graph.nodes.find((n) => n.id === selectedWire.to.nodeId);

    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
          <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[11px]">
            Wire Inspector: {selectedWire.id}
          </h4>
          <button
            type="button"
            onClick={onDeselect}
            aria-label="Close wire inspector"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <span className="font-semibold text-gray-500">Source Driver:</span>{' '}
            <span className="font-mono font-bold">{fromNode?.label || fromNode?.id}</span> (pin {selectedWire.from.pin})
          </div>
          <div>
            <span className="font-semibold text-gray-500">Target Terminal:</span>{' '}
            <span className="font-mono font-bold">{toNode?.label || toNode?.id}</span> (input pin {selectedWire.to.pin})
          </div>
        </div>

        <Button variant="danger" size="sm" onClick={handleDeleteWire} aria-label={`Delete wire ${selectedWire.id}`}>
          Delete Wire
        </Button>
      </div>
    );
  }

  // 2. Selected Node View
  if (selectedNode) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
          <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[11px]">
            Node Inspector: {selectedNode.id}
          </h4>
          <button
            type="button"
            onClick={onDeselect}
            aria-label="Close node inspector"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Label Editor */}
        <div className="space-y-1">
          <label htmlFor="inspector-label" className="font-semibold text-gray-700 dark:text-gray-300">
            Node Label
          </label>
          <input
            id="inspector-label"
            type="text"
            value={labelDraft}
            onChange={(e) => handleLabelChange(e.target.value)}
            className={`w-full rounded-md border px-2.5 py-1.5 text-xs ${
              labelError
                ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
          />
          {labelError && <p className="text-[11px] text-red-600 dark:text-red-400">{labelError}</p>}
        </div>

        {/* Gate Parameters */}
        {selectedNode.kind === 'gate' && (
          <>
            {selectedNode.gateType !== 'NOT' && (
              <div className="space-y-1">
                <label htmlFor="inspector-input-count" className="font-semibold text-gray-700 dark:text-gray-300">
                  Input Pin Count (2..8)
                </label>
                <select
                  id="inspector-input-count"
                  value={selectedNode.inputCount}
                  onChange={(e) => handleInputCountChange(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <option key={c} value={c}>
                      {c} inputs
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="inspector-delay" className="font-semibold text-gray-700 dark:text-gray-300">
                Gate Delay (time units)
              </label>
              <input
                id="inspector-delay"
                type="number"
                min={0}
                max={50}
                value={selectedNode.delay ?? 1}
                onChange={(e) => handleDelayChange(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </>
        )}

        {/* Clock Parameters */}
        {selectedNode.kind === 'clock' && (
          <div className="space-y-1">
            <label htmlFor="inspector-clock-period" className="font-semibold text-gray-700 dark:text-gray-300">
              Clock Half-Period (units)
            </label>
            <input
              id="inspector-clock-period"
              type="number"
              min={1}
              max={100}
              value={selectedNode.halfPeriod}
              onChange={(e) => handleClockPeriodChange(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        <div className="pt-2">
          <Button variant="danger" size="sm" onClick={handleDeleteNode} aria-label={`Delete node ${selectedNode.id}`}>
            Delete Node
          </Button>
        </div>
      </div>
    );
  }

  // 3. Nothing Selected: Circuit Summary
  const gateCount = graph.nodes.filter((n) => n.kind === 'gate').length;
  const inCount = graph.nodes.filter((n) => n.kind === 'input').length;
  const outCount = graph.nodes.filter((n) => n.kind === 'output').length;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-400">
      <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[11px]">
        Circuit Summary
      </h4>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>Total Nodes: <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{graph.nodes.length}</span></div>
        <div>Total Wires: <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{graph.wires.length}</span></div>
        <div>Logic Gates: <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{gateCount}</span></div>
        <div>Inputs / Outputs: <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{inCount} / {outCount}</span></div>
      </div>
      <p className="text-[11px] italic text-gray-500 pt-1">
        Click any gate, switch, or wire on the canvas to inspect and edit its parameters.
      </p>
    </div>
  );
};
