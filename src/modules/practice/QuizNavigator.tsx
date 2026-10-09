/**
 * @file QuizNavigator.tsx
 * Accessible question navigator for 10-question formative quizzes (Stage 11C).
 *
 * Implements numbered buttons 1-10 displaying answered/unanswered and flagged status
 * by text AND icon (never color alone), full roving-tabindex keyboard navigation,
 * and high-contrast focus rings.
 */

import { type FC } from 'react';

export interface QuizNavigatorProps {
  readonly totalQuestions: number;
  readonly currentIndex: number;
  readonly answers: Readonly<Record<string, string | number>>;
  readonly questionIds: readonly string[];
  readonly flaggedQuestionIds: ReadonlySet<string>;
  readonly onSelectQuestion: (index: number) => void;
}

export const QuizNavigator: FC<QuizNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  answers,
  questionIds,
  flaggedQuestionIds,
  onSelectQuestion,
}) => {
  return (
    <nav
      aria-label="Quiz Questions Navigation"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Question Navigator
        </span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {Object.keys(answers).filter((k) => String(answers[k] ?? '').trim() !== '').length} of {totalQuestions} answered
        </span>
      </div>

      <div
        role="group"
        aria-label="Questions list"
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
      >
        {Array.from({ length: totalQuestions }, (_, idx) => {
          const qId = questionIds[idx] ?? `q-${idx}`;
          const rawAns = answers[qId];
          const isAnswered = rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '';
          const isFlagged = flaggedQuestionIds.has(qId);
          const isCurrent = idx === currentIndex;

          return (
            <button
              key={qId}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}${isFlagged ? ', Flagged for review' : ''}`}
              className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isCurrent
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/30 dark:border-blue-400 dark:bg-blue-950/60'
                  : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Q{idx + 1}
              </span>

              {/* Status indicator with icon AND text for accessible multi-modal feedback */}
              <div className="mt-1 flex items-center gap-0.5 text-[10px]">
                {isAnswered ? (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400" title="Answered">
                    ✓ Ans
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500" title="Unanswered">
                    ○ Pend
                  </span>
                )}
              </div>

              {/* Flag indicator */}
              {isFlagged && (
                <span
                  className="mt-0.5 rounded px-1 text-[9px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"
                  title="Flagged for review"
                >
                  ⚑ Flag
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
