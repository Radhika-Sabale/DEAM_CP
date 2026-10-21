/**
 * @file KMapPage.tsx
 * Top-level Karnaugh Map module page coordinating grid cell manipulation,
 * dual-layer 5-variable maps, prime implicant decomposition overlays,
 * Quine-McCluskey inspections, interactive student practice mode,
 * project store state synchronization, and pipeline handoffs.
 */

import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { KMapGroup, KMapSolution } from '../../engine/kmap/types';
import { solvePOS, solveSOP } from '../../engine/kmap/solver';
import { buildTruthTable, toString } from '../../engine/boolean';
import { useProjectStore } from '../../store/projectStore';
import { SendToNextButton } from '../../components/layout/SendToNextButton';
import { KMapGrid } from './KMapGrid';
import { GroupOverlay, groupsWithCareCells, type VisualGroup } from './GroupOverlay';
import { SolutionPanel } from './SolutionPanel';
import { QmTablePanel } from './QmTablePanel';
import { StudentModePanel } from './StudentModePanel';

export const KMapPage: FC = () => {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);
  const expressionVariables = useMemo(() => {
    const names = [...(project.variables ?? [])];
    for (const name of ['A', 'B', 'C', 'D', 'E']) if (names.length < 2 && !names.includes(name)) names.push(name);
    return names;
  }, [project.variables]);

  // Initialize variables & cells from project or defaults
  const initialVarCount = useMemo(() => {
    const pVars = project.kmap?.variables ?? project.truthTable?.variables ?? project.variables ?? [];
    return pVars.length >= 2 && pVars.length <= 5 ? pVars.length : project.expression && pVars.length < 5 ? Math.max(2, pVars.length) : 4;
  }, [project.kmap?.variables, project.truthTable?.variables, project.variables, project.expression]);
  const expressionTable = useMemo(() => {
    if (!project.expression) return null;
    if (expressionVariables.length > 5) return null;
    const result = buildTruthTable(project.expression, expressionVariables);
    return result.ok ? result.table : null;
  }, [project.expression, expressionVariables]);

  const [varCount, setVarCount] = useState<number>(initialVarCount);
  const [varNames, setVarNames] = useState<string[]>(
    project.kmap?.variables && project.kmap.variables.length === initialVarCount
      ? [...project.kmap.variables]
      : project.expression && expressionVariables.length === initialVarCount
        ? expressionVariables
        : ['A', 'B', 'C', 'D', 'E'].slice(0, initialVarCount)
  );

  const [cells, setCells] = useState<LogicValue[]>(() => {
    const total = 1 << initialVarCount;
    if (project.kmap?.cells && project.kmap.cells.length === total) {
      return [...project.kmap.cells];
    }
    if (project.kmap?.cells && project.kmap.cells.length === total) {
      setCells([...project.kmap.cells]);
    } else if (project.truthTable?.rows && project.truthTable.rows.length === total) {
      return project.truthTable.rows.map((r) => r.output);
    }
    if (expressionTable?.rows && expressionTable.rows.length === total) return expressionTable.rows.map((row) => row.output);
    return Array.from({ length: total }, () => 0 as LogicValue);
  });

  const [activeTab, setActiveTab] = useState<'explore' | 'student'>('explore');
  const [targetForm, setTargetForm] = useState<'SOP' | 'POS'>('SOP');
  const [selectedCoverIdx, setSelectedCoverIdx] = useState<number>(0);
  const [sopSolution, setSopSolution] = useState<KMapSolution | null>(null);
  const [posSolution, setPosSolution] = useState<KMapSolution | null>(null);

  // Student mode state
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [studentGroups, setStudentGroups] = useState<number[][]>(() => {
    return project.kmap?.studentGroups ? project.kmap.studentGroups.map((g) => [...g.cellIndices]) : [];
  });
  const [highlightedCells, setHighlightedCells] = useState<number[]>([]);
  const [highlightLabel, setHighlightLabel] = useState<string | undefined>(undefined);
  const [revealedSolution, setRevealedSolution] = useState<boolean>(false);
  const [copiedExpression, setCopiedExpression] = useState(false);

  // Derive minterms and don't-cares
  const minterms = useMemo(() => {
    const m: number[] = [];
    cells.forEach((val, idx) => {
      if (val === 1) m.push(idx);
    });
    return m;
  }, [cells]);

  const dontCares = useMemo(() => {
    const d: number[] = [];
    cells.forEach((val, idx) => {
      if (val === 'X') d.push(idx);
    });
    return d;
  }, [cells]);

  // Solver execution
  const executeSolve = useCallback(() => {
    const sSop = solveSOP(varCount, minterms, dontCares, varNames);
    const sPos = solvePOS(varCount, minterms, dontCares, varNames);

    const sopSol = sSop.ok ? sSop.solution : null;
    const posSol = sPos.ok ? sPos.solution : null;

    setSopSolution(sopSol);
    setPosSolution(posSol);
    setSelectedCoverIdx(0);

    // Write back minimal results to project store
    if (sopSol && posSol) {
      const kmapGroups: readonly KMapGroup[] = sopSol.groups;
      applyPatch({
        variables: varNames,
        kmap: {
          variables: varNames,
          cells,
          groups: kmapGroups.map((g, i) => ({
            id: `G${i + 1}`,
            cellIndices: g.cellIndices,
            termString: g.termString,
          })),
          studentGroups: studentGroups.map((sg, i) => ({
            id: `SG${i + 1}`,
            cellIndices: sg,
            termString: `SG${i + 1}`,
          })),
        },
        minimizedExpression: {
          sop: { ast: sopSol.expression, text: sopSol.expressionString },
          pos: { ast: posSol.expression, text: posSol.expressionString },
        },
      });
    }
  }, [varCount, minterms, dontCares, varNames, cells, studentGroups, applyPatch]);

  // Sync local KMap state when active project changes (e.g. from ExamplesMenu or ProjectIO)
  useEffect(() => {
    const pVars = project.kmap?.variables ?? project.truthTable?.variables ?? project.variables ?? [];
    const count = pVars.length >= 2 && pVars.length <= 5 ? pVars.length : project.expression && pVars.length < 5 ? Math.max(2, pVars.length) : 4;
    setVarCount(count);
    setVarNames(pVars.length === count ? [...pVars] : project.expression && expressionVariables.length === count ? expressionVariables : ['A', 'B', 'C', 'D', 'E'].slice(0, count));
    const total = 1 << count;
    if (project.kmap?.cells && project.kmap.cells.length === total) {
      setCells([...project.kmap.cells]);
    } else if (project.truthTable?.rows && project.truthTable.rows.length === total) {
      const newCells: LogicValue[] = Array.from({ length: total }, () => 0 as LogicValue);
      project.truthTable.rows.forEach((r) => {
        if (r.index < total) newCells[r.index] = r.output;
      });
      setCells(newCells);
    } else if (expressionTable?.rows && expressionTable.rows.length === total) {
      setCells(expressionTable.rows.map((row) => row.output));
    } else {
      setCells(Array.from({ length: total }, () => 0 as LogicValue));
    }
    setSelectedCells([]);
    setStudentGroups(project.kmap?.studentGroups ? project.kmap.studentGroups.map((g) => [...g.cellIndices]) : []);
    setHighlightedCells([]);
    setRevealedSolution(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Auto-solve on initial load if unsolved or cells change
  useEffect(() => {
    executeSolve();
  }, [varCount, cells, executeSolve]);

  const handleCellChange = (minterm: number, val: LogicValue) => {
    setCells((prev) => {
      const next = [...prev];
      next[minterm] = val;
      return next;
    });
  };

  const handleToggleCellSelect = (m: number) => {
    setSelectedCells((prev) => (prev.includes(m) ? prev.filter((c) => c !== m) : [...prev, m].sort((a, b) => a - b)));
  };

  const handleClearCells = () => {
    setCells(Array.from({ length: 1 << varCount }, () => 0 as LogicValue));
    setSelectedCells([]);
    setStudentGroups([]);
  };

  const handleFillFromTruthTable = () => {
    if (!project.truthTable) return;
    const tt = project.truthTable;
    const total = 1 << varCount;
    const newCells: LogicValue[] = Array.from({ length: total }, () => 0 as LogicValue);
    tt.rows.forEach((r) => {
      if (r.index < total) newCells[r.index] = r.output;
    });
    setCells(newCells);
  };

  // Convert active solution groups to VisualGroups for GroupOverlay
  const activeSolution = targetForm === 'SOP' ? sopSolution : posSolution;
  const overlayGroups: VisualGroup[] = useMemo(() => {
    if (activeTab === 'student') {
      if (revealedSolution && activeSolution) {
        return activeSolution.groups.map((g, i) => ({
          id: `sol-${i + 1}`,
          cube: g.cube,
          cellIndices: g.cellIndices,
          termString: g.termString,
        }));
      }
      return groupsWithCareCells(studentGroups.map((sg, i) => ({
        id: `sg-${i + 1}`,
        cellIndices: sg,
        termString: `G${i + 1}`,
      })), cells, targetForm === 'SOP' ? 1 : 0);
    }

    if (!activeSolution) return [];
    const cover = activeSolution.allMinimalCovers[selectedCoverIdx] ?? activeSolution.primarySolution;
    return groupsWithCareCells(cover.primeImplicants.map((pi) => ({
      id: pi.id,
      cube: pi.cube,
      cellIndices: pi.minterms,
      termString: pi.termString,
      isEssential: activeSolution.essentialPrimeImplicants.some((e) => e.id === pi.id),
    })), cells, targetForm === 'SOP' ? 1 : 0);
  }, [activeTab, revealedSolution, activeSolution, studentGroups, selectedCoverIdx, cells, targetForm]);

  return (
    <div className="workflow-stack">
      {/* Header and Module Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Karnaugh Map Minimizer
          </h2>
        </div>
      </div>
      {project.expression && (project.variables?.length ?? 0) > 5 && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Karnaugh maps support up to 5 variables. Simplify the expression or remove variables before sending it to this solver.</p>}

      {/* Setup and Map cards */}
  <div className="kmap-workbench-grid">
    <div className="kmap-setup-map">
            <KMapGrid
              variableCount={varCount}
              variableNames={varNames}
              values={cells}
              onChangeValue={handleCellChange}
              onClear={handleClearCells}
              onFillFromTruthTable={handleFillFromTruthTable}
              hasTruthTable={!!project.truthTable}
              onVariableCountChange={(cnt) => {
                setVarCount(cnt);
                setVarNames(['A', 'B', 'C', 'D', 'E'].slice(0, cnt));
                setCells(Array.from({ length: 1 << cnt }, () => 0 as LogicValue));
                setSelectedCells([]);
                setStudentGroups([]);
              }}
              onVariableNamesChange={(names) => setVarNames([...names])}
              selectedCells={activeTab === 'student' ? selectedCells : []}
              onToggleCellSelect={activeTab === 'student' ? handleToggleCellSelect : undefined}
              highlightedCells={highlightedCells}
              highlightLabel={highlightLabel}
              overlayGroups={overlayGroups}
              setupActions={
                <div className="seg" role="group" aria-label="Karnaugh map mode">
                  <button type="button" aria-pressed={activeTab === 'explore'} onClick={() => { setActiveTab('explore'); setSelectedCells([]); setHighlightedCells([]); setRevealedSolution(false); }}>Explore &amp; Solve</button>
                  <button type="button" aria-pressed={activeTab === 'student'} onClick={() => { setActiveTab('student'); setSelectedCells([]); setHighlightedCells([]); }}>Student Practice Mode</button>
                </div>
              }
            />

            {/* Implicants Legend */}
            <div className="kmap-legend">
              <GroupOverlay
                groups={overlayGroups}
                variableCount={varCount}
                showLegend={true}
                onGroupHover={(indices) => setHighlightedCells(indices ? [...indices] : [])}
              />
            </div>
      </div>

        {/* Solver and details follow the map in workflow order */}
        <div className="workflow-stack kmap-solution-column">
          {activeTab === 'explore' ? (
            <>
              <section className="workflow-card">
                <header className="workflow-card-header"><div className="workflow-step-heading"><h3>Simplified expression</h3></div><button type="button" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold dark:border-gray-700" onClick={() => {
                  const text = activeSolution?.expressionString ?? '';
                  if (text) void navigator.clipboard?.writeText(text).then(() => { setCopiedExpression(true); window.setTimeout(() => setCopiedExpression(false), 1200); });
                }} disabled={!activeSolution}>{copiedExpression ? 'Copied' : 'Copy'}</button></header>
                <div className="workflow-card-body space-y-3 text-sm">
                  <p><strong>Original:</strong> <span className="font-mono">{project.expression ? toString(project.expression) : 'Set the map cells to define a function.'}</span></p>
                  <p><strong>Minimal {targetForm}:</strong> <span className="font-mono">{activeSolution?.expressionString ?? 'Solve the map to get a result.'}</span></p>
                  <p><strong>Minterms:</strong> <span className="font-mono">{minterms.length ? `Σm(${minterms.join(', ')})` : '= 0'}</span></p>
                  <p><strong>Groups:</strong> {activeSolution?.groups.map((group) => group.termString).join(' + ') || (activeSolution?.expressionString === '1' ? '= 1' : 'No groups required.')}</p>
                </div>
              </section>
              <SolutionPanel
                sopSolution={sopSolution}
                posSolution={posSolution}
                selectedForm={targetForm}
                onSelectForm={setTargetForm}
                selectedCoverIndex={selectedCoverIdx}
                onSelectCoverIndex={setSelectedCoverIdx}
                onSolve={executeSolve}
                onHighlightGroup={(indices) => setHighlightedCells(indices ? [...indices] : [])}
              />
              {activeSolution && (
                <QmTablePanel
                  solution={activeSolution}
                  onHighlightGroup={(indices) => setHighlightedCells([...indices])}
                  activeHighlightCells={highlightedCells}
                />
              )}
            </>
          ) : (
            <StudentModePanel
              variableCount={varCount}
              variableNames={varNames}
              minterms={minterms}
              dontCares={dontCares}
              selectedCells={selectedCells}
              onClearSelection={() => setSelectedCells([])}
              studentGroups={studentGroups}
              onAddGroup={(g) => setStudentGroups((prev) => [...prev, [...g]])}
              onRemoveGroup={(idx) => setStudentGroups((prev) => prev.filter((_, i) => i !== idx))}
              onResetStudentGroups={() => setStudentGroups([])}
              onSetHighlight={(c, lbl) => {
                setHighlightedCells(c ? [...c] : []);
                setHighlightLabel(lbl);
              }}
              onRevealSolution={() => setRevealedSolution(true)}
              solverSolution={activeSolution}
              mode={targetForm}
              onModeChange={setTargetForm}
            />
          )}

          {/* Pipeline Handoff Footer Line */}
          <div className="workflow-card kmap-handoff-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Carried over to Circuit Simulator:
                </span>{' '}
                Minimal {targetForm} expression (
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {activeSolution?.expressionString || 'unsolved'}
                </span>
                ) with {activeSolution?.primarySolution.termCount ?? 0} terms and{' '}
                {activeSolution?.primarySolution.literalCount ?? 0} literals.
              </div>
              <SendToNextButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
