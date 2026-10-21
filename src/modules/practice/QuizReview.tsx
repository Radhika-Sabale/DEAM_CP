/**
 * @file QuizReview.tsx
 * Post-submission formative quiz review card (Stage 11C).
 *
 * Displays score out of 10, per-question correctness breakdown with expected and
 * student responses, diagnostic misconception catalog entries for incorrect answers,
 * and actionable links to target practice modules.
 */

import { type FC } from 'react';
import { Button } from '../../components/ui/Button';
import { getMisconception } from '../../engine/feedback/misconceptions';
import type { Quiz, QuizResult } from '../../engine/practice/types';
import { formatActiveDuration } from '../../hooks/useActiveQuizTimer';
import { useUiStore } from '../../store/uiStore';
import type { ModuleId } from '../../types/designProject';

export interface QuizReviewProps {
  readonly quiz: Quiz;
  readonly result: QuizResult;
  readonly answers: Readonly<Record<string, string | number>>;
  readonly durationMs?: number;
  readonly onRetake: () => void;
}

export const QuizReview: FC<QuizReviewProps> = ({
  quiz,
  result,
  answers,
  durationMs = 0,
  onRetake,
}) => {
  const setModule = useUiStore((s) => s.setModule);

  const percentage = Math.round((result.score / result.totalQuestions) * 100);

  return (
    <div className="space-y-6">
      {/* Score Summary Banner */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Quiz Results: {quiz.topic}
        </h3>
        <div className="mt-4 flex flex-col items-center justify-center">
          <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
            {result.score} / {result.totalQuestions}
          </div>
          <span className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {percentage}% Correct
          </span>
          <span className="quiz-result-duration" aria-label="Active quiz time">
            Active time {formatActiveDuration(durationMs)}
          </span>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" size="md" onClick={onRetake}>
            Retake Quiz (New Questions)
          </Button>
        </div>
      </div>

      {/* Detailed Per-Question Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-6">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 pb-3 dark:border-gray-800">
          Question by Question Breakdown
        </h4>

        <div className="space-y-4">
          {quiz.questions.map((q, idx) => {
            const qResult = result.perQuestion.find((r) => r.questionId === q.id);
            const isCorrect = qResult?.correct ?? false;
            const studentAns = String(answers[q.id] ?? 'Unanswered');
            const misconceptionTag = qResult?.misconceptionTag;

            let misconceptionInfo: { title: string; description: string } | null = null;
            if (misconceptionTag) {
              try {
                const catalogEntry = getMisconception(misconceptionTag);
                misconceptionInfo = {
                  title: catalogEntry.title,
                  description: catalogEntry.description,
                };
              } catch {
                // Fallback if tag unknown
              }
            }

            return (
              <div
                key={q.id}
                className={`rounded-lg border p-4 transition-colors ${
                  isCorrect
                    ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-950/30 dark:bg-emerald-950/10'
                    : 'border-red-200 bg-red-50/20 dark:border-red-950/30 dark:bg-red-950/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      Question {idx + 1} • {q.subSkill}
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {q.prompt}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold shrink-0 ${
                      isCorrect
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                    }`}
                  >
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-white/70 p-2 border border-gray-100 dark:bg-gray-800/60 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Your Answer: </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 font-mono">
                      {studentAns}
                    </span>
                  </div>
                  <div className="rounded bg-white/70 p-2 border border-gray-100 dark:bg-gray-800/60 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Correct Answer: </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                      {q.correctAnswer}
                    </span>
                  </div>
                </div>

                {q.explanation && <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Explanation: </span>{q.explanation}</p>}

                {/* Cognitive Misconception Diagnosis */}
                {misconceptionInfo && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 space-y-2">
                    <div>
                      <span className="font-bold">Detected Misconception: </span>
                      <span className="font-semibold">{misconceptionInfo.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                      {misconceptionInfo.description}
                    </p>
                    <div className="pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setModule(quiz.topic as ModuleId);
                        }}
                        className="text-xs"
                      >
                        Practise this skill in {quiz.topic}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

