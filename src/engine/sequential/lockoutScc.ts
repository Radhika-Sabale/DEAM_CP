/**
 * @file lockoutScc.ts
 * Strongly Connected Component (SCC) graph cycle finder using Tarjan's algorithm for lockout analysis.
 */

/**
 * Finds Strongly Connected Components (SCCs) within a directed graph using Tarjan's algorithm.
 *
 * @param nodes List of node integer IDs
 * @param adj Adjacency map of outgoing directed edges
 * @returns Array of SCC node ID arrays, sorted deterministically
 */
export function findSCCs(
  nodes: readonly number[],
  adj: ReadonlyMap<number, readonly number[]>
): number[][] {
  let index = 0;
  const indices = new Map<number, number>();
  const lowlinks = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const sccs: number[][] = [];

  function strongConnect(v: number) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adj.get(v) ?? [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        const vLow = lowlinks.get(v) ?? 0;
        const wLow = lowlinks.get(w) ?? 0;
        lowlinks.set(v, Math.min(vLow, wLow));
      } else if (onStack.has(w)) {
        const vLow = lowlinks.get(v) ?? 0;
        const wIdx = indices.get(w) ?? 0;
        lowlinks.set(v, Math.min(vLow, wIdx));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: number[] = [];
      let w: number | undefined;
      do {
        w = stack.pop();
        if (w !== undefined) {
          onStack.delete(w);
          scc.push(w);
        }
      } while (w !== undefined && w !== v);
      sccs.push(scc.sort((a, b) => a - b));
    }
  }

  for (const node of nodes) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  return sccs;
}
