/**
 * @file SimplificationSteps.tsx
 * Interactive step-by-step algebraic Boolean simplifier.
 * Features a sequential stepper mode, rule-by-rule "Try a law" playground,
 * before/after diff marking with accessibility text, and literal count metrics.
 */

import { type FC, useMemo, useState } from 'react';
import type { BooleanLaw, BoolNode } from '../../types/ast';
import {
  applyRulesBottomUp,
  simplify,
  toString,
} from '../../engine/boolean';

export interface SimplificationStepsProps {
  /** Source expression AST to simplify */
  readonly ast: BoolNode | null;
  /** Callback fired when student applies the simplified AST to the project */
  readonly onApplySimplified?: (simplifiedAst: BoolNode) => void;
  /** Navigation trigger to open the K-Map module */
  readonly onNavigateToKMap?: () => void;
}

const LAW_DETAILS: Record<BooleanLaw, { title: string; statement: string }> = {
  'de-morgan': { title: "De Morgan's Laws", statement: "(A·B)' = A'+B', (A+B)' = A'·B'" },
  absorption: { title: 'Absorption Law', statement: 'A + AB = A, A(A + B) = A' },
  consensus: { title: 'Consensus Theorem', statement: "AB + A'C + BC = AB + A'C" },
  distributive: { title: 'Distributive Law', statement: 'A(B + C) = AB + AC' },
  idempotent: { title: 'Idempotent Law', statement: 'A·A = A, A + A = A' },
  complement: { title: 'Complement Law', statement: "A·A' = 0, A + A' = 1" },
  identity: { title: 'Identity Law', statement: 'A·1 = A, A + 0 = A' },
  null: { title: 'Null Law', statement: 'A·0 = 0, A + 1 = 1' },
  involution: { title: 'Involution', statement: "(A')' = A" },
  associative: { title: 'Associative Law', statement: '(AB)C = A(BC), (A+B)+C = A+(B+C)' },
  commutative: { title: 'Commutative Law', statement: 'AB = BA, A+B = B+A' },
};

const SELECTABLE_LAWS: readonly BooleanLaw[] = [
  'involution',
  'null',
  'identity',
  'complement',
  'idempotent',
  'absorption',
  'de-morgan',
  'distributive',
];

function countLiterals(node: BoolNode): number {
  switch (node.type) {
    case 'variable':
    case 'constant':
      return 1;
    case 'not':
      return countLiterals(node.child);
    case 'and':
    case 'or':
      return node.children.reduce((sum, c) => sum + countLiterals(c), 0);
    case 'xor':
    case 'nand':
    case 'nor':
    case 'xnor':
      return countLiterals(node.left) + countLiterals(node.right);
  }
}

