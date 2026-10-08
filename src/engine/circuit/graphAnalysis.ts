/**
 * @file graphAnalysis.ts
 * Topological indexing, cycle detection, cone analysis, and structural signatures.
 */

import type { CircuitGraph } from '../../types/circuit';
import { buildIndex } from './graphIndex';

export { buildIndex, type CircuitIndex } from './graphIndex';
export {
  stronglyConnectedComponents,
  topologicalLevels,
  type TopologicalLevelsResult,
} from './graphTarjan';

/**
 * Computes the downstream transitive fan-out cone of node IDs.
 *
 * @param graph Circuit graph
 * @param startNodeIds Initial source node IDs
 * @returns Array of reachable downstream node IDs (including starting nodes)
 */
export function fanoutCone(
  graph: CircuitGraph,
  startNodeIds: readonly string[]
): readonly string[] {
  const index = buildIndex(graph);
  const visited = new Set<string>();
  const queue: string[] = [...startNodeIds];

  for (const id of startNodeIds) {
    visited.add(id);
  }

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) continue;
    const neighbors = index.adjacency.get(cur) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return Array.from(visited);
}

/**
 * Computes the upstream transitive fan-in cone of node IDs.
 *
 * @param graph Circuit graph
 * @param targetNodeIds Target node IDs to trace backwards from
 * @returns Array of upstream driver node IDs (including target nodes)
 */
export function faninCone(
  graph: CircuitGraph,
  targetNodeIds: readonly string[]
): readonly string[] {
  const index = buildIndex(graph);
  const visited = new Set<string>();
  const queue: string[] = [...targetNodeIds];

  for (const id of targetNodeIds) {
    visited.add(id);
  }

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) continue;
    const pinMap = index.incomingWires.get(cur);
    if (pinMap) {
      for (const wireList of pinMap.values()) {
        for (const w of wireList) {
          if (!visited.has(w.from.nodeId)) {
            visited.add(w.from.nodeId);
            queue.push(w.from.nodeId);
          }
        }
      }
    }
  }

  return Array.from(visited);
}

/**
 * Computes a stable structural signature string that ignores node coordinates (x, y)
 * so UI layers can differentiate pure layout drag events from netlist topology edits.
 *
 * @param graph Circuit graph
 * @returns Deterministic structural hash string
 */
export function structuralSignature(graph: CircuitGraph): string {
  const nodeParts = graph.nodes
    .map((n) => {
      switch (n.kind) {
        case 'input':
          return `in:${n.id}:${n.label}:${n.value}`;
        case 'output':
          return `out:${n.id}:${n.label}`;
        case 'clock':
          return `clk:${n.id}:${n.label}:${n.halfPeriod}:${n.startValue}`;
        case 'const':
          return `const:${n.id}:${n.value}:${n.label ?? ''}`;
        case 'gate':
          return `g:${n.id}:${n.gateType}:${n.inputCount}:${n.delay ?? ''}:${n.label ?? ''}`;
      }
    })
    .sort()
    .join(';');

  const wireParts = graph.wires
    .map((w) => `w:${w.id}:${w.from.nodeId}.${w.from.pin}->${w.to.nodeId}.${w.to.pin}`)
    .sort()
    .join(';');

  return `[NODES]${nodeParts}[WIRES]${wireParts}`;
}
