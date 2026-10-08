/**
 * @file StepFrame.tsx
 * Shared step container providing consistent layout, instructions, action buttons
 * (Check, Show me with confirmation), live status line, telemetry timing,
 * and cognitive feedback elements (HintLadder, DiagnosisCard, AnswerTrapBanner).
 */

import { useState, useEffect, type FC, type ReactNode } from 'react';
import type { AnswerTrapFlag, Diagnosis } from '../../types/feedback';
import { useStepTimer } from '../../hooks/useStepTimer';
import { useLogStore } from '../../store/logStore';
import { DiagnosisCard } from '../../components/feedback/DiagnosisCard';
import { HintLadder } from '../../components/feedback/HintLadder';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import type { StepId, StepStatus } from './sequentialSession';

export interface StepFrameProps {
  /** Sequential wizard step identifier */
  readonly stepId: StepId;
  /** Primary title of the step */
  readonly title: string;
  /** Clear pedagogical instructions */
  readonly instructions: string;
  /** Step interactive body */
  readonly children: ReactNode;
  /** Current step completion status */
  readonly status?: StepStatus;
  /** Explicit status feedback message */
  readonly statusMessage?: string;
  /** Callback to trigger verification */
  readonly onCheck?: () => void;
  /** Callback to trigger worked-example auto fill */
  readonly onShowMe?: () => void;
  /** Whether a check operation is in flight */
  readonly isChecking?: boolean;
  /** Whether the Check button should be disabled */
  readonly disableCheck?: boolean;
  /** Whether the Show me button should be disabled */
  readonly disableShowMe?: boolean;
  /** Optionally hide the bottom action toolbar */
  readonly hideActions?: boolean;
  /** Diagnostic error record for the latest failure */
  readonly lastDiagnosis?: Diagnosis | null;
  /** Step key for triggering progressive hints */
  readonly lastFailedStepKey?: string | null;
  /** Answer trap pedagogical flag */
  readonly answerTrapFlag?: AnswerTrapFlag | null;
  /** Callback when answer trap banner is dismissed */
  readonly onDismissAnswerTrap?: () => void;
  /** Additional styling class names */
  readonly className?: string;
}

/**
 * Renders the status icon and label pair for accessible status presentation.
 */
function renderStatusBadge(status?: StepStatus, message?: string) {
  if (!status && !message) return null;

  switch (status) {
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{message ?? 'Verified: Step complete.'}</span>
        </span>
      );
    case 'assisted':
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>{message ?? 'Assisted: Solution revealed.'}</span>
        </span>
      );
    case 'in-progress':
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <span>{message ?? 'In progress: Reviewing work.'}</span>
        </span>
      );
    default:
      if (message) {
        return (
          <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
            <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />
            <span>{message}</span>
          </span>
        );
      }
      return null;
  }
}

export const StepFrame: FC<StepFrameProps> = ({
  stepId,
  title,
  instructions,
  children,
  status,
  statusMessage,
  onCheck,
  onShowMe,
  isChecking = false,
  disableCheck = false,
  disableShowMe = false,
  hideActions = false,
  lastDiagnosis,
  lastFailedStepKey,
  answerTrapFlag,
  onDismissAnswerTrap,
  className = '',
}) => {
  const [confirmShowMe, setConfirmShowMe] = useState(false);
  const { start: startTimer, reset: resetTimer } = useStepTimer();

  useEffect(() => {
    startTimer();
    useLogStore.getState().logEvent({
      eventType: 'step-started',
      moduleId: 'sequential-designer',
      stepId,
    });
    return () => {
      resetTimer();
    };
  }, [stepId, startTimer, resetTimer]);

  const handleShowMeClick = () => {
    setConfirmShowMe(true);
  };

  const handleConfirmShowMe = () => {
    setConfirmShowMe(false);
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId: 'sequential-designer',
      stepId,
      level: 3,
    });
    onShowMe?.();
  };

  const handleCancelShowMe = () => {
    setConfirmShowMe(false);
  };

  return (
    <section
      aria-labelledby={`step-title-${stepId}`}
      className={`space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Step Header */}
      <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
        <h3
          id={`step-title-${stepId}`}
          className="text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {instructions}
        </p>
      </div>

      {/* Main Step Content */}
      <div className="space-y-4">
        {children}
      </div>

      {/* Answer Trap Alert if student stumbled into correct terminal state with invalid steps */}
      {answerTrapFlag && (
        <AnswerTrapBanner
          flag={answerTrapFlag}
          onDismiss={onDismissAnswerTrap}
        />
      )}

      {/* Bottom Actions and Status Toolbar */}
      {!hideActions && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {onCheck && (
              <button
                type="button"
                onClick={onCheck}
                disabled={disableCheck || isChecking}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {isChecking ? 'Checking...' : 'Check'}
              </button>
            )}
            {onShowMe && (
              <button
                type="button"
                onClick={handleShowMeClick}
                disabled={disableShowMe}
                className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
              >
                Show me
              </button>
            )}
          </div>

          <div
            aria-live="polite"
            className="text-xs"
          >
            {renderStatusBadge(status, statusMessage)}
          </div>
        </div>
      )}

      {/* Show Me Confirmation Alert */}
      {confirmShowMe && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-showme-title"
          aria-describedby="confirm-showme-desc"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          <h4 id="confirm-showme-title" className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Confirm Worked Example Assistance
          </h4>
          <p id="confirm-showme-desc" className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            This fills in the correct answer and marks the step as assisted.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmShowMe}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Fill &amp; Mark Assisted
            </button>
            <button
              type="button"
              onClick={handleCancelShowMe}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cognitive Scaffolding: Diagnosis Card & Hint Ladder */}
      {lastDiagnosis && (
        <div className="space-y-4 pt-2">
          <DiagnosisCard diagnosis={lastDiagnosis} />
          {lastFailedStepKey && (
            <HintLadder stepKey={lastFailedStepKey} />
          )}
        </div>
      )}
    </section>
  );
};
