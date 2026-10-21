/**
 * @file CircuitPage.tsx
 * Top-level Digital Circuit Schematic Simulator page component (Stage 8C).
 * Coordinates canvas and tabular netlist editors, discrete-event simulation controls,
 * K-Map expression synthesis banners, diagnostics, timing diagrams, and project persistence.
 */

import { useState, type FC, useCallback } from 'react';
import type { CircuitGraph, CircuitNode, GateType } from '../../types/circuit';
import { addNode, createEmptyCircuit, nextNodeId } from '../../engine/circuit';
import { layoutCircuit } from '../../engine/circuit/layout';
import type { GeneratorStyle } from '../../engine/circuit/generator';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import {
  createCircuitStorePatch,
  getAvailableExpressionFromProject,
  getAvailableStylesForExpression,
  synthesizeAndLayoutCircuit,
} from './circuitModuleLogic';
import { useUndoRedo } from './useUndoRedo';
import { useCircuitSimulation } from './useCircuitSimulation';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { CircuitListEditor } from './CircuitListEditor';
import { CircuitInspector } from './CircuitInspector';
import { SimulationControls } from './SimulationControls';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { TruthTableCompare } from './TruthTableCompare';
import { LiveCircuitTable } from './LiveCircuitTable';
import { TimingDiagram } from './TimingDiagram';
import { CircuitSynthesisBanner } from './CircuitSynthesisBanner';
import { KeyboardHelpModal } from './KeyboardHelpModal';

