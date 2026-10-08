/**
 * @file HintLadder.tsx
 * Interactive three-tiered progressive hint ladder component for Socratic scaffolding.
 * Calls feedbackStore.requestHint to unlock levels 1, 2, and 3, automatically logging
 * telemetry and marking level-3 requests as assisted.
 */

import { type FC } from 'react';
import { useFeedbackStore } from '../../store/feedbackStore';

export interface HintLadderProps {
  readonly stepKey: string;
  readonly className?: string;
}

const LEVEL_LABELS: Record<number, { title: string; desc: string }> = {
  1: { title: 'Level 1: Nudge', desc: 'Gentle rule or concept reminder' },
  2: { title: 'Level 2: Pointed', desc: 'Direct hint identifying error site' },
  3: { title: 'Level 3: Worked Step', desc: 'Complete worked transformation (Assisted)' },
};

export const HintLadder: FC<HintLadderProps> = ({ stepKey, className = '' }) => {
  const session = useFeedbackStore((s) => s.hintSessions[stepKey]);
  const assisted = useFeedbackStore((s) => !!s.assistedSteps[stepKey]);
  const latestDiagnoses = useFeedbackStore((s) => s.latestDiagnoses[stepKey] ?? []);
  const requestHint = useFeedbackStore((s) => s.requestHint);

  const levelsShown = session?.levelsShown ?? [];
  const currentLevelCount = levelsShown.length;
  const nextLevel = currentLevelCount === 0 ? 1 : currentLevelCount === 1 ? 2 : 3;
  const canRequest = latestDiagnoses.length > 0;

  const handleNextHint = () => {
    requestHint(stepKey);
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Progressive Hint Ladder
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Socratic guidance: Nudge &rarr; Pointed &rarr; Worked solution
          </p>
        </div>

        <button
          type="button"
          onClick={handleNextHint}
          disabled={!canRequest}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label={
            currentLevelCount >= 3
              ? 'Repeat Level 3 worked step hint'
              : `Unlock hint level ${nextLevel} of 3`
          }
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>
            {currentLevelCount === 0
              ? 'Get first hint (Level 1)'
              : currentLevelCount >= 3
                ? 'Repeat Level 3 Hint'
                : `Unlock Level ${nextLevel} Hint`}
          </span>
        </button>
      </div>

      {/* Announced Hints Container */}
      <div className="mt-3 space-y-3" aria-live="polite">
        {levelsShown.length === 0 ? (
          <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
            No hints unlocked for this step yet. Try checking your work first!
          </p>
        ) : (
          levelsShown.map((hint, idx) => {
            const meta = LEVEL_LABELS[hint.level] ?? { title: `Level ${hint.level}`, desc: '' };
            const isLevel3 = hint.level === 3;

            return (
              <div
                key={`${hint.stepId}-${hint.level}-${idx}`}
                className={`rounded-lg border p-3 transition-all ${
                  isLevel3
                    ? 'border-amber-300 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30'
                    : 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                      isLevel3
                        ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                        : 'bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200'
                    }`}
                  >
                    {meta.title}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    Step {idx + 1} of 3
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-gray-900 dark:text-gray-100">
                  {hint.content}
                </p>

                {isLevel3 && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    <span aria-hidden="true">&bull;</span>
                    Note: Unlocking Level 3 marks this step as assisted for pedagogical research.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Assisted Indicator Banner */}
      {assisted && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <span>Status: Assisted by Worked Step</span>
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
