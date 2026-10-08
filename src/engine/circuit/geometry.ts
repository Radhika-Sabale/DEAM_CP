/**
 * @file geometry.ts
 * Geometric primitives, SVG path calculations, pin mapping, grid snapping, spatial queries, and hit testing.
 *
 * Implements:
 * - Deterministic node sizing and pin port coordinate mapping.
 * - Smooth cubic Bézier wire routing between pins.
 * - Spatial hit-testing against pins and viewport frustum culling.
 */

import type { CircuitGraph, CircuitNode } from '../../types/circuit';
import type { Point, Size, Viewport } from './viewport';
import { screenToWorld } from './viewport';

export {
  MIN_ZOOM,
  MAX_ZOOM,
  type Point,
  type Size,
  type Rect,
  type Viewport,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './viewport';

/** Standard snap grid unit size in world pixels */
export const GRID = 10;

/**
 * Hit-test result identifying a specific pin on a circuit node.
 */
export interface PinHitResult {
  readonly node: CircuitNode;
  readonly direction: 'in' | 'out';
  readonly pinIndex: number;
  readonly position: Point;
  readonly distance: number;
}

/**
 * Computes the dimensional bounding size of a node.
 *
 * @param node Circuit schematic node
 * @returns Width and height in world pixels
 */
export function nodeSize(node: CircuitNode): Size {
  switch (node.kind) {
    case 'input':
    case 'output':
    case 'clock':
      return { width: 70, height: 40 };
    case 'const':
      return { width: 50, height: 40 };
    case 'gate': {
      if (node.gateType === 'NOT') {
        return { width: 70, height: 40 };
      }
      const count = Math.max(2, node.inputCount);
      const height = Math.max(40, (count + 1) * 16);
      return { width: 80, height };
    }
  }
}

/**
 * Computes the world coordinate of a specific pin on a node.
 *
 * @param node Circuit node
 * @param direction Pin direction ('in' for input pin, 'out' for output driver pin)
 * @param index 0-based pin index
 * @returns Exact Point in world space
 */
export function pinPosition(
  node: CircuitNode,
  direction: 'in' | 'out',
  index: number
): Point {
  const size = nodeSize(node);

  if (direction === 'out') {
    // Driver pin (pin 0) is positioned on the right vertical boundary
    return {
      x: node.x + size.width,
      y: node.y + size.height / 2,
    };
  }

  // Input pin(s) are positioned on the left vertical boundary
  if (node.kind === 'output') {
    return {
      x: node.x,
      y: node.y + size.height / 2,
    };
  }

  if (node.kind === 'gate') {
    if (node.gateType === 'NOT') {
      return {
        x: node.x,
        y: node.y + size.height / 2,
      };
    }
    const count = node.inputCount;
    const spacing = size.height / (count + 1);
    const pinY = node.y + (index + 1) * spacing;
    return {
      x: node.x,
      y: pinY,
    };
  }

  return {
    x: node.x,
    y: node.y + size.height / 2,
  };
}

/**
 * Computes a smooth, deterministic cubic Bézier SVG path string connecting two pin points.
 *
 * @param from Output driver pin world coordinate
 * @param to Target input pin world coordinate
 * @returns SVG `<path d="...">` attribute string
 */
export function wirePath(from: Point, to: Point): string {
  const dx = Math.max(30, Math.abs(to.x - from.x) * 0.5);
  const cp1x = from.x + dx;
  const cp1y = from.y;
  const cp2x = to.x - dx;
  const cp2y = to.y;

  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/**
 * Computes the geometric midpoint along a wire.
 *
 * @param from Source pin point
 * @param to Target pin point
 * @returns Midpoint coordinate
 */
export function wireMidpoint(from: Point, to: Point): Point {
  return {
    x: (from.x + to.x) * 0.5,
    y: (from.y + to.y) * 0.5,
  };
}

/**
 * Snaps a world coordinate to the global grid.
 *
 * @param value Continuous coordinate value
 * @param grid Grid pitch (defaults to GRID = 10)
 * @returns Snapped coordinate value
 */
export function snapToGrid(value: number, grid = GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Computes an optimal viewport centering and fitting the entire circuit graph.
 *
 * @param graph Circuit schematic graph
 * @param containerSize Container viewport dimensions
 * @param padding Padding around schematic boundaries in pixels
 * @returns Viewport framing all nodes
 */
export function fitToContent(
  graph: CircuitGraph,
  containerSize: Size,
  padding = 40
): Viewport {
  if (graph.nodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of graph.nodes) {
    const size = nodeSize(node);
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + size.width);
    maxY = Math.max(maxY, node.y + size.height);
  }

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);

  const availW = Math.max(10, containerSize.width - padding * 2);
  const availH = Math.max(10, containerSize.height - padding * 2);

  const fitZoom = Math.min(1.5, Math.min(availW / contentW, availH / contentH));
  const zoom = Math.min(3.0, Math.max(0.25, fitZoom));

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  return {
    zoom,
    x: containerSize.width * 0.5 - centerX * zoom,
    y: containerSize.height * 0.5 - centerY * zoom,
  };
}

/**
 * Filters the circuit nodes that intersect the visible viewport.
 *
 * @param graph Circuit graph
 * @param viewport Current viewport transform
 * @param size Container size
 * @param margin Pixel margin for frustum culling
 * @returns Array of nodes intersecting visible area
 */
export function nodesInViewport(
  graph: CircuitGraph,
  viewport: Viewport,
  size: Size,
  margin = 50
): readonly CircuitNode[] {
  const topLeft = screenToWorld({ x: -margin, y: -margin }, viewport);
  const botRight = screenToWorld({ x: size.width + margin, y: size.height + margin }, viewport);

  const viewMinX = Math.min(topLeft.x, botRight.x);
  const viewMaxX = Math.max(topLeft.x, botRight.x);
  const viewMinY = Math.min(topLeft.y, botRight.y);
  const viewMaxY = Math.max(topLeft.y, botRight.y);

  return graph.nodes.filter((node) => {
    const nSize = nodeSize(node);
    const nMinX = node.x;
    const nMaxX = node.x + nSize.width;
    const nMinY = node.y;
    const nMaxY = node.y + nSize.height;

    return nMinX <= viewMaxX && nMaxX >= viewMinX && nMinY <= viewMaxY && nMaxY >= viewMinY;
  });
}

/**
 * Finds the nearest node pin within a hit-test radius of a world coordinate point.
 *
 * @param graph Circuit graph
 * @param worldPoint Target coordinate in world space
 * @param radius Maximum hit-test radius in world pixels
 * @returns Nearest PinHitResult or null if none within radius
 */
export function hitTestPin(
  graph: CircuitGraph,
  worldPoint: Point,
  radius = 14
): PinHitResult | null {
  let closest: PinHitResult | null = null;
  let minDistance = radius;

  for (const node of graph.nodes) {
    // Check output pin (all nodes except output probe)
    if (node.kind !== 'output') {
      const pos = pinPosition(node, 'out', 0);
      const dist = Math.hypot(pos.x - worldPoint.x, pos.y - worldPoint.y);
      if (dist <= minDistance) {
        minDistance = dist;
        closest = {
          node,
          direction: 'out',
          pinIndex: 0,
          position: pos,
          distance: dist,
        };
      }
    }

    // Check input pin(s)
    if (node.kind === 'output') {
      const pos = pinPosition(node, 'in', 0);
      const dist = Math.hypot(pos.x - worldPoint.x, pos.y - worldPoint.y);
      if (dist <= minDistance) {
        minDistance = dist;
        closest = {
          node,
          direction: 'in',
          pinIndex: 0,
          position: pos,
          distance: dist,
        };
      }
    } else if (node.kind === 'gate') {
      for (let p = 0; p < node.inputCount; p++) {
        const pos = pinPosition(node, 'in', p);
        const dist = Math.hypot(pos.x - worldPoint.x, pos.y - worldPoint.y);
        if (dist <= minDistance) {
          minDistance = dist;
          closest = {
            node,
            direction: 'in',
            pinIndex: p,
            position: pos,
            distance: dist,
          };
        }
      }
    }
  }

  return closest;
}
