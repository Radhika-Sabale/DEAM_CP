/**
 * @file KMapLayer5Var.tsx
 * Dual-layer 4x4 grid layout for 5-variable Karnaugh maps, rendering
 * Layer 0 (A = 0) and Layer 1 (A = 1) side by side with inter-layer
 * adjacency explanations, keyboard navigation, and overlay slots.
 */

import { type FC, type KeyboardEvent } from 'react';
import type { LogicValue } from '../../types/ast';
import {
  axisVariables,
  cellAt,
  colHeaderLabels,
  rowHeaderLabels,
} from '../../engine/kmap/layout';
import { CellGroupOutline, getCellGroupIndices, GroupBadges, type VisualGroup } from './GroupOverlay';

export interface KMapLayer5VarProps {
  readonly variableNames: readonly string[];
  readonly values: readonly LogicValue[];
  readonly selectedCells?: readonly number[];
  readonly highlightedCells?: readonly number[];
  readonly highlightLabel?: string;
  readonly onCellClick: (minterm: number) => void;
  readonly onMouseDown: (minterm: number) => void;
  readonly onMouseEnter: (minterm: number) => void;
  readonly getCellAriaLabel: (minterm: number) => string;
  readonly overlayGroups?: readonly VisualGroup[];
}

export const KMapLayer5Var: FC<KMapLayer5VarProps> = ({
  variableNames,
  values,
  selectedCells = [],
  highlightedCells = [],
  highlightLabel,
  onCellClick,
  onMouseDown,
  onMouseEnter,
  getCellAriaLabel,
  overlayGroups = [],
}) => {
  const rowLabels = rowHeaderLabels(5);
  const colLabels = colHeaderLabels(5);
  const axes = axisVariables(5, variableNames);
  const layerVar = axes.layerVar ?? 'A';

  const renderSingleLayer = (layerIndex: 0 | 1) => {
    return (
      <div className="flex flex-col items-center">
        {/* Layer Header Title */}
        <div className="mb-2 rounded-md bg-blue-50 px-3 py-1 text-center font-mono text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          Layer {layerVar} = {layerIndex}
        </div>

        {/* 4x4 Grid Container */}
        <div className="relative inline-block overflow-x-auto border-collapse">
          <div
            role="grid"
            aria-label={`5-variable Karnaugh Map Layer ${layerVar}=${layerIndex}`}
            className="relative select-none border-collapse"
          >
            {/* Column Header Row */}
            <div role="row" className="flex items-end">
              {/* Corner Axis Label */}
              <div
                role="columnheader"
                className="flex h-12 w-14 shrink-0 items-center justify-center border-b border-r border-gray-300 bg-gray-50 p-1 font-mono text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <div className="relative h-full w-full">
                  <span className="absolute bottom-0 left-0 text-[9px] text-gray-500">
                    {axes.rowVars.join('')}
                  </span>
                  <span className="absolute top-0 right-0 text-[9px] text-blue-600 dark:text-blue-400">
                    {axes.colVars.join('')}
                  </span>
                  <div className="absolute inset-0 border-b border-gray-300 [transform:rotate(40deg)] [transform-origin:top_left] dark:border-gray-700" />
                </div>
              </div>

              {/* Column Gray-Code Labels */}
              {colLabels.map((cLabel, cIdx) => (
                <div
                  key={`col-${cIdx}`}
                  role="columnheader"
                  className="flex h-7 w-12 sm:w-14 shrink-0 items-center justify-center border-b border-r border-gray-200 bg-gray-50 font-mono text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                >
                  {cLabel}
                </div>
              ))}
            </div>

            {/* Grid Body Rows */}
            {rowLabels.map((rLabel, rIdx) => (
              <div key={`row-${rIdx}`} role="row" className="flex">
                {/* Row Header */}
                <div
                  role="rowheader"
                  className="flex h-12 sm:h-14 w-14 shrink-0 items-center justify-center border-b border-r border-gray-300 bg-gray-50 font-mono text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {rLabel}
                </div>

                {/* Cells */}
                {colLabels.map((_, cIdx) => {
                  const m = cellAt(rIdx, cIdx, layerIndex, 5);
                  const val = values[m] ?? 0;
                  const isSelected = selectedCells.includes(m);
                  const isHighlighted = highlightedCells.includes(m);
                  const isDimmed = highlightedCells.length > 0 && !isHighlighted;

                  return (
                    <div
                      key={`cell-${m}`}
                      role="gridcell"
                      tabIndex={0}
                      data-dimmed={isDimmed || undefined}
                      data-groups={getCellGroupIndices(overlayGroups, m).map((index) => index + 1).join(',') || undefined}
                      aria-selected={isSelected}
                      aria-label={getCellAriaLabel(m)}
                      onClick={() => onCellClick(m)}
                      onMouseDown={() => onMouseDown(m)}
                      onMouseEnter={() => onMouseEnter(m)}
                      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          onCellClick(m);
                        }
                      }}
                      className={`kmap-cell relative flex h-12 sm:h-14 w-12 sm:w-14 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-r border-gray-200 transition-colors focus:z-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-gray-800 ${
                        isSelected
                          ? 'bg-blue-100 ring-2 ring-inset ring-blue-600 dark:bg-blue-950/70 dark:ring-blue-400'
                          : isHighlighted
                          ? 'bg-red-100 ring-2 ring-inset ring-red-600 dark:bg-red-950/70 dark:ring-red-500'
                          : 'bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900'
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 z-[3] text-[8px] font-mono text-gray-400 dark:text-gray-500">
                        {m}
                      </span>
                      <CellGroupOutline key={`outline-${overlayGroups.map((group) => `${group.id}:${group.cellIndices.join(',')}`).join('|')}`} groups={overlayGroups} cellIndex={m} />
                      <GroupBadges key={`badges-${overlayGroups.map((group) => `${group.id}:${group.cellIndices.join(',')}`).join('|')}`} groups={overlayGroups} cellIndex={m} />
                      <span
                        className={`kmap-cell-value relative z-[3] text-base font-bold font-mono ${
                          val === 1
                            ? 'text-blue-700 dark:text-blue-300'
                            : val === 'X'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {String(val)}
                      </span>
                      {isHighlighted && highlightLabel && (
                        <span className="absolute bottom-0.5 inset-x-0 text-center text-[7px] font-semibold text-red-600 dark:text-red-400">
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
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Side-by-Side Layers */}
      <div className="kmap-layer-pair flex flex-col items-center justify-center gap-6 lg:items-start">
        {renderSingleLayer(0)}
        {renderSingleLayer(1)}
      </div>

      {/* Inter-layer Adjacency Caption */}
      <p className="text-center text-xs italic text-gray-600 dark:text-gray-400">
        Inter-layer adjacency: Corresponding cells at the same (row, col) in both layers differ by only variable {layerVar} (value 16) and are adjacent in 5-dimensional Boolean space.
      </p>
    </div>
  );
};
