/**
 * @file QuizPage.tsx
 * Formative 10-question diagnostic quiz page (Stage 11C).
 *
 * Implements topic selection, 10-question navigation with text+icon status,
 * flag-for-review, radio group semantics, format hints, unanswered check modal,
 * active timer display, telemetry logging, and misconception-grounded review.
 */

import { type FC, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AVAILABLE_TOPICS, buildQuiz, scoreQuiz } from '../../engine/practice/quiz';
import type { Quiz, QuizResult } from '../../engine/practice/types';
import { useStepTimer } from '../../hooks/useStepTimer';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import { QuizNavigator } from './QuizNavigator';
import { QuizReview } from './QuizReview';

export const QuizPage: FC = () => {
  const [topic, setTopic] = useState<string>(AVAILABLE_TOPICS[0] ?? 'boolean-tool');
  const [seed, setSeed] = useState<number>(101);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  // Active step timer for informational display
  const timer = useStepTimer();

  const handleInitQuiz = (selectedTopic: string, currentSeed: number) => {
    const q = buildQuiz(selectedTopic, currentSeed);
    setQuiz(q);
    setCurrentIndex(0);
    setAnswers({});
    setFlaggedIds(new Set());
    setIsSubmitted(false);
    setQuizResult(null);
    timer.reset();
    timer.start();
  };

  useEffect(() => {
    handleInitQuiz(topic, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, seed]);

  if (!quiz) return null;

  const currentQ = quiz.questions[currentIndex];
  if (!currentQ) return null;

  const currentAns = answers[currentQ.id] ?? '';
  const isFlagged = flaggedIds.has(currentQ.id);

  const handleSelectAnswer = (ans: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: ans }));
  };

  const handleToggleFlag = () => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  };

  const unansweredIndices = quiz.questions
    .map((q, idx) => (String(answers[q.id] ?? '').trim() === '' ? idx + 1 : null))
    .filter((n): n is number => n !== null);

  const handleSubmitAttempt = () => {
    if (unansweredIndices.length > 0) {
      setConfirmModalOpen(true);
      return;
    }
    executeSubmit();
  };

  const executeSubmit = () => {
    setConfirmModalOpen(false);
    timer.stop();
    const scored = scoreQuiz(quiz, answers);
    setQuizResult(scored);
    setIsSubmitted(true);

    // Telemetry: log quiz-answered events for each question
    for (const q of quiz.questions) {
      const qRes = scored.perQuestion.find((r) => r.questionId === q.id);
      useLogStore.getState().logEvent({
        eventType: 'quiz-answered',
        moduleId: topic,
        questionId: q.id,
        selectedOption: String(answers[q.id] ?? ''),
        isCorrect: qRes?.correct ?? false,
      });
    }

    // Log module-completed event
    useLogStore.getState().logEvent({
      eventType: 'module-completed',
      moduleId: topic,
      durationMs: timer.elapsedMs,
      finalScore: scored.score,
    });

    useStudyStore.getState().recordTaskCompleted('quizzesCompletedCount');
  };

  const seconds = Math.floor(timer.elapsedMs / 1000);
  const formattedTime = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Quiz Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Formative Concept Quiz
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="quiz-topic-select" className="text-xs font-bold uppercase text-gray-500">
            Topic:
          </label>
          <select
            id="quiz-topic-select"
            value={topic}
            disabled={isSubmitted}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {AVAILABLE_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            ⏱ {formattedTime}
          </div>
        </div>
      </div>

      {isSubmitted && quizResult ? (
        <QuizReview
          quiz={quiz}
          result={quizResult}
          answers={answers}
          onRetake={() => {
            setSeed((s) => s + 1);
          }}
        />
      ) : (
        <div className="space-y-6">
          <QuizNavigator
            totalQuestions={quiz.questions.length}
            currentIndex={currentIndex}
            answers={answers}
            questionIds={quiz.questions.map((q) => q.id)}
            flaggedQuestionIds={flaggedIds}
            onSelectQuestion={setCurrentIndex}
          />

          {/* Active Question Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <span className="inline-block rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  Question {currentIndex + 1} of {quiz.questions.length} • {currentQ.difficulty.toUpperCase()}
                </span>
                <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {currentQ.prompt}
                </p>
              </div>

              <Button
                variant={isFlagged ? 'secondary' : 'ghost'}
                size="sm"
                onClick={handleToggleFlag}
                className="shrink-0 text-xs gap-1.5"
              >
                <span>{isFlagged ? '⚑ Flagged' : '⚐ Flag for review'}</span>
              </Button>
            </div>

            {/* Answer Input: Multiple Choice or Short Answer */}
            {currentQ.type === 'multiple-choice' && currentQ.options ? (
              <div role="radiogroup" aria-label={currentQ.prompt} className="space-y-2.5">
                {currentQ.options.map((opt, oIdx) => {
                  const isChecked = currentAns === opt;
                  return (
                    <label
                      key={oIdx}
                      className={`flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`quiz-q-${currentQ.id}`}
                        value={opt}
                        checked={isChecked}
                        onChange={() => handleSelectAnswer(opt)}
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor={`short-ans-${currentQ.id}`} className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Your Answer:
                </label>
                <input
                  id={`short-ans-${currentQ.id}`}
                  type="text"
                  value={currentAns}
                  placeholder="e.g. 1010 or A + B"
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 font-mono"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Format hint: Enter decimal, binary bit-string, or algebraic expression.
                </p>
              </div>
            )}

            {/* Stepper Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button
                variant="secondary"
                size="md"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>

              <div className="flex gap-2">
                {currentIndex < quiz.questions.length - 1 ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setCurrentIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button variant="primary" size="md" onClick={handleSubmitAttempt}>
                    Submit Quiz
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unanswered Submit Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Unanswered Questions Confirmation"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You have {unansweredIndices.length} unanswered questions:
          </p>
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {unansweredIndices.map((num) => (
              <span key={num} className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Q{num}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Unanswered questions will be scored as 0. Do you want to submit now?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmModalOpen(false)}>
              Back to Quiz
            </Button>
            <Button variant="danger" onClick={executeSubmit}>
              Submit Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
