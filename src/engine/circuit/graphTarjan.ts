/**
 * @file graphTarjan.ts
 * Iterative Tarjan strongly connected components and topological levelization.
 */

import type { CircuitGraph } from '../../types/circuit';
import { buildIndex, type CircuitIndex } from './graphIndex';

/**
 * Result of topological level analysis.
 */
export interface TopologicalLevelsResult {
  readonly levels: ReadonlyMap<string, number>;
  readonly maxLevel: number;
  readonly hasFeedback: boolean;
}

/**
 * Finds all non-trivial Strongly Connected Components (cycles) using
 * an iterative Tarjan's algorithm.
 *
 * @param index Circuit indexing structure
 * @returns Array of non-trivial SCCs (each containing >= 2 nodes or a self-loop)
 */
export function stronglyConnectedComponents(
  index: CircuitIndex
): readonly (readonly string[])[] {
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const tarjanStack: string[] = [];
  const sccs: (readonly string[])[] = [];
  let timer = 0;

  interface Frame {
    readonly u: string;
    neighborIdx: number;
  }

  for (const rootId of index.nodeById.keys()) {
    if (disc.has(rootId)) continue;

    const callStack: Frame[] = [{ u: rootId, neighborIdx: 0 }];
    disc.set(rootId, timer);
    low.set(rootId, timer);
    timer++;
    tarjanStack.push(rootId);
    onStack.set(rootId, true);

    while (callStack.length > 0) {
      const top = callStack[callStack.length - 1];
      if (!top) break;
      const u = top.u;
      const neighbors = index.adjacency.get(u) ?? [];

      if (top.neighborIdx < neighbors.length) {
        const v = neighbors[top.neighborIdx];
        top.neighborIdx++;

        if (v !== undefined) {
          if (!disc.has(v)) {
            disc.set(v, timer);
            low.set(v, timer);
            timer++;
            tarjanStack.push(v);
            onStack.set(v, true);
            callStack.push({ u: v, neighborIdx: 0 });
          } else if (onStack.get(v)) {
            const curLow = low.get(u) ?? 0;
            const vDisc = disc.get(v) ?? 0;
            low.set(u, Math.min(curLow, vDisc));
          }
        }
      } else {
        // Backtrack
        callStack.pop();
        if (callStack.length > 0) {
          const parentTop = callStack[callStack.length - 1];
          if (parentTop) {
            const p = parentTop.u;
            const pLow = low.get(p) ?? 0;
            const uLow = low.get(u) ?? 0;
            low.set(p, Math.min(pLow, uLow));
          }
        }

        const uLow = low.get(u);
        const uDisc = disc.get(u);
        if (uLow !== undefined && uDisc !== undefined && uLow === uDisc) {
          const component: string[] = [];
          while (tarjanStack.length > 0) {
            const w = tarjanStack.pop();
            if (w === undefined) break;
            onStack.set(w, false);
            component.push(w);
            if (w === u) break;
          }

          const hasSelfLoop = (index.adjacency.get(u) ?? []).includes(u);
          if (component.length > 1 || (component.length === 1 && hasSelfLoop)) {
            sccs.push(component);
          }
        }
      }
    }
  }

  return sccs;
}

/**
 * Computes topological depth levels across the circuit graph.
 *
 * Source nodes sit at Level 0. Strongly connected components share
 * the maximum level of their predecessors.
 *
 * @param graph Circuit graph
 * @returns Topological levels map and feedback flag
 */
export function topologicalLevels(graph: CircuitGraph): TopologicalLevelsResult {
  const index = buildIndex(graph);
  const sccs = stronglyConnectedComponents(index);
  const hasFeedback = sccs.length > 0;

  const sccOf = new Map<string, number>();
  sccs.forEach((scc, idx) => {
    for (const id of scc) {
      sccOf.set(id, idx);
    }
  });

  const levels = new Map<string, number>();
  for (const node of graph.nodes) {
    levels.set(node.id, 0);
  }

  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(1, graph.nodes.length + 1);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const wire of graph.wires) {
      const srcLevel = levels.get(wire.from.nodeId) ?? 0;
      const tgtLevel = levels.get(wire.to.nodeId) ?? 0;

      const srcScc = sccOf.get(wire.from.nodeId);
      const tgtScc = sccOf.get(wire.to.nodeId);

      const required = srcScc !== undefined && srcScc === tgtScc ? srcLevel : srcLevel + 1;
      if (tgtLevel < required) {
        levels.set(wire.to.nodeId, required);
        changed = true;
      }
    }

    for (const scc of sccs) {
      let maxSccLevel = 0;
      for (const id of scc) {
        maxSccLevel = Math.max(maxSccLevel, levels.get(id) ?? 0);
      }
      for (const id of scc) {
        if ((levels.get(id) ?? 0) < maxSccLevel) {
          levels.set(id, maxSccLevel);
          changed = true;
        }
      }
    }
  }

  let maxLevel = 0;
  for (const lvl of levels.values()) {
    if (lvl > maxLevel) maxLevel = lvl;
  }

  return {
    levels,
    maxLevel,
    hasFeedback,
  };
}
