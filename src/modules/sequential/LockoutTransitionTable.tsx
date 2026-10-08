/**
 * @file LockoutTransitionTable.tsx
 * Accessible HTML table displaying unused state transitions, status icons, and paths (Stage 10E).
 */

import type { FC } from 'react';
import type { UnusedStateAnalysis } from '../../engine/sequential/lockout';
import { formatCode } from '../../engine/sequential/encoding';

export interface LockoutTransitionTableProps {
  readonly unusedStates: readonly UnusedStateAnalysis[];
  readonly stateBits: number;
}

/**
 * Renders the transition behaviors of unused states under synthesized next-state equations.
 */
export const LockoutTransitionTable: FC<LockoutTransitionTableProps> = ({
  unusedStates,
  stateBits,
}) => {
  if (unusedStates.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
        <thead>
          <tr className="bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            <th scope="col" className="px-3 py-2 text-left font-bold">Unused State</th>
            <th scope="col" className="px-3 py-2 text-left font-bold">Next State(s) Reached</th>
            <th scope="col" className="px-3 py-2 text-center font-bold">Status</th>
            <th scope="col" className="px-3 py-2 text-left font-bold">Example Path</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
          {unusedStates.map((u) => {
            const nextStr = u.transitions
              .map((t) => (typeof t.nextCode === 'number' ? formatCode(t.nextCode, stateBits) : 'X'))
              .join(', ');
            const pathStr = u.examplePath.map((c) => formatCode(c, stateBits)).join(' -> ');

            return (
              <tr key={u.code}>
                <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-200">
                  S{u.code} ({u.binaryCode})
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {nextStr}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {u.status === 'returns' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Returns
                    </span>
                  )}
                  {u.status === 'locked' && (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.486 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Locked
                    </span>
                  )}
                  {u.status === 'indeterminate' && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Indeterminate
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono text-[11px] dark:text-gray-400">
                  {pathStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
