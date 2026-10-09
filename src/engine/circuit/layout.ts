/**
 * @file layout.ts
 * Deterministic layered schematic auto-placement and graph layout engine.
 *
 * Implements:
 * - Topological levelization (inputs/consts/clocks in col 0, outputs in last col).
 * - Feedback loop handling (SCC members share columns).
 * - 4-pass barycenter heuristic row ordering with deterministic ID tie-breaking.
 * - Grid-snapped coordinate assignment with reference identity preservation.
 */

import type { CircuitGraph, CircuitNode } from '../../types/circuit';
import { nodeSize, snapToGrid } from './geometry';
import { buildIndex } from './graphIndex';
import { topologicalLevels } from './graphTarjan';

/**
 * Customization options for circuit schematic layout.
 */
export interface LayoutOptions {
  /** Top-left initial X offset in world pixels (default: 60) */
  readonly startX?: number;
  /** Top-left initial Y offset in world pixels (default: 60) */
  readonly startY?: number;
  /** Horizontal column spacing in world pixels (default: 80) */
  readonly colGap?: number;
  /** Vertical row spacing in world pixels (default: 30) */
  readonly rowGap?: number;
}

/**
 * Computes an aesthetically arranged, layered schematic layout for a circuit graph.
 *
 * @param graph Circuit graph to lay out
 * @param options Layout parameters
 * @returns New circuit graph with updated x/y coordinates (or same references if unchanged)
 */
