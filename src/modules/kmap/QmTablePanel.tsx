/**
 * @file QmTablePanel.tsx
 * Comprehensive pedagogical inspection panel displaying the tabular
 * Quine-McCluskey elimination columns, PI chart with 'X' cell markers,
 * Essential Prime Implicants, dominance reduction steps, and Petrick expansions.
 */

import { type FC, useState } from 'react';
import type { KMapSolution } from '../../engine/kmap/types';
import type { PrimeImplicant } from '../../engine/kmap/primeImplicants';

export interface QmTablePanelProps {
  readonly solution: KMapSolution;
  readonly onHighlightGroup?: (cellIndices: readonly number[]) => void;
  readonly activeHighlightCells?: readonly number[];
}

export const QmTablePanel: FC<QmTablePanelProps> = ({
  solution,
  onHighlightGroup,
  activeHighlightCells = [],
}) => {
  const [openSections, setOpenSections] = useState<{
    qmTable: boolean;
    piChart: boolean;
    dominance: boolean;
    petrick: boolean;
  }>({
    qmTable: true,
    piChart: true,
    dominance: true,
    petrick: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isEpi = (pi: PrimeImplicant): boolean => {
    return solution.essentialPrimeImplicants.some((e) => e.id === pi.id);
  };

  return (
    <div className="space-y-4">
      {/* 1. Quine-McCluskey Tabular Reduction Columns */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => toggleSection('qmTable')}
          className="flex w-full items-center justify-between p-4 text-left font-bold text-gray-900 dark:text-gray-100"
        >
          <span className="text-sm">Quine-McCluskey Implicant Tables ({solution.qmTrace.columns.length} columns)</span>
          <span className="text-xs text-gray-500">{openSections.qmTable ? '▼ Collapse' : '▶ Expand'}</span>
        </button>

        {openSections.qmTable && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {solution.qmTrace.columns.map((col) => (
                <div
                  key={`qm-col-${col.columnIndex}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950/50"
                >
                  <div className="mb-2 border-b border-gray-200 pb-1 font-mono text-xs font-bold text-blue-700 dark:border-gray-800 dark:text-blue-300">
                    Column {col.columnIndex + 1} (Size {col.termSize})
                  </div>
                  <div className="space-y-3">
                    {col.groups.map((group) => (
                      <div key={`col-${col.columnIndex}-grp-${group.groupIndex}`} className="space-y-1">
                        <div className="text-[10px] font-semibold text-gray-500">
                          Group {group.groupIndex} (weight {group.groupIndex})
                        </div>
                        <div className="divide-y divide-gray-100 rounded-sm border border-gray-200 bg-white font-mono text-xs dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
                          {group.implicants.map((imp) => (
                            <div
                              key={imp.id}
                              className="flex items-center justify-between px-2 py-1 text-[11px]"
                            >
                              <span className="text-gray-800 dark:text-gray-200">
                                {imp.binaryString}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                m({imp.minterms.join(',')})
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  imp.combined ? 'text-emerald-600' : 'text-blue-600 font-semibold'
                                }`}
                              >
                                {imp.combined ? '✓' : 'PI'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Prime Implicant Chart */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => toggleSection('piChart')}
          className="flex w-full items-center justify-between p-4 text-left font-bold text-gray-900 dark:text-gray-100"
        >
          <span className="text-sm">Prime Implicant Coverage Chart</span>
          <span className="text-xs text-gray-500">{openSections.piChart ? '▼ Collapse' : '▶ Expand'}</span>
        </button>

        {openSections.piChart && (
          <div className="overflow-x-auto border-t border-gray-100 p-4 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 text-left font-mono text-xs dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">PI Term</th>
                  <th className="px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Lit.</th>
                  <th className="px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  {solution.minterms.map((m) => (
                    <th key={`hdr-m-${m}`} className="px-2 py-2 text-center font-bold text-blue-600 dark:text-blue-400">
                      m{m}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right">Map</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {solution.primeImplicants.map((pi) => {
                  const essential = isEpi(pi);
                  const isHighlighted =
                    activeHighlightCells.length > 0 &&
                    pi.minterms.every((c) => activeHighlightCells.includes(c));

                  return (
                    <tr
                      key={`pi-${pi.id}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                        isHighlighted ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">
                        {pi.termString}
                      </td>
                      <td className="px-2 py-2 text-gray-600 dark:text-gray-400">
                        {pi.literalCount}
                      </td>
                      <td className="px-2 py-2">
                        {essential ? (
                          <span className="rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            Essential PI
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">Prime</span>
                        )}
                      </td>
                      {solution.minterms.map((m) => {
                        const covers = pi.requiredMinterms.includes(m);
                        return (
                          <td key={`cov-${pi.id}-${m}`} className="px-2 py-2 text-center font-bold">
                            {covers ? (
                              <span className="text-blue-700 dark:text-blue-400">X</span>
                            ) : (
                              <span className="text-gray-200 dark:text-gray-800">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right">
                        {onHighlightGroup && (
                          <button
                            type="button"
                            onClick={() => onHighlightGroup(pi.minterms)}
                            className="rounded-sm border border-gray-300 px-2 py-0.5 text-[10px] font-sans font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            Show on map
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Reduction Steps (Essentials & Dominance) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => toggleSection('dominance')}
          className="flex w-full items-center justify-between p-4 text-left font-bold text-gray-900 dark:text-gray-100"
        >
          <span className="text-sm">Iterative Reduction Steps ({solution.reductionSteps.length})</span>
          <span className="text-xs text-gray-500">{openSections.dominance ? '▼ Collapse' : '▶ Expand'}</span>
        </button>

        {openSections.dominance && (
          <div className="space-y-2 border-t border-gray-100 p-4 text-xs dark:border-gray-800">
            {solution.reductionSteps.length === 0 ? (
              <p className="italic text-gray-500">No chart reductions applied.</p>
            ) : (
              solution.reductionSteps.map((step, idx) => (
                <div
                  key={`step-${idx}`}
                  className="rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-950/40"
                >
                  <span className="mr-2 font-bold font-mono text-blue-600 dark:text-blue-400">
                    Step {idx + 1} ({step.type}):
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{step.reason}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. Petrick's Method Steps (if cyclic core existed) */}
      {solution.petrickSteps.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => toggleSection('petrick')}
            className="flex w-full items-center justify-between p-4 text-left font-bold text-gray-900 dark:text-gray-100"
          >
            <span className="text-sm">Petrick's Method Algebraic Expansion ({solution.petrickSteps.length} steps)</span>
            <span className="text-xs text-gray-500">{openSections.petrick ? '▼ Collapse' : '▶ Expand'}</span>
          </button>

          {openSections.petrick && (
            <div className="space-y-2 border-t border-gray-100 p-4 font-mono text-xs dark:border-gray-800">
              {solution.petrickSteps.map((pStep) => (
                <div
                  key={`petrick-${pStep.stepIndex}`}
                  className="rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950"
                >
                  Clause {pStep.stepIndex + 1} for minterm m{pStep.minterm}: covering PIs [
                  {pStep.coveringPiIndices.map((i) => `P${i}`).join(' + ')}] → Intermediate terms: {pStep.termCountAfterStep}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
