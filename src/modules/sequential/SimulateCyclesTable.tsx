/**
 * @file SimulateCyclesTable.tsx
 * Accessible HTML table displaying cycle-by-cycle sequential execution trace (Stage 10E).
 */

import type { FC } from 'react';
import type { SimulationRow } from '../../engine/sequential/simulate';
import { formatCode } from '../../engine/sequential/encoding';

export interface SimulateCyclesTableProps {
  readonly rows: readonly SimulationRow[];
  readonly currentCycle: number;
  readonly stateBits: number;
  readonly hasInput: boolean;
  readonly inputLabel?: string;
  readonly hasOutput: boolean;
}

/**
 * Tabular sequential execution trace marking the active clock cycle as textual "Current".
 */
export const SimulateCyclesTable: FC<SimulateCyclesTableProps> = ({
  rows,
  currentCycle,
  stateBits,
  hasInput,
  inputLabel = 'IN',
  hasOutput,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
        <thead>
          <tr className="bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            <th scope="col" className="px-3 py-2 text-left font-bold">Cycle</th>
            <th scope="col" className="px-3 py-2 text-left font-bold">Present State</th>
            {hasInput && <th scope="col" className="px-3 py-2 text-center font-bold">{inputLabel}</th>}
            <th scope="col" className="px-3 py-2 text-left font-bold">Flip-Flop Inputs</th>
            {hasOutput && <th scope="col" className="px-3 py-2 text-center font-bold">Output (Z)</th>}
            <th scope="col" className="px-3 py-2 text-left font-bold">Next State</th>
            <th scope="col" className="px-3 py-2 text-center font-bold">Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
          {rows.map((r, idx) => {
            const isCurrent = idx === currentCycle;
            const presentStr =
              typeof r.state === 'number'
                ? `S${r.state} (${formatCode(r.state, stateBits)})`
                : 'X (Unknown)';
            const nextStr =
              typeof r.nextState === 'number'
                ? `S${r.nextState} (${formatCode(r.nextState, stateBits)})`
                : 'X (Unknown)';

            const ffStr = Object.entries(r.ffInputs)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ');

            return (
              <tr
                key={r.cycle}
                className={isCurrent ? 'bg-blue-50/80 font-bold dark:bg-blue-950/40' : undefined}
              >
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  #{r.cycle}
                </td>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  {presentStr}
                </td>
                {hasInput && (
                  <td className="px-3 py-2 text-center text-blue-600 dark:text-blue-400">
                    {r.input}
                  </td>
                )}
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {ffStr || '—'}
                </td>
                {hasOutput && (
                  <td className="px-3 py-2 text-center font-bold text-amber-600 dark:text-amber-400">
                    {r.output}
                  </td>
                )}
                <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                  {nextStr}
                </td>
                <td className="px-3 py-2 text-center">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Current
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
