/**
 * @file NonTwosComplementResultView.tsx
 * Result card view for one's complement and sign-magnitude arithmetic modes.
 */

import type { FC } from 'react';
import { formatBitsWithEnds } from './BinaryArithmeticPanel';

export interface NonTwosComplementResultViewProps {
  readonly onesRes?: unknown;
  readonly smRes?: unknown;
}

export const NonTwosComplementResultView: FC<NonTwosComplementResultViewProps> = ({
  onesRes,
  smRes,
}) => {
  if (onesRes) {
    const res = onesRes as { finalBits: string; initialSumBits: string; endAroundCarry: number; finalValue: number };
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">One&apos;s Complement Addition Result</h4>
        <p className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
          {formatBitsWithEnds(res.finalBits)}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Initial Sum: <span className="font-mono">{res.initialSumBits}</span> | End-around carry: <span className="font-mono">{res.endAroundCarry}</span> | Value: <span className="font-mono">{res.finalValue}</span>
        </p>
      </div>
    );
  }

  if (smRes) {
    const res = smRes as { resultBits: string; resultSign: number; resultMag: number; overflow: boolean };
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sign-Magnitude Addition Result</h4>
        <p className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
          {formatBitsWithEnds(res.resultBits)}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Sign: <span className="font-mono">{res.resultSign}</span> | Magnitude: <span className="font-mono">{res.resultMag}</span> | Overflow: <span className="font-mono">{String(res.overflow)}</span>
        </p>
      </div>
    );
  }

  return null;
};
