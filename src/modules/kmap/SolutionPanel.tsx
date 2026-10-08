/**
 * @file SolutionPanel.tsx
 * Solution presentation panel displaying prime implicants, essential PIs,
 * minimal SOP/POS expressions with copy buttons, term/literal statistics,
 * constant function detection, and alternative minimal cover selector.
 */

import { type FC, useState } from 'react';
import type { KMapSolution } from '../../engine/kmap/types';

export interface SolutionPanelProps {
  readonly sopSolution: KMapSolution | null;
  readonly posSolution: KMapSolution | null;
  readonly selectedForm: 'SOP' | 'POS';
  readonly onSelectForm: (form: 'SOP' | 'POS') => void;
  readonly selectedCoverIndex: number;
  readonly onSelectCoverIndex: (index: number) => void;
  readonly onSolve: () => void;
  readonly isSolving?: boolean;
}

export const SolutionPanel: FC<SolutionPanelProps> = ({
  sopSolution,
  posSolution,
  selectedForm,
  onSelectForm,
  selectedCoverIndex,
  onSelectCoverIndex,
  onSolve,
  isSolving = false,
}) => {
  const [copiedForm, setCopiedForm] = useState<'SOP' | 'POS' | null>(null);

  const activeSolution = selectedForm === 'SOP' ? sopSolution : posSolution;

  const handleCopy = (form: 'SOP' | 'POS', expr: string) => {
    navigator.clipboard.writeText(expr);
    setCopiedForm(form);
    setTimeout(() => setCopiedForm(null), 1800);
  };

  // Check constant function conditions
  const isConstant0 = activeSolution && activeSolution.minterms.length === 0;
  const totalCells = activeSolution ? 1 << activeSolution.variableCount : 0;
  const isConstant1 =
    activeSolution &&
    (activeSolution.minterms.length === totalCells ||
      activeSolution.minterms.length + activeSolution.dontCares.length === totalCells);

  const allCovers = activeSolution?.allMinimalCovers ?? [];
  const currentCover = allCovers[selectedCoverIndex] ?? activeSolution?.primarySolution;

  return (
    <div className="space-y-4">
      {/* Top Controls: Solve Action & Form Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSolve}
            disabled={isSolving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSolving ? 'Solving...' : 'Solve Map'}
          </button>

          {/* SOP / POS Toggle */}
          <div className="inline-flex rounded-md border border-gray-200 p-0.5 dark:border-gray-700">
            <button
              type="button"
              onClick={() => onSelectForm('SOP')}
              className={`rounded-sm px-3 py-1 text-xs font-semibold transition-colors ${
                selectedForm === 'SOP'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              Sum of Products (SOP)
            </button>
            <button
              type="button"
              onClick={() => onSelectForm('POS')}
              className={`rounded-sm px-3 py-1 text-xs font-semibold transition-colors ${
                selectedForm === 'POS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              Product of Sums (POS)
            </button>
          </div>
        </div>

        {/* Status indicator */}
        {activeSolution && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{activeSolution.primeImplicants.length} Prime Implicants</span>
            <span>•</span>
            <span>{activeSolution.essentialPrimeImplicants.length} Essential</span>
          </div>
        )}
      </div>

      {/* Constant Function Callout */}
      {isConstant0 && (
        <div
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <div className="font-bold">Constant 0 (F = 0)</div>
          <p className="mt-1 text-xs">
            No minterms are true. The function evaluates unconditionally to 0 with 0 terms and 0 literals.
          </p>
        </div>
      )}

      {isConstant1 && (
        <div
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <div className="font-bold">Constant 1 (F = 1)</div>
          <p className="mt-1 text-xs">
            All minterms are true. The minimal term is 1 with 0 literals.
          </p>
        </div>
      )}

      {/* Minimal Expressions Display */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Minimal SOP Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Minimal SOP
            </span>
            {sopSolution && (
              <button
                type="button"
                onClick={() => handleCopy('SOP', sopSolution.expressionString)}
                className="rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copiedForm === 'SOP' ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="mt-2 font-mono text-base font-bold text-gray-900 dark:text-gray-100">
            {sopSolution ? sopSolution.expressionString : 'Not solved yet'}
          </div>
          {sopSolution && (
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {sopSolution.primarySolution.termCount} terms, {sopSolution.primarySolution.literalCount} literals
            </div>
          )}
        </div>

        {/* Minimal POS Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Minimal POS
            </span>
            {posSolution && (
              <button
                type="button"
                onClick={() => handleCopy('POS', posSolution.expressionString)}
                className="rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copiedForm === 'POS' ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="mt-2 font-mono text-base font-bold text-gray-900 dark:text-gray-100">
            {posSolution ? posSolution.expressionString : 'Not solved yet'}
          </div>
          {posSolution && (
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {posSolution.primarySolution.termCount} terms, {posSolution.primarySolution.literalCount} literals
            </div>
          )}
        </div>
      </div>

      {/* Multiple Minimal Covers Selector */}
      {allCovers.length > 1 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Alternative Minimal Covers ({allCovers.length} available)
              </span>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Multiple minimal covers exist. All options are equally minimal (same number of terms and literals).
              </p>
            </div>
            <select
              value={selectedCoverIndex}
              onChange={(e) => onSelectCoverIndex(Number(e.target.value))}
              aria-label="Select alternative minimal cover"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-2xs dark:border-amber-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {allCovers.map((cov, idx) => (
                <option key={`cover-${idx}`} value={idx}>
                  Cover {idx + 1}: {cov.expressionString}
                </option>
              ))}
            </select>
          </div>
          {currentCover && (
            <div className="mt-2 font-mono text-xs font-bold text-amber-900 dark:text-amber-200">
              Active Selection: {currentCover.expressionString} ({currentCover.termCount} terms, {currentCover.literalCount} literals)
            </div>
          )}
        </div>
      )}

      {/* Prime Implicants Breakdown */}
      {activeSolution && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Identified Prime Implicants
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSolution.primeImplicants.map((pi) => {
              const isEssential = activeSolution.essentialPrimeImplicants.some((e) => e.id === pi.id);
              return (
                <div
                  key={`pi-chip-${pi.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs shadow-2xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <span className="font-bold text-gray-900 dark:text-gray-100">{pi.termString}</span>
                  <span className="text-[10px] text-gray-500">[{pi.minterms.join(',')}]</span>
                  {isEssential ? (
                    <span className="rounded-xs bg-amber-100 px-1 text-[9px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      Essential PI
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400">Non-essential</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
