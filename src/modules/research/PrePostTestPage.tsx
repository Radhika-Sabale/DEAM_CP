/**
 * @file PrePostTestPage.tsx
 * Counterbalanced Pre-Test and Post-Test diagnostic assessment batteries (Stage 11C).
 *
 * Implements Form A / Form B allocation, locked stage gating with researcher unlock dialog,
 * 20-item question navigation, disabled hints banner, neutral post-submission completion view,
 * and comprehensive research telemetry logging.
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FORM_A_ITEMS, FORM_B_ITEMS, scoreTest } from '../../engine/evaluation/prepost';
import type { PrePostItem } from '../../engine/evaluation/types';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import { PrePostQuestionCard } from './PrePostQuestionCard';

export const PrePostTestPage: FC = () => {
  const [stage, setStage] = useState<'pre' | 'post'>('pre');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [showScore, setShowScore] = useState<boolean>(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState<boolean>(false);

  const formOrder = useStudyStore((s) => s.formOrder);
  const completedTasks = useStudyStore((s) => s.completedTasks);
  const pretestUnlocked = useStudyStore((s) => s.pretestUnlocked);
  const posttestUnlocked = useStudyStore((s) => s.posttestUnlocked);
  const unlockPretest = useStudyStore((s) => s.unlockPretest);
  const unlockPosttest = useStudyStore((s) => s.unlockPosttest);
  const setLatestPretestResult = useStudyStore((s) => s.setLatestPretestResult);
  const setLatestPosttestResult = useStudyStore((s) => s.setLatestPosttestResult);

  const assignedForm: 'A' | 'B' = stage === 'pre' ? formOrder.pre : formOrder.post;
  const items: readonly PrePostItem[] = assignedForm === 'A' ? FORM_A_ITEMS : FORM_B_ITEMS;

  const isStageLocked =
    (stage === 'pre' && completedTasks.pretestCompleted && !pretestUnlocked) ||
    (stage === 'post' && completedTasks.posttestCompleted && !posttestUnlocked);

  const handleSelectAnswer = (ans: string) => {
    const activeItem = items[currentIndex];
    if (activeItem) {
      setAnswers((prev) => ({ ...prev, [activeItem.id]: ans }));
    }
  };

  const handleSubmit = () => {
    const timestamp = new Date().toISOString();
    const result = scoreTest(assignedForm, answers, timestamp);

    if (stage === 'pre') {
      setLatestPretestResult(result);
    } else {
      setLatestPosttestResult(result);
    }

    useLogStore.getState().logEvent({
      eventType: 'pretest/posttest-submitted',
      moduleId: 'prepost',
      testType: stage === 'pre' ? 'pretest' : 'posttest',
      score: result.score,
      maxScore: result.maxScore,
    });

    setIsCompleted(true);
  };

  const handleConfirmUnlock = () => {
    if (stage === 'pre') unlockPretest();
    else unlockPosttest();

    useLogStore.getState().logEvent({
      eventType: 'practice-started',
      moduleId: 'prepost',
      exerciseId: `unlock-${stage}test`,
    });

    setUnlockModalOpen(false);
    setIsCompleted(false);
    setAnswers({});
    setCurrentIndex(0);
  };

  const currentItem = items[currentIndex];

  return (
    <div className="space-y-6">
      {/* Header and Stage Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Diagnostic Assessment ({stage === 'pre' ? 'Pre-Test' : 'Post-Test'})
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Allocated Form: <span className="font-bold text-blue-600 dark:text-blue-400">Form {assignedForm}</span>
          </p>
        </div>

        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800/40">
          <button
            type="button"
            onClick={() => {
              setStage('pre');
              setIsCompleted(false);
              setCurrentIndex(0);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === 'pre'
                ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Pre-Test
          </button>
          <button
            type="button"
            onClick={() => {
              setStage('post');
              setIsCompleted(false);
              setCurrentIndex(0);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === 'post'
                ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Post-Test
          </button>
        </div>
      </div>

      {/* Strict Research Constraint Advisory */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <span className="font-bold">Research Assessment Notice: </span>
        This diagnostic test is designed for pedagogy evaluation. Hints, &quot;Show solution&quot;, and practice
        assistance are strictly disabled while taking this assessment.
      </div>

      {isCompleted ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 text-xl font-bold">
            ✓
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Assessment Completed
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
            Thank you for completing this assessment. Your responses have been recorded locally for research analysis.
          </p>

          {/* Optional score reveal */}
          <div className="pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showScore}
                onChange={(e) => setShowScore(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Show my score (Participant review)</span>
            </label>
          </div>

          {showScore && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 font-mono text-sm dark:bg-gray-800">
              Score: {Object.keys(answers).length} questions evaluated. Form {assignedForm}.
            </div>
          )}
        </div>
      ) : isStageLocked ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {stage === 'pre' ? 'Pre-Test' : 'Post-Test'} Already Completed
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            You have already submitted this assessment. In research protocols, repeated takes are
            locked unless specifically authorized by an instructor.
          </p>
          <Button variant="secondary" size="md" onClick={() => setUnlockModalOpen(true)}>
            Unlock Retake (Instructor Auth)
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Question Navigator */}
          <nav
            aria-label="Assessment Question Navigator"
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-bold uppercase tracking-wider">Question Navigator</span>
              <span>{Object.keys(answers).length} of {items.length} answered</span>
            </div>
            <div
              role="group"
              aria-label="Questions list"
              className="grid grid-cols-5 gap-1.5 sm:grid-cols-10"
            >
              {items.map((it, idx) => {
                const isAns = String(answers[it.id] ?? '').trim() !== '';
                const isCur = idx === currentIndex;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-current={isCur ? 'true' : undefined}
                    aria-label={`Question ${idx + 1}: ${isAns ? 'Answered' : 'Unanswered'}`}
                    className={`rounded-lg border p-1.5 text-center text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      isCur
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/30 dark:border-blue-400 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    <span className="block text-[9px] font-normal">
                      {isAns ? '✓ Ans' : '○ Pend'}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {currentItem && (
            <PrePostQuestionCard
              item={currentItem}
              questionIndex={currentIndex}
              totalQuestions={items.length}
              selectedAnswer={answers[currentItem.id] ?? ''}
              onSelectAnswer={handleSelectAnswer}
              onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      )}

      {/* Unlock Confirmation Modal */}
      <Modal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        title="Unlock Assessment Retake"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to unlock {stage === 'pre' ? 'Pre-Test' : 'Post-Test'} retake?
            This will allow a second attempt and will be recorded in the telemetry log.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setUnlockModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmUnlock}>
              Confirm Unlock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
