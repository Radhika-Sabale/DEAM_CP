/**
 * @file AluPredictPractice.tsx
 * Interactive practice harness for predicting ALU results and status flags with reasoning options.
 */

import { type FC, useState } from 'react';
import type { AluOpId } from '../../types/designProject';
import type {
  AluFlagAnswer,
  AluFlagReasoningOption,
  AluResultAnswer,
  StepSubmission,
} from '../../types/feedback';
import { StepChecker } from '../../components/feedback/StepChecker';

export interface AluPredictPracticeProps {
  readonly op: AluOpId;
  readonly width: number;
  readonly a: number;
  readonly b: number;
  readonly shiftCount?: number;
}

const REASONING_OPTIONS: { id: AluFlagReasoningOption; label: string }[] = [
  { id: 'carry-out', label: 'Addition produced carry-out (C=1)' },
  { id: 'no-carry-out', label: 'Addition fit within width (C=0)' },
  { id: 'borrow-needed', label: 'Subtraction required borrow A < B (CF=1)' },
  { id: 'no-borrow-needed', label: 'Subtraction had no borrow A >= B (CF=0)' },
  { id: 'overflow-rule', label: 'Signed overflow occurred (V=1)' },
  { id: 'no-overflow', label: 'No signed overflow (V=0)' },
  { id: 'msb-of-result', label: 'MSB is 1 (negative signed value, S=1)' },
  { id: 'msb-is-zero', label: 'MSB is 0 (non-negative signed value, S=0)' },
  { id: 'all-bits-zero', label: 'All result bits are 0 (Z=1)' },
  { id: 'nonzero-result', label: 'Result has non-zero bits (Z=0)' },
  { id: 'shift-count-greater-than-one', label: 'Shift count > 1 leaves OF undefined' },
  { id: 'shifted-out-bit', label: 'Carry flag receives last bit shifted out' },
  { id: 'inc-dec-preserves-carry', label: 'INC/DEC preserves carry flag' },
  { id: 'none', label: 'Direct bitwise logic operation' },
];

export const AluPredictPractice: FC<AluPredictPracticeProps> = ({
  op,
  width,
  a,
  b,
  shiftCount = 1,
}) => {
  const [studentResult, setStudentResult] = useState<string>('0');
  const [selectedFlag, setSelectedFlag] = useState<'Z' | 'C' | 'S' | 'O'>('Z');
  const [flagValue, setFlagValue] = useState<0 | 1 | 'undefined'>(0);
  const [reasoning, setReasoning] = useState<AluFlagReasoningOption>('all-bits-zero');

  const context = {
    alu: { op, width, a, b, shiftCount },
  };

  const buildResultSubmission = (): StepSubmission => {
    const parsed = parseInt(studentResult, 10);
    const answer: AluResultAnswer = {
      kind: 'alu-result',
      value: Number.isNaN(parsed) ? 0 : parsed,
    };
    return {
      moduleId: 'alu',
      stepId: `predict-result-${op}-${a}-${b}`,
      studentAnswer: answer,
      timestamp: new Date().toISOString(),
    };
  };

  const buildFlagSubmission = (): StepSubmission => {
    const answer: AluFlagAnswer = {
      kind: 'alu-flag',
      flag: selectedFlag,
      value: flagValue,
      reasoning,
    };
    return {
      moduleId: 'alu',
      stepId: `predict-flag-${selectedFlag}-${op}-${a}-${b}`,
      studentAnswer: answer,
      timestamp: new Date().toISOString(),
    };
  };

  return (
    <div className="space-y-6">
      {/* Result prediction step */}
      <StepChecker
        moduleId="alu"
        stepId={`predict-res-${op}-${a}-${b}`}
        title={`Step 1: Predict the Result for ${op} (A=${a}, B=${b})`}
        description={`Calculate the ${width}-bit unsigned decimal result of ${op}.`}
        buildSubmission={buildResultSubmission}
        context={context}
        renderInput={({ hasSubmitted, isCorrect }) => (
          <div>
            <label
              htmlFor="predict-result-input"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
            >
              Your Computed Result (Decimal)
            </label>
            <input
              id="predict-result-input"
              type="number"
              value={studentResult}
              onChange={(e) => setStudentResult(e.target.value)}
              disabled={hasSubmitted && isCorrect}
              className="mt-1 block w-48 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}
      />

      {/* Flag prediction step */}
      <StepChecker
        moduleId="alu"
        stepId={`predict-flag-${selectedFlag}-${op}-${a}-${b}`}
        title={`Step 2: Predict Status Flag & Justify with Reasoning`}
        description="Choose a status flag, predict its value, and select the architectural reasoning."
        buildSubmission={buildFlagSubmission}
        context={context}
        renderInput={({ hasSubmitted, isCorrect }) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="select-flag-id"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Target Flag
              </label>
              <select
                id="select-flag-id"
                value={selectedFlag}
                onChange={(e) => setSelectedFlag(e.target.value as 'Z' | 'C' | 'S' | 'O')}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="Z">ZF (Zero Flag)</option>
                <option value="C">CF (Carry / Borrow Flag)</option>
                <option value="S">SF (Sign Flag)</option>
                <option value="O">OF (Overflow Flag)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="select-flag-val"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Predicted Value
              </label>
              <select
                id="select-flag-val"
                value={String(flagValue)}
                onChange={(e) => {
                  const v = e.target.value;
                  setFlagValue(v === 'undefined' ? 'undefined' : (Number(v) as 0 | 1));
                }}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="0">0 (Clear)</option>
                <option value="1">1 (Set)</option>
                <option value="undefined">undefined (x86 multi-bit shift)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="select-flag-reasoning"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Reasoning Justification
              </label>
              <select
                id="select-flag-reasoning"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value as AluFlagReasoningOption)}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {REASONING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      />
    </div>
  );
};
