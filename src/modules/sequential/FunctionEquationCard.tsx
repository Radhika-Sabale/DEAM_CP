/**
 * @file FunctionEquationCard.tsx
 * Card component displaying the truth table column, student equation input,
 * solver reveal panel, and K-Map handoff trigger for a single sequential function (Stage 10E).
 */

import { type FC, useState } from 'react';
import type { FunctionColumn } from '../../types/sequential';
import type { DerivedEquation } from '../../engine/sequential/nextStateEquations';

export interface FunctionEquationState {
  readonly text: string;
  readonly isCorrect?: boolean;
  readonly isMinimal?: boolean;
  readonly note?: string;
  readonly errorMsg?: string;
  readonly isRevealed?: boolean;
}

export interface FunctionEquationCardProps {
  readonly fn: FunctionColumn;
  readonly derivedEq?: DerivedEquation;
  readonly state: FunctionEquationState;
  readonly onChange: (text: string) => void;
  readonly onReveal: () => void;
  readonly onOpenKMap: () => void;
  readonly className?: string;
}

export const FunctionEquationCard: FC<FunctionEquationCardProps> = ({
  fn,
  derivedEq,
  state,
  onChange,
  onReveal,
  onOpenKMap,
  className = '',
}) => {
  const [showTable, setShowTable] = useState(false);
  const varCount = fn.variables.length;
  const canOpenKMap = varCount >= 2 && varCount <= 5;
  const kmapDisabledReason = varCount < 2
    ? 'K-Map requires at least 2 variables'
    : varCount > 5
      ? 'K-Map supports at most 5 variables'
      : undefined;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Function Header & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <span className="inline-block rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
            {fn.name}
          </span>
          <span className="ml-2 text-xs text-gray-500 font-mono dark:text-gray-400">
            f({fn.variables.join(', ')})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showTable ? 'Hide Truth Table' : 'View Truth Table'}
          </button>
          <button
            type="button"
            disabled={!canOpenKMap}
            title={kmapDisabledReason}
            onClick={onOpenKMap}
            className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            Open in K-Map
          </button>
        </div>
      </div>

      {kmapDisabledReason && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          * {kmapDisabledReason}
        </p>
      )}

      {/* Collapsible Truth Table Column */}
      {showTable && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950">
          <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
            <thead>
              <tr className="text-gray-600 dark:text-gray-400">
                <th scope="col" className="px-2 py-1 text-left font-semibold">Row</th>
                {fn.variables.map((v) => (
                  <th key={v} scope="col" className="px-2 py-1 text-center font-semibold">{v}</th>
                ))}
                <th scope="col" className="px-2 py-1 text-center font-bold text-blue-600 dark:text-blue-400">{fn.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {fn.column.map((val, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="px-2 py-1 text-gray-500">{rowIdx}</td>
                  {fn.variables.map((_, bitIdx) => {
                    const bitVal = (rowIdx >> (varCount - 1 - bitIdx)) & 1;
                    return (
                      <td key={bitIdx} className="px-2 py-1 text-center text-gray-700 dark:text-gray-300">
                        {bitVal}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center font-bold text-gray-900 dark:text-gray-100">
                    {val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Equation Input Form */}
      <div className="mt-3 space-y-2">
        <label htmlFor={`eq-input-${fn.name}`} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Enter SOP Boolean Equation for {fn.name}:
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`eq-input-${fn.name}`}
            type="text"
            value={state.text}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`e.g. ${derivedEq?.text ?? 'Q0 & IN'}`}
            aria-label={`Boolean equation for ${fn.name}`}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-mono text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={onReveal}
            className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
          >
            Reveal solver result
          </button>
        </div>

        {/* Validation Status / Error Message */}
        {state.isCorrect === true && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>
              {state.isMinimal
                ? 'Verified: Minimal equation.'
                : `Accepted with note: ${state.note ?? 'Valid on all care rows but non-minimal.'}`}
            </span>
          </div>
        )}

        {state.isCorrect === false && state.errorMsg && (
          <div className="flex items-start gap-1.5 text-xs font-medium text-red-700 dark:text-red-400" role="alert">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.486 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{state.errorMsg}</span>
          </div>
        )}

        {/* Revealed Solver Detail Panel */}
        {state.isRevealed && derivedEq && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 text-xs dark:border-purple-900/50 dark:bg-purple-950/30">
            <div className="font-semibold text-purple-900 dark:text-purple-200">
              Solver Solution: <span className="font-mono">{derivedEq.text}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-purple-800 dark:text-purple-300">
              <span>Cost: {derivedEq.cost.terms} terms, {derivedEq.cost.literals} literals</span>
              <span>Minimal covers: {derivedEq.minimalCoverCount}</span>
              <span>Used don't-cares: [{derivedEq.usedDontCares.join(', ')}]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
