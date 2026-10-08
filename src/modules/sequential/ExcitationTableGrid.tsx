/**
 * @file ExcitationTableGrid.tsx
 * Pure grid and collapsible reminder component for the flip-flop excitation table (Stage 10E).
 */

import { type FC } from 'react';
import type { CanonicalExcitationTable } from '../../types/sequential';
import { excitationTable } from '../../engine/flipflop/tables';
import { formatCode } from '../../engine/sequential/encoding';

export interface ExcitationCellState {
  readonly value: string;
  readonly isCorrect?: boolean;
  readonly isAcceptedWithNote?: boolean;
  readonly errorMsg?: string;
}

export interface ExcitationTableGridProps {
  readonly table: CanonicalExcitationTable;
  readonly cells: Readonly<Record<string, ExcitationCellState>>;
  readonly onCellChange: (key: string, value: string) => void;
  readonly footnoteText?: string;
}

export const ExcitationTableGrid: FC<ExcitationTableGridProps> = ({
  table,
  cells,
  onCellChange,
  footnoteText = 'Unused states have don\'t-care (X) next states and excitation inputs because the machine never enters them during normal operation.',
}) => {
  const { stateBits, flipFlop, hasInput, rows, functionColumns } = table;
  const reminderRows = excitationTable(flipFlop);

  // Derive column header names for flip-flop inputs
  const ffColNames = functionColumns.map((col) => col.name);

  return (
    <div className="space-y-4">
      {/* Collapsible 9A Excitation Table Reminder */}
      <details className="group rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-900/50">
        <summary className="cursor-pointer font-semibold text-gray-700 select-none group-open:mb-3 dark:text-gray-300">
          Flip-Flop Excitation Table Reminder ({flipFlop})
        </summary>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-center font-mono dark:divide-gray-800">
            <thead>
              <tr className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <th scope="col" className="px-3 py-1 font-semibold">Q</th>
                <th scope="col" className="px-3 py-1 font-semibold">Q+</th>
                {flipFlop === 'JK' && (
                  <>
                    <th scope="col" className="px-3 py-1 font-semibold">J</th>
                    <th scope="col" className="px-3 py-1 font-semibold">K</th>
                  </>
                )}
                {flipFlop === 'SR' && (
                  <>
                    <th scope="col" className="px-3 py-1 font-semibold">S</th>
                    <th scope="col" className="px-3 py-1 font-semibold">R</th>
                  </>
                )}
                {flipFlop === 'D' && <th scope="col" className="px-3 py-1 font-semibold">D</th>}
                {flipFlop === 'T' && <th scope="col" className="px-3 py-1 font-semibold">T</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {reminderRows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1 text-gray-700 dark:text-gray-300">{r.q}</td>
                  <td className="px-3 py-1 text-gray-700 dark:text-gray-300">{r.qNext}</td>
                  {flipFlop === 'JK' && (
                    <>
                      <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.J ?? 'X'}</td>
                      <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.K ?? 'X'}</td>
                    </>
                  )}
                  {flipFlop === 'SR' && (
                    <>
                      <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.S ?? 'X'}</td>
                      <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.R ?? 'X'}</td>
                    </>
                  )}
                  {flipFlop === 'D' && (
                    <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.D ?? 'X'}</td>
                  )}
                  {flipFlop === 'T' && (
                    <td className="px-3 py-1 font-bold text-blue-600 dark:text-blue-400">{r.inputs.T ?? 'X'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Main Excitation Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
          <thead>
            <tr className="bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
              <th scope="col" className="px-3 py-2 text-left font-bold">Present State (Q)</th>
              {hasInput && <th scope="col" className="px-3 py-2 text-center font-bold">Input</th>}
              <th scope="col" className="px-3 py-2 text-left font-bold">Next State (Q+)</th>
              {ffColNames.map((colName) => (
                <th key={colName} scope="col" className="px-3 py-2 text-center font-bold text-blue-600 dark:text-blue-400">
                  {colName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {rows.map((row) => {
              const presStr = formatCode(row.code, stateBits);
              const nextStr = row.valid && typeof row.nextCode === 'number'
                ? formatCode(row.nextCode, stateBits)
                : 'X';
              const inVal = hasInput ? (row.inputValue ?? 0) : 0;

              return (
                <tr
                  key={row.rowIndex}
                  className={!row.valid ? 'bg-gray-50/70 text-gray-400 dark:bg-gray-950/40 dark:text-gray-500' : ''}
                >
                  <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-200">
                    S{row.code} ({presStr})
                  </td>
                  {hasInput && (
                    <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                      {row.inputValue}
                    </td>
                  )}
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {row.valid && typeof row.nextCode === 'number' ? `S${row.nextCode} (${nextStr})` : 'X'}
                  </td>

                  {/* Flip-Flop Input Selects */}
                  {ffColNames.map((colName) => {
                    const cellKey = `${row.code}:${inVal}:${colName}`;
                    const cellState = cells[cellKey] ?? { value: '' };

                    if (!row.valid) {
                      return (
                        <td key={colName} className="px-3 py-2 text-center font-bold text-gray-400 dark:text-gray-500">
                          X
                        </td>
                      );
                    }

                    return (
                      <td key={colName} className="px-2 py-1 text-center">
                        <select
                          aria-label={`Row S${row.code}, input ${colName}`}
                          value={cellState.value}
                          onChange={(e) => onCellChange(cellKey, e.target.value)}
                          className={`rounded border px-2 py-1 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 ${
                            cellState.isCorrect === true
                              ? cellState.isAcceptedWithNote
                                ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                                : 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                              : cellState.isCorrect === false
                                ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                                : 'border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                          }`}
                        >
                          <option value="">-</option>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="X">X</option>
                        </select>
                        {cellState.isAcceptedWithNote && (
                          <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400" title="Accepted with note">
                            Accepted (concrete)
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unused State Footnote */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        * {footnoteText}
      </p>
    </div>
  );
};