export function layoutCircuit(
  graph: CircuitGraph,
  options: LayoutOptions = {}
): CircuitGraph {
  if (graph.nodes.length === 0) {
    return graph;
  }

  const startX = snapToGrid(options.startX ?? 60);
  const startY = snapToGrid(options.startY ?? 60);
  const colGap = snapToGrid(options.colGap ?? 80);
  const rowGap = snapToGrid(options.rowGap ?? 30);

  // 1. Compute topological depth levels
  const { levels } = topologicalLevels(graph);
  const index = buildIndex(graph);

  // 2. Classify nodes into initial column tiers
  let maxIntermediateLevel = 0;
  for (const node of graph.nodes) {
    if (node.kind === 'gate') {
      const lvl = levels.get(node.id) ?? 1;
      if (lvl > maxIntermediateLevel) {
        maxIntermediateLevel = lvl;
      }
    }
  }

  const outputColumn = Math.max(1, maxIntermediateLevel + 1);

  // Map each node to its assigned column
  const nodeColumn = new Map<string, number>();
  for (const node of graph.nodes) {
    switch (node.kind) {
      case 'input':
      case 'const':
      case 'clock':
        nodeColumn.set(node.id, 0);
        break;
      case 'output':
        nodeColumn.set(node.id, outputColumn);
        break;
      case 'gate': {
        const lvl = levels.get(node.id) ?? 1;
        // Keep gates strictly between column 1 and outputColumn - 1
        const col = Math.min(outputColumn - 1, Math.max(1, lvl));
        nodeColumn.set(node.id, col);
        break;
      }
    }
  }

  // Group nodes into columns
  const numColumns = outputColumn + 1;
  const columns: CircuitNode[][] = Array.from({ length: numColumns }, () => []);

  for (const node of graph.nodes) {
    const colIdx = nodeColumn.get(node.id) ?? 0;
    columns[colIdx]?.push(node);
  }

  // Sort each column initially:
  // Source/Output nodes alphabetically by label/id, gates deterministically by ID
  for (let c = 0; c < numColumns; c++) {
    const col = columns[c];
    if (!col) continue;
    col.sort((a, b) => {
      const labelA = 'label' in a && a.label ? a.label : a.id;
      const labelB = 'label' in b && b.label ? b.label : b.id;
      return labelA.localeCompare(labelB);
    });
  }

  // 3. Four-pass barycenter sweeps for edge crossing minimization
  const nodeOrderMap = new Map<string, number>();

  const updateOrderMap = (): void => {
    nodeOrderMap.clear();
    for (let c = 0; c < numColumns; c++) {
      const col = columns[c];
      if (!col) continue;
      col.forEach((n, idx) => {
        nodeOrderMap.set(n.id, idx);
      });
    }
  };

  updateOrderMap();

  // Helper to compute barycenter rank
  const computeUpstreamBarycenter = (nodeId: string): number => {
    const inWires = index.incomingWires.get(nodeId);
    if (!inWires || inWires.size === 0) return nodeOrderMap.get(nodeId) ?? 0;

    let sum = 0;
    let count = 0;
    for (const wireList of inWires.values()) {
      for (const w of wireList) {
        const rank = nodeOrderMap.get(w.from.nodeId);
        if (rank !== undefined) {
          sum += rank;
          count++;
        }
      }
    }
    return count > 0 ? sum / count : (nodeOrderMap.get(nodeId) ?? 0);
  };

  const computeDownstreamBarycenter = (nodeId: string): number => {
    const neighbors = index.adjacency.get(nodeId);
    if (!neighbors || neighbors.length === 0) return nodeOrderMap.get(nodeId) ?? 0;

    let sum = 0;
    let count = 0;
    for (const tgtId of neighbors) {
      const rank = nodeOrderMap.get(tgtId);
      if (rank !== undefined) {
        sum += rank;
        count++;
      }
    }
    return count > 0 ? sum / count : (nodeOrderMap.get(nodeId) ?? 0);
  };

  // Pass 1: Forward (L -> R)
  for (let c = 1; c < numColumns; c++) {
    const col = columns[c];
    if (col && col.length > 1) {
      col.sort((a, b) => {
        const baryA = computeUpstreamBarycenter(a.id);
        const baryB = computeUpstreamBarycenter(b.id);
        if (Math.abs(baryA - baryB) > 1e-6) return baryA - baryB;
        return a.id.localeCompare(b.id);
      });
      updateOrderMap();
    }
  }

  // Pass 2: Backward (R -> L)
  for (let c = numColumns - 2; c >= 0; c--) {
    const col = columns[c];
    if (col && col.length > 1) {
      col.sort((a, b) => {
        const baryA = computeDownstreamBarycenter(a.id);
        const baryB = computeDownstreamBarycenter(b.id);
        if (Math.abs(baryA - baryB) > 1e-6) return baryA - baryB;
        return a.id.localeCompare(b.id);
      });
      updateOrderMap();
    }
  }

  // Pass 3: Forward (L -> R)
  for (let c = 1; c < numColumns; c++) {
    const col = columns[c];
    if (col && col.length > 1) {
      col.sort((a, b) => {
        const baryA = computeUpstreamBarycenter(a.id);
        const baryB = computeUpstreamBarycenter(b.id);
        if (Math.abs(baryA - baryB) > 1e-6) return baryA - baryB;
        return a.id.localeCompare(b.id);
      });
      updateOrderMap();
    }
  }

  // Pass 4: Backward (R -> L)
  for (let c = numColumns - 2; c >= 0; c--) {
    const col = columns[c];
    if (col && col.length > 1) {
      col.sort((a, b) => {
        const baryA = computeDownstreamBarycenter(a.id);
        const baryB = computeDownstreamBarycenter(b.id);
        if (Math.abs(baryA - baryB) > 1e-6) return baryA - baryB;
        return a.id.localeCompare(b.id);
      });
      updateOrderMap();
    }
  }

  // 4. Calculate Column Widths & Heights
  const columnWidths = columns.map((col) => {
    let maxW = 70;
    for (const node of col) {
      const size = nodeSize(node);
      if (size.width > maxW) maxW = size.width;
    }
    return snapToGrid(maxW);
  });

  const columnHeights = columns.map((col) => {
    if (col.length === 0) return 0;
    let totalH = 0;
    col.forEach((node, idx) => {
      totalH += nodeSize(node).height;
      if (idx < col.length - 1) totalH += rowGap;
    });
    return totalH;
  });

  const maxTotalHeight = Math.max(...columnHeights, 0);

  // Compute X positions for each column
  const columnX: number[] = [];
  let curX = startX;
  for (let c = 0; c < numColumns; c++) {
    columnX.push(curX);
    curX += (columnWidths[c] ?? 70) + colGap;
  }

  // 5. Position nodes with grid alignment and reference identity preservation
  const updatedNodes: CircuitNode[] = [];
  let anyMoved = false;

  for (let c = 0; c < numColumns; c++) {
    const col = columns[c];
    if (!col) continue;

    const colX = columnX[c] ?? startX;
    const colH = columnHeights[c] ?? 0;
    const colOffsetY = startY + snapToGrid((maxTotalHeight - colH) * 0.5);

    let curY = colOffsetY;
    for (const node of col) {
      const targetX = colX;
      const targetY = curY;
      const size = nodeSize(node);

      if (node.x === targetX && node.y === targetY) {
        updatedNodes.push(node);
      } else {
        anyMoved = true;
        updatedNodes.push({
          ...node,
          x: targetX,
          y: targetY,
        });
      }

      curY += size.height + rowGap;
    }
  }

  if (!anyMoved && updatedNodes.length === graph.nodes.length) {
    return graph;
  }

  return {
    nodes: updatedNodes,
    wires: graph.wires,
  };
}
