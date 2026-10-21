/**
 * @file KMapGrid.tsx
 * Keyboard-operable Karnaugh Map grid component supporting 2 to 5 variables,
 * Gray-code axis headers, cell cycling (0 -> 1 -> X), mouse painting,
 * accessible ARIA grid roles, and overlay slots for implicant loops.
 */

import {
  type FC,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { LogicValue } from '../../types/ast';
import {
  axisVariables,
  cellAt,
  colHeaderLabels,
  rowHeaderLabels,
} from '../../engine/kmap/layout';
import { KMapLayer5Var } from './KMapLayer5Var';
import { getCellGroupIndices, getCellGroupShadows, GroupBadges, type VisualGroup } from './GroupOverlay';

export interface KMapGridProps {
  readonly variableCount: number;
  readonly variableNames: readonly string[];
  readonly values: readonly LogicValue[];
  readonly onChangeValue?: (minterm: number, value: LogicValue) => void;
  readonly onClear?: () => void;
  readonly onFillFromTruthTable?: () => void;
  readonly hasTruthTable?: boolean;
  readonly onVariableCountChange?: (count: number) => void;
  readonly onVariableNamesChange?: (names: readonly string[]) => void;
  readonly readOnly?: boolean;
  readonly selectedCells?: readonly number[];
  readonly onToggleCellSelect?: (minterm: number) => void;
  readonly overlayGroups?: readonly VisualGroup[];
  readonly setupActions?: ReactNode;
  readonly highlightedCells?: readonly number[];
  readonly highlightLabel?: string;
}

export function cycleLogicValue(current: LogicValue): LogicValue {
  if (current === 0) return 1;
  if (current === 1) return 'X';
  return 0;
}

export const KMapGrid: FC<KMapGridProps> = ({
  variableCount,
  variableNames,
  values,
  onChangeValue,
  onClear,
  onFillFromTruthTable,
  hasTruthTable = false,
  onVariableCountChange,
  onVariableNamesChange,
  readOnly = false,
  selectedCells = [],
  onToggleCellSelect,
  overlayGroups = [],
  setupActions,
  highlightedCells = [],
  highlightLabel,
}) => {
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [paintValue, setPaintValue] = useState<LogicValue | null>(null);
  const [editingVars, setEditingVars] = useState<boolean>(false);
  const [varNamesInput, setVarNamesInput] = useState<string>(
    variableNames.join(', ')
  );
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleCellClick = (minterm: number) => {
    if (onToggleCellSelect) {
      onToggleCellSelect(minterm);
      return;
    }
    if (readOnly || !onChangeValue) return;
    const current = values[minterm] ?? 0;
    const next = cycleLogicValue(current);
    onChangeValue(minterm, next);
  };

  const handleMouseDown = (minterm: number) => {
    if (readOnly || onToggleCellSelect || !onChangeValue) return;
    setIsPainting(true);
    const current = values[minterm] ?? 0;
    const next = cycleLogicValue(current);
    setPaintValue(next);
    onChangeValue(minterm, next);
  };

  const handleMouseEnter = (minterm: number) => {
    if (!isPainting || paintValue === null || readOnly || onToggleCellSelect || !onChangeValue) return;
    onChangeValue(minterm, paintValue);
  };

  const handleVarNamesSubmit = () => {
    const split = varNamesInput
      .split(/[, ]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    if (split.length === variableCount && onVariableNamesChange) {
      onVariableNamesChange(split);
    }
    setEditingVars(false);
  };

  const rowLabels = rowHeaderLabels(variableCount);
  const colLabels = colHeaderLabels(variableCount);
  const axes = axisVariables(variableCount, variableNames);

  const getCellAriaLabel = useCallback(
    (m: number): string => {
      const assignments = variableNames
        .map((name, idx) => {
          const bit = (m >>> (variableCount - 1 - idx)) & 1;
          return `${name}=${bit}`;
        })
        .join(' ');
      const val = values[m] ?? 0;
      return `Cell ${assignments}, minterm ${m}, value ${val}`;
    },
    [variableCount, variableNames, values]
  );

  useEffect(() => {
    if (!isPainting) return;
    const onGlobalMouseUp = () => {
      setIsPainting(false);
      setPaintValue(null);
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isPainting]);

  return (
    <div className="workflow-stack">
      <section className="workflow-card">
      <header className="workflow-card-header">
        <div className="workflow-step-heading"><span>01</span><h3>Setup</h3></div>
        {setupActions}
      </header>
      <div className="workflow-card-body">
      {/* Grid Toolbar & Config */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <label htmlFor="kmap-var-count" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Variables:
          </label>
          <select
            id="kmap-var-count"
            value={variableCount}
            disabled={readOnly}
            onChange={(e) => onVariableCountChange?.(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {[2, 3, 4, 5].map((cnt) => (
              <option key={cnt} value={cnt}>
                {cnt} Variables ({cnt === 2 ? '2x2' : cnt === 3 ? '2x4' : cnt === 4 ? '4x4' : 'Dual 4x4'})
              </option>
            ))}
          </select>

          {/* Editable Variable Names */}
          {!editingVars ? (
            <button
              type="button"
              onClick={() => {
                setVarNamesInput(variableNames.join(', '));
                setEditingVars(true);
              }}
              title="Click to edit variable names"
              className="inline-flex items-center rounded-md px-2 py-1 text-xs font-mono text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              [{variableNames.join(', ')}]
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={varNamesInput}
                onChange={(e) => setVarNamesInput(e.target.value)}
                onBlur={handleVarNamesSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleVarNamesSubmit()}
                className="w-28 rounded-sm border border-blue-500 px-1 py-0.5 text-xs font-mono uppercase dark:bg-gray-900"
              />
              <button
                type="button"
                onClick={handleVarNamesSubmit}
                className="rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] text-white"
              >
                Set
              </button>
            </div>
          )}
        </div>

        {/* Clear & Fill Controls */}
        <div className="flex items-center gap-2">
          {hasTruthTable && onFillFromTruthTable && (
            <button
              type="button"
              onClick={onFillFromTruthTable}
              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
            >
              Fill from Truth Table
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              Clear Cells
            </button>
          )}
        </div>
      </div>
      </div>
      </section>

      <section className="workflow-card kmap-map-card">
        <header className="workflow-card-header"><div className="workflow-step-heading"><span>02</span><h3>Map</h3></div></header>
        <div className="workflow-card-body">
      {/* 5-variable dual layer layout */}
      {variableCount === 5 ? (
        <KMapLayer5Var
          variableNames={variableNames}
          values={values}
          selectedCells={selectedCells}
          highlightedCells={highlightedCells}
          highlightLabel={highlightLabel}
          onCellClick={handleCellClick}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          getCellAriaLabel={getCellAriaLabel}
          overlayGroups={overlayGroups}
        />
      ) : (
        /* Standard 2, 3, or 4 variable grid */
        <div ref={gridContainerRef} className="relative kmap-grid-scroll overflow-x-auto p-2">
          <div
            role="grid"
            aria-label={`${variableCount}-variable Karnaugh Map`}
            className="relative select-none border-collapse"
          >
            {/* Column Header Row */}
            <div role="row" className="flex items-end">
              {/* Top-Left Axis Label Corner */}
              <div
                role="columnheader"
                className="flex h-12 w-16 shrink-0 items-center justify-center border-b border-r border-gray-300 bg-gray-50 p-1 font-mono text-[11px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <div className="relative h-full w-full">
                  <span className="absolute bottom-0 left-0 text-[10px] text-gray-500">
                    {axes.rowVars.join('')}
                  </span>
                  <span className="absolute top-0 right-0 text-[10px] text-blue-600 dark:text-blue-400">
                    {axes.colVars.join('')}
                  </span>
                  <div className="absolute inset-0 border-b border-gray-300 [transform:rotate(36deg)] [transform-origin:top_left] dark:border-gray-700" />
                </div>
              </div>

              {/* Column Gray-Code Labels */}
              {colLabels.map((cLabel, cIdx) => (
                <div
                  key={`col-${cIdx}`}
                  role="columnheader"
                  className="flex h-8 w-14 sm:w-16 shrink-0 items-center justify-center border-b border-r border-gray-200 bg-gray-50 font-mono text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                  style={{ width: 'var(--kmap-cell-size)', height: 'calc(var(--kmap-cell-size) * .5)' }}
                >
                  {cLabel}
                </div>
              ))}
            </div>

            {/* Grid Body Rows */}
            {rowLabels.map((rLabel, rIdx) => (
              <div key={`row-${rIdx}`} role="row" className="flex">
                {/* Row Gray-Code Label Header */}
                <div
                  role="rowheader"
                  className="flex h-14 sm:h-16 w-16 shrink-0 items-center justify-center border-b border-r border-gray-300 bg-gray-50 font-mono text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {rLabel}
                </div>

                {/* Cells in Row */}
                {colLabels.map((_, cIdx) => {
                  const m = cellAt(rIdx, cIdx, 0, variableCount);
                  const val = values[m] ?? 0;
                  const isSelected = selectedCells.includes(m);
                  const isHighlighted = highlightedCells.includes(m);
                  const isDimmed = highlightedCells.length > 0 && !isHighlighted;

                  return (
                    <div
                      key={`cell-${m}`}
                      role="gridcell"
                      tabIndex={0}
                      aria-selected={isSelected}
                      data-groups={getCellGroupIndices(overlayGroups, m).map((index) => index + 1).join(',') || undefined}
                      style={{ width: 'var(--kmap-cell-size)', height: 'var(--kmap-cell-size)', ...(overlayGroups.some((group) => group.cellIndices.includes(m)) ? { '--group-shadows': getCellGroupShadows(overlayGroups, m) } : {}) } as CSSProperties}
                      data-dimmed={isDimmed || undefined}
                      data-value={String(val)}
                      aria-label={getCellAriaLabel(m)}
                      onClick={() => handleCellClick(m)}
                      onMouseDown={() => handleMouseDown(m)}
                      onMouseEnter={() => handleMouseEnter(m)}
                      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleCellClick(m);
                        } else if (e.key === '0' || e.key === '1' || e.key === 'x' || e.key === 'X') {
                          e.preventDefault();
                          const directVal: LogicValue = e.key === '0' ? 0 : e.key === '1' ? 1 : 'X';
                          onChangeValue?.(m, directVal);
                        }
                      }}
                      className={`kmap-cell relative flex h-14 sm:h-16 w-14 sm:w-16 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-r border-gray-200 transition-colors focus:z-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-gray-800 ${overlayGroups.some((group) => group.cellIndices.includes(m)) ? 'grouped' : ''} ${
                        isSelected
                          ? 'bg-blue-100 ring-2 ring-inset ring-blue-600 dark:bg-blue-950/70 dark:ring-blue-400'
                          : isHighlighted
                          ? 'bg-red-100 ring-2 ring-inset ring-red-600 dark:bg-red-950/70 dark:ring-red-500'
                          : 'bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900'
                      }`}
                    >
                      {/* Minterm Subscript Badge */}
                      <span className="absolute top-1 left-1.5 z-[3] text-[9px] font-mono text-gray-400 dark:text-gray-500">
                        {m}
                      </span>
                      <GroupBadges groups={overlayGroups} cellIndex={m} />

                      {/* Explicit Text Symbol */}
                      <span
                        className={`relative z-[3] text-lg font-bold font-mono ${
                          val === 1
                            ? 'text-blue-700 dark:text-blue-300'
                            : val === 'X'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {String(val)}
                      </span>

                      {/* Diagnostic highlight indicator */}
                      {isHighlighted && highlightLabel && (
                        <span className="absolute bottom-0.5 inset-x-0 text-center text-[8px] font-semibold text-red-600 dark:text-red-400">
                          {highlightLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        </div>
      )}
        </div>
      </section>
    </div>
  );
};
