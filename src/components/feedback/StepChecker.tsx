/**
 * @file StepChecker.tsx
 * Reusable pedagogical step-checking harness combining input slot, debounced submission,
 * active step timing via useStepTimer, inline DiagnosisCard on errors, HintLadder,
 * and high-contrast accessible success indicators.
 */

import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';
import type { FeedbackResult, StepSubmission } from '../../types/feedback';
import type { StepContext } from '../../engine/feedback/types';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useStepTimer } from '../../hooks/useStepTimer';
import { DiagnosisCard } from './DiagnosisCard';
import { HintLadder } from './HintLadder';

export interface StepCheckerProps {
  readonly moduleId: string;
  readonly stepId: string;
  readonly title: string;
  readonly description?: string;
  readonly buildSubmission: () => StepSubmission;
  readonly context?: StepContext;
  readonly renderInput: (state: {
    readonly isSubmitting: boolean;
    readonly hasSubmitted: boolean;
    readonly isCorrect: boolean;
  }) => ReactNode;
  readonly onSuccess?: () => void;
  readonly className?: string;
}

export const StepChecker: FC<StepCheckerProps> = ({
  stepId,
  title,
  description,
  buildSubmission,
  context,
  renderInput,
  onSuccess,
  className = '',
}) => {
  const submitStep = useFeedbackStore((s) => s.submitStep);
  const friendlyText = useFeedbackStore((s) => s.friendlyTexts[stepId]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);

  // Active step timer automatically pauses on tab blur and inactivity
  const timer = useStepTimer();
  const { start: startTimer, reset: resetTimer } = timer;

  useEffect(() => {
    startTimer();
    return () => {
      resetTimer();
    };
  }, [stepId, startTimer, resetTimer]);

  const lastSubmitRef = useRef<number>(0);

  const handleSubmit = () => {
    const now = Date.now();
    if (isSubmitting || now - lastSubmitRef.current < 400) return; // Prevent double submission
    lastSubmitRef.current = now;
    setIsSubmitting(true);

    timer.stop();
    const submission = buildSubmission();
    const outcome = submitStep(submission, context);

    setResult(outcome);
    setHasSubmitted(true);
    setIsSubmitting(false);

    if (outcome.ok) {
      onSuccess?.();
    }
  };

  const handleTryAgain = () => {
    lastSubmitRef.current = 0;
    setResult(null);
    setHasSubmitted(false);
    timer.reset();
    timer.start();
  };

  const isCorrect = !!(result && result.ok);
  const hasError = !!(result && !result.ok);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Title & Description */}
      <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {/* Student Input Slot */}
      <div className="my-4">
        {renderInput({
          isSubmitting,
          hasSubmitted,
          isCorrect,
        })}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!isCorrect && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? 'Checking...' : 'Check My Step'}
          </button>
        )}

        {hasSubmitted && (
          <button
            type="button"
            onClick={handleTryAgain}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Try Again
          </button>
        )}
      </div>

      {/* Correct Verdict State */}
      {isCorrect && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold">Correct! Step verified.</p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              {result?.message || 'Your step matches the expected logical transformation.'}
            </p>
          </div>
        </div>
      )}

      {/* Failure Verdict State: DiagnosisCard + HintLadder */}
      {hasError && result?.diagnoses[0] && (
        <div className="mt-4 space-y-4">
          <DiagnosisCard
            diagnosis={result.diagnoses[0]}
            friendlyText={friendlyText}
          />
          <HintLadder stepKey={stepId} />
        </div>
      )}
    </div>
  );
};
