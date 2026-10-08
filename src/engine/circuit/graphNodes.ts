/**
 * @file graphNodes.ts
 * Immutable node operations and deterministic ID generators for CircuitGraph.
 */

import type { CircuitGraph, CircuitNode } from '../../types/circuit';

/**
 * Creates a fresh, empty CircuitGraph.
 *
 * @returns Initialized empty circuit graph
 */
export function createEmptyCircuit(): CircuitGraph {
  return {
    nodes: [],
    wires: [],
  };
}

function nodeKindPrefix(kind: CircuitNode['kind']): string {
  switch (kind) {
    case 'input':
      return 'in';
    case 'output':
      return 'out';
    case 'clock':
      return 'clk';
    case 'const':
      return 'const';
    case 'gate':
      return 'g';
  }
}

/**
 * Computes the next deterministic node ID for a given node kind.
 * ID format is `{prefix}{N}` where N = max(existing suffixes) + 1.
 *
 * @param graph Circuit graph
 * @param kind Node kind
 * @returns Deterministic unique ID string
 */
export function nextNodeId(graph: CircuitGraph, kind: CircuitNode['kind']): string {
  const prefix = nodeKindPrefix(kind);
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  let maxSuffix = 0;

  for (const node of graph.nodes) {
    const match = regex.exec(node.id);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxSuffix) {
        maxSuffix = num;
      }
    }
  }
  return `${prefix}${maxSuffix + 1}`;
}

/**
 * Computes the next deterministic wire ID.
 * ID format is `w{N}` where N = max(existing suffixes) + 1.
 *
 * @param graph Circuit graph
 * @returns Deterministic unique wire ID string
 */
export function nextWireId(graph: CircuitGraph): string {
  const regex = /^w(\d+)$/;
  let maxSuffix = 0;

  for (const wire of graph.wires) {
    const match = regex.exec(wire.id);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxSuffix) {
        maxSuffix = num;
      }
    }
  }
  return `w${maxSuffix + 1}`;
}

/**
 * Adds a node to the circuit graph immutably.
 *
 * @param graph Circuit graph
 * @param node Node to append
 * @returns New circuit graph with node added
 */
export function addNode(graph: CircuitGraph, node: CircuitNode): CircuitGraph {
  if (graph.nodes.some((n) => n.id === node.id)) {
    return graph;
  }
  return {
    nodes: [...graph.nodes, node],
    wires: graph.wires,
  };
}

/**
 * Removes a node and cascades removal to all attached wires.
 *
 * @param graph Circuit graph
 * @param nodeId Identifier of node to remove
 * @returns New circuit graph with node and attached wires removed
 */
export function removeNode(graph: CircuitGraph, nodeId: string): CircuitGraph {
  const nodeExists = graph.nodes.some((n) => n.id === nodeId);
  if (!nodeExists) {
    return graph;
  }

  const nextNodes = graph.nodes.filter((n) => n.id !== nodeId);
  const nextWires = graph.wires.filter(
    (w) => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId
  );

  return {
    nodes: nextNodes,
    wires: nextWires.length === graph.wires.length ? graph.wires : nextWires,
  };
}

/**
 * Batch moves nodes to new (x, y) coordinates with structural sharing.
 *
 * @param graph Circuit graph
 * @param moves Array of position updates
 * @returns New circuit graph with updated node positions
 */
export function moveNodes(
  graph: CircuitGraph,
  moves: readonly { readonly id: string; readonly x: number; readonly y: number }[]
): CircuitGraph {
  if (moves.length === 0) return graph;
  const moveMap = new Map<string, { readonly x: number; readonly y: number }>();
  for (const m of moves) {
    moveMap.set(m.id, { x: m.x, y: m.y });
  }

  let changed = false;
  const nextNodes = graph.nodes.map((node) => {
    const m = moveMap.get(node.id);
    if (!m || (node.x === m.x && node.y === m.y)) {
      return node;
    }
    changed = true;
    return { ...node, x: m.x, y: m.y } as CircuitNode;
  });

  if (!changed) return graph;
  return {
    nodes: nextNodes,
    wires: graph.wires,
  };
}
