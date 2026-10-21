/**
 * @file Canvas.tsx
 * Interactive SVG schematic canvas for digital circuit design and simulation.
 * Supports pan/zoom, drag-and-drop node placement, pin-to-pin wiring,
 * multi-element selection, and full keyboard navigation.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, GateType } from '../../types/circuit';
import { addNode, moveNodes, nextNodeId } from '../../engine/circuit';
import {
  pinPosition,
  fitToContent,
  snapToGrid,
  wirePath,
  zoomByStep,
  type Size,
} from '../../engine/circuit/geometry';
import { GateNode } from './GateNode';
import { WireEdge } from './WireEdge';
import { useCanvasInteractions } from './useCanvasInteractions';
import { Button } from '../../components/ui/Button';

export interface CanvasProps {
  readonly graph: CircuitGraph;
  readonly values: Readonly<Record<string, LogicValue>>;
  readonly onCommitGraph: (nextGraph: CircuitGraph) => void;
  readonly onBeginTransaction: () => void;
  readonly onUpdateTransaction: (nextGraph: CircuitGraph) => void;
  readonly onCommitTransaction: () => void;
  readonly onToggleInput: (nodeId: string) => void;
  readonly onOpenHelpModal?: () => void;
  readonly onDeleteResult?: (deleted: boolean) => void;
}

export const Canvas: FC<CanvasProps> = ({
  graph,
  values,
  onCommitGraph,
  onBeginTransaction,
  onUpdateTransaction,
  onCommitTransaction,
  onToggleInput,
  onOpenHelpModal,
  onDeleteResult,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 });
  const hasInitialFit = useRef(false);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const palettePointerDragRef = useRef<{ kind: CircuitNode['kind']; gateType?: GateType; customValue?: 0 | 1 } | null>(null);
  const pinPointerStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const {
    viewport,
    setViewport,
    selectedNodeIds,
    selectedWireIds,
    focusedNodeId,
    wiring,
    setWiring,
    setAnnouncement,
    announcement,
    isPanningRef,
    isDraggingNodesRef,
    dragStartScreenRef,
    dragStartPositionsRef,
    screenToWorldCoord,
    handleZoomIn,
    handleZoomOut,
    handleFitToContent,
    handleSelectNode,
    handleSelectWire,
    handleClearSelection,
    handleDeleteSelected,
    handlePinClick,
    cancelWiring,
    handleCanvasKeyDown,
  } = useCanvasInteractions({
    graph,
    containerSize,
    onCommitGraph,
    onToggleInput,
    onDeleteResult,
  });

  // Track container resize and defer fitting until it has real dimensions.
  const measureContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasInitialFit.current || graph.nodes.length === 0 || containerSize.width <= 0 || containerSize.height <= 0) return;
    hasInitialFit.current = true;
    setViewport((current) => ({ ...current, ...fitToContent(graph, containerSize) }));
  }, [graph, containerSize, setViewport]);

  // Mouse wheel zoom
  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setViewport((prev) => zoomByStep(prev, mouseScreen, e.deltaY < 0 ? 1 : -1));
  };

  // Background pointer down (pan or drag start)
  const handlePointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left click
    if (e.target instanceof Element && e.target.closest('[data-circuit-pin]')) return;

    if (wiring.active) {
      cancelWiring();
      return;
    }

    handleClearSelection();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPanningRef.current = true;
    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseWorld = screenToWorldCoord(e.clientX - rect.left, e.clientY - rect.top);

    if (wiring.active) {
      setWiring((prev) => ({
        ...prev,
        currentMouseWorld: mouseWorld,
      }));
      return;
    }

    if (isPanningRef.current) {
      const dx = e.clientX - dragStartScreenRef.current.x;
      const dy = e.clientY - dragStartScreenRef.current.y;
      dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
      setViewport((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      return;
    }

    if (isDraggingNodesRef.current && selectedNodeIds.length > 0) {
      const dxScreen = e.clientX - dragStartScreenRef.current.x;
      const dyScreen = e.clientY - dragStartScreenRef.current.y;
      const dxWorld = dxScreen / viewport.zoom;
      const dyWorld = dyScreen / viewport.zoom;

      const moves = selectedNodeIds.map((nodeId) => {
        const startPos = dragStartPositionsRef.current.get(nodeId);
        if (!startPos) return { id: nodeId, x: 0, y: 0 };
        const rawTargetX = startPos.x + dxWorld;
        const rawTargetY = startPos.y + dyWorld;
        const snappedX = snapToGrid(rawTargetX);
        const snappedY = snapToGrid(rawTargetY);

        return {
          id: nodeId,
          x: snappedX,
          y: snappedY,
        };
      });

      const updated = moveNodes(graph, moves);
      onUpdateTransaction(updated);
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }
    if (isDraggingNodesRef.current) {
      isDraggingNodesRef.current = false;
      onCommitTransaction();
    }
  };

  const handlePinPointerDown = (nodeId: string, direction: 'in' | 'out', pin: number, e: PointerEvent<SVGGElement>) => {
    if (direction !== 'out') return;
    pinPointerStartRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePinClick(nodeId, direction, pin);
  };

  const handleCanvasPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const start = pinPointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) { handlePointerUp(); return; }
    pinPointerStartRef.current = null;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6;
    if (moved && wiring.active) {
      const element = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGGElement>('[data-circuit-pin]');
      const nodeId = element?.dataset.nodeId;
      const pinIndex = Number(element?.dataset.pinIndex);
      if (element?.dataset.pinDirection === 'in' && nodeId && Number.isInteger(pinIndex)) {
        handlePinClick(nodeId, 'in', pinIndex);
      } else {
        cancelWiring();
        setAnnouncement('Connect the wire to a gate input or output terminal.');
      }
    }
    handlePointerUp();
  };

  // Node Drag Initiator
  const handleNodeDragStart = (nodeId: string, e: PointerEvent<SVGGElement>) => {
    if (wiring.active) return;
    if (e.target instanceof Element && e.target.closest('[data-circuit-pin]')) return;
    if (!selectedNodeIds.includes(nodeId)) {
      handleSelectNode(nodeId, e);
    }

    onBeginTransaction();
    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
    isDraggingNodesRef.current = true;
    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
    dragStartPositionsRef.current.clear();

    const idsToDrag = selectedNodeIds.length > 0 && selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
    for (const id of idsToDrag) {
      const n = graph.nodes.find((node) => node.id === id);
      if (n) {
        dragStartPositionsRef.current.set(id, { x: n.x, y: n.y });
      }
    }
  };

  // HTML5 Drag & Drop from Palette
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr) as {
        kind: CircuitNode['kind'];
        gateType?: GateType;
        customValue?: 0 | 1;
      };
      const rect = containerRef.current.getBoundingClientRect();
      const worldPos = screenToWorldCoord(e.clientX - rect.left, e.clientY - rect.top);
      const snappedX = snapToGrid(worldPos.x);
      const snappedY = snapToGrid(worldPos.y);
      const id = nextNodeId(graph, data.kind);

      let nextGraph = graph;
      if (data.kind === 'gate' && data.gateType) {
        nextGraph = addNode(nextGraph, {
          id,
          kind: 'gate',
          gateType: data.gateType,
          inputCount: data.gateType === 'NOT' || data.gateType === 'BUFFER' ? 1 : 2,
          x: snappedX,
          y: snappedY,
        });
      } else if (data.kind === 'input') {
        nextGraph = addNode(nextGraph, {
          id,
          kind: 'input',
          label: 'IN',
          value: 0,
          x: snappedX,
          y: snappedY,
        });
      } else if (data.kind === 'output') {
        nextGraph = addNode(nextGraph, {
          id,
          kind: 'output',
          label: 'OUT',
          x: snappedX,
          y: snappedY,
        });
      } else if (data.kind === 'clock') {
        nextGraph = addNode(nextGraph, {
          id,
          kind: 'clock',
          label: 'CLK',
          halfPeriod: 5,
          startValue: 0,
          x: snappedX,
          y: snappedY,
        });
      } else if (data.kind === 'const') {
        nextGraph = addNode(nextGraph, {
          id,
          kind: 'const',
          value: data.customValue ?? 1,
          x: snappedX,
          y: snappedY,
        });
      }

      onCommitGraph(nextGraph);
    } catch {
      // Ignore malformed drag payload
    }
  };

  useEffect(() => {
    const onPaletteDrag = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: CircuitNode['kind']; gateType?: GateType; customValue?: 0 | 1 }>).detail;
      palettePointerDragRef.current = detail;
    };
    const onPaletteDragEnd = () => { palettePointerDragRef.current = null; };
    const onPointerUp = (event: globalThis.PointerEvent) => {
      const data = palettePointerDragRef.current;
      const container = containerRef.current;
      if (!data || !container) return;
      palettePointerDragRef.current = null;
      const rect = container.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      const world = screenToWorldCoord(event.clientX - rect.left, event.clientY - rect.top);
      const x = snapToGrid(world.x);
      const y = snapToGrid(world.y);
      const id = nextNodeId(graph, data.kind);
      let nextGraph = graph;
      if (data.kind === 'gate' && data.gateType) {
        nextGraph = addNode(graph, { id, kind: 'gate', gateType: data.gateType, inputCount: data.gateType === 'NOT' || data.gateType === 'BUFFER' ? 1 : 2, x, y });
      } else if (data.kind === 'input') {
        nextGraph = addNode(graph, { id, kind: 'input', label: 'IN', value: 0, x, y });
      } else if (data.kind === 'output') {
        nextGraph = addNode(graph, { id, kind: 'output', label: 'OUT', x, y });
      } else if (data.kind === 'clock') {
        nextGraph = addNode(graph, { id, kind: 'clock', label: 'CLK', halfPeriod: 5, startValue: 0, x, y });
      } else if (data.kind === 'const') {
        nextGraph = addNode(graph, { id, kind: 'const', value: data.customValue ?? 1, x, y });
      }
      onCommitGraph(nextGraph);
    };
    window.addEventListener('deam:circuit-palette-drag', onPaletteDrag);
    window.addEventListener('deam:circuit-palette-drag-end', onPaletteDragEnd);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('deam:circuit-palette-drag', onPaletteDrag);
      window.removeEventListener('deam:circuit-palette-drag-end', onPaletteDragEnd);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [graph, onCommitGraph, screenToWorldCoord]);

  return (
    <div
      ref={measureContainer}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="circuit-canvas-shell relative flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950 shadow-inner select-none"
    >
      {/* Screen Reader Live Region for Announcements */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Canvas Controls Toolbar */}
      <div className="circuit-canvas-toolbar flex shrink-0 flex-nowrap items-center gap-1.5 border-b p-2">
        <Button variant="ghost" size="sm" onClick={handleZoomIn} aria-label="Zoom in canvas">
          +
        </Button>
        <Button variant="ghost" size="sm" onClick={handleZoomOut} aria-label="Zoom out canvas">
          −
        </Button>
        <Button variant="ghost" size="sm" onClick={handleFitToContent} aria-label="Fit circuit to view">
          Fit
        </Button>
        <span className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300 px-1">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <span className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <Button className="circuit-delete-button" variant="secondary" size="sm" onClick={handleDeleteSelected} disabled={selectedNodeIds.length === 0 && selectedWireIds.length === 0}>Delete selected</Button>
        {onOpenHelpModal && (
          <>
            <span className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
            <Button variant="ghost" size="sm" onClick={onOpenHelpModal} aria-label="Open keyboard shortcuts help">
              Keyboard help
            </Button>
          </>
        )}
      </div>

      {/* Main SVG Viewport */}
      <svg
        tabIndex={0}
        role="region"
        aria-label="Digital Circuit Schematic Canvas. Use Tab and Arrow keys to navigate, Space to toggle inputs, Enter to wire."
        className="min-h-0 w-full flex-1 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleCanvasKeyDown}
      >
        <defs>
          {/* Subtle Grid Pattern */}
          <pattern id="canvas-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={2} cy={2} r={1} fill="currentColor" className="text-gray-300 dark:text-gray-800" />
          </pattern>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#canvas-grid)" />

        {/* Transformed Scene Graph */}
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* 1. Electrical Wires */}
          {graph.wires.map((wire) => {
            const fromNode = graph.nodes.find((n) => n.id === wire.from.nodeId);
            const toNode = graph.nodes.find((n) => n.id === wire.to.nodeId);
            if (!fromNode || !toNode) return null;

            const fromPos = pinPosition(fromNode, 'out', wire.from.pin);
            const toPos = pinPosition(toNode, 'in', wire.to.pin);
            const wireVal = values[fromNode.id] ?? 'X';

            return (
              <WireEdge
                key={wire.id}
                id={wire.id}
                fromNodeId={wire.from.nodeId}
                fromPin={wire.from.pin}
                toNodeId={wire.to.nodeId}
                toPin={wire.to.pin}
                fromPos={fromPos}
                toPos={toPos}
                value={wireVal}
                isSelected={selectedWireIds.includes(wire.id)}
                isHovered={hoveredWireId === wire.id}
                zoom={viewport.zoom}
                onSelectWire={handleSelectWire}
                onHoverWire={setHoveredWireId}
              />
            );
          })}

          {/* 2. Active Wiring Gesture Preview Line */}
          {wiring.active && (() => {
            const srcNode = graph.nodes.find((n) => n.id === wiring.fromNodeId);
            if (!srcNode) return null;
            const srcPos = pinPosition(srcNode, 'out', wiring.fromPin);
            const previewPath = wirePath(srcPos, wiring.currentMouseWorld);

            return (
              <path
                d={previewPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeDasharray="6,4"
                className="pointer-events-none animate-pulse"
              />
            );
          })()}

          {/* 3. Schematic Nodes */}
          {graph.nodes.map((node) => {
            const nodeVal = values[node.id] ?? 'X';
            const isSelected = selectedNodeIds.includes(node.id);
            const isFocused = focusedNodeId === node.id;
            const isWiringSource = wiring.active && wiring.fromNodeId === node.id;

            return (
              <g
                key={node.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleNodeDragStart(node.id, e);
                }}
              >
                <GateNode
                  node={node}
                  outputValue={nodeVal}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  isWiringActive={wiring.active}
                  isWiringSource={isWiringSource}
                  activeWiringTargetPin={wiring.targetNodeId === node.id ? wiring.targetPin : null}
                  onSelectNode={handleSelectNode}
                  onToggleInput={onToggleInput}
                  onPinClick={handlePinClick}
                  onPinPointerDown={handlePinPointerDown}
                  onPinKeyDown={(nId, dir, pIdx) => handlePinClick(nId, dir, pIdx)}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
