/**
 * @file PrePostQuestionCard.tsx
 * Card rendering an active pre/post evaluation battery question (Stage 11C).
 *
 * Implements accessible radio group selection, option buttons, and disabled hint notes.
 */

import { type FC } from 'react';
import { Button } from '../../components/ui/Button';
import type { PrePostItem } from '../../engine/evaluation/types';

export interface PrePostQuestionCardProps {
  readonly item: PrePostItem;
  readonly questionIndex: number;
  readonly totalQuestions: number;
  readonly selectedAnswer: string;
  readonly onSelectAnswer: (answer: string) => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSubmit: () => void;
}

export const PrePostQuestionCard: FC<PrePostQuestionCardProps> = ({
  item,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
}) => {
  const isFirst = questionIndex === 0;
  const isLast = questionIndex === totalQuestions - 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-6">
      <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
        <span className="inline-block rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
          Question {questionIndex + 1} of {totalQuestions} • {item.topic}
        </span>
        <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          {item.prompt}
        </h3>
      </div>

      {/* Radio group answer options */}
      <div
        role="radiogroup"
        aria-label={item.prompt}
        className="space-y-3"
      >
        {item.options.map((opt, idx) => {
          const isChecked = selectedAnswer === opt;
          return (
            <label
              key={idx}
              className={`flex items-center gap-3.5 rounded-lg border p-3.5 cursor-pointer transition-all ${
                isChecked
                  ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/40'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40'
              }`}
            >
              <input
                type="radio"
                name={`prepost-${item.id}`}
                value={opt}
                checked={isChecked}
                onChange={() => onSelectAnswer(opt)}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {opt}
              </span>
            </label>
          );
        })}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button
          variant="secondary"
          size="md"
          disabled={isFirst}
          onClick={onPrevious}
        >
          Previous
        </Button>

        {isLast ? (
          <Button variant="primary" size="md" onClick={onSubmit}>
            Submit Assessment
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={onNext}>
            Next Question
          </Button>
        )}
      </div>
    </div>
  );
};
