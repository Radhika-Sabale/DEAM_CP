/**
 * @file InputEquations.tsx
 * Step 6 component: Next-State & Output Boolean Equations (Stage 10E).
 *
 * Implements truth table columns, student equation checking via seq-equation,
 * non-minimal accepted-with-note feedback, solver reveal with cost & don't-care details,
 * K-Map pipeline handoff, and aggregated cost metrics.
 */

import { type FC, useState } from 'react';
import type { BoolNode } from '../../types/ast';
import type { FunctionColumn, NextStateEquations } from '../../types/sequential';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import type { DerivedEquation } from '../../engine/sequential/nextStateEquations';
import { parse } from '../../engine/boolean/parser';
import { verifyEquation } from '../../engine/sequential/verifyStep';
import type { StepContext } from '../../engine/feedback/types';
import '../../engine/feedback/validators/sequentialValidator';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import type { StepSubmission, StudentAnswer } from '../../types/feedback';
import { createKMapHandoffPatch } from './sequentialHandoff';
import type { UseSequentialSessionResult } from './useSequentialSession';
import { FunctionEquationCard, type FunctionEquationState } from './FunctionEquationCard';

export type { FunctionEquationState };

interface InputEquationsFormProps {
  readonly referenceDesign: SequentialDesign;
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

const InputEquationsForm: FC<InputEquationsFormProps> = ({
  referenceDesign,
  session,
  className = '',
}) => {
  const { updateDraft, markVerified, markAssisted } = session;
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);
  const setModule = useUiStore((s) => s.setModule);
  const submitStep = useFeedbackStore((s) => s.submitStep);
  const logEvent = useLogStore((s) => s.logEvent);

  const { functions, equations, totalCost: aggCost } = referenceDesign;

  const [eqStates, setEqStates] = useState<Record<string, FunctionEquationState>>({});
  const [overallStatus, setOverallStatus] = useState<string | null>(null);

  const handleTextChange = (fnName: string, text: string) => {
    const updated = {
      ...eqStates,
      [fnName]: {
        ...eqStates[fnName],
        text,
      },
    };
    setEqStates(updated);
    updateDraft('equations', updated);
  };

  const handleReveal = (fnName: string) => {
    const derivedEq = equations.find((e: DerivedEquation) => e.name === fnName);
    const updated = {
      ...eqStates,
      [fnName]: {
        ...eqStates[fnName],
        text: derivedEq?.text ?? eqStates[fnName]?.text ?? '',
        isRevealed: true,
      },
    };
    setEqStates(updated);
    updateDraft('equations', updated);
    logEvent({
      eventType: 'hint-used',
      moduleId: 'sequential-designer',
      stepId: 'equations',
      level: 3,
    });
  };

  const handleOpenKMap = (fnName: string) => {
    const handoff = createKMapHandoffPatch(project, fnName);
    if (handoff.ok && handoff.patch) {
      applyPatch(handoff.patch);
      setModule('kmap-solver');
      if (typeof window !== 'undefined') {
        window.location.hash = '#/kmap';
      }
    }
  };

  const handleCheck = () => {
    let allValid = true;
    const nextStates: Record<string, FunctionEquationState> = { ...eqStates };
    const astMap: Record<string, BoolNode> = {};

    for (const fn of functions) {
      const fnName = fn.name;
      const text = (eqStates[fnName]?.text ?? '').trim();

      const submission: StepSubmission = {
        moduleId: 'sequential-designer',
        stepId: 'seq-equation',
        studentAnswer: {
          kind: 'seq-equation',
          text,
          expression: text,
          studentExpression: text,
          resultingExpression: text,
        } as unknown as StudentAnswer,
        timestamp: new Date().toISOString(),
      };

      const ctx = {
        sequential: {
          spec: session.state.spec ?? undefined,
          functionName: fnName,
        },
      };

      const res = submitStep(submission, ctx as unknown as StepContext);
      const verifyRes = verifyEquation(text, fn.column, fn.variables);

      if (res.ok) {
        const parsed = parse(text);
        if (parsed.ok) {
          astMap[fnName] = parsed.ast;
        }
        nextStates[fnName] = {
          ...eqStates[fnName],
          text,
          isCorrect: true,
          isMinimal: verifyRes.isMinimal,
          note: verifyRes.message,
          errorMsg: undefined,
        };
      } else {
        allValid = false;
        const diag = res.diagnoses[0];
        nextStates[fnName] = {
          ...eqStates[fnName],
          text,
          isCorrect: false,
          errorMsg: diag?.fullExplanation ?? diag?.hint ?? 'Invalid equation for this function.',
        };
      }
    }

    setEqStates(nextStates);

    if (allValid) {
      setOverallStatus('Verified: All next-state Boolean equations verified.');
      markVerified('equations', nextStates, { nextStateEquations: astMap as NextStateEquations });
    } else {
      setOverallStatus('Errors found in one or more equations.');
    }
  };

  const handleShowMe = () => {
    const filled: Record<string, FunctionEquationState> = {};
    const astMap: Record<string, BoolNode> = {};

    for (const eq of equations) {
      filled[eq.name] = {
        text: eq.text,
        isCorrect: true,
        isMinimal: true,
        isRevealed: true,
      };
      astMap[eq.name] = eq.expression;
    }

    setEqStates(filled);
    updateDraft('equations', filled);
    logEvent({
      eventType: 'hint-used',
      moduleId: 'sequential-designer',
      stepId: 'equations',
      level: 3,
    });
    setOverallStatus('Assisted: Minimal solver equations loaded.');
    markAssisted('equations', filled, { nextStateEquations: astMap as NextStateEquations });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Step Header & Cost Metric Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Next-State & Output Boolean Equations
          </h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Derive minimal Sum-of-Products (SOP) equations for each flip-flop input and output function.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <span className="font-semibold">Minimal Design Cost: </span>
          <span className="font-mono">{aggCost.terms} terms, {aggCost.literals} literals</span>
        </div>
      </div>

      {/* Function Equation Cards List */}
      <div className="space-y-4">
        {functions.map((fn: FunctionColumn) => {
          const derivedEq = equations.find((e: DerivedEquation) => e.name === fn.name);
          const state = eqStates[fn.name] ?? { text: '' };

          return (
            <FunctionEquationCard
              key={fn.name}
              fn={fn}
              derivedEq={derivedEq}
              state={state}
              onChange={(txt) => handleTextChange(fn.name, txt)}
              onReveal={() => handleReveal(fn.name)}
              onOpenKMap={() => handleOpenKMap(fn.name)}
            />
          );
        })}
      </div>

      {/* Toolbar & Live Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCheck}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Check Equations
          </button>
          <button
            type="button"
            onClick={handleShowMe}
            className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
          >
            Show me
          </button>
        </div>

        {overallStatus && (
          <span role="status" aria-live="polite" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {overallStatus}
          </span>
        )}
      </div>
    </div>
  );
};

export interface InputEquationsProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

export const InputEquations: FC<InputEquationsProps> = ({ session, className = '' }) => {
  if (!session.referenceDesign) {
    return <div className="p-4 text-xs text-gray-500">Define a valid sequential specification first.</div>;
  }
  return <InputEquationsForm referenceDesign={session.referenceDesign} session={session} className={className} />;
};
