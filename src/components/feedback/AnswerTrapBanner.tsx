/**
 * @file AnswerTrapBanner.tsx
 * Alert banner warning students when a terminal correct answer was reached through
 * invalid intermediate reasoning, broken algebraic chains, or direct level-3 assistance.
 */

import { type FC } from 'react';
import type { AnswerTrapFlag } from '../../types/feedback';
import { useLogStore } from '../../store/logStore';

export interface AnswerTrapBannerProps {
  readonly flag: AnswerTrapFlag;
  readonly onDismiss?: () => void;
  readonly onSelectStep?: (stepKey: string) => void;
  readonly className?: string;
}

export const AnswerTrapBanner: FC<AnswerTrapBannerProps> = ({
  flag,
  onDismiss,
  onSelectStep,
  className = '',
}) => {
  const handleDismiss = () => {
    // Log the dismissal action to telemetry
    useLogStore.getState().logEvent({
      eventType: 'practice-started',
      moduleId: 'feedback',
      exerciseId: 'dismiss-answer-trap',
      category: 'trap-dismissed',
    });
    onDismiss?.();
  };

  const handleStepClick = (stepKey: string) => {
    onSelectStep?.(stepKey);
    const el = document.getElementById(stepKey);
    if (el) {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      el.focus();
    }
  };

  return (
    <div
      role="region"
      aria-label="Pedagogical reasoning alert"
      aria-live="polite"
      className={`rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/40 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
            aria-hidden="true"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </span>

          <div>
            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
              Answer Trap Detected
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {flag.notes}
            </p>

            {flag.inconsistentSteps.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-amber-950 dark:text-amber-300">
                  Review offending steps:
                </span>
                {flag.inconsistentSteps.map((stepKey) => (
                  <button
                    key={stepKey}
                    type="button"
                    onClick={() => handleStepClick(stepKey)}
                    className="inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 hover:text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500 dark:border-amber-700 dark:bg-gray-900 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    aria-label={`Jump to ${stepKey}`}
                  >
                    {stepKey}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:hover:text-amber-200"
            aria-label="Dismiss answer trap alert"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
