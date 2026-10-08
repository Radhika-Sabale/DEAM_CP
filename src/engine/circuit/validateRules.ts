/**
 * @file validateRules.ts
 * Diagnostic generation rules for circuit netlists and schematic topology.
 */

import type { CircuitDiagnostic, CircuitGraph, CircuitNode } from '../../types/circuit';
import { faninCone, stronglyConnectedComponents, type CircuitIndex } from './graphAnalysis';

export const VALID_LABEL_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Helper generating human-readable display name for a node.
 */
export function nodeDisplayName(node: CircuitNode): string {
  switch (node.kind) {
    case 'input':
      return `Input '${node.label}' (${node.id})`;
    case 'output':
      return `Output '${node.label}' (${node.id})`;
    case 'clock':
      return `Clock '${node.label}' (${node.id})`;
    case 'const':
      return `Constant ${node.value} (${node.id})`;
    case 'gate':
      return node.label && node.label.length > 0
        ? `Gate '${node.label}' (${node.gateType}, ${node.id})`
        : `Gate ${node.id} (${node.gateType})`;
  }
}

/**
 * Validates wire endpoints, pin ranges, and multiple drivers on the same input pin.
 */
export function checkWiresAndDrivers(
  graph: CircuitGraph,
  nodeMap: Map<string, CircuitNode>,
  diagnostics: CircuitDiagnostic[]
): void {
  const targetPinWires = new Map<string, string[]>();

  for (const wire of graph.wires) {
    const src = nodeMap.get(wire.from.nodeId);
    const tgt = nodeMap.get(wire.to.nodeId);

    if (!src || !tgt) {
      const missingIds = [
        ...(!src ? [wire.from.nodeId] : []),
        ...(!tgt ? [wire.to.nodeId] : []),
      ];
      diagnostics.push({
        code: 'invalid-reference',
        severity: 'error',
        message: `Wire ${wire.id} connects to missing node(s): ${missingIds.join(', ')}. Remove the dangling wire.`,
        nodeIds: missingIds,
        wireIds: [wire.id],
      });
      continue;
    }

    const srcValid = wire.from.pin === 0 && src.kind !== 'output';
    let tgtValid = true;
    if (tgt.kind === 'input' || tgt.kind === 'clock' || tgt.kind === 'const') {
      tgtValid = false;
    } else if (tgt.kind === 'output') {
      tgtValid = wire.to.pin === 0;
    } else if (tgt.kind === 'gate') {
      tgtValid = wire.to.pin >= 0 && wire.to.pin < tgt.inputCount;
    }

    if (!srcValid || !tgtValid) {
      diagnostics.push({
        code: 'invalid-pin',
        severity: 'error',
        message: `Wire ${wire.id} has an invalid pin connection between ${nodeDisplayName(src)} (pin ${wire.from.pin}) and ${nodeDisplayName(tgt)} (pin ${wire.to.pin}). Reconnect to valid input/output ports.`,
        nodeIds: [src.id, tgt.id],
        wireIds: [wire.id],
      });
      continue;
    }

    const pinKey = `${wire.to.nodeId}:${wire.to.pin}`;
    const existing = targetPinWires.get(pinKey);
    if (existing) {
      existing.push(wire.id);
    } else {
      targetPinWires.set(pinKey, [wire.id]);
    }
  }

  for (const [pinKey, wireIds] of targetPinWires.entries()) {
    if (wireIds.length > 1) {
      const [targetId = '', pinIndex = '0'] = pinKey.split(':');
      const tgtNode = nodeMap.get(targetId);
      const name = tgtNode ? nodeDisplayName(tgtNode) : targetId;
      diagnostics.push({
        code: 'multiple-drivers',
        severity: 'error',
        message: `Input pin ${pinIndex} on ${name} is driven by ${wireIds.length} wires (${wireIds.join(', ')}). In CMOS digital logic, connect only one driver per input pin.`,
        nodeIds: [targetId],
        wireIds,
      });
    }
  }
}

/**
 * Validates terminal label uniqueness and syntactic formatting.
 */
export function checkLabels(graph: CircuitGraph, diagnostics: CircuitDiagnostic[]): void {
  const labelNodes = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.kind === 'input' || node.kind === 'output' || node.kind === 'clock') {
      const list = labelNodes.get(node.label) ?? [];
      list.push(node.id);
      labelNodes.set(node.label, list);

      if (!VALID_LABEL_REGEX.test(node.label)) {
        diagnostics.push({
          code: 'invalid-label',
          severity: 'warning',
          message: `${nodeDisplayName(node)} has label '${node.label}' which does not follow identifier syntax (must start with letter, containing letters, numbers, and underscores).`,
          nodeIds: [node.id],
          wireIds: [],
        });
      }
    }
  }

  for (const [label, ids] of labelNodes.entries()) {
    if (ids.length > 1) {
      diagnostics.push({
        code: 'duplicate-label',
        severity: 'error',
        message: `Label '${label}' is duplicated across ${ids.length} terminals (${ids.join(', ')}). Assign unique variable labels to each input, output, and clock.`,
        nodeIds: ids,
        wireIds: [],
      });
    }
  }
}

