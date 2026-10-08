/**
 * @file extractTruthTable.ts
 * Static levelized truth table extraction for combinational digital circuits.
 *
 * Implements an independent topological evaluation model (distinct from the
 * discrete event queue) to guarantee correctness and cross-validation against the simulator.
 */

import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, ExtractedTruthTable, ExtractedTruthTableRow, GateNode } from '../../types/circuit';
import { evaluateGate } from './gateLogic';
import { buildIndex, topologicalLevels } from './graphAnalysis';
import { validateCircuit } from './validate';

/**
 * Diagnostic error codes emitted during truth table extraction.
 */
export type ExtractErrorCode =
  | 'no-outputs'
  | 'too-many-inputs'
  | 'has-feedback'
  | 'has-clock'
  | 'blocking-errors'
  | 'duplicate-labels';

/**
 * Failure result containing specific extract error code and descriptive message.
 */
export interface ExtractTruthTableError {
  readonly code: ExtractErrorCode;
  readonly message: string;
}

/**
 * Options configuring input and output port ordering during table extraction.
 */
export interface ExtractTruthTableOptions {
  /** Explicit ordering of input variable labels (default: alphabetical) */
  readonly inputOrder?: readonly string[];
  /** Explicit ordering of output variable labels (default: alphabetical) */
  readonly outputOrder?: readonly string[];
}

/**
 * Discriminated result of truth table extraction.
 */
export type ExtractTruthTableResult =
  | { readonly ok: true; readonly table: ExtractedTruthTable; readonly warnings?: readonly string[] }
  | { readonly ok: false; readonly error: ExtractTruthTableError };

/**
 * Extracts a complete Boolean truth table from a combinational circuit schematic.
 *
 * @param graph Circuit schematic graph
 * @param options Port ordering options
 * @returns Result object with extracted truth table or failure error
 */
