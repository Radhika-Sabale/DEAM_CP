/**
 * @file FrameStackView.tsx
 * Labeled stack view for 8086 interrupt frames (Return IP, Return CS, Saved FLAGS),
 * nested interrupt stack frames, and normal subroutine calls.
 */

import { type FC, useMemo } from 'react';
import type { CpuState, StackChange } from '../../engine/cpu8086/cpuTypes';
import { readWord } from '../../engine/cpu8086/memory';
import type { Program } from '../../engine/cpu8086/types';
import type { InterruptLogEntry } from './useInterruptSession';

export interface FrameStackViewProps {
  readonly cpuState: CpuState | null;
  readonly interruptLog?: readonly InterruptLogEntry[];
  readonly program?: Program | null;
  readonly lastStackChange?: StackChange;
  readonly className?: string;
}

const MAX_STACK_WORDS = 32;

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export const FrameStackView: FC<FrameStackViewProps> = ({
  cpuState,
  interruptLog = [],
  program,
  lastStackChange,
  className = '',
}) => {
  // Build reverse map of instruction IP to source line
  const lineMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!program) return map;
    for (const [ipStr, instr] of Object.entries(program.instructions)) {
      map.set(parseInt(ipStr, 10), instr.sourceLine);
    }
    return map;
  }, [program]);

  // Decode active unreturned interrupt frames
  const activeInterrupts = useMemo(() => {
    return interruptLog.filter((e) => e.returnedByIretAtTick === undefined);
  }, [interruptLog]);

  const stackEntries = useMemo(() => {
    if (!cpuState) return [];
    const sp = cpuState.registers.SP;
    const top = cpuState.initialSp;
    const words: {
      addr: number;
      value: number;
      annotation: string;
      frameType: 'int-ip' | 'int-cs' | 'int-flags' | 'call-ip' | 'data';
      depth: number;
    }[] = [];

    // Read words from SP up to initialSp
    let offset = 0;
    for (let addr = sp; addr < top && words.length < MAX_STACK_WORDS; addr += 2, offset += 2) {
      const value = readWord(cpuState.memory, addr);

      // Check if this matches an interrupt frame boundary
      // Active unreturned interrupts are ordered oldest to newest.
      // The newest interrupt frame is at lowest SP (offset 0 = IP, offset 2 = CS, offset 4 = FLAGS)
      // The next nested interrupt frame is 6 bytes higher, etc.
      const frameIndex = Math.floor(offset / 6);
      const slotInFrame = (offset % 6) / 2; // 0 = IP, 1 = CS, 2 = FLAGS

      // Check if within active interrupts count
      const matchingInt =
        frameIndex < activeInterrupts.length
          ? activeInterrupts[activeInterrupts.length - 1 - frameIndex]
          : null;

      let annotation = 'Data Word';
      let frameType: 'int-ip' | 'int-cs' | 'int-flags' | 'call-ip' | 'data' = 'data';
      const depth = matchingInt ? matchingInt.nestingDepth : 0;

      if (matchingInt) {
        if (slotInFrame === 0) {
          const retLine = lineMap.get(value);
          annotation = `Interrupt Return IP: ${formatHex16(value)}${
            retLine !== undefined ? ` (line ${retLine})` : ''
          } [Frame ${matchingInt.nestingDepth}]`;
          frameType = 'int-ip';
        } else if (slotInFrame === 1) {
          annotation = `Interrupt Return CS: ${formatHex16(value)} [Frame ${matchingInt.nestingDepth}]`;
          frameType = 'int-cs';
        } else if (slotInFrame === 2) {
          const ifVal = (value & (1 << 9)) !== 0 ? 1 : 0;
          const tfVal = (value & (1 << 8)) !== 0 ? 1 : 0;
          annotation = `Saved FLAGS: ${formatHex16(value)} (IF=${ifVal}, TF=${tfVal}) [Frame ${matchingInt.nestingDepth}]`;
          frameType = 'int-flags';
        }
      } else {
        const callLine = lineMap.get(value);
        if (callLine !== undefined) {
          annotation = `Subroutine Return IP (line ${callLine})`;
          frameType = 'call-ip';
        }
      }

      words.push({ addr, value, annotation, frameType, depth });
    }

    return words;
  }, [cpuState, activeInterrupts, lineMap]);

  if (!cpuState) {
    return (
      <div
        role="region"
        aria-label="8086 CPU stack and interrupt frames"
        className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Stack & Interrupt Frames
        </h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">
          Assemble a program to inspect the stack and interrupt frames.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="8086 CPU stack and interrupt frames"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Stack & Interrupt Frames
          </h3>
          <span className="font-mono text-gray-500">
            SP = {formatHex16(cpuState.registers.SP)}
          </span>
        </div>

        <div>
          {activeInterrupts.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
              Active Frames: {activeInterrupts.length}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">No active interrupt frames</span>
          )}
        </div>
      </div>

      {/* Stack Table */}
      <div className="overflow-x-auto p-3">
        <table className="w-full text-xs font-mono" aria-label="8086 stack and frame layout">
          <caption className="text-left text-[11px] text-gray-500 dark:text-gray-400 pb-2">
            The stack grows downward. Each interrupt pushes 3 words (6 bytes): FLAGS, CS, IP. IRET pops IP, CS, FLAGS.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-2 py-1 text-left font-semibold text-gray-500 dark:text-gray-400">Address</th>
              <th scope="col" className="px-2 py-1 text-right font-semibold text-gray-500 dark:text-gray-400">Word Value</th>
              <th scope="col" className="px-2 py-1 text-left font-semibold text-gray-500 dark:text-gray-400">Frame Element / Annotation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {stackEntries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-gray-400 dark:text-gray-500 italic">
                  Stack is empty (SP = 0x{cpuState.initialSp.toString(16).toUpperCase()}).
                </td>
              </tr>
            ) : (
              stackEntries.map((entry, idx) => {
                const isTos = idx === 0;
                const isRecentPush = lastStackChange?.type === 'push' && entry.addr === lastStackChange.spAfter;
                const isRecentPop = lastStackChange?.type === 'pop' && entry.addr === lastStackChange.spBefore;

                const rowBg =
                  entry.frameType === 'int-ip'
                    ? 'bg-blue-50/80 dark:bg-blue-950/30'
                    : entry.frameType === 'int-cs'
                      ? 'bg-blue-50/50 dark:bg-blue-950/20'
                      : entry.frameType === 'int-flags'
                        ? 'bg-blue-50/30 dark:bg-blue-950/10 border-b-2 border-b-blue-300 dark:border-b-blue-800'
                        : entry.frameType === 'call-ip'
                          ? 'bg-purple-50/60 dark:bg-purple-950/20'
                          : isRecentPush
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : '';

                return (
                  <tr key={entry.addr} className={rowBg}>
                    <td className="px-2 py-1 text-left font-bold text-gray-700 dark:text-gray-300">
                      {formatHex16(entry.addr)}
                      {isTos && (
                        <span className="ml-1 text-[10px] text-blue-600 font-semibold">[TOS]</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-bold text-gray-900 dark:text-gray-100">
                      {formatHex16(entry.value)}
                    </td>
                    <td className="px-2 py-1 text-left text-xs">
                      {entry.frameType !== 'data' ? (
                        <span
                          className={`font-semibold ${
                            entry.frameType.startsWith('int')
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {entry.annotation}
                        </span>
                      ) : isRecentPush ? (
                        <span className="text-amber-600 font-semibold">Last pushed word</span>
                      ) : isRecentPop ? (
                        <span className="text-amber-600 font-semibold">Last popped word</span>
                      ) : (
                        <span className="text-gray-400">{entry.annotation}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Frame Size Notice */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
        RET pops only 2 bytes (IP), leaving CS and FLAGS on the stack! Handlers must use IRET (pops 6 bytes: IP, CS, FLAGS) to cleanly restore CPU state.
      </div>
    </div>
  );
};
