/**
 * @file BinaryFlagsCard.tsx
 * Status flag indicators (C, borrow, N, Z, V) and overflow rationale for binary arithmetic.
 */

import type { FC } from 'react';
import type { ArithmeticFlags } from '../../engine/numberSystems';

export interface BinaryFlagsCardProps {
  readonly flags: ArithmeticFlags;
  readonly overflowExplanation?: string;
}

export const BinaryFlagsCard: FC<BinaryFlagsCardProps> = ({ flags, overflowExplanation }) => {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Condition Flags</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-sm font-mono">
        <div className={`p-2.5 rounded-lg border ${flags.C === 1 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="text-xs font-sans text-gray-500 dark:text-gray-400">C (carry)</div>
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">C: {flags.C}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${flags.borrow === 1 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="text-xs font-sans text-gray-500 dark:text-gray-400">Borrow (8086 convention)</div>
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">Borrow: {flags.borrow}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${flags.N === 1 ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="text-xs font-sans text-gray-500 dark:text-gray-400">N (negative)</div>
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">N: {flags.N}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${flags.Z === 1 ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="text-xs font-sans text-gray-500 dark:text-gray-400">Z (zero)</div>
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">Z: {flags.Z}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${flags.V === 1 ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="text-xs font-sans text-gray-500 dark:text-gray-400">V (overflow)</div>
          <div className="text-base font-bold">V (overflow): {flags.V}</div>
        </div>
      </div>
      {overflowExplanation && (
        <div role="status" className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <span className="font-bold">Explanation:</span> {overflowExplanation}
        </div>
      )}
    </div>
  );
};
