/**
 * @file SequentialCompletionSummary.tsx
 * Completion summary banner displaying implementation cost totals, assisted status,
 * and unused state lockout resolution decisions (Stage 10E).
 */

import type { FC } from 'react';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import type { LockoutDraft } from './LockoutCheck';
import { SEQUENTIAL_STEP_IDS } from './sequentialSessionTypes';
import type { UseSequentialSessionResult } from './useSequentialSession';

export interface SequentialCompletionSummaryProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

/**
 * Summary banner rendered upon completing sequential state machine synthesis.
 */
export const SequentialCompletionSummary: FC<SequentialCompletionSummaryProps> = ({
  session,
  className = '',
}) => {
  const { state } = session;
  const design: SequentialDesign | null =
    (session.activeDesign && session.activeDesign.kind === 'sync'
      ? session.activeDesign.design
      : null) ?? session.referenceDesign;

  // Check if any step used Show me / assistance
  const assistedSteps = SEQUENTIAL_STEP_IDS.filter(
    (id) => state.steps[id].status === 'assisted'
  );
  const hasAssistance = assistedSteps.length > 0;

  // Extract lockout resolution from draft
  const lockoutDraft = state.steps.lockout.draft as LockoutDraft | null;
  const fixApplied =
    !!lockoutDraft?.appliedRedirects &&
    Object.keys(lockoutDraft.appliedRedirects).length > 0;
  const keptAsIs = !!lockoutDraft?.keptAsIs;

  const lockoutDecisionText = fixApplied
    ? 'Lockout redirects applied to guarantee recovery.'
    : keptAsIs
    ? 'Kept as is with unhandled unused state risk warning.'
    : 'Self-correcting: all unused states return to valid operation naturally.';

  const totalTerms = design?.totalCost.terms ?? 0;
  const totalLiterals = design?.totalCost.literals ?? 0;

  return (
    <div
      role="region"
      aria-label="Wizard Completion Summary"
      className={`rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-xs shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 ${className}`}
    >
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <h4 className="font-bold text-emerald-950 dark:text-emerald-200">
          Sequential Synthesis Complete!
        </h4>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Cost Totals */}
        <div className="rounded-lg bg-white/80 p-2.5 dark:bg-gray-900/80">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] block">
            Implementation Cost:
          </span>
          <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
            {totalTerms} terms, {totalLiterals} literals
          </span>
        </div>

        {/* Assistance Metric */}
        <div className="rounded-lg bg-white/80 p-2.5 dark:bg-gray-900/80">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] block">
            Assistance Metric:
          </span>
          <span
            className={`font-semibold text-xs ${
              hasAssistance
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {hasAssistance
              ? `Assisted steps used (${assistedSteps.length} step${assistedSteps.length > 1 ? 's' : ''})`
              : 'Completed fully without assistance'}
          </span>
        </div>

        {/* Lockout Resolution */}
        <div className="rounded-lg bg-white/80 p-2.5 dark:bg-gray-900/80">
          <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] block">
            Lockout Resolution:
          </span>
          <span className="text-gray-800 dark:text-gray-200 text-xs">
            {lockoutDecisionText}
          </span>
        </div>
      </div>
    </div>
  );
};
