/**
 * @file BooleanPractice.tsx
 * Interactive step-by-step Boolean algebraic simplification practice.
 * Students enter deductive transformation steps with optional law declarations,
 * evaluated by the Feedback Engine with misconception diagnosis and answer trap detection.
 */

import { type FC, useEffect, useState } from 'react';
import { StepChecker } from '../../components/feedback/StepChecker';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import { LlmSettings } from '../../components/feedback/LlmSettings';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { StepSubmission } from '../../types/feedback';
import type { BooleanLaw } from '../../types/ast';

export interface BooleanPracticeProps {
  readonly onStepEvent?: (event: unknown) => void;
  readonly className?: string;
}

interface PracticeProblem {
  readonly id: string;
  readonly title: string;
  readonly initialExpression: string;
  readonly expectedFinal: string;
  readonly description: string;
}

const DEFAULT_PROBLEM: PracticeProblem = {
  id: 'demorgan-basic',
  title: "De Morgan's Theorem",
  initialExpression: "(A + B)'",
  expectedFinal: "A'B'",
  description: "Simplify the negated OR expression by distributing negation across operands.",
};

const PRACTICE_PROBLEMS: readonly PracticeProblem[] = [
  DEFAULT_PROBLEM,
  {
    id: 'absorption-redundancy',
    title: 'Negated Absorption',
    initialExpression: "A + A'B",
    expectedFinal: 'A + B',
    description: "Simplify using absorption/distributive law to eliminate the redundant literal.",
  },
  {
    id: 'idempotent-simplification',
    title: 'Idempotent & Null',
    initialExpression: 'A + A·0',
    expectedFinal: 'A',
    description: 'Simplify terms using null law (A·0 = 0) and identity law (A + 0 = A).',
  },
];

const SELECTABLE_LAWS: readonly { readonly id: BooleanLaw | ''; readonly label: string }[] = [
  { id: '', label: '(No law claimed / optional)' },
  { id: 'de-morgan', label: "De Morgan's Laws" },
  { id: 'absorption', label: 'Absorption Law' },
  { id: 'distributive', label: 'Distributive Law' },
  { id: 'idempotent', label: 'Idempotent Law' },
  { id: 'complement', label: 'Complement Law' },
  { id: 'identity', label: 'Identity Law' },
  { id: 'null', label: 'Null Law' },
  { id: 'involution', label: 'Involution' },
  { id: 'consensus', label: 'Consensus Theorem' },
];

export const BooleanPractice: FC<BooleanPracticeProps> = ({
  onStepEvent,
  className = '',
}) => {
  const [selectedProblemIndex, setSelectedProblemIndex] = useState<number>(0);
  const [nextStepInput, setNextStepInput] = useState<string>('');
  const [claimedLaw, setClaimedLaw] = useState<string>('');

  const problem: PracticeProblem = PRACTICE_PROBLEMS[selectedProblemIndex] ?? DEFAULT_PROBLEM;
  const { latestAnswerTrap, completeAttempt, resetAll } = useFeedbackStore();

  useEffect(() => {
    resetAll();
    setNextStepInput('');
    setClaimedLaw('');

    const startEvt = {
      eventType: 'step-started' as const,
      moduleId: 'boolean',
      stepId: problem.id,
    };
    useLogStore.getState().logEvent(startEvt);
    onStepEvent?.(startEvt);
  }, [problem.id, onStepEvent, resetAll]);

  const handleFinalAttemptCheck = () => {
    completeAttempt(
      {
        kind: 'boolean-step',
        resultingExpression: nextStepInput.trim(),
        appliedLaw: claimedLaw,
      },
      'boolean',
      {
        previousStepAnswer: problem.initialExpression,
        expectedFinalAnswer: problem.expectedFinal,
      }
    );
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="boolean-practice">
      {latestAnswerTrap && (
        <AnswerTrapBanner
          flag={latestAnswerTrap}
          onDismiss={() => {
            useFeedbackStore.setState({ latestAnswerTrap: null });
          }}
        />
      )}

      {/* Problem Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex flex-wrap gap-2">
          {PRACTICE_PROBLEMS.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProblemIndex(idx)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                idx === selectedProblemIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Details */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Proposed Expression:</span>
          <span className="text-xs text-muted-foreground">Target: {problem.expectedFinal}</span>
        </div>
        <div className="text-xl font-bold font-mono text-foreground">
          {problem.initialExpression}
        </div>
        <p className="text-xs text-muted-foreground pt-1">{problem.description}</p>
      </div>

      {/* Interactive Step Checker */}
      <div id={problem.id}>
        <StepChecker
          moduleId="boolean"
          stepId={problem.id}
          title="Enter Next Algebraic Step"
          description="Type the simplified expression and optionally select the law applied."
          context={{
            previousStepAnswer: problem.initialExpression,
            claimedLaw: claimedLaw || undefined,
          }}
          buildSubmission={(): StepSubmission => ({
            moduleId: 'boolean',
            stepId: problem.id,
            timestamp: new Date().toISOString(),
            studentAnswer: {
              kind: 'boolean-step',
              resultingExpression: nextStepInput.trim(),
              appliedLaw: claimedLaw,
            },
          })}
          renderInput={() => (
            <div className="space-y-3">
              <div>
                <label htmlFor="bool-step-input" className="block text-xs font-medium mb-1">
                  Resulting Algebraic Expression:
                </label>
                <input
                  id="bool-step-input"
                  type="text"
                  value={nextStepInput}
                  placeholder="e.g. A'B' or A + B"
                  onChange={(e) => setNextStepInput(e.target.value)}
                  className="w-full max-w-md px-3 py-1.5 text-sm border rounded font-mono"
                />
              </div>

              <div>
                <label htmlFor="bool-law-select" className="block text-xs font-medium mb-1">
                  Claimed Boolean Law (Optional):
                </label>
                <select
                  id="bool-law-select"
                  value={claimedLaw}
                  onChange={(e) => setClaimedLaw(e.target.value)}
                  className="w-full max-w-md px-3 py-1.5 text-sm border rounded"
                >
                  {SELECTABLE_LAWS.map((law) => (
                    <option key={law.id} value={law.id}>
                      {law.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleFinalAttemptCheck}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Check Complete Simplification &amp; Trap Detection
        </button>
      </div>

      {/* Optional AI Hint Settings disclosure */}
      <div className="pt-4 border-t border-border">
        <LlmSettings />
      </div>
    </div>
  );
};
