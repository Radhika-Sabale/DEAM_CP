/**
 * @file stateDiagramLayout.ts
 * Deterministic circular layout engine for finite state machine diagrams (Stage 10A).
 * Calculates node center coordinates, bezier curved edge paths, reverse-edge offsets,
 * self-loop geometries, label placements, and terminal arrowhead rotations.
 */

import type { StateDiagramData } from '../../types/sequential';

/** Renderable 2D node position with bounding circle. */
export interface LayoutedNode {
  readonly id: string;
  readonly code: number;
  readonly name: string;
  readonly binaryCode: string;
  readonly isInitial: boolean;
  readonly mooreOutput?: string | number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Vector coordinate in 2D Euclidean canvas space. */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/** Renderable arrow marker orientation and point. */
export interface ArrowheadGeometry {
  readonly tipX: number;
  readonly tipY: number;
  readonly angleRad: number;
}

/** Renderable state transition edge with SVG path descriptor and label anchor. */
export interface LayoutedEdge {
  readonly id: string;
  readonly fromCode: number;
  readonly toCode: number;
  readonly label: string;
  readonly isSelfLoop: boolean;
  readonly pathD: string;
  readonly arrowhead: ArrowheadGeometry;
  readonly labelPosition: Point2D;
}

/** Complete geometrically laid-out state diagram model. */
export interface LayoutedStateDiagram {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly LayoutedNode[];
  readonly edges: readonly LayoutedEdge[];
}

const DEFAULT_NODE_RADIUS = 28;
const MIN_CANVAS_SIZE = 100;

/**
 * Computes deterministic 2D circular layout coordinates for a state diagram.
 *
 * @param diagram Source state diagram graph
 * @param bounds Canvas dimensions { width, height }
 * @returns Fully computed LayoutedStateDiagram
 */
export function layoutStateDiagram(
  diagram: StateDiagramData,
  bounds: { readonly width: number; readonly height: number }
): LayoutedStateDiagram {
  const width = Math.max(MIN_CANVAS_SIZE, Math.floor(bounds.width));
  const height = Math.max(MIN_CANVAS_SIZE, Math.floor(bounds.height));

  const centerX = width / 2;
  const centerY = height / 2;
  const nodeRadius = DEFAULT_NODE_RADIUS;

  const nodeCount = diagram.nodes.length;
  const ringRadius = Math.max(
    nodeRadius * 2,
    Math.min(width, height) / 2 - nodeRadius - 40
  );

  // 1. Arrange nodes on circle with initial state at the top (-PI/2)
  const nodeMap = new Map<number, LayoutedNode>();
  const nodes: LayoutedNode[] = [];

  // Sort nodes with initial state first, then remaining ascending by code
  const initial = diagram.nodes.find((n) => n.code === diagram.initialStateCode);
  const others = diagram.nodes.filter((n) => n.code !== diagram.initialStateCode).sort((a, b) => a.code - b.code);
  const orderedNodes = initial ? [initial, ...others] : [...others];

  if (nodeCount === 1 && orderedNodes[0]) {
    const single = orderedNodes[0];
    const laidOut: LayoutedNode = {
      id: single.id,
      code: single.code,
      name: single.name,
      binaryCode: single.binaryCode,
      isInitial: single.isInitial,
      mooreOutput: single.mooreOutput,
      x: centerX,
      y: centerY,
      radius: nodeRadius,
    };
    nodes.push(laidOut);
    nodeMap.set(single.code, laidOut);
  } else {
    for (let i = 0; i < orderedNodes.length; i++) {
      const srcNode = orderedNodes[i];
      if (!srcNode) continue;

      // Initial state at top (-PI/2), progressing clockwise
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodeCount;
      const x = Math.round((centerX + ringRadius * Math.cos(angle)) * 100) / 100;
      const y = Math.round((centerY + ringRadius * Math.sin(angle)) * 100) / 100;

      const laidOut: LayoutedNode = {
        id: srcNode.id,
        code: srcNode.code,
        name: srcNode.name,
        binaryCode: srcNode.binaryCode,
        isInitial: srcNode.isInitial,
        mooreOutput: srcNode.mooreOutput,
        x,
        y,
        radius: nodeRadius,
      };

      nodes.push(laidOut);
      nodeMap.set(srcNode.code, laidOut);
    }
  }

  // 2. Identify pair mutual transitions for bow/curve separation
  const edgePairSet = new Set<string>();
  for (const edge of diagram.edges) {
    if (!edge.isSelfLoop) {
      edgePairSet.add(`${edge.fromCode}->${edge.toCode}`);
    }
  }

  // 3. Calculate paths, control points, arrowheads, and label positions
  const edges: LayoutedEdge[] = [];

  for (const edge of diagram.edges) {
    const fromNode = nodeMap.get(edge.fromCode);
    const toNode = nodeMap.get(edge.toCode);

    if (!fromNode || !toNode) {
      continue;
    }

    if (edge.isSelfLoop) {
      // Loop outward from the circle center
      const angleFromCenter = Math.atan2(fromNode.y - centerY, fromNode.x - centerX);
      const outwardAngle = nodeCount === 1 ? -Math.PI / 2 : angleFromCenter;

      const loopDist = nodeRadius * 2.2;
      const cp1X = fromNode.x + Math.cos(outwardAngle - 0.5) * loopDist;
      const cp1Y = fromNode.y + Math.sin(outwardAngle - 0.5) * loopDist;
      const cp2X = fromNode.x + Math.cos(outwardAngle + 0.5) * loopDist;
      const cp2Y = fromNode.y + Math.sin(outwardAngle + 0.5) * loopDist;

      const startX = fromNode.x + Math.cos(outwardAngle - 0.4) * nodeRadius;
      const startY = fromNode.y + Math.sin(outwardAngle - 0.4) * nodeRadius;
      const endX = fromNode.x + Math.cos(outwardAngle + 0.4) * nodeRadius;
      const endY = fromNode.y + Math.sin(outwardAngle + 0.4) * nodeRadius;

      const pathD = `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${cp1X.toFixed(1)} ${cp1Y.toFixed(1)}, ${cp2X.toFixed(1)} ${cp2Y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;

      const labelX = fromNode.x + Math.cos(outwardAngle) * (loopDist * 1.15);
      const labelY = fromNode.y + Math.sin(outwardAngle) * (loopDist * 1.15);

      const arrowAngle = Math.atan2(endY - cp2Y, endX - cp2X);

      edges.push({
        id: edge.id,
        fromCode: edge.fromCode,
        toCode: edge.toCode,
        label: edge.label,
        isSelfLoop: true,
        pathD,
        arrowhead: {
          tipX: endX,
          tipY: endY,
          angleRad: arrowAngle,
        },
        labelPosition: {
          x: Math.round(labelX * 10) / 10,
          y: Math.round(labelY * 10) / 10,
        },
      });
    } else {
      // Directed edge between distinct nodes
      const hasReverse = edgePairSet.has(`${edge.toCode}->${edge.fromCode}`);

      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const unitX = dist > 0 ? dx / dist : 1;
      const unitY = dist > 0 ? dy / dist : 0;

      // Normal perpendicular unit vector (points right of line)
      const normX = -unitY;
      const normY = unitX;

      // Offset curve when reverse edge exists or default gentle offset
      const curveOffset = hasReverse ? Math.min(40, Math.max(25, dist * 0.2)) : 0;

      const midX = (fromNode.x + toNode.x) / 2 + normX * curveOffset;
      const midY = (fromNode.y + toNode.y) / 2 + normY * curveOffset;

      // Calculate border intersection points
      const startAngle = Math.atan2(midY - fromNode.y, midX - fromNode.x);
      const startX = fromNode.x + Math.cos(startAngle) * nodeRadius;
      const startY = fromNode.y + Math.sin(startAngle) * nodeRadius;

      const endAngle = Math.atan2(midY - toNode.y, midX - toNode.x);
      const endX = toNode.x + Math.cos(endAngle) * nodeRadius;
      const endY = toNode.y + Math.sin(endAngle) * nodeRadius;

      let pathD: string;
      if (curveOffset === 0) {
        pathD = `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      } else {
        pathD = `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      }

      const arrowAngle = Math.atan2(endY - midY, endX - midX);

      // Label positioned near apex of curve
      const labelX = midX + normX * 12;
      const labelY = midY + normY * 12;

      edges.push({
        id: edge.id,
        fromCode: edge.fromCode,
        toCode: edge.toCode,
        label: edge.label,
        isSelfLoop: false,
        pathD,
        arrowhead: {
          tipX: endX,
          tipY: endY,
          angleRad: arrowAngle,
        },
        labelPosition: {
          x: Math.round(labelX * 10) / 10,
          y: Math.round(labelY * 10) / 10,
        },
      });
    }
  }

  return {
    width,
    height,
    nodes,
    edges,
  };
}
