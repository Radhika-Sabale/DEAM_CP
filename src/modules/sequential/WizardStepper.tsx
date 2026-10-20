/**
 * @file WizardStepper.tsx
 * Accessible sequential designer wizard progress stepper (Stage 10D).
 *
 * Implements real <ol> element semantics, aria-current="step", keyboard navigation
 * between unlocked steps, explicit status icons and text, and lock explanations.
 */

import type { FC } from 'react';
import {
  getStepLockReason,
  isStepUnlocked,
  SEQUENTIAL_STEP_IDS,
  STEP_TITLES,
  type SequentialSessionState,
  type SequentialStepId,
  type StepStatus,
} from './sequentialSession';

export interface WizardStepperProps {
  readonly state: SequentialSessionState;
  readonly onSelectStep: (stepId: SequentialStepId) => void;
  readonly className?: string;
}

/** Icon for locked step. */
const LockIcon: FC<{ readonly className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/** Icon for not started step. */
const NotStartedIcon: FC<{ readonly className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

/** Icon for in-progress step. */
const InProgressIcon: FC<{ readonly className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/** Icon for verified step. */
const VerifiedIcon: FC<{ readonly className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/** Icon for assisted step. */
const AssistedIcon: FC<{ readonly className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

/** Helper formatting step status to icon and label. */
function renderStatusVisuals(status: StepStatus, isLocked: boolean, isCurrent: boolean) {
  if (isLocked) {
    return {
      icon: <LockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />,
      label: 'Locked',
      badgeClass:
        'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    };
  }

  if (isCurrent) {
    return {
      icon: <InProgressIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      label: 'Current',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    };
  }

  switch (status) {
    case 'verified':
      return {
        icon: <VerifiedIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        label: 'Done',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'assisted':
      return {
        icon: <AssistedIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
        label: 'Done',
        badgeClass:
          'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
      };
    case 'in-progress':
      return {
        icon: <InProgressIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
        label: 'In progress',
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      };
    case 'not-started':
    default:
      return {
        icon: <NotStartedIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />,
        label: 'Not started',
        badgeClass:
          'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      };
  }
}

/**
 * Renders the 8-step wizard stepper navigation bar.
 */
export const WizardStepper: FC<WizardStepperProps> = ({
  state,
  onSelectStep,
  className = '',
}) => {
  const hasLockedSteps = SEQUENTIAL_STEP_IDS.some((stepId) => !isStepUnlocked(state, stepId));
  return (
    <nav
      aria-label="Sequential design steps"
      className={`rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <ol className="sequential-wizard-grid grid gap-2">
        {SEQUENTIAL_STEP_IDS.map((stepId, index) => {
          const isCurrent = state.currentStep === stepId;
          const unlocked = isStepUnlocked(state, stepId);
          const lockReason = getStepLockReason(state, stepId);
          const stepState = state.steps[stepId];
          const visuals = renderStatusVisuals(stepState.status, !unlocked, isCurrent);
          const stepNumber = index + 1;
          const title = STEP_TITLES[stepId];

          return (
            <li key={stepId} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (unlocked) {
                    onSelectStep(stepId);
                  }
                }}
                disabled={!unlocked}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={!unlocked}
                title={lockReason ? `${title} (Locked: ${lockReason})` : title}
                className={`group flex w-full flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs dark:border-blue-500 dark:bg-blue-950/40'
                    : unlocked
                      ? 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/60'
                      : 'cursor-not-allowed border-gray-100 bg-gray-50/50 opacity-60 dark:border-gray-800/50 dark:bg-gray-950/30'
                }`}
              >
                {/* Step header: Index + status badge */}
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="wizard-step-number text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    Step {stepNumber}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${visuals.badgeClass}`}
                  >
                    {visuals.icon}
                    <span>{visuals.label}</span>
                  </span>
                </div>

                {/* Step title */}
                <span
                  className={`text-xs font-semibold leading-tight ${
                    isCurrent
                      ? 'text-blue-900 dark:text-blue-200'
                      : unlocked
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {title}
                </span>

                {/* Reason locked advisory */}
                {!unlocked && lockReason && (
                  <span
                    className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400"
                    aria-label={`Locked: ${lockReason}`}
                  >
                    {lockReason}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {hasLockedSteps && (
        <p className="sequential-step-hint" role="note">
          Define a valid sequential specification first.
        </p>
      )}
    </nav>
  );
};
