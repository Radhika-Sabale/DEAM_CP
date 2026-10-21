/**
 * @file graphUpdate.ts
 * Node property updates and gate input count mutation with structural sharing.
 */

import type { LogicValue } from '../../types/ast';
import type {
  CircuitGraph,
  CircuitNode,
  ClockNode,
  ConstNode,
  GateNode,
  GateType,
  InputNode,
  OutputNode,
} from '../../types/circuit';

/**
 * Result of changing gate input count.
 */
export interface SetGateInputCountResult {
  readonly graph: CircuitGraph;
  readonly removedWireIds: readonly string[];
}

/**
 * Node property update patch.
 */
export interface NodeUpdatePatch {
  readonly label?: string;
  readonly delay?: number;
  readonly halfPeriod?: number;
  readonly startValue?: 0 | 1;
  readonly value?: LogicValue;
  readonly gateType?: GateType;
}

/**
 * Updates properties of an existing node with structural sharing.
 *
 * @param graph Circuit graph
 * @param nodeId Node identifier to update
 * @param patch Validated patch properties
 * @returns New circuit graph with node updated
 */
export function updateNode(
  graph: CircuitGraph,
  nodeId: string,
  patch: NodeUpdatePatch
): CircuitGraph {
  let changed = false;
  const nextNodes = graph.nodes.map((node) => {
    if (node.id !== nodeId) return node;

    let updated: CircuitNode = node;
    switch (node.kind) {
      case 'input': {
        const nextLabel = patch.label !== undefined ? patch.label : node.label;
        const nextVal = patch.value !== undefined ? patch.value : node.value;
        if (nextLabel !== node.label || nextVal !== node.value) {
          updated = { ...node, label: nextLabel, value: nextVal } as InputNode;
          changed = true;
        }
        break;
      }
      case 'output': {
        const nextLabel = patch.label !== undefined ? patch.label : node.label;
        if (nextLabel !== node.label) {
          updated = { ...node, label: nextLabel } as OutputNode;
          changed = true;
        }
        break;
      }
      case 'clock': {
        const nextLabel = patch.label !== undefined ? patch.label : node.label;
        const nextHalf =
          patch.halfPeriod !== undefined && patch.halfPeriod >= 1
            ? Math.floor(patch.halfPeriod)
            : node.halfPeriod;
        const nextStart =
          patch.startValue === 0 || patch.startValue === 1
            ? patch.startValue
            : node.startValue;
        if (
          nextLabel !== node.label ||
          nextHalf !== node.halfPeriod ||
          nextStart !== node.startValue
        ) {
          updated = {
            ...node,
            label: nextLabel,
            halfPeriod: nextHalf,
            startValue: nextStart,
          } as ClockNode;
          changed = true;
        }
        break;
      }
      case 'const': {
        const nextVal =
          patch.value === 0 || patch.value === 1 ? patch.value : node.value;
        const nextLabel = patch.label !== undefined ? patch.label : node.label;
        if (nextVal !== node.value || nextLabel !== node.label) {
          updated = { ...node, value: nextVal, label: nextLabel } as ConstNode;
          changed = true;
        }
        break;
      }
      case 'gate': {
        const nextLabel = patch.label !== undefined ? patch.label : node.label;
        const nextDelay =
          patch.delay !== undefined && patch.delay >= 0
            ? Math.floor(patch.delay)
            : node.delay;
        const nextType = patch.gateType !== undefined ? patch.gateType : node.gateType;
        if (
          nextLabel !== node.label ||
          nextDelay !== node.delay ||
          nextType !== node.gateType
        ) {
          updated = {
            ...node,
            label: nextLabel,
            delay: nextDelay,
            gateType: nextType,
          } as GateNode;
          changed = true;
        }
        break;
      }
    }
    return updated;
  });

  if (!changed) return graph;
  return {
    nodes: nextNodes,
    wires: graph.wires,
  };
}

/**
 * Changes gate input count and drops wires connecting to removed pins.
 *
 * @param graph Circuit graph
 * @param gateId Gate node identifier
 * @param count New input pin count (1 for NOT, 2..8 for others)
 * @returns Result with updated graph and array of removed wire IDs
 */
export function setGateInputCount(
  graph: CircuitGraph,
  gateId: string,
  count: number
): SetGateInputCountResult {
  const targetNode = graph.nodes.find((n) => n.id === gateId);
  if (!targetNode || targetNode.kind !== 'gate') {
    return { graph, removedWireIds: [] };
  }

  const validCount =
    targetNode.gateType === 'NOT' || targetNode.gateType === 'BUFFER'
      ? 1
      : Math.min(8, Math.max(2, Math.floor(count)));

  if (targetNode.inputCount === validCount) {
    return { graph, removedWireIds: [] };
  }

  const removedWireIds: string[] = [];
  const nextWires = graph.wires.filter((w) => {
    if (w.to.nodeId === gateId && w.to.pin >= validCount) {
      removedWireIds.push(w.id);
      return false;
    }
    return true;
  });

  const nextNodes = graph.nodes.map((n) => {
    if (n.id === gateId) {
      return { ...n, inputCount: validCount } as GateNode;
    }
    return n;
  });

  return {
    graph: { nodes: nextNodes, wires: nextWires },
    removedWireIds,
  };
}
