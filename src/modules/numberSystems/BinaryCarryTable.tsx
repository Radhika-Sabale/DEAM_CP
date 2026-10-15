/**
 * @file BinaryCarryTable.tsx
 * Accessible bit-by-bit carry chain grid component with MSB-left ordering.
 */

import type { FC } from 'react';
import type { BitCarryStep } from '../../engine/numberSystems';

export interface BinaryCarryTableProps {
  readonly carryChain: readonly BitCarryStep[];
  readonly width: number;
}

export const BinaryCarryTable: FC<BinaryCarryTableProps> = ({ carryChain, width }) => {
  const reversedChain = carryChain.slice().reverse();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs overflow-x-auto">
      <table className="w-full text-center text-sm font-mono border-collapse" aria-label="Binary carry chain">
        <caption className="sr-only">Binary arithmetic carry chain with bit-by-bit stages</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
            <th scope="row" className="px-3 py-2 text-left">Bit Position</th>
            {reversedChain.map((step) => (
              <th key={step.position} scope="col" className="px-2 py-2">
                Bit {step.position} {step.position === width - 1 ? '(MSB)' : step.position === 0 ? '(LSB)' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          <tr>
            <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-500">Carry In</th>
            {reversedChain.map((s) => (
              <td key={s.position} className="px-2 py-1.5 text-gray-500">{s.carryIn}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-700 dark:text-gray-300 font-semibold">A</th>
            {reversedChain.map((s) => (
              <td key={s.position} className="px-2 py-1.5 font-bold text-gray-900 dark:text-gray-100">{s.a}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-700 dark:text-gray-300 font-semibold">B</th>
            {reversedChain.map((s) => (
              <td key={s.position} className="px-2 py-1.5 font-bold text-gray-900 dark:text-gray-100">{s.b}</td>
            ))}
          </tr>
          <tr className="bg-blue-50/50 dark:bg-blue-900/20 font-bold">
            <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-blue-800 dark:text-blue-300">Sum (S)</th>
            {reversedChain.map((s) => (
              <td key={s.position} className="px-2 py-1.5 text-blue-600 dark:text-blue-400 font-bold">{s.sum}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-500">Carry Out</th>
            {reversedChain.map((s) => (
              <td key={s.position} className="px-2 py-1.5 text-gray-500">{s.carryOut}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
