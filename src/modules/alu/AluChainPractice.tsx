/**
 * @file AluChainPractice.tsx
 * Interactive practice harness for filling ripple-carry chain stages bit-by-bit.
 */

import { type FC, useState } from 'react';
import type { AluChainBitAnswer, StepSubmission } from '../../types/feedback';
import { StepChecker } from '../../components/feedback/StepChecker';
import { getBit } from '../../engine/common/bitUtils';

export interface AluChainPracticeProps {
  readonly op: 'ADD' | 'SUB';
  readonly width: number;
  readonly a: number;
  readonly b: number;
}

export const AluChainPractice: FC<AluChainPracticeProps> = ({
  op,
  width,
  a,
  b,
}) => {
  const [currentBit, setCurrentBit] = useState<number>(0);
  const [cin, setCin] = useState<0 | 1>(0);
  const [sumBit, setSumBit] = useState<0 | 1>(0);
  const [cout, setCout] = useState<0 | 1>(0);

  const isSub = op === 'SUB';
  const aBit = getBit(a, currentBit);
  const rawBBit = getBit(b, currentBit);
  const bEffBit = (rawBBit ^ (isSub ? 1 : 0)) as 0 | 1;

  const buildSubmission = (): StepSubmission => {
    const answer: AluChainBitAnswer = {
      kind: 'alu-chain-bit',
      bitIndex: currentBit,
      carryIn: cin,
      sumBit,
      carryOut: cout,
    };

    return {
      moduleId: 'alu',
      stepId: `chain-bit-${currentBit}-${op}-${a}-${b}`,
      studentAnswer: answer,
      timestamp: new Date().toISOString(),
    };
  };

  const context = {
    alu: { op, width, a, b },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Target Bit Stage:
          <select
            value={currentBit}
            onChange={(e) => setCurrentBit(Number(e.target.value))}
            className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {Array.from({ length: width }, (_, i) => (
              <option key={i} value={i}>
                Bit {i} {i === width - 1 ? '(MSB)' : i === 0 ? '(LSB)' : ''}
              </option>
            ))}
          </select>
        </label>

        <span className="text-xs text-gray-500 font-mono">
          Inputs: A[{currentBit}] = {aBit}, B_eff[{currentBit}] = {bEffBit}
        </span>
      </div>

      <StepChecker
        moduleId="alu"
        stepId={`chain-stage-${currentBit}-${op}-${a}-${b}`}
        title={`Stage Bit ${currentBit} Ripple-Carry Evaluation`}
        description={`Compute Carry-In, Sum, and Carry-Out for bit position ${currentBit}.`}
        buildSubmission={buildSubmission}
        context={context}
        renderInput={({ hasSubmitted, isCorrect }) => (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="chain-cin-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Carry-In (Cin)
              </label>
              <select
                id="chain-cin-input"
                value={cin}
                onChange={(e) => setCin(Number(e.target.value) as 0 | 1)}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="chain-sum-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Sum Bit (S)
              </label>
              <select
                id="chain-sum-input"
                value={sumBit}
                onChange={(e) => setSumBit(Number(e.target.value) as 0 | 1)}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="chain-cout-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Carry-Out (Cout)
              </label>
              <select
                id="chain-cout-input"
                value={cout}
                onChange={(e) => setCout(Number(e.target.value) as 0 | 1)}
                disabled={hasSubmitted && isCorrect}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </div>
          </div>
        )}
      />
    </div>
  );
};
