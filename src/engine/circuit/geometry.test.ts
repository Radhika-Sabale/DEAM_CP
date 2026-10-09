/**
 * @file geometry.test.ts
 * Unit tests for geometric calculations, pin placement, wire routing, viewport transforms, and spatial indexing.
 */

import { describe, it, expect } from 'vitest';
import type { CircuitGraph, CircuitNode } from '../../types/circuit';
import {
  nodeSize,
  pinPosition,
  wirePath,
  wireMidpoint,
  snapToGrid,
  screenToWorld,
  worldToScreen,
  zoomAt,
  fitToContent,
  nodesInViewport,
  hitTestPin,
  GRID,
  MIN_ZOOM,
  MAX_ZOOM,
} from './geometry';

describe('geometry engine', () => {
  const mockInput: CircuitNode = {
    id: 'in_A',
    kind: 'input',
    label: 'A',
    x: 100,
    y: 200,
    value: 0,
  };

  const mockGate3: CircuitNode = {
    id: 'and1',
    kind: 'gate',
    gateType: 'AND',
    inputCount: 3,
    x: 300,
    y: 200,
  };

  const mockNot: CircuitNode = {
    id: 'not1',
    kind: 'gate',
    gateType: 'NOT',
    inputCount: 1,
    x: 200,
    y: 100,
  };

  const mockOutput: CircuitNode = {
    id: 'out_F',
    kind: 'output',
    label: 'F',
    x: 500,
    y: 200,
  };

  const mockGraph: CircuitGraph = {
    nodes: [mockInput, mockNot, mockGate3, mockOutput],
    wires: [
      { id: 'w1', from: { nodeId: 'in_A', pin: 0 }, to: { nodeId: 'and1', pin: 0 } },
    ],
  };

  it('nodeSize grows appropriately with gate input count', () => {
    const sizeIn = nodeSize(mockInput);
    expect(sizeIn.width).toBe(70);
    expect(sizeIn.height).toBe(40);

    const sizeNot = nodeSize(mockNot);
    expect(sizeNot.width).toBe(70);
    expect(sizeNot.height).toBe(40);

    const size2 = nodeSize({ id: 'g2', kind: 'gate', gateType: 'AND', inputCount: 2, x: 0, y: 0 });
    const size5 = nodeSize({ id: 'g5', kind: 'gate', gateType: 'AND', inputCount: 5, x: 0, y: 0 });

    expect(size5.height).toBeGreaterThan(size2.height);
  });

  it('pin positions lie on the node boundary', () => {
    const sizeGate = nodeSize(mockGate3);
    const outPin = pinPosition(mockGate3, 'out', 0);
    expect(outPin.x).toBe(mockGate3.x + sizeGate.width);
    expect(outPin.y).toBe(mockGate3.y + sizeGate.height / 2);

    for (let p = 0; p < 3; p++) {
      const inPin = pinPosition(mockGate3, 'in', p);
      expect(inPin.x).toBe(mockGate3.x);
      expect(inPin.y).toBeGreaterThan(mockGate3.y);
      expect(inPin.y).toBeLessThan(mockGate3.y + sizeGate.height);
    }
  });

  it('hitTestPin finds every pin at its own position', () => {
    for (const node of mockGraph.nodes) {
      if (node.kind !== 'output') {
        const outPos = pinPosition(node, 'out', 0);
        const hit = hitTestPin(mockGraph, outPos, 5);
        expect(hit).not.toBeNull();
        expect(hit?.node.id).toBe(node.id);
        expect(hit?.direction).toBe('out');
        expect(hit?.pinIndex).toBe(0);
      }

      if (node.kind === 'output') {
        const inPos = pinPosition(node, 'in', 0);
        const hit = hitTestPin(mockGraph, inPos, 5);
        expect(hit).not.toBeNull();
        expect(hit?.node.id).toBe(node.id);
        expect(hit?.direction).toBe('in');
      } else if (node.kind === 'gate') {
        for (let p = 0; p < node.inputCount; p++) {
          const inPos = pinPosition(node, 'in', p);
          const hit = hitTestPin(mockGraph, inPos, 5);
          expect(hit).not.toBeNull();
          expect(hit?.node.id).toBe(node.id);
          expect(hit?.direction).toBe('in');
          expect(hit?.pinIndex).toBe(p);
        }
      }
    }
  });

  it('hitTestPin returns null when coordinates are far away', () => {
    const hit = hitTestPin(mockGraph, { x: 9999, y: 9999 }, 10);
    expect(hit).toBeNull();
  });

  it('screen/world transforms form an exact bijection within 1e-9', () => {
    const viewport = { x: 123.45, y: -67.89, zoom: 1.45 };
    const originalWorld = { x: 314.159, y: 271.828 };

    const screen = worldToScreen(originalWorld, viewport);
    const roundTripWorld = screenToWorld(screen, viewport);

    expect(Math.abs(roundTripWorld.x - originalWorld.x)).toBeLessThan(1e-9);
    expect(Math.abs(roundTripWorld.y - originalWorld.y)).toBeLessThan(1e-9);
  });

  it('zoomAt maintains the screen anchor point in world space and respects zoom clamping', () => {
    const initialViewport = { x: 50, y: 50, zoom: 1.0 };
    const anchorScreen = { x: 400, y: 300 };

    const worldBefore = screenToWorld(anchorScreen, initialViewport);
    const zoomedViewport = zoomAt(initialViewport, anchorScreen, 1.5);
    const worldAfter = screenToWorld(anchorScreen, zoomedViewport);

    expect(Math.abs(worldAfter.x - worldBefore.x)).toBeLessThan(1e-9);
    expect(Math.abs(worldAfter.y - worldBefore.y)).toBeLessThan(1e-9);
    expect(zoomedViewport.zoom).toBe(1.5);

    // Zoom min/max clamp
    const zoomWayOut = zoomAt(initialViewport, anchorScreen, 0.01);
    expect(zoomWayOut.zoom).toBe(MIN_ZOOM);

    const zoomWayIn = zoomAt(initialViewport, anchorScreen, 100);
    expect(zoomWayIn.zoom).toBe(MAX_ZOOM);
  });

  it('fitToContent encompasses all nodes in the graph', () => {
    const container = { width: 800, height: 600 };
    const viewport = fitToContent(mockGraph, container, 20);

    for (const node of mockGraph.nodes) {
      const size = nodeSize(node);
      const screenTopLeft = worldToScreen({ x: node.x, y: node.y }, viewport);
      const screenBotRight = worldToScreen({ x: node.x + size.width, y: node.y + size.height }, viewport);

      expect(screenTopLeft.x).toBeGreaterThanOrEqual(15);
      expect(screenTopLeft.y).toBeGreaterThanOrEqual(15);
      expect(screenBotRight.x).toBeLessThanOrEqual(container.width - 15);
      expect(screenBotRight.y).toBeLessThanOrEqual(container.height - 15);
    }
  });

  it('nodesInViewport spatial culling matches brute-force bounding box intersection', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };
    const container = { width: 350, height: 250 };
    const culled = nodesInViewport(mockGraph, viewport, container, 0);

    // in_A (100,200), not1 (200,100) are within 350x250; out_F (500,200) is outside
    const ids = culled.map((n) => n.id);
    expect(ids).toContain('in_A');
    expect(ids).toContain('not1');
    expect(ids).not.toContain('out_F');
  });

  it('wirePath and snapToGrid produce deterministic outputs', () => {
    const from = { x: 10, y: 20 };
    const to = { x: 100, y: 80 };
    const path = wirePath(from, to);
    expect(path).toMatch(/^M 10.00 20.00 C/);

    const mid = wireMidpoint(from, to);
    expect(mid).toEqual({ x: 55, y: 50 });

    expect(snapToGrid(23, GRID)).toBe(20);
    expect(snapToGrid(27, GRID)).toBe(30);
  });
});
