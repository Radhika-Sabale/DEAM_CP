/**
 * @file FlagsPanel.tsx
 * Status flag indicators (Z, C, S, O), pedagogical flag explanations, 8086 borrow notice,
 * and CMP comparison relation matrix.
 */

import { type FC } from 'react';
import type { AluComparisonRelations, AluFlags, FlagExplanation } from '../../engine/alu/types';
import type { AluOpId } from '../../types/designProject';

export interface FlagsPanelProps {
  readonly flags: AluFlags;
  readonly explanations?: readonly FlagExplanation[];
  readonly op: AluOpId;
  readonly compareRelations?: AluComparisonRelations;
}

export const FlagsPanel: FC<FlagsPanelProps> = ({
  flags,
  explanations,
  op,
  compareRelations,
}) => {
  const isSubOrCmp = op === 'SUB' || op === 'CMP';

  const flagList: {
    key: 'Z' | 'C' | 'S' | 'O';
    name: string;
    description: string;
    val: string | number;
  }[] = [
    {
      key: 'Z',
      name: 'Zero Flag (ZF)',
      description: 'Set to 1 if all bits of the result are 0.',
      val: flags.Z,
    },
    {
      key: 'C',
      name: isSubOrCmp ? 'Carry / Borrow Flag (CF)' : 'Carry Flag (CF)',
      description: isSubOrCmp
        ? 'Borrow flag (8086 convention: 1 = borrow required, A < B unsigned).'
        : 'Set to 1 if addition produced an unsigned carry-out.',
      val: flags.C,
    },
    {
      key: 'S',
      name: 'Sign Flag (SF)',
      description: 'Equal to the Most Significant Bit (MSB) of the result.',
      val: flags.S,
    },
    {
      key: 'O',
      name: 'Overflow Flag (OF)',
      description:
        flags.O === 'undefined'
          ? 'Undefined for shifts by more than 1 bit in x86 architecture.'
          : 'Set to 1 if signed two’s complement arithmetic overflowed.',
      val: flags.O === 'undefined' ? 'undefined' : flags.O,
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          ALU Status Flags
        </h3>
        {isSubOrCmp && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            8086 Subtraction: CF = 1 means Borrow
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {flagList.map(({ key, name, val }) => {
          const isUndef = val === 'undefined';
          const isActive = val === 1;
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 transition-colors ${
                isUndef
                  ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
                  : isActive
                  ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/30'
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {key}
                </span>
                <span
                  className={`font-mono text-base font-bold ${
                    isUndef
                      ? 'text-gray-500 italic text-xs'
                      : isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {val}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                {name}
              </p>
            </div>
          );
        })}
      </div>

      {explanations && explanations.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
          <div className="font-semibold text-gray-700 dark:text-gray-300">
            Flag Evaluations:
          </div>
          {explanations.map((exp) => (
            <div key={exp.flag} className="flex items-start gap-2">
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                [{exp.flag}={exp.value}]:
              </span>
              <span>{exp.description}</span>
            </div>
          ))}
        </div>
      )}

      {op === 'CMP' && compareRelations && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
            CMP Comparison Relations (A vs B)
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Unsigned Interpretation (CF & ZF):
              </span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside text-gray-600 dark:text-gray-400">
                <li>A == B: {compareRelations.equal ? 'TRUE (ZF=1)' : 'FALSE'}</li>
                <li>A &lt; B (Below): {compareRelations.below ? 'TRUE (CF=1)' : 'FALSE'}</li>
                <li>A &gt; B (Above): {compareRelations.above ? 'TRUE (CF=0, ZF=0)' : 'FALSE'}</li>
              </ul>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Signed Interpretation (SF, OF & ZF):
              </span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside text-gray-600 dark:text-gray-400">
                <li>A == B: {compareRelations.equal ? 'TRUE' : 'FALSE'}</li>
                <li>A &lt; B (Less): {compareRelations.less ? 'TRUE (SF ≠ OF)' : 'FALSE'}</li>
                <li>A &gt; B (Greater): {compareRelations.greater ? 'TRUE (SF == OF, ZF=0)' : 'FALSE'}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
