/**
 * @file graphIndex.ts
 * Topological indexing structure for high-performance circuit graph queries.
 */

import type { CircuitGraph, CircuitNode, CircuitWire } from '../../types/circuit';

/**
 * Fast indexing structures for high-performance circuit graph queries.
 */
export interface CircuitIndex {
  readonly nodeById: ReadonlyMap<string, CircuitNode>;
  readonly wireById: ReadonlyMap<string, CircuitWire>;
  /** Map of nodeId -> (pinIndex -> array of wires entering that pin) */
  readonly incomingWires: ReadonlyMap<string, ReadonlyMap<number, readonly CircuitWire[]>>;
  /** Map of nodeId -> array of wires driven by that node (pin 0) */
  readonly fanoutWires: ReadonlyMap<string, readonly CircuitWire[]>;
  /** Directed adjacency list (sourceNodeId -> array of targetNodeIds) */
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
}

/**
 * Builds indexing maps over nodes and wires for O(1) topology lookups.
 *
 * @param graph Circuit graph
 * @returns Indexing container
 */
export function buildIndex(graph: CircuitGraph): CircuitIndex {
  const nodeById = new Map<string, CircuitNode>();
  for (const node of graph.nodes) {
    nodeById.set(node.id, node);
  }

  const wireById = new Map<string, CircuitWire>();
  const incoming = new Map<string, Map<number, CircuitWire[]>>();
  const fanout = new Map<string, CircuitWire[]>();
  const adj = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    incoming.set(node.id, new Map());
    fanout.set(node.id, []);
    adj.set(node.id, new Set());
  }

  for (const wire of graph.wires) {
    wireById.set(wire.id, wire);

    let pinMap = incoming.get(wire.to.nodeId);
    if (!pinMap) {
      pinMap = new Map();
      incoming.set(wire.to.nodeId, pinMap);
    }
    const pinWires = pinMap.get(wire.to.pin);
    if (pinWires) {
      pinWires.push(wire);
    } else {
      pinMap.set(wire.to.pin, [wire]);
    }

    const outWires = fanout.get(wire.from.nodeId);
    if (outWires) {
      outWires.push(wire);
    } else {
      fanout.set(wire.from.nodeId, [wire]);
    }

    const targets = adj.get(wire.from.nodeId);
    if (targets) {
      targets.add(wire.to.nodeId);
    } else {
      adj.set(wire.from.nodeId, new Set([wire.to.nodeId]));
    }
  }

  const finalizedIncoming = new Map<string, ReadonlyMap<number, readonly CircuitWire[]>>();
  for (const [nId, pMap] of incoming.entries()) {
    const readOnlyPMap = new Map<number, readonly CircuitWire[]>();
    for (const [pin, wList] of pMap.entries()) {
      readOnlyPMap.set(pin, wList);
    }
    finalizedIncoming.set(nId, readOnlyPMap);
  }

  const finalizedAdj = new Map<string, readonly string[]>();
  for (const [nId, tSet] of adj.entries()) {
    finalizedAdj.set(nId, Array.from(tSet));
  }

  return {
    nodeById,
    wireById,
    incomingWires: finalizedIncoming,
    fanoutWires: fanout,
    adjacency: finalizedAdj,
  };
}
