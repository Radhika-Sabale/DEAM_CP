/**
 * @file TraceView.tsx
 * Execution trace table with step slider, keyboard-focusable rows,
 * read-only step inspection banner, and Return to Current button.
 */

import type { FC } from 'react';
import type { TraceTableRow } from '../../engine/cpu8086/history';
import { Button } from '../../components/ui/Button';

export interface TraceViewProps {
  readonly rows: readonly TraceTableRow[];
  readonly historyLength: number;
  readonly historyIndex: number;
  readonly historyTruncated: boolean;
  readonly onGoTo?: (index: number) => void;
  readonly onReturnToCurrent?: () => void;
  readonly className?: string;
}

export const TraceView: FC<TraceViewProps> = ({
  rows,
  historyLength,
  historyIndex,
  historyTruncated,
  onGoTo,
  onReturnToCurrent,
  className = '',
}) => {
  const isViewingPast = historyLength > 0 && historyIndex < historyLength - 1;

  if (rows.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Execution Trace</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Step through the program to see the execution trace.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}>
      {/* Read-only History Banner */}
      {isViewingPast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Viewing step {historyIndex + 1} of {historyLength} (read-only)
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onReturnToCurrent ?? (() => onGoTo?.(historyLength - 1))}
            aria-label="Return to current execution state"
          >
            Return to current
          </Button>
        </div>
      )}

      {/* Header with Slider and Step Input */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Execution Trace</h3>
          {historyTruncated && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title="Oldest steps discarded to maintain performance">
              Truncated
            </span>
          )}
        </div>

        {historyLength > 1 && onGoTo && (
          <div className="flex items-center gap-2">
            <label htmlFor="history-slider" className="text-[11px] text-gray-500 dark:text-gray-400">
              Step:
            </label>
            <input
              id="history-slider"
              type="range"
              min={0}
              max={historyLength - 1}
              value={historyIndex >= 0 ? historyIndex : 0}
              onChange={(e) => onGoTo(parseInt(e.target.value, 10))}
              aria-label="Execution history step slider"
              className="w-24 sm:w-32 cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              min={1}
              max={historyLength}
              value={historyIndex + 1}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= historyLength) {
                  onGoTo(n - 1);
                }
              }}
              aria-label="Step number"
              className="w-14 rounded border border-gray-300 px-1 py-0.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="font-mono text-[11px] text-gray-400">/ {historyLength}</span>
          </div>
        )}
      </div>

      {/* Trace Table */}
      <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
        <table className="w-full text-left text-[11px] font-mono" aria-label="Chronological execution trace">
          <caption className="sr-only">
            Table of executed instructions with registers changed, flags changed, memory writes, and stack changes.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-900 sticky top-0 text-gray-500 dark:text-gray-400 z-10">
              <th scope="col" className="px-2 py-1 text-center font-semibold">#</th>
              <th scope="col" className="px-2 py-1 text-center font-semibold">Addr</th>
              <th scope="col" className="px-2 py-1 text-center font-semibold">Line</th>
              <th scope="col" className="px-2 py-1 font-semibold">Instruction</th>
              <th scope="col" className="px-2 py-1 font-semibold">Registers</th>
              <th scope="col" className="px-2 py-1 font-semibold">Flags</th>
              <th scope="col" className="px-2 py-1 font-semibold">Memory</th>
              <th scope="col" className="px-2 py-1 font-semibold">Stack</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {rows.map((row) => {
              const isSelected = row.stepNumber - 1 === historyIndex;

              return (
                <tr
                  key={row.stepNumber}
                  tabIndex={0}
                  onClick={() => onGoTo?.(row.stepNumber - 1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onGoTo?.(row.stepNumber - 1);
                    }
                  }}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-100/70 font-semibold dark:bg-blue-900/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }`}
                  aria-label={`Step ${row.stepNumber}: ${row.instructionText} at line ${row.sourceLine}`}
                >
                  <td className="px-2 py-1 text-center text-gray-400 font-bold">{row.stepNumber}</td>
                  <td className="px-2 py-1 text-center text-gray-500 font-mono">0x{row.address.toString(16).padStart(4, '0').toUpperCase()}</td>
                  <td className="px-2 py-1 text-center text-gray-400">{row.sourceLine}</td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100 font-bold">{row.instructionText}</td>
                  <td className="px-2 py-1 text-blue-700 dark:text-blue-300">{row.registersChanged || '—'}</td>
                  <td className="px-2 py-1 text-amber-700 dark:text-amber-300">{row.flagsChanged || '—'}</td>
                  <td className="px-2 py-1 text-emerald-700 dark:text-emerald-300">{row.memoryWrites || '—'}</td>
                  <td className="px-2 py-1 text-purple-700 dark:text-purple-300">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
