/**
 * @file InterruptTimeline.tsx
 * Execution audit timeline and latency log for interrupts recognized during CPU execution.
 *
 * Displays recognized interrupts, vector numbers, execution addresses, return ticks (IRET),
 * nesting depth, and recognition latency in CPU clock ticks.
 */

import type { FC } from 'react';
import type { InterruptLogEntry } from './useInterruptSession';

export interface InterruptTimelineProps {
  readonly interruptLog: readonly InterruptLogEntry[];
  readonly currentTick?: number;
  readonly className?: string;
}

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export const InterruptTimeline: FC<InterruptTimelineProps> = ({
  interruptLog,
  currentTick = 0,
  className = '',
}) => {
  return (
    <div
      role="region"
      aria-label="Interrupt recognition timeline and latency log"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Interrupt Execution Timeline & Latency
          </h3>
          <span className="font-mono text-gray-500">
            ({interruptLog.length} recorded, current tick {currentTick})
          </span>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" aria-label="Chronological interrupt event log">
          <caption className="sr-only">
            Chronological audit log of all interrupts serviced, including vector, recognition address, handler address, return tick, latency, and nesting depth.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Tick</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Source</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Vector</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Recognized At IP</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Handler IP</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">IRET Tick</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Nesting</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {interruptLog.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 italic">
                  No interrupts have been recognized yet. Step or run the program to record interrupt timeline events.
                </td>
              </tr>
            ) : (
              interruptLog.map((entry) => {
                const isReturned = entry.returnedByIretAtTick !== undefined;
                const duration = isReturned ? entry.returnedByIretAtTick! - entry.tick : null;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">
                      {entry.tick}
                    </td>
                    <td className="px-3 py-1.5">
                      {entry.kind === 'nmi' && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          NMI
                        </span>
                      )}
                      {entry.kind === 'intr' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                          INTR
                        </span>
                      )}
                      {entry.kind === 'single-step' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                          Single-Step
                        </span>
                      )}
                      {entry.kind === 'software' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                          INT {entry.vector}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-medium">
                      Vector {entry.vector}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">
                      {formatHex16(entry.recognizedAtInstructionIp)}
                    </td>
                    <td className="px-3 py-1.5 font-bold text-purple-600 dark:text-purple-400">
                      {formatHex16(entry.handlerIp)}
                    </td>
                    <td className="px-3 py-1.5">
                      {isReturned ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Tick {entry.returnedByIretAtTick}{' '}
                          <span className="text-[10px] text-gray-400">({duration} ticks)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                          ● In Progress
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          entry.nestingDepth > 1
                            ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        Depth {entry.nestingDepth}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400">
                      {entry.latencyTicks} ticks
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Latency Note */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
        Latency is measured from external signal assert to recognition at instruction boundary. Maskable INTR latency increases while IF=0 or during STI delay.
      </div>
    </div>
  );
};
