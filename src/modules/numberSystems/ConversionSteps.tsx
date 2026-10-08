/**
 * @file ConversionSteps.tsx
 * Educational step-by-step visualizer for number system conversions.
 * Renders repeated division, repeated multiplication, positional weights,
 * and grouping tables with stepper controls (Previous / Next / Show All).
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { StepRecord } from '../../engine/numberSystems';

export interface ConversionStepsProps {
  readonly steps: readonly StepRecord[];
  readonly route?: 'direct_grouping' | 'via_decimal';
  readonly isExact?: boolean;
  readonly isRepeating?: boolean;
  readonly repeatingCycle?: string;
  readonly targetRadix?: number;
  readonly onStepEvent?: (event: unknown) => void;
  readonly className?: string;
}

export const ConversionSteps: FC<ConversionStepsProps> = ({
  steps,
  route,
  isExact,
  isRepeating,
  repeatingCycle,
  className = '',
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(steps.length - 1);
  const [showAll, setShowAll] = useState<boolean>(true);

  if (steps.length === 0) {
    return (
      <div className={`p-4 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-500 italic ${className}`}>
        No steps available for this conversion.
      </div>
    );
  }

  const visibleSteps = showAll ? steps : steps.slice(0, currentStepIndex + 1);

  const divisionSteps = visibleSteps.filter((s) => s.kind === 'division');
  const multiplicationSteps = visibleSteps.filter((s) => s.kind === 'multiplication');
  const weightSteps = visibleSteps.filter((s) => s.kind === 'positional_weight');
  const groupingSteps = visibleSteps.filter((s) => s.kind === 'grouping' || s.kind === 'grouping_stage1');

  return (
    <div className={`space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs ${className}`}>
      {/* Header and Stepper Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Step-by-Step Conversion Steps
          </h3>
          {route && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Route: <span className="font-mono font-medium">{route === 'direct_grouping' ? 'Direct Grouping Shortcut' : 'Via Decimal Intermediate'}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Step walkthrough controls">
          <Button
            size="sm"
            variant="secondary"
            disabled={showAll ? false : currentStepIndex <= 0}
            onClick={() => {
              setShowAll(false);
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            aria-label="Previous step"
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!showAll && currentStepIndex >= steps.length - 1}
            onClick={() => {
              if (showAll) {
                setShowAll(false);
                setCurrentStepIndex(0);
              } else {
                setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
              }
            }}
            aria-label="Next step"
          >
            Next
          </Button>
          <Button
            size="sm"
            variant={showAll ? 'primary' : 'ghost'}
            onClick={() => {
              setShowAll(true);
              setCurrentStepIndex(steps.length - 1);
            }}
            aria-label="Show all steps"
          >
            Show All
          </Button>
          <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400" aria-live="polite">
            Step {showAll ? steps.length : currentStepIndex + 1} of {steps.length}
          </span>
        </div>
      </div>

      {/* Repeated Division Table */}
      {divisionSteps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-800 dark:text-blue-300">
            <span aria-hidden="true" className="text-base font-bold">↑</span>
            <span>Read remainders from bottom to top (arrow points from LSB to MSB).</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse" aria-label="Repeated division steps">
              <caption className="sr-only">Repeated division steps for integer radix conversion</caption>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                  <th scope="col" className="px-3 py-2">Step</th>
                  <th scope="col" className="px-3 py-2">Dividend</th>
                  <th scope="col" className="px-3 py-2">Divisor</th>
                  <th scope="col" className="px-3 py-2">Quotient</th>
                  <th scope="col" className="px-3 py-2">Remainder</th>
                  <th scope="col" className="px-3 py-2">Digit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {divisionSteps.map((s, idx) => {
                  const inp = s.inputs as { dividend?: string; divisor?: number };
                  const out = s.output as { quotient?: string; remainder?: number; remainderDigit?: string };
                  const isLast = idx === divisionSteps.length - 1;
                  return (
                    <tr key={idx} className={isLast ? 'bg-blue-50/50 dark:bg-blue-900/20 font-bold' : ''}>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-1.5">{inp.dividend}</td>
                      <td className="px-3 py-1.5">÷ {inp.divisor}</td>
                      <td className="px-3 py-1.5">{out.quotient}</td>
                      <td className="px-3 py-1.5">{out.remainder}</td>
                      <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400 font-semibold">{out.remainderDigit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Repeated Multiplication Table (Fractional) */}
      {multiplicationSteps.length > 0 && (
        <div className="space-y-2">
          {isRepeating && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
              Repeating fraction detected! Repeating cycle: <span className="font-mono font-bold">{repeatingCycle}</span>
            </div>
          )}
          {isExact === false && !isRepeating && (
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
              Fraction does not terminate within the precision limit; truncated.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse" aria-label="Repeated multiplication steps">
              <caption className="sr-only">Repeated multiplication steps for fractional radix conversion</caption>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                  <th scope="col" className="px-3 py-2">Step</th>
                  <th scope="col" className="px-3 py-2">Fraction</th>
                  <th scope="col" className="px-3 py-2">Multiplier</th>
                  <th scope="col" className="px-3 py-2">Integer Produced</th>
                  <th scope="col" className="px-3 py-2">New Remainder Fraction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {multiplicationSteps.map((s, idx) => {
                  const inp = s.inputs as { fraction?: string; multiplier?: number };
                  const out = s.output as { integerPart?: number | string; digit?: string; newFraction?: string };
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-1.5">{inp.fraction}</td>
                      <td className="px-3 py-1.5">× {inp.multiplier}</td>
                      <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400 font-bold">{out.digit ?? out.integerPart}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{out.newFraction}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positional Weights Table */}
      {weightSteps.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" aria-label="Positional weights steps">
            <caption className="sr-only">Positional weights calculation steps to decimal</caption>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                <th scope="col" className="px-3 py-2">Digit</th>
                <th scope="col" className="px-3 py-2">Position</th>
                <th scope="col" className="px-3 py-2">Weight (Radix^Pos)</th>
                <th scope="col" className="px-3 py-2">Product</th>
                <th scope="col" className="px-3 py-2">Running Sum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
              {weightSteps.map((s, idx) => {
                const inp = s.inputs as { digit?: string; position?: number; radix?: number; weight?: string };
                const out = s.output as { product?: string; runningSum?: string };
                return (
                  <tr key={idx}>
                    <td className="px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400">{inp.digit}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{inp.position}</td>
                    <td className="px-3 py-1.5">{inp.radix}^{inp.position} ({inp.weight})</td>
                    <td className="px-3 py-1.5">{out.product}</td>
                    <td className="px-3 py-1.5 font-semibold text-gray-900 dark:text-gray-100">{out.runningSum}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grouping View */}
      {groupingSteps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Bit Groupings
          </p>
          <div className="flex flex-wrap gap-2">
            {groupingSteps.map((s, idx) => {
              const inp = s.inputs as { groupBits?: string; targetRadix?: number; padded?: boolean };
              const out = s.output as { digit?: string; bits?: string };
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-2 text-center"
                >
                  <span className="font-mono text-sm font-bold text-gray-800 dark:text-gray-200">{inp.groupBits ?? out.bits}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">↓</span>
                  <span className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">{out.digit}</span>
                  {inp.padded && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">padded</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
