/**
 * @file PracticeStepItem.tsx
 * Individual practice problem step card integrating StepChecker harness,
 * dynamic student input, and level-3 assisted "Show solution" action (Stage 11C).
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { StepChecker } from '../../components/feedback/StepChecker';
import type { ProblemStep } from '../../engine/practice/types';
import type { StepSubmission } from '../../types/feedback';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';

export interface PracticeStepItemProps {
  readonly step: ProblemStep;
  readonly moduleId: string;
  readonly stepIndex: number;
  readonly isCompleted: boolean;
  readonly onStepSuccess: (stepKey: string) => void;
}

export const PracticeStepItem: FC<PracticeStepItemProps> = ({
  step,
  moduleId,
  stepIndex,
  isCompleted,
  onStepSuccess,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [appliedLaw, setAppliedLaw] = useState<string>('De Morgan');
  const [solutionRevealed, setSolutionRevealed] = useState<boolean>(false);

  const isAssisted = useFeedbackStore((s) => s.assistedSteps[step.key]);

  const handleShowSolution = () => {
    setSolutionRevealed(true);
    // Mark as assisted in feedback store
    useFeedbackStore.setState((s) => ({
      assistedSteps: { ...s.assistedSteps, [step.key]: true },
    }));

    // Log level-3 assisted hint event
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId,
      stepId: step.key,
      level: 3,
    });
  };

  const buildSubmission = (): StepSubmission => {
    const trimmed = inputValue.trim();

    // Map input to appropriate StudentAnswer kind based on step.kind
    let studentAnswer: import('../../types/feedback').StudentAnswer;

    if (step.kind === 'boolean-step') {
      studentAnswer = {
        kind: 'boolean-step',
        appliedLaw,
        resultingExpression: trimmed,
      };
    } else if (step.kind === 'kmap-group-set') {
      // Parse group notation e.g. "0,1,2,3; 4,5,6,7" or expression
      const groupLists = trimmed
        .split(';')
        .map((chunk) =>
          chunk
            .split(',')
            .map((c) => parseInt(c.trim(), 10))
            .filter((n) => !isNaN(n))
        )
        .filter((g) => g.length > 0);

      studentAnswer = {
        kind: 'kmap-group-set',
        groups: groupLists,
        expression: trimmed,
      };
    } else if (step.kind === 'circuit-step') {
      studentAnswer = {
        kind: 'number-conversion-step',
        sourceValue: trimmed,
        sourceRadix: 10,
        targetRadix: 10,
        intermediateWork: [],
        finalAnswer: trimmed,
      };
    } else {
      // Default to number conversion step or generic string container
      studentAnswer = {
        kind: 'number-conversion-step',
        sourceValue: trimmed,
        sourceRadix: 10,
        targetRadix: 10,
        intermediateWork: [],
        finalAnswer: trimmed,
      };
    }

    return {
      moduleId,
      stepId: step.key,
      timestamp: new Date().toISOString(),
      studentAnswer,
    };
  };

  const expectedStr =
    typeof step.expected === 'object' && step.expected !== null
      ? (step.expected as { finalAnswer?: string; expression?: string; value?: unknown }).finalAnswer ??
        (step.expected as { expression?: string }).expression ??
        (step.expected as { value?: unknown }).value ??
        JSON.stringify(step.expected)
      : String(step.expected ?? '');

  return (
    <div
      id={step.key}
      className={`rounded-xl border p-5 transition-colors ${
        isCompleted
          ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Step {stepIndex + 1}: {step.prompt}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowSolution}
          className="text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        >
          Show solution
        </Button>
      </div>

      <StepChecker
        moduleId={moduleId}
        stepId={step.key}
        title={`Step ${stepIndex + 1}`}
        buildSubmission={buildSubmission}
        context={step.context}
        onSuccess={() => onStepSuccess(step.key)}
        renderInput={({ isSubmitting }) => (
          <div className="space-y-3">
            {step.kind === 'boolean-step' && (
              <div>
                <label
                  htmlFor={`law-${step.key}`}
                  className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1"
                >
                  Applied Law:
                </label>
                <select
                  id={`law-${step.key}`}
                  value={appliedLaw}
                  onChange={(e) => setAppliedLaw(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="De Morgan">De Morgan</option>
                  <option value="Distributive">Distributive</option>
                  <option value="Absorption">Absorption</option>
                  <option value="Complement">Complement</option>
                  <option value="Idempotent">Idempotent</option>
                  <option value="Consensus">Consensus</option>
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor={`input-${step.key}`}
                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1"
              >
                Your Answer:
              </label>
              <input
                id={`input-${step.key}`}
                type="text"
                value={inputValue}
                placeholder="Enter step result..."
                disabled={isSubmitting}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 font-mono"
              />
            </div>
          </div>
        )}
      />

      {(solutionRevealed || isAssisted) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">Worked Solution (Assisted):</div>
          <div className="mt-1 font-mono">{String(expectedStr)}</div>
        </div>
      )}
    </div>
  );
};
