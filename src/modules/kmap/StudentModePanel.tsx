/**
 * @file StudentModePanel.tsx
 * Interactive student practice mode harness integrating cell selection,
 * StepChecker evaluation for individual groups ('kmap-group'), DiagnosisCard
 * with grid hatching badges, HintLadder, final set validation ('kmap-group-set'),
 * answer-trap banner, equivalence comparison, and assisted solution reveals.
 */

import { type FC, useEffect, useState } from 'react';
import type { Diagnosis, FeedbackResult, StepSubmission } from '../../types/feedback';
import type { StepContext } from '../../engine/feedback/types';
import type { KMapSolution } from '../../engine/kmap/types';
import {
  convertGroupsToExpression,
  validateGroupSet,
  type GroupSetValidationResult,
} from '../../engine/kmap/groupValidator';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { useStepTimer } from '../../hooks/useStepTimer';
import { DiagnosisCard } from '../../components/feedback/DiagnosisCard';
import { HintLadder } from '../../components/feedback/HintLadder';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import { LlmSettings } from '../../components/feedback/LlmSettings';

export interface StudentModePanelProps {
  readonly variableCount: number;
  readonly variableNames: readonly string[];
  readonly minterms: readonly number[];
  readonly dontCares: readonly number[];
  readonly selectedCells: readonly number[];
  readonly onClearSelection: () => void;
  readonly studentGroups: readonly (readonly number[])[];
  readonly onAddGroup: (cells: readonly number[]) => void;
  readonly onRemoveGroup: (index: number) => void;
  readonly onResetStudentGroups: () => void;
  readonly onSetHighlight: (cells: readonly number[], label?: string) => void;
  readonly onRevealSolution: () => void;
  readonly solverSolution: KMapSolution | null;
  readonly mode: 'SOP' | 'POS';
  readonly onModeChange: (mode: 'SOP' | 'POS') => void;
}

