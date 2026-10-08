/**
 * @file useCanvasInteractions.ts
 * Interaction state machine and hook managing pan/zoom transforms, node dragging,
 * pin wiring gestures, keyboard topological navigation, and accessibility announcements.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react';
import type { CircuitGraph } from '../../types/circuit';
import {
  addWire,
  moveNodes,
  removeNode,
  removeWire,
  topologicalLevels,
} from '../../engine/circuit';
import {
  fitToContent,
  pinPosition,
  type Point,
  type Size,
  type Viewport,
  zoomAt,
} from '../../engine/circuit/geometry';

export interface UseCanvasInteractionsProps {
  readonly graph: CircuitGraph;
  readonly containerSize: Size;
  readonly onCommitGraph: (nextGraph: CircuitGraph) => void;
  readonly onToggleInput: (nodeId: string) => void;
}

export interface WiringState {
  readonly active: boolean;
  readonly fromNodeId: string;
  readonly fromPin: number;
  readonly currentMouseWorld: Point;
  readonly targetNodeId: string | null;
  readonly targetPin: number | null;
}

export function useCanvasInteractions({
  graph,
  containerSize,
  onCommitGraph,
  onToggleInput,
}: UseCanvasInteractionsProps) {
  // Viewport transform
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1.0 });

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<readonly string[]>([]);
  const [selectedWireIds, setSelectedWireIds] = useState<readonly string[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Wiring gesture state
  const [wiring, setWiring] = useState<WiringState>({
    active: false,
    fromNodeId: '',
    fromPin: 0,
    currentMouseWorld: { x: 0, y: 0 },
    targetNodeId: null,
    targetPin: null,
  });

  // Action announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>('');

  // Dragging state references
  const isPanningRef = useRef<boolean>(false);
  const isDraggingNodesRef = useRef<boolean>(false);
  const dragStartScreenRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef<Map<string, Point>>(new Map());

  // Topological node order for accessible keyboard navigation
  const topologicalNodeIds = useRef<string[]>([]);
  useEffect(() => {
    const topo = topologicalLevels(graph);
    const ordered = [...graph.nodes]
      .sort((a, b) => (topo.levels.get(a.id) ?? 0) - (topo.levels.get(b.id) ?? 0))
      .map((n) => n.id);
    topologicalNodeIds.current = ordered;
  }, [graph]);

  // Convert screen pixels to world coordinates
  const screenToWorldCoord = useCallback(
    (screenX: number, screenY: number): Point => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const center = { x: containerSize.width / 2, y: containerSize.height / 2 };
    setViewport((prev) => zoomAt(prev, center, 1.25));
  }, [containerSize]);

  const handleZoomOut = useCallback(() => {
    const center = { x: containerSize.width / 2, y: containerSize.height / 2 };
    setViewport((prev) => zoomAt(prev, center, 0.8));
  }, [containerSize]);

  const handleFitToContent = useCallback(() => {
    const fitted = fitToContent(graph, containerSize);
    setViewport(fitted);
    setAnnouncement('Fitted circuit to viewport');
  }, [graph, containerSize]);

  // Selection handlers
  const handleSelectNode = useCallback(
    (nodeId: string, e?: MouseEvent | KeyboardEvent) => {
      setFocusedNodeId(nodeId);
      if (e?.shiftKey) {
        setSelectedNodeIds((prev) =>
          prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
        );
      } else {
        setSelectedNodeIds([nodeId]);
        setSelectedWireIds([]);
      }
    },
    []
  );

  const handleSelectWire = useCallback((wireId: string, e?: MouseEvent | KeyboardEvent) => {
    if (e?.shiftKey) {
      setSelectedWireIds((prev) =>
        prev.includes(wireId) ? prev.filter((id) => id !== wireId) : [...prev, wireId]
      );
    } else {
      setSelectedWireIds([wireId]);
      setSelectedNodeIds([]);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedWireIds([]);
  }, []);

  // Delete selected elements
  const handleDeleteSelected = useCallback(() => {
    let nextGraph = graph;
    const deletedNodesCount = selectedNodeIds.length;
    const deletedWiresCount = selectedWireIds.length;

    for (const wireId of selectedWireIds) {
      nextGraph = removeWire(nextGraph, wireId);
    }
    for (const nodeId of selectedNodeIds) {
      nextGraph = removeNode(nextGraph, nodeId);
    }

    if (nextGraph !== graph) {
      onCommitGraph(nextGraph);
      setSelectedNodeIds([]);
      setSelectedWireIds([]);
      setAnnouncement(`Deleted ${deletedNodesCount} nodes and ${deletedWiresCount} wires`);
    }
  }, [graph, selectedNodeIds, selectedWireIds, onCommitGraph]);

  // Pin Wiring Handlers
  const handlePinClick = useCallback(
    (nodeId: string, direction: 'in' | 'out', pinIndex: number) => {
      if (!wiring.active) {
        if (direction === 'out') {
          const node = graph.nodes.find((n) => n.id === nodeId);
          if (!node) return;
          const pos = pinPosition(node, 'out', pinIndex);
          setWiring({
            active: true,
            fromNodeId: nodeId,
            fromPin: pinIndex,
            currentMouseWorld: pos,
            targetNodeId: null,
            targetPin: null,
          });
          setAnnouncement(`Started connection from ${nodeId} output pin`);
        }
      } else {
        // Complete connection if clicking an input pin
        if (direction === 'in') {
          const res = addWire(graph, {
            from: { nodeId: wiring.fromNodeId, pin: wiring.fromPin },
            to: { nodeId, pin: pinIndex },
          });

          if (res.ok) {
            onCommitGraph(res.graph);
            setAnnouncement(`Connected ${wiring.fromNodeId} output to ${nodeId} input ${pinIndex}`);
          } else {
            setAnnouncement(`Cannot connect: ${res.reason}`);
          }
          setWiring({
            active: false,
            fromNodeId: '',
            fromPin: 0,
            currentMouseWorld: { x: 0, y: 0 },
            targetNodeId: null,
            targetPin: null,
          });
        }
      }
    },
    [wiring, graph, onCommitGraph]
  );

  const cancelWiring = useCallback(() => {
    if (wiring.active) {
      setWiring({
        active: false,
        fromNodeId: '',
        fromPin: 0,
        currentMouseWorld: { x: 0, y: 0 },
        targetNodeId: null,
        targetPin: null,
      });
      setAnnouncement('Wiring canceled');
    }
  }, [wiring.active]);

  // Keyboard navigation
  const handleCanvasKeyDown = useCallback(
    (e: KeyboardEvent<SVGSVGElement>) => {
      // Escape cancels wiring or selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (wiring.active) {
          cancelWiring();
        } else {
          handleClearSelection();
        }
        return;
      }

      // Delete / Backspace removes selected items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Left / Right navigates through nodes in topological order
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const ids = topologicalNodeIds.current;
        if (ids.length === 0) return;

        if (e.altKey && focusedNodeId) {
          e.preventDefault();
          const curN = graph.nodes.find((n) => n.id === focusedNodeId);
          if (!curN) return;
          const dx = e.key === 'ArrowRight' ? 10 : -10;
          const moved = moveNodes(graph, [{ id: focusedNodeId, x: curN.x + dx, y: curN.y }]);
          onCommitGraph(moved);
          return;
        }

        e.preventDefault();
        const currentIdx = focusedNodeId ? ids.indexOf(focusedNodeId) : -1;
        const nextIdx =
          e.key === 'ArrowRight'
            ? (currentIdx + 1) % ids.length
            : (currentIdx - 1 + ids.length) % ids.length;
        const nextId = ids[nextIdx];
        if (nextId) {
          setFocusedNodeId(nextId);
          setSelectedNodeIds([nextId]);
          setSelectedWireIds([]);
          const n = graph.nodes.find((node) => node.id === nextId);
          if (n) setAnnouncement(`Focused ${n.kind} node ${n.label || n.id}`);
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.altKey && focusedNodeId) {
          e.preventDefault();
          const curN = graph.nodes.find((n) => n.id === focusedNodeId);
          if (!curN) return;
          const dy = e.key === 'ArrowDown' ? 10 : -10;
          const moved = moveNodes(graph, [{ id: focusedNodeId, x: curN.x, y: curN.y + dy }]);
          onCommitGraph(moved);
          return;
        }
      }

      // Space toggles a focused input node
      if (e.key === ' ' && focusedNodeId) {
        const node = graph.nodes.find((n) => n.id === focusedNodeId);
        if (node && node.kind === 'input') {
          e.preventDefault();
          onToggleInput(focusedNodeId);
        }
      }
    },
    [
      wiring.active,
      cancelWiring,
      handleClearSelection,
      handleDeleteSelected,
      focusedNodeId,
      graph,
      onCommitGraph,
      onToggleInput,
    ]
  );

  return {
    viewport,
    setViewport,
    selectedNodeIds,
    selectedWireIds,
    focusedNodeId,
    wiring,
    setWiring,
    announcement,
    setAnnouncement,
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
  };
}