export const SimplificationSteps: FC<SimplificationStepsProps> = ({
  ast,
  onApplySimplified,
  onNavigateToKMap,
}) => {
  const [stepperStep, setStepperStep] = useState<number | null>(null);
  const [selectedLaw, setSelectedLaw] = useState<BooleanLaw>('absorption');
  const [tryLawFeedback, setTryLawFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const simplifyResult = useMemo(() => {
    if (!ast) return null;
    return simplify(ast);
  }, [ast]);

  if (!ast || !simplifyResult) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Enter a valid Boolean expression to view step-by-step algebraic simplification.
      </div>
    );
  }

  const steps = simplifyResult.steps;
  const initialLiterals = countLiterals(ast);
  const finalLiterals = countLiterals(simplifyResult.simplified);

  // Stepper view limits
  const visibleStepCount = stepperStep === null ? steps.length : stepperStep;
  const visibleSteps = steps.slice(0, visibleStepCount);

  const handleTryLaw = (): void => {
    const { steps: ruleSteps } = applyRulesBottomUp(ast);
    const matching = ruleSteps.find((s) => s.lawName === selectedLaw);

    if (matching) {
      setTryLawFeedback({
        ok: true,
        message: `[Success] ${matching.explanation}. Result: ${toString(matching.after)}`,
      });
    } else {
      const lawInfo = LAW_DETAILS[selectedLaw];
      setTryLawFeedback({
        ok: false,
        message: `[Did Not Apply] The structural pattern for "${lawInfo.title}" (${lawInfo.statement}) was not found in this expression.`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Literal Count & Minimal Form Disclaimer */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs dark:border-blue-900/50 dark:bg-blue-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-blue-900 dark:text-blue-200">
            Algebraic Reduction Result:
          </div>
          <div className="font-mono font-bold text-blue-700 dark:text-blue-300">
            Literals: {initialLiterals} → {finalLiterals} (
            {initialLiterals > finalLiterals
              ? `-${initialLiterals - finalLiterals}`
              : 'no change'}
            )
          </div>
        </div>
        <p className="mt-1.5 text-gray-700 dark:text-gray-300">
          <strong>Note:</strong> Algebraic simplification applies axiomatic theorems and may not yield
          the global minimal form. The guaranteed minimal form is produced by the Quine-McCluskey
          algorithm in the K-Map module.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {onApplySimplified && (
            <button
              type="button"
              onClick={() => onApplySimplified(simplifyResult.simplified)}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Apply Simplified Expression to Project
            </button>
          )}
          {onNavigateToKMap && (
            <button
              type="button"
              onClick={onNavigateToKMap}
              className="text-xs font-semibold text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
            >
              Solve minimal form in K-Map Module →
            </button>
          )}
        </div>
      </div>

      {/* Stepper Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
          Steps ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={stepperStep === 0 || steps.length === 0}
            onClick={() => setStepperStep((prev) => Math.max(0, (prev ?? steps.length) - 1))}
            className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={stepperStep === steps.length || steps.length === 0}
            onClick={() => setStepperStep((prev) => Math.min(steps.length, (prev ?? 0) + 1))}
            className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Next Step
          </button>
          <button
            type="button"
            onClick={() => setStepperStep(null)}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              stepperStep === null
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300'
            }`}
          >
            Show All
          </button>
        </div>
      </div>

      {/* Step List */}
      {steps.length === 0 ? (
        <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
          The expression is already in its irreducible algebraic form; no rewrite laws could be applied.
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Simplification step sequence">
          {visibleSteps.map((step, idx) => {
            const lawInfo = LAW_DETAILS[step.lawName];
            const beforeStr = toString(step.before);
            const afterStr = toString(step.after);

            return (
              <li
                key={idx}
                className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      Step {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {lawInfo.title}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                    {lawInfo.statement}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {beforeStr}
                  </span>
                  <span aria-hidden="true" className="text-gray-400">
                    →
                  </span>
                  <span
                    className="rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-800 underline decoration-emerald-500 decoration-2 dark:bg-emerald-950/60 dark:text-emerald-300"
                    aria-label={`Changed to: ${afterStr}`}
                  >
                    {afterStr}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    [changed]
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {step.explanation}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {/* "Try a law" Interactive Playground */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs dark:border-gray-800 dark:bg-gray-900/40">
        <div className="font-bold text-gray-900 dark:text-gray-100">
          Try a Law on Current Expression:
        </div>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Select a Boolean law to test if its structural pattern matches the input expression.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="try-law-select" className="sr-only">
            Select Boolean Law
          </label>
          <select
            id="try-law-select"
            value={selectedLaw}
            onChange={(e) => {
              setSelectedLaw(e.target.value as BooleanLaw);
              setTryLawFeedback(null);
            }}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {SELECTABLE_LAWS.map((law) => (
              <option key={law} value={law}>
                {LAW_DETAILS[law].title} ({LAW_DETAILS[law].statement})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTryLaw}
            className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Verify Law
          </button>
        </div>

        {tryLawFeedback && (
          <div
            role="status"
            className={`mt-3 rounded p-2.5 text-xs font-medium ${
              tryLawFeedback.ok
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            }`}
          >
            {tryLawFeedback.message}
          </div>
        )}
      </div>
    </div>
  );
};
