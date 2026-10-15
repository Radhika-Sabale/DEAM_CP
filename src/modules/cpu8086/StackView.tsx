/**
 * @file StackView.tsx
 * Displays the current stack contents growing downward from SP to initialSp.
 * Shows return address labels for CALL, last push/pop text markers, and pedagogical caption.
 */

import { type FC, useMemo } from 'react';
import type { CpuState, StackChange } from '../../engine/cpu8086/cpuTypes';
import { readWord } from '../../engine/cpu8086/memory';
import type { Program } from '../../engine/cpu8086/types';
import type { ExecutionHistory } from '../../engine/cpu8086/history';

export interface StackViewProps {
  readonly cpuState: CpuState | null;
  readonly lastStackChange?: StackChange;
  readonly program?: Program | null;
  readonly history?: ExecutionHistory | null;
  readonly className?: string;
}

const MAX_STACK_ENTRIES = 32;

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export const StackView: FC<StackViewProps> = ({
  cpuState,
  lastStackChange,
  program,
  history,
  className = '',
}) => {
  // Map of return addresses to source line from CALL instructions in history
  const callReturnLines = useMemo(() => {
    const map = new Map<number, number>();
    if (!history || !program) return map;
    for (const rec of history.records) {
      if (rec.instruction.mnemonic === 'CALL') {
        const returnIp = rec.address + 1;
        const targetInstr = program.instructions[returnIp];
        if (targetInstr) {
          map.set(returnIp, targetInstr.sourceLine);
        }
      }
    }
    return map;
  }, [history, program]);

  const entries = useMemo(() => {
    if (!cpuState) return [];
    const sp = cpuState.registers.SP;
    const top = cpuState.initialSp;
    const result: { addr: number; value: number }[] = [];

    // Stack grows downward: sp < top means items on stack
    for (let addr = sp; addr < top && result.length < MAX_STACK_ENTRIES; addr += 2) {
      const value = readWord(cpuState.memory, addr);
      result.push({ addr, value });
    }
    return result;
  }, [cpuState]);

  if (!cpuState) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Stack</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Assemble a program to view the stack.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Stack (SS:SP)</h3>
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
          SP = {formatHex16(cpuState.registers.SP)}
        </span>
      </div>

      <div className="p-3">
        <table className="w-full text-xs font-mono" aria-label="8086 CPU stack table">
          <caption className="text-left text-[11px] text-gray-500 dark:text-gray-400 pb-2">
            The stack grows downward from initial SP (0x{cpuState.initialSp.toString(16).toUpperCase()}). PUSH decrements SP first, then writes.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-2 py-1 text-left font-semibold text-gray-500 dark:text-gray-400">Address</th>
              <th scope="col" className="px-2 py-1 text-right font-semibold text-gray-500 dark:text-gray-400">Word Value</th>
              <th scope="col" className="px-2 py-1 text-right font-semibold text-gray-500 dark:text-gray-400">Decimal</th>
              <th scope="col" className="px-2 py-1 text-left font-semibold text-gray-500 dark:text-gray-400">Annotation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-gray-400 dark:text-gray-500 italic">
                  Stack is empty (SP = initial SP).
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => {
                const isTos = idx === 0;
                const isRecentPush = lastStackChange?.type === 'push' && entry.addr === lastStackChange.spAfter;
                const isRecentPop = lastStackChange?.type === 'pop' && entry.addr === lastStackChange.spBefore;
                const returnLine = callReturnLines.get(entry.value);

                return (
                  <tr
                    key={entry.addr}
                    className={
                      isRecentPush
                        ? 'bg-blue-50/70 dark:bg-blue-900/20'
                        : isRecentPop
                          ? 'bg-amber-50/70 dark:bg-amber-900/20'
                          : isTos
                            ? 'bg-gray-50/80 dark:bg-gray-800/20'
                            : ''
                    }
                  >
                    <td className="px-2 py-1 text-left font-bold text-gray-700 dark:text-gray-300">
                      {formatHex16(entry.addr)}
                      {isTos && <span className="ml-1 text-[10px] text-blue-600 font-semibold">[TOS]</span>}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100 font-bold">
                      {formatHex16(entry.value)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-400">
                      {entry.value}
                    </td>
                    <td className="px-2 py-1 text-left text-xs">
                      {returnLine !== undefined ? (
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          return address (line {returnLine})
                        </span>
                      ) : isRecentPush ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          last pushed
                        </span>
                      ) : isRecentPop ? (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          last popped
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">word</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
