/**
 * @file InterruptLines.tsx
 * Visual status panel for 8086 physical interrupt lines, flags, STI delay shadow,
 * and priority arbitration queue.
 */

import type { FC } from 'react';
import { Button } from '../../components/ui/Button';

export interface InterruptLinesProps {
  readonly currentTick: number;
  readonly pendingLines: {
    readonly nmi: boolean;
    readonly intr: { readonly vector: number } | null;
    readonly ifFlag: 0 | 1;
    readonly tfFlag: 0 | 1;
    readonly stiShadow: boolean;
  };
  readonly pendingList: readonly {
    readonly source: 'single-step' | 'nmi' | 'intr';
    readonly priority: number;
    readonly vector: number;
    readonly blocked: boolean;
    readonly label: string;
  }[];
  readonly hasInterruptWatchpoint: boolean;
  readonly onToggleInterruptWatchpoint: () => void;
  readonly className?: string;
}

export const InterruptLines: FC<InterruptLinesProps> = ({
  currentTick,
  pendingLines,
  pendingList,
  hasInterruptWatchpoint,
  onToggleInterruptWatchpoint,
  className = '',
}) => {
  const { nmi, intr, ifFlag, tfFlag, stiShadow } = pendingLines;

  return (
    <div
      role="region"
      aria-label="Hardware interrupt lines and priority queue"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Interrupt Lines & Priorities
          </h3>
          <span className="font-mono text-gray-500">Tick: {currentTick}</span>
        </div>

        <Button
          variant={hasInterruptWatchpoint ? 'primary' : 'secondary'}
          size="sm"
          onClick={onToggleInterruptWatchpoint}
          aria-label={
            hasInterruptWatchpoint
              ? 'Disable interrupt watchpoint'
              : 'Enable interrupt watchpoint to break when an interrupt is recognized'
          }
        >
          {hasInterruptWatchpoint ? '● Watch: Break on Interrupt' : '○ Break on Interrupt'}
        </Button>
      </div>

      {/* Hardware Pins & Internal Flags Grid */}
      <div className="interrupt-hardware-grid grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 border-b border-gray-100 dark:border-gray-800 text-xs">
        {/* NMI Pin */}
        <div
          className={`rounded-lg border p-2.5 transition-colors ${
            nmi
              ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
              : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-gray-800 dark:text-gray-200">NMI Pin</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                nmi ? 'bg-amber-500 text-white font-bold' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {nmi ? 'HIGH (Latched)' : 'LOW'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Vector 2 • Non-maskable (bypasses IF)
          </p>
        </div>

        {/* INTR Pin */}
        <div
          className={`rounded-lg border p-2.5 transition-colors ${
            intr
              ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
              : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-gray-800 dark:text-gray-200">INTR Pin</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                intr ? 'bg-blue-600 text-white font-bold' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {intr ? `HIGH (Vec ${intr.vector})` : 'LOW'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Maskable by IF flag (0 = blocked)
          </p>
        </div>

        {/* IF Flag */}
        <div
          className={`rounded-lg border p-2.5 transition-colors ${
            ifFlag === 1
              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
              : 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-gray-800 dark:text-gray-200">IF Flag</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                ifFlag === 1
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-rose-600 text-white font-bold'
              }`}
            >
              {ifFlag === 1 ? '1 (Enabled)' : '0 (Masked)'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {ifFlag === 1 ? 'INTR permitted' : 'INTR held pending'}
          </p>
        </div>

        {/* TF Flag */}
        <div
          className={`rounded-lg border p-2.5 transition-colors ${
            tfFlag === 1
              ? 'border-purple-400 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/30'
              : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-gray-800 dark:text-gray-200">TF (Trap)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                tfFlag === 1
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {tfFlag === 1 ? '1 (Active)' : '0 (Off)'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Single-step trap after instruction
          </p>
        </div>

        {/* STI Delay Shadow */}
        <div
          className={`rounded-lg border p-2.5 transition-colors ${
            stiShadow
              ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30'
              : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-gray-800 dark:text-gray-200">STI Shadow</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                stiShadow
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {stiShadow ? 'Active (1-instr delay)' : 'Inactive'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Delays INTR recognition by 1 instruction
          </p>
        </div>
      </div>

      {/* Priority Arbitration Queue */}
      <div className="p-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
          Priority Arbitration Queue (Hardware Order)
        </h4>

        {pendingList.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No interrupts currently pending. The CPU continues normal instruction fetch.
          </p>
        ) : (
          <div className="space-y-1.5">
            {pendingList.map((item) => (
              <div
                key={`${item.source}-${item.vector}`}
                className={`interrupt-pending-item flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-mono ${
                  item.blocked
                    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                    : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    Priority {item.priority}:
                  </span>
                  <span>{item.label}</span>
                </div>
                <div>
                  {item.blocked ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                      <span aria-hidden="true">⏳</span> Blocked (IF=0 or STI shadow)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                      Ready (Will fire next)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Educational Convention Line */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
        Intel 8086 Priority: 1. Single-Step Trap → 2. NMI → 3. INTR. Software INT n has no priority rating because it is executed synchronously as an instruction.
      </div>
    </div>
  );
};
