/**
 * @file graphWires.ts
 * Immutable wire operations for CircuitGraph.
 */

import type { CircuitGraph, CircuitWire } from '../../types/circuit';
import { nextWireId } from './graphNodes';

/**
 * Result of attempting to add a wire to a CircuitGraph.
 */
export type AddWireResult =
  | { readonly ok: true; readonly graph: CircuitGraph; readonly wire: CircuitWire }
  | {
      readonly ok: false;
      readonly reason: 'missing-node' | 'bad-pin' | 'wrong-direction' | 'duplicate-wire';
    };

/**
 * Validates and adds a new wire connecting a source node to a target node.
 *
 * @param graph Circuit graph
 * @param wire Wire specification (if id omitted, nextWireId is generated)
 * @returns Result object with status and graph
 */
export function addWire(
  graph: CircuitGraph,
  wire: {
    readonly id?: string;
    readonly from: { readonly nodeId: string; readonly pin: number };
    readonly to: { readonly nodeId: string; readonly pin: number };
  }
): AddWireResult {
  const sourceNode = graph.nodes.find((n) => n.id === wire.from.nodeId);
  const targetNode = graph.nodes.find((n) => n.id === wire.to.nodeId);

  if (!sourceNode || !targetNode) {
    return { ok: false, reason: 'missing-node' };
  }

  // Source pin checks: source pin must always be 0; output nodes cannot drive
  if (wire.from.pin !== 0 || sourceNode.kind === 'output') {
    return { ok: false, reason: 'wrong-direction' };
  }

  // Target pin checks: inputs, clocks, and consts cannot receive wires
  if (
    targetNode.kind === 'input' ||
    targetNode.kind === 'clock' ||
    targetNode.kind === 'const'
  ) {
    return { ok: false, reason: 'wrong-direction' };
  }

  if (targetNode.kind === 'output') {
    if (wire.to.pin !== 0) {
      return { ok: false, reason: 'bad-pin' };
    }
  } else if (targetNode.kind === 'gate') {
    if (wire.to.pin < 0 || wire.to.pin >= targetNode.inputCount) {
      return { ok: false, reason: 'bad-pin' };
    }
  }

  // Duplicate check
  const isDup = graph.wires.some(
    (w) =>
      w.from.nodeId === wire.from.nodeId &&
      w.from.pin === wire.from.pin &&
      w.to.nodeId === wire.to.nodeId &&
      w.to.pin === wire.to.pin
  );
  if (isDup) {
    return { ok: false, reason: 'duplicate-wire' };
  }

  const wireId = wire.id && wire.id.length > 0 ? wire.id : nextWireId(graph);
  const createdWire: CircuitWire = {
    id: wireId,
    from: { nodeId: wire.from.nodeId, pin: wire.from.pin },
    to: { nodeId: wire.to.nodeId, pin: wire.to.pin },
  };

  return {
    ok: true,
    graph: {
      nodes: graph.nodes,
      wires: [...graph.wires, createdWire],
    },
    wire: createdWire,
  };
}

/**
 * Removes a wire from the circuit graph immutably.
 *
 * @param graph Circuit graph
 * @param wireId Identifier of wire to remove
 * @returns New circuit graph with wire removed
 */
export function removeWire(graph: CircuitGraph, wireId: string): CircuitGraph {
  const exists = graph.wires.some((w) => w.id === wireId);
  if (!exists) return graph;

  return {
    nodes: graph.nodes,
    wires: graph.wires.filter((w) => w.id !== wireId),
  };
}
