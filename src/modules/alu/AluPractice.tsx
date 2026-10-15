/**
 * @file AluPractice.tsx
 * Adaptive practice workbench for ALU arithmetic, status flag reasoning, and carry chain bit tracing.
 */

import { type FC, useState } from 'react';
import type { AluOpId } from '../../types/designProject';
import { AluPredictPractice } from './AluPredictPractice';
import { AluChainPractice } from './AluChainPractice';
import { Button } from '../../components/ui/Button';

export interface AluPracticeProps {
  readonly width: number;
}

interface PracticeProblem {
  id: string;
  title: string;
  op: AluOpId;
  a: number;
  b: number;
  shiftCount?: number;
}

const DEFAULT_PROBLEM: PracticeProblem = {
  id: 'p1',
  title: 'Signed Overflow: 7 + 1 (4-bit)',
  op: 'ADD',
  a: 7,
  b: 1,
};

const PRACTICE_PROBLEMS: readonly PracticeProblem[] = [
  DEFAULT_PROBLEM,
  { id: 'p2', title: 'Hardware Borrow: 5 - 7 (4-bit)', op: 'SUB', a: 5, b: 7 },
  { id: 'p3', title: 'Zero Result: 12 - 12 (4-bit)', op: 'SUB', a: 12, b: 12 },
  { id: 'p4', title: 'Multi-Bit Shift: 3 SHL 2 (4-bit)', op: 'SHL', a: 3, b: 2, shiftCount: 2 },
  { id: 'p5', title: 'Sign Bit Set: 14 AND 11 (4-bit)', op: 'AND', a: 14, b: 11 },
];

export const AluPractice: FC<AluPracticeProps> = ({ width }) => {
  const [problemIndex, setProblemIndex] = useState<number>(0);
  const [mode, setMode] = useState<'predict' | 'chain'>('predict');

  const problem = PRACTICE_PROBLEMS[problemIndex] ?? DEFAULT_PROBLEM;
  const isArithmetic = problem.op === 'ADD' || problem.op === 'SUB';

  const nextProblem = (): void => {
    setProblemIndex((prev) => (prev + 1) % PRACTICE_PROBLEMS.length);
  };

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Problem {problemIndex + 1} of {PRACTICE_PROBLEMS.length}
          </span>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {problem.title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setMode('predict')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === 'predict'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              Predict Result & Flags
            </button>
            <button
              type="button"
              disabled={!isArithmetic}
              onClick={() => setMode('chain')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !isArithmetic
                  ? 'opacity-40 cursor-not-allowed text-gray-400'
                  : mode === 'chain'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              Fill Carry Chain
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={nextProblem}>
            Next Problem
          </Button>
        </div>
      </div>

      {mode === 'predict' || !isArithmetic ? (
        <AluPredictPractice
          op={problem.op}
          width={width}
          a={problem.a}
          b={problem.b}
          shiftCount={problem.shiftCount}
        />
      ) : (
        <AluChainPractice
          op={problem.op as 'ADD' | 'SUB'}
          width={width}
          a={problem.a}
          b={problem.b}
        />
      )}
    </div>
  );
};