export function extractTruthTable(
  graph: CircuitGraph,
  options: ExtractTruthTableOptions = {}
): ExtractTruthTableResult {
  // 1. Check for clock nodes
  const hasClock = graph.nodes.some((n) => n.kind === 'clock');
  if (hasClock) {
    return {
      ok: false,
      error: {
        code: 'has-clock',
        message: 'Circuits with Clock nodes cannot be extracted as pure combinational truth tables. Replace the clock with an Input node to analyze logic.',
      },
    };
  }

  // 2. Validate topology (blocking errors and duplicate labels)
  const validation = validateCircuit(graph, { allowFeedback: false });
  if (validation.hasBlockingErrors) {
    return {
      ok: false,
      error: {
        code: 'blocking-errors',
        message: 'Cannot extract truth table: circuit contains blocking wire or pin errors. Resolve netlist diagnostics first.',
      },
    };
  }

  const duplicateLabelDiag = validation.diagnostics.find((d) => d.code === 'duplicate-label');
  if (duplicateLabelDiag) {
    return {
      ok: false,
      error: {
        code: 'duplicate-labels',
        message: duplicateLabelDiag.message,
      },
    };
  }

  // 3. Check for cycles/feedback
  const levelsRes = topologicalLevels(graph);
  if (levelsRes.hasFeedback) {
    return {
      ok: false,
      error: {
        code: 'has-feedback',
        message: 'Cannot extract truth table: circuit contains feedback loops or sequential state. Break feedback loops to analyze combinational logic.',
      },
    };
  }

  // 4. Collect outputs
  const outputNodes = graph.nodes.filter((n) => n.kind === 'output');
  if (outputNodes.length === 0) {
    return {
      ok: false,
      error: {
        code: 'no-outputs',
        message: 'Cannot extract truth table: circuit has no Output terminal nodes. Place at least one Output node.',
      },
    };
  }

  // 5. Collect inputs
  const inputNodes = graph.nodes.filter((n) => n.kind === 'input');
  if (inputNodes.length > 6) {
    return {
      ok: false,
      error: {
        code: 'too-many-inputs',
        message: `Circuit has ${inputNodes.length} inputs. Full truth table extraction is limited to a maximum of 6 inputs (64 rows).`,
      },
    };
  }

  // Determine input ordering
  let orderedInputLabels: string[];
  if (options.inputOrder && options.inputOrder.length > 0) {
    orderedInputLabels = [...options.inputOrder];
  } else {
    orderedInputLabels = inputNodes.map((n) => n.label).sort();
  }

  // Determine output ordering
  let orderedOutputLabels: string[];
  if (options.outputOrder && options.outputOrder.length > 0) {
    orderedOutputLabels = [...options.outputOrder];
  } else {
    orderedOutputLabels = outputNodes.map((n) => n.label).sort();
  }

  const inputNodeByLabel = new Map<string, string>();
  for (const n of inputNodes) {
    inputNodeByLabel.set(n.label, n.id);
  }

  const outputNodeByLabel = new Map<string, string>();
  for (const n of outputNodes) {
    outputNodeByLabel.set(n.label, n.id);
  }

  const index = buildIndex(graph);
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const lA = levelsRes.levels.get(a.id) ?? 0;
    const lB = levelsRes.levels.get(b.id) ?? 0;
    return lA - lB;
  });

  const numInputs = orderedInputLabels.length;
  const numRows = numInputs === 0 ? 1 : 1 << numInputs;
  const rows: ExtractedTruthTableRow[] = [];
  let hasFloatingPins = false;

  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const inputValuation = new Map<string, LogicValue>();
    const rowInputValues: LogicValue[] = [];

    for (let bitIdx = 0; bitIdx < numInputs; bitIdx++) {
      const shift = numInputs - 1 - bitIdx;
      const bitVal: LogicValue = ((rowIndex >> shift) & 1) as LogicValue;
      const label = orderedInputLabels[bitIdx];
      rowInputValues.push(bitVal);
      if (label) {
        const nId = inputNodeByLabel.get(label);
        if (nId) {
          inputValuation.set(nId, bitVal);
        }
      }
    }

    // Levelized topological evaluation
    const nodeValues = new Map<string, LogicValue>();

    for (const node of sortedNodes) {
      if (node.kind === 'input') {
        const assigned = inputValuation.get(node.id) ?? node.value;
        nodeValues.set(node.id, assigned);
      } else if (node.kind === 'const') {
        nodeValues.set(node.id, node.value);
      } else if (node.kind === 'gate') {
        const inVals = collectGateInputValues(node, nodeValues, index);
        if (inVals.includes('X')) {
          hasFloatingPins = true;
        }
        const outVal = evaluateGate(node.gateType, inVals);
        nodeValues.set(node.id, outVal);
      } else if (node.kind === 'output') {
        const incoming = index.incomingWires.get(node.id)?.get(0);
        const srcWire = incoming && incoming.length > 0 ? incoming[0] : undefined;
        const val = srcWire ? nodeValues.get(srcWire.from.nodeId) ?? 'X' : 'X';
        if (!srcWire) hasFloatingPins = true;
        nodeValues.set(node.id, val);
      }
    }

    const rowOutputValues: LogicValue[] = [];
    for (const outLabel of orderedOutputLabels) {
      const outNodeId = outputNodeByLabel.get(outLabel);
      const outVal = outNodeId ? nodeValues.get(outNodeId) ?? 'X' : 'X';
      rowOutputValues.push(outVal);
    }

    rows.push({
      index: rowIndex,
      inputs: rowInputValues,
      outputs: rowOutputValues,
    });
  }

  const warnings: string[] = [];
  if (hasFloatingPins) {
    warnings.push('Floating or disconnected inputs detected; some truth table outputs evaluated to X.');
  }

  return {
    ok: true,
    table: {
      inputs: orderedInputLabels,
      outputs: orderedOutputLabels,
      rows,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function collectGateInputValues(
  gate: GateNode,
  nodeValues: Map<string, LogicValue>,
  index: ReturnType<typeof buildIndex>
): LogicValue[] {
  const inVals: LogicValue[] = [];
  const pinMap = index.incomingWires.get(gate.id);

  for (let pin = 0; pin < gate.inputCount; pin++) {
    const wireList = pinMap?.get(pin);
    if (!wireList || wireList.length === 0) {
      inVals.push('X');
    } else {
      const srcWire = wireList[0];
      const val = srcWire ? nodeValues.get(srcWire.from.nodeId) ?? 'X' : 'X';
      inVals.push(val);
    }
  }

  return inVals;
}