export const CircuitPage: FC = () => {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);
  const pushToast = useUiStore((s) => s.pushToast);

  // Initialize circuit graph from project store or empty
  const initialCircuit = project.circuit ?? createEmptyCircuit();

  // Undo / Redo history state
  const {
    graph,
    canUndo,
    canRedo,
    commit,
    undo,
    redo,
    replace,
    beginTransaction,
    updateTransaction,
    commitTransaction,
  } = useUndoRedo(initialCircuit);

  // Discrete-event simulation hook
  const sim = useCircuitSimulation(graph);

  // Selected element state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

  // View Tabs
  const [editorTab, setEditorTab] = useState<'canvas' | 'list'>('canvas');
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'diagnostics' | 'truth-table' | 'timing'>('inspector');

  // Keyboard Help Modal
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);

  // Synthesizer banner state
  const availableExpr = getAvailableExpressionFromProject(project);
  const availableStyles = availableExpr ? getAvailableStylesForExpression(availableExpr.isPos) : [];
  const [selectedStyle, setSelectedStyle] = useState<GeneratorStyle>(
    availableExpr?.isPos ? 'pos-or-and' : 'sop-and-or'
  );

  // Synchronize graph to project store
  const handleCommitGraph = useCallback(
    (nextGraph: CircuitGraph) => {
      commit(nextGraph);
      applyPatch(createCircuitStorePatch(nextGraph));
    },
    [commit, applyPatch]
  );

  // Handle adding node from Palette
  const handleAddNodeFromPalette = useCallback(
    (kind: CircuitNode['kind'], gateType?: GateType, customValue?: 0 | 1) => {
      const count = graph.nodes.length;
      const x = 120 + (count % 5) * 140;
      const y = 80 + Math.floor(count / 5) * 100;

      let nextGraph = graph;
      if (kind === 'gate' && gateType) {
        nextGraph = addNode(nextGraph, {
          id: nextNodeId(nextGraph, 'gate'),
          kind: 'gate',
          gateType,
          inputCount: gateType === 'NOT' || gateType === 'BUFFER' ? 1 : 2,
          x,
          y,
        });
      } else if (kind === 'input') {
        nextGraph = addNode(nextGraph, {
          id: nextNodeId(nextGraph, 'input'),
          kind: 'input',
          label: `IN_${count + 1}`,
          value: 0,
          x,
          y,
        });
      } else if (kind === 'output') {
        nextGraph = addNode(nextGraph, {
          id: nextNodeId(nextGraph, 'output'),
          kind: 'output',
          label: `OUT_${count + 1}`,
          x,
          y,
        });
      } else if (kind === 'clock') {
        nextGraph = addNode(nextGraph, {
          id: nextNodeId(nextGraph, 'clock'),
          kind: 'clock',
          label: `CLK_${count + 1}`,
          halfPeriod: 5,
          startValue: 0,
          x,
          y,
        });
      } else if (kind === 'const') {
        nextGraph = addNode(nextGraph, {
          id: nextNodeId(nextGraph, 'const'),
          kind: 'const',
          value: customValue ?? 1,
          x,
          y,
        });
      }

      handleCommitGraph(nextGraph);
      pushToast({ level: 'info', title: 'Node Added', message: `Added ${gateType || kind} node to schematic.` });
    },
    [graph, handleCommitGraph, pushToast]
  );

  // Handle loading example
  const handleLoadExample = useCallback(
    (exampleGraph: CircuitGraph, title: string) => {
      const laidOutExample = layoutCircuit(exampleGraph);
      replace(laidOutExample, { undoable: true });
      applyPatch(createCircuitStorePatch(laidOutExample));
      setCanvasGeneration((generation) => generation + 1);
      pushToast({ level: 'success', title: 'Example Loaded', message: `Loaded reference circuit '${title}'.` });
    },
    [replace, applyPatch, pushToast]
  );

  // Auto-Layout
  const handleAutoLayout = useCallback(() => {
    const nextGraph = layoutCircuit(graph);
    replace(nextGraph, { undoable: true });
    applyPatch(createCircuitStorePatch(nextGraph));
    pushToast({ level: 'info', title: 'Auto-Layout', message: `Organized ${graph.nodes.length} nodes across topological levels.` });
  }, [graph, replace, applyPatch, pushToast]);

  // Generate Circuit from K-Map Expression
  const handleGenerateCircuit = useCallback(() => {
    if (!availableExpr) return;
    const vars = project.variables?.length ? project.variables : ['A', 'B', 'C', 'D'];
    const res = synthesizeAndLayoutCircuit(availableExpr.expression, vars, selectedStyle, 'F');

    if (res) {
      replace(res.graph, { undoable: true });
      applyPatch(createCircuitStorePatch(res.graph));
      pushToast({
        level: 'success',
        title: 'Circuit Synthesized',
        message: `Generated schematic using style: ${res.appliedStyle}.`,
      });
    } else {
      pushToast({
        level: 'error',
        title: 'Synthesis Failed',
        message: 'Could not synthesize circuit from the current expression.',
      });
    }
  }, [availableExpr, project.variables, selectedStyle, replace, applyPatch, pushToast]);

  return (
    <div className="space-y-6">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <span className="eyebrow">MODULE 04 · CIRCUIT SIMULATOR</span>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Digital Circuit Schematic Simulator
          </h2>
          <p className="module-description">Build, simulate, and inspect digital logic circuits.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo circuit modification (Ctrl+Z)"
          >
            ↶ Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo circuit modification (Ctrl+Y)"
          >
            ↷ Redo
          </Button>
          <span className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoLayout}
            aria-label="Automatically lay out circuit gates and route wires"
          >
            Auto-Layout
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHelpOpen(true)}
            aria-label="Open keyboard shortcuts help modal"
          >
            Keyboard Help
          </Button>
        </div>
      </div>

      {/* Upstream K-Map / Boolean Minimized Expression Banner */}
      {availableExpr && (
        <CircuitSynthesisBanner
          availableExpr={availableExpr}
          availableStyles={availableStyles}
          selectedStyle={selectedStyle}
          onSelectStyle={setSelectedStyle}
          onGenerate={handleGenerateCircuit}
        />
      )}

      {/* Simulation Controls Bar */}
      <SimulationControls
        time={sim.time}
        status={sim.status}
        oscillationMessage={sim.oscillationMessage}
        isPlaying={sim.isPlaying}
        delayMode={sim.delayMode}
        allowFeedback={sim.allowFeedback}
        onStep={sim.step}
        onRunFor={sim.runFor}
        onRunToNextEvent={sim.runToNextEvent}
        onPlay={sim.play}
        onPause={sim.pause}
        onReset={sim.reset}
        onSetDelayMode={sim.setDelayMode}
        onSetAllowFeedback={sim.setAllowFeedback}
      />

      {/* Main Studio Body: Palette | Editor Viewport | Right Inspector/Diagnostics */}
      <div className="circuit-workbench grid grid-cols-1 gap-6 items-start">
        {/* Left Column: Component Palette */}
        <div className="circuit-palette-column">
          <Palette onAddNode={handleAddNodeFromPalette} onLoadExample={handleLoadExample} />
        </div>

        {/* Center Column: Editor (Canvas vs List Editor) */}
        <div className="space-y-3 circuit-editor-column">
          <Tabs
            tabs={[
              {
                id: 'canvas',
                label: 'Schematic Canvas',
                content: (
                    <Canvas
                    key={canvasGeneration}
                    graph={graph}
                    values={sim.values}
                    onCommitGraph={handleCommitGraph}
                    onBeginTransaction={beginTransaction}
                    onUpdateTransaction={updateTransaction}
                    onCommitTransaction={commitTransaction}
                    onToggleInput={(id) => {
                      const currentVal = sim.values[id] ?? 0;
                      const nextVal = currentVal === 0 ? 1 : 0;
                      sim.setInput(id, nextVal);
                    }}
                    onOpenHelpModal={() => setIsHelpOpen(true)}
                    onDeleteResult={(deleted) => {
                      if (deleted) {
                        setSelectedNodeId(null);
                        setSelectedWireId(null);
                      }
                      if (deleted) pushToast({ level: 'success', message: 'Component deleted.' });
                    }}
                  />
                ),
              },
              {
                id: 'list',
                label: 'List & Table Editor',
                content: (
                  <CircuitListEditor
                    graph={graph}
                    values={sim.values}
                    onCommitGraph={handleCommitGraph}
                    onToggleInput={(id) => {
                      const currentVal = sim.values[id] ?? 0;
                      const nextVal = currentVal === 0 ? 1 : 0;
                      sim.setInput(id, nextVal);
                    }}
                  />
                ),
              },
            ]}
            defaultValue={editorTab}
            onChange={(id) => setEditorTab(id as 'canvas' | 'list')}
          />
          <div className="circuit-wire-legend" aria-label="Wire value legend">
            <span><i className="wire-legend-high" />Logic High (1)</span>
            <span><i className="wire-legend-low" />Logic Low (0)</span>
            <span><i className="wire-legend-unknown" />Unknown / Floating (X)</span>
          </div>
        </div>

        {/* Right Column: Inspector / Diagnostics / Truth Table / Timing */}
        <div className="space-y-3 circuit-inspector-column">
          <Tabs
            tabs={[
              {
                id: 'inspector',
                label: 'Inspector',
                content: (
                  <CircuitInspector
                    graph={graph}
                    selectedNodeId={selectedNodeId}
                    selectedWireId={selectedWireId}
                    onCommitGraph={handleCommitGraph}
                    onDeselect={() => {
                      setSelectedNodeId(null);
                      setSelectedWireId(null);
                    }}
                  />
                ),
              },
              {
                id: 'diagnostics',
                label: `Diagnostics (${sim.diagnostics.length})`,
                content: (
                  <DiagnosticsPanel
                    diagnostics={sim.diagnostics}
                    onSelectDiagnosticElements={(nodeIds, wireIds) => {
                      if (nodeIds[0]) setSelectedNodeId(nodeIds[0]);
                      if (wireIds[0]) setSelectedWireId(wireIds[0]);
                      setRightPanelTab('inspector');
                    }}
                  />
                ),
              },
              {
                id: 'truth-table',
                label: 'Truth Table',
                content: <TruthTableCompare graph={graph} project={project} />,
              },
              {
                id: 'timing',
                label: 'Timing Waveforms',
                content: <TimingDiagram graph={graph} trace={sim.trace} currentTime={sim.time} />,
              },
            ]}
            defaultValue={rightPanelTab}
            onChange={(id) => setRightPanelTab(id as typeof rightPanelTab)}
          />
        </div>
      </div>

      <LiveCircuitTable graph={graph} values={sim.values} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