export const StudentModePanel: FC<StudentModePanelProps> = ({
  variableCount,
  variableNames,
  minterms,
  dontCares,
  selectedCells,
  onClearSelection,
  studentGroups,
  onAddGroup,
  onRemoveGroup,
  onResetStudentGroups,
  onSetHighlight,
  onRevealSolution,
  solverSolution,
  mode,
  onModeChange,
}) => {
  const submitStep = useFeedbackStore((s) => s.submitStep);
  const completeAttempt = useFeedbackStore((s) => s.completeAttempt);
  const latestAnswerTrap = useFeedbackStore((s) => s.latestAnswerTrap);

  const [currentStepKey, setCurrentStepKey] = useState<string>('group-1');
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<Diagnosis | null>(null);
  const [groupSetResult, setGroupSetResult] = useState<GroupSetValidationResult | null>(null);
  const [hasCheckedSet, setHasCheckedSet] = useState<boolean>(false);

  const timer = useStepTimer();
  const { start: startTimer, reset: resetTimer } = timer;

  useEffect(() => {
    startTimer();
    useLogStore.getState().logEvent({
      eventType: 'step-started',
      moduleId: 'kmap-solver',
      stepId: currentStepKey,
    });
    return () => {
      resetTimer();
    };
  }, [currentStepKey, startTimer, resetTimer]);

  // Derived student expression
  const studentExprResult = convertGroupsToExpression(
    { variableCount, minterms, dontCares, mode, variableNames },
    studentGroups
  );

  const handleAddGroupSubmit = () => {
    const stepKey = `group-${studentGroups.length + 1}-att-${attemptCount}`;
    setAttemptCount((prev) => prev + 1);
    setCurrentStepKey(stepKey);

    const submission: StepSubmission = {
      moduleId: 'kmap-solver',
      stepId: stepKey,
      studentAnswer: {
        kind: 'kmap-group',
        selectedCells,
        expression: convertGroupsToExpression(
          { variableCount, minterms, dontCares, mode, variableNames },
          [selectedCells]
        ).expressionString,
      },
      timestamp: new Date().toISOString(),
    };

    const context: StepContext = {
      kmap: {
        variableCount,
        minterms,
        dontCares,
        mode,
        variableNames,
        groupsSoFar: studentGroups,
      },
    };

    const outcome: FeedbackResult = submitStep(submission, context);

    if (outcome.ok) {
      onAddGroup(selectedCells);
      onClearSelection();
      setCurrentDiagnosis(null);
      onSetHighlight([], undefined);
      setGroupSetResult(null);
      setHasCheckedSet(false);
    } else {
      const diag = outcome.diagnoses[0] ?? null;
      setCurrentDiagnosis(diag);

      // Extract offending cells if available from diagnosis
      const label =
        diag?.misconceptionTag === 'covered-a-zero'
          ? 'covers a 0'
          : diag?.misconceptionTag === 'group-not-rectangle'
          ? 'not rectangle'
          : diag?.misconceptionTag === 'forgot-wraparound-grouping'
          ? 'needs wrap'
          : 'invalid';

      const offending = diag?.misconceptionTag === 'covered-a-zero'
        ? selectedCells.filter((c) => (mode === 'SOP' ? !minterms.includes(c) && !dontCares.includes(c) : minterms.includes(c)))
        : selectedCells;

      onSetHighlight(offending, label);
    }
  };

  const handleCheckSolution = () => {
    const setResult = validateGroupSet(
      {
        variableCount,
        minterms,
        dontCares,
        mode,
        variableNames,
        solverResult: solverSolution ?? undefined,
      },
      studentGroups
    );
    setGroupSetResult(setResult);
    setHasCheckedSet(true);

    const submission: StepSubmission = {
      moduleId: 'kmap-solver',
      stepId: 'final-solution',
      studentAnswer: {
        kind: 'kmap-group-set',
        groups: studentGroups,
        expression: studentExprResult.expressionString,
      },
      timestamp: new Date().toISOString(),
    };

    const context: StepContext = {
      kmap: {
        variableCount,
        minterms,
        dontCares,
        mode,
        variableNames,
        expectedExpression: solverSolution?.expressionString,
      },
    };

    submitStep(submission, context);
    completeAttempt(submission.studentAnswer, 'kmap-solver', {
      ...context,
      expectedFinalAnswer: solverSolution?.expressionString,
    });
  };

  const handleReveal = () => {
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId: 'kmap-solver',
      stepId: 'reveal-solution',
      level: 3,
    });
    onRevealSolution();
  };

  return (
    <div className="space-y-4">
      {/* Target Form Mode & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Target Form:</span>
          <div className="inline-flex rounded-md border border-gray-200 p-0.5 dark:border-gray-700">
            <button
              type="button"
              onClick={() => onModeChange('SOP')}
              className={`rounded-sm px-3 py-1 text-xs font-semibold ${
                mode === 'SOP' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
              }`}
            >
              SOP (Group 1s & Xs)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('POS')}
              className={`rounded-sm px-3 py-1 text-xs font-semibold ${
                mode === 'POS' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
              }`}
            >
              POS (Group 0s & Xs)
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Selected: {selectedCells.length} cells [{selectedCells.join(', ')}]
        </div>
      </div>

      {/* Group Creation Actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={handleAddGroupSubmit}
          disabled={selectedCells.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Add Group ({selectedCells.length} cells)
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          disabled={selectedCells.length === 0}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          Clear Selection
        </button>

        <button
          type="button"
          onClick={handleCheckSolution}
          disabled={studentGroups.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          Check My Solution
        </button>

        <button
          type="button"
          onClick={handleReveal}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Show Correct Groups (Assisted)
        </button>
      </div>

      {/* Answer Trap Banner */}
      {latestAnswerTrap && (
        <AnswerTrapBanner flag={latestAnswerTrap} />
      )}

      {/* Single Group DiagnosisCard & HintLadder */}
      {currentDiagnosis && (
        <div className="space-y-3">
          <DiagnosisCard diagnosis={currentDiagnosis} />
          <HintLadder stepKey={currentStepKey} />
        </div>
      )}

      {/* Current Student Groups List */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Drawn Groups ({studentGroups.length})
          </h4>
          {studentGroups.length > 0 && (
            <button
              type="button"
              onClick={onResetStudentGroups}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Reset All
            </button>
          )}
        </div>

        {studentGroups.length === 0 ? (
          <p className="mt-2 text-xs italic text-gray-400">
            No groups added yet. Click cells on the Karnaugh map to select them, then click "Add Group".
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {studentGroups.map((grp, idx) => (
              <div
                key={`student-grp-${idx}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400">G{idx + 1}:</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    [{grp.join(', ')}] ({grp.length} cells)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveGroup(idx)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solution Comparison Card */}
      {studentGroups.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Derived Expression & Comparison
          </h4>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
              <span className="text-[10px] font-bold uppercase text-gray-500">Your Expression</span>
              <div className="mt-1 font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                {studentExprResult.expressionString || '(empty)'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
              <span className="text-[10px] font-bold uppercase text-gray-500">Solver Reference</span>
              <div className="mt-1 font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                {solverSolution?.expressionString || '(unsolved)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Set Validation Report */}
      {hasCheckedSet && groupSetResult && (
        <div
          role="status"
          className={`rounded-xl border p-4 ${
            groupSetResult.valid && groupSetResult.isMinimal
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : groupSetResult.valid
              ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">
              {groupSetResult.valid && groupSetResult.isMinimal
                ? '✓ Valid & Minimal Solution!'
                : groupSetResult.valid
                ? 'ℹ Correct but Not Minimal'
                : '✕ Incomplete or Invalid Cover'}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-xs">
            {groupSetResult.uncoveredCells.length > 0 && (
              <div>
                <span className="font-bold">Missed Minterms:</span> [
                {groupSetResult.uncoveredCells.join(', ')}]
              </div>
            )}
            {groupSetResult.redundantGroupIndices.length > 0 && (
              <div>
                <span className="font-bold">Redundant Groups:</span> Group(s) [
                {groupSetResult.redundantGroupIndices.map((i) => `G${i + 1}`).join(', ')}]
              </div>
            )}
            <div className="text-[11px]">
              Terms: {groupSetResult.studentTermCount} (minimal: {groupSetResult.minimalTermCount}) • Literals: {groupSetResult.studentLiteralCount} (minimal: {groupSetResult.minimalLiteralCount})
            </div>
            {groupSetResult.valid && !groupSetResult.isMinimal && (
              <p className="mt-1 italic">
                Note: Multiple minimal covers may exist, but minimal covers require exactly {groupSetResult.minimalTermCount} terms.
              </p>
            )}
            {groupSetResult.valid &&
              groupSetResult.isMinimal &&
              solverSolution &&
              studentExprResult.expressionString !== solverSolution.expressionString && (
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                  Note: Different but equally minimal cover to solver reference!
                </p>
              )}
          </div>
        </div>
      )}

      {/* Optional AI Hint Settings */}
      <LlmSettings className="mt-4" />
    </div>
  );
};
