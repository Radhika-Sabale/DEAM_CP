/**
 * @file StateTableGrid.tsx
 * Semantic HTML table component for sequential state transition tables.
 * Renders editable input/dropdown controls with full row/column accessible names,
 * don't-care markings for unused states, and inline status badges.
 */

import { type FC } from 'react';
import type { CanonicalStateTable, MachineKind } from '../../types/sequential';

export interface CellState {
  readonly value: string;
  readonly isCorrect?: boolean;
  readonly errorMsg?: string;
}

export interface StateTableGridProps {
  readonly table: CanonicalStateTable;
  readonly validCodes: readonly number[];
  readonly unusedCodes: readonly number[];
  readonly stateNames: Record<number, string>;
  readonly stateBits: number;
  readonly hasInput: boolean;
  readonly inVarName: string;
  readonly hasOutput: boolean;
  readonly machineKind: MachineKind;
  readonly cells: Record<string, CellState>;
  readonly onCellChange: (key: string, value: string) => void;
}

function formatCode(code: number, bits: number): string {
  return code.toString(2).padStart(bits, '0');
}

export const StateTableGrid: FC<StateTableGridProps> = ({
  table,
  validCodes,
  unusedCodes,
  stateNames,
  stateBits,
  hasInput,
  inVarName,
  hasOutput,
  machineKind,
  cells,
  onCellChange,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-left font-mono text-xs" aria-label="Sequential State Transition Table">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <th scope="col" className="px-3 py-2 font-bold">Present State</th>
            {hasInput && <th scope="col" className="px-3 py-2 font-bold">{inVarName}</th>}
            <th scope="col" className="px-3 py-2 font-bold">Next State Q+</th>
            {hasOutput && (
              <th scope="col" className="px-3 py-2 font-bold">
                Output ({machineKind === 'mealy' ? 'Mealy Y' : 'Moore Y'})
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {/* Valid State Transition Rows */}
          {table.rows.filter((r) => r.valid).map((row) => {
            const inVal = hasInput ? (row.inputValue ?? 0) : 0;
            const nextKey = `${row.code}:${inVal}:next`;
            const outKey = `${row.code}:${inVal}:output`;
            const sName = stateNames[row.code] ?? `S${row.code}`;
            const bCode = formatCode(row.code, stateBits);
            const nextCell = cells[nextKey];
            const outCell = cells[outKey];

            return (
              <tr key={`${row.code}-${inVal}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">
                  {sName} ({bCode})
                </td>
                {hasInput && (
                  <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">
                    {inVal}
                  </td>
                )}
                <td className="px-3 py-2">
                  <select
                    value={nextCell?.value ?? ''}
                    aria-label={`State ${bCode} (${sName}), ${hasInput ? `${inVarName} = ${inVal}, ` : ''}next state`}
                    onChange={(e) => onCellChange(nextKey, e.target.value)}
                    className={`rounded-md border p-1 text-xs text-gray-900 shadow-2xs focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 ${
                      nextCell?.isCorrect === false
                        ? 'border-red-500 bg-red-50/50 dark:border-red-600 dark:bg-red-950/30'
                        : nextCell?.isCorrect === true
                          ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/30'
                          : 'border-gray-300 bg-white dark:border-gray-700'
                    }`}
                  >
                    <option value="">-- select --</option>
                    {validCodes.map((c) => (
                      <option key={c} value={c}>
                        {stateNames[c] ?? `S${c}`} ({formatCode(c, stateBits)})
                      </option>
                    ))}
                  </select>
                </td>
                {hasOutput && (
                  <td className="px-3 py-2">
                    {machineKind === 'mealy' ? (
                      <select
                        value={outCell?.value ?? ''}
                        aria-label={`State ${bCode} (${sName}), ${inVarName} = ${inVal}, output`}
                        onChange={(e) => onCellChange(outKey, e.target.value)}
                        className="rounded-md border border-gray-300 bg-white p-1 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">-- select --</option>
                        <option value="0">0</option>
                        <option value="1">1</option>
                      </select>
                    ) : (
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {row.mooreOutput}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-[11px]">
                  {nextCell?.isCorrect === true ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Correct</span>
                  ) : nextCell?.isCorrect === false ? (
                    <span role="status" className="font-semibold text-red-600 dark:text-red-400">{nextCell.errorMsg}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Unused State Rows */}
          {unusedCodes.map((code) => (
            <tr key={`unused-${code}`} className="bg-gray-50/50 text-gray-400 opacity-75 dark:bg-gray-800/20 dark:text-gray-500">
              <td className="px-3 py-2">S{code} ({formatCode(code, stateBits)})*</td>
              {hasInput && <td className="px-3 py-2">X</td>}
              <td className="px-3 py-2 font-bold">X</td>
              {hasOutput && <td className="px-3 py-2 font-bold">X</td>}
              <td className="px-3 py-2 text-[10px]">Unused (Don&apos;t care)</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footnote for unused rows */}
      {unusedCodes.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          * Unused state: treated as don&apos;t-care (X) for next-state logic.
        </p>
      )}
    </div>
  );
};