/**
 * Validates floating gate inputs and un-driven circuit outputs.
 */
export function checkFloatingAndUndriven(
  graph: CircuitGraph,
  index: CircuitIndex,
  diagnostics: CircuitDiagnostic[]
): void {
  for (const node of graph.nodes) {
    if (node.kind === 'output') {
      const incoming = index.incomingWires.get(node.id)?.get(0);
      if (!incoming || incoming.length === 0) {
        diagnostics.push({
          code: 'undriven-output',
          severity: 'error',
          message: `${nodeDisplayName(node)} is undriven. Connect a logic source or gate output to this output terminal.`,
          nodeIds: [node.id],
          wireIds: [],
        });
      }
    } else if (node.kind === 'gate') {
      const pinMap = index.incomingWires.get(node.id);
      for (let pin = 0; pin < node.inputCount; pin++) {
        const wireList = pinMap?.get(pin);
        if (!wireList || wireList.length === 0) {
          diagnostics.push({
            code: 'floating-input',
            severity: 'error',
            message: `Input port ${pin} on ${nodeDisplayName(node)} is floating. Wire a signal or constant to this input pin.`,
            nodeIds: [node.id],
            wireIds: [],
          });
        }
      }
    }
  }
}

/**
 * Validates unused inputs, dangling gate outputs, and dead logic.
 */
export function checkUsageAndDeadLogic(
  graph: CircuitGraph,
  index: CircuitIndex,
  diagnostics: CircuitDiagnostic[]
): void {
  for (const node of graph.nodes) {
    const fanout = index.fanoutWires.get(node.id) ?? [];
    if (node.kind === 'input' || node.kind === 'clock') {
      if (fanout.length === 0) {
        diagnostics.push({
          code: 'unused-input',
          severity: 'warning',
          message: `${nodeDisplayName(node)} is not connected to any downstream gates. Connect it to a gate or remove it.`,
          nodeIds: [node.id],
          wireIds: [],
        });
      }
    } else if (node.kind === 'gate' && fanout.length === 0) {
      diagnostics.push({
        code: 'dangling-gate-output',
        severity: 'warning',
        message: `${nodeDisplayName(node)} has a dangling output with no connected wires. Wire its output to downstream logic or a circuit output.`,
        nodeIds: [node.id],
        wireIds: [],
      });
    }
  }

  const outputNodes = graph.nodes.filter((n) => n.kind === 'output');
  if (outputNodes.length === 0) {
    diagnostics.push({
      code: 'no-outputs',
      severity: 'warning',
      message: 'The circuit schematic has no Output terminals. Place at least one Output terminal to observe logic results.',
      nodeIds: [],
      wireIds: [],
    });
  } else {
    const reachable = new Set(faninCone(graph, outputNodes.map((n) => n.id)));
    for (const node of graph.nodes) {
      if (node.kind === 'gate') {
        const fanout = index.fanoutWires.get(node.id) ?? [];
        if (fanout.length > 0 && !reachable.has(node.id)) {
          diagnostics.push({
            code: 'dead-logic',
            severity: 'warning',
            message: `${nodeDisplayName(node)} drives signals but does not lead to any circuit Output terminal. Verify connections or remove dead logic.`,
            nodeIds: [node.id],
            wireIds: [],
          });
        }
      }
    }
  }
}

/**
 * Evaluates feedback loops and strongly connected components against allowFeedback mode.
 */
export function checkCycles(
  index: CircuitIndex,
  nodeMap: Map<string, CircuitNode>,
  allowFeedback: boolean,
  diagnostics: CircuitDiagnostic[]
): void {
  const sccs = stronglyConnectedComponents(index);
  for (const scc of sccs) {
    const memberNames = scc
      .map((id) => {
        const n = nodeMap.get(id);
        return n ? nodeDisplayName(n) : id;
      })
      .join(', ');

    if (!allowFeedback) {
      diagnostics.push({
        code: 'combinational-loop',
        severity: 'error',
        message: `Combinational loop detected containing: ${memberNames}. Pure combinational circuits cannot contain feedback loops. Enable sequential mode or break the loop.`,
        nodeIds: [...scc],
        wireIds: [],
      });
    } else {
      diagnostics.push({
        code: 'feedback-loop',
        severity: 'info',
        message: `Sequential feedback loop active across: ${memberNames}. Monitored under event-driven simulation.`,
        nodeIds: [...scc],
        wireIds: [],
      });
    }
  }
}
