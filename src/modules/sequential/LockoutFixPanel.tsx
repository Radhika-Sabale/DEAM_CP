/**
 * @file LockoutFixPanel.tsx
 * Repair proposal and confirmation panel for unused state lockout remediation (Stage 10E).
 */

import { type FC, useState } from 'react';
import type { SequentialSpec } from '../../types/sequential';
import { proposeLockoutFix, type LockoutFixStrategy, type LockoutFixResult } from '../../engine/sequential/lockoutFix';
import { formatCode } from '../../engine/sequential/encoding';

export interface LockoutFixPanelProps {
  readonly spec: SequentialSpec;
  readonly stateBits: number;
  readonly onApplyFix: (redirects: Record<number, number>) => void;
  readonly onKeepAsIs: () => void;
  readonly isKeptAsIs: boolean;
  readonly isFixApplied: boolean;
  readonly className?: string;
}

export const LockoutFixPanel: FC<LockoutFixPanelProps> = ({
  spec,
  stateBits,
  onApplyFix,
  onKeepAsIs,
  isKeptAsIs,
  isFixApplied,
  className = '',
}) => {
  const [strategy, setStrategy] = useState<LockoutFixStrategy>('minimal-cost');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fixOutcome = proposeLockoutFix(spec, strategy);
  const fixResult: LockoutFixResult | null = fixOutcome.ok ? fixOutcome : null;

  const handleConfirmApply = () => {
    if (fixResult) {
      onApplyFix(fixResult.redirects);
    }
    setConfirmOpen(false);
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Propose a Lockout Fix
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Remediate deadlock loops by redirecting unused states to guaranteed return paths.
          </p>
        </div>

        {/* Strategy Selector */}
        <div role="group" aria-label="Repair strategy" className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setStrategy('minimal-cost')}
            aria-pressed={strategy === 'minimal-cost'}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              strategy === 'minimal-cost'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-900 dark:text-blue-400 font-semibold'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Minimal Cost
          </button>
          <button
            type="button"
            onClick={() => setStrategy('all-to-initial')}
            aria-pressed={strategy === 'all-to-initial'}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              strategy === 'all-to-initial'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-900 dark:text-blue-400 font-semibold'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            All to Initial (S0)
          </button>
        </div>
      </div>

      {fixResult && (
        <div className="mt-4 space-y-3 text-xs">
          {/* Redirects List */}
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Proposed Redirects: </span>
            {Object.keys(fixResult.redirects).length === 0 ? (
              <span className="text-gray-500">None required (already self-correcting)</span>
            ) : (
              <span className="font-mono text-blue-700 dark:text-blue-400">
                {Object.entries(fixResult.redirects)
                  .map(([from, to]) => `${formatCode(Number(from), stateBits)} -> ${formatCode(Number(to), stateBits)}`)
                  .join(', ')}
              </span>
            )}
          </div>

          {/* Cost Comparison */}
          <div className="flex flex-wrap gap-4 text-gray-700 dark:text-gray-300">
            <div>
              <span className="font-semibold">Cost Before: </span>
              <span className="font-mono">{fixResult.costBefore.terms} terms, {fixResult.costBefore.literals} literals</span>
            </div>
            <div>
              <span className="font-semibold">Cost After: </span>
              <span className="font-mono">{fixResult.costAfter.terms} terms, {fixResult.costAfter.literals} literals</span>
            </div>
          </div>

          {/* New Equations Preview */}
          <div className="rounded-lg bg-gray-50 p-2.5 font-mono text-[11px] text-gray-800 dark:bg-gray-950 dark:text-gray-200">
            <div className="mb-1 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
              New Equations After Fix:
            </div>
            {fixResult.design.equations.map((eq) => (
              <div key={eq.name}>{eq.name} = {eq.text}</div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isFixApplied || Object.keys(fixResult.redirects).length === 0}
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {isFixApplied ? 'Fix Applied' : 'Apply fix'}
            </button>
            <button
              type="button"
              onClick={onKeepAsIs}
              className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Keep as is
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal / Prompt */}
      {confirmOpen && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/40" role="alert">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Confirm Applying Lockout Fix:
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Applying this fix will re-derive next-state equations for subsequent steps and record the redirects in the project.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmApply}
              className="rounded-md bg-amber-700 px-3 py-1 font-semibold text-white hover:bg-amber-800 dark:bg-amber-600"
            >
              Confirm and Re-derive
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keep as is Warning */}
      {isKeptAsIs && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200" role="alert">
          <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Warning: Counter may hang in an unused sequence if it powers on into an unhandled state.</span>
        </div>
      )}
    </div>
  );
};
