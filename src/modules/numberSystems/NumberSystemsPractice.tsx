/**
 * @file NumberSystemsPractice.tsx
 * Interactive step-by-step practice for number system conversions, two's complement,
 * and signed arithmetic overflow flags with cognitive diagnostic checks and answer trap detection.
 */

import { type FC, useEffect, useState } from 'react';
import { StepChecker } from '../../components/feedback/StepChecker';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { StepSubmission } from '../../types/feedback';

export interface NumberSystemsPracticeProps {
  readonly onStepEvent?: (event: unknown) => void;
  readonly className?: string;
}

type PracticeMode = 'division-156' | 'twos-complement' | 'overflow-check';

export const NumberSystemsPractice: FC<NumberSystemsPracticeProps> = ({
  onStepEvent,
  className = '',
}) => {
  const [mode, setMode] = useState<PracticeMode>('division-156');
  const [quotientInput, setQuotientInput] = useState<string>('');
  const [bitStringInput, setBitStringInput] = useState<string>('');
  const [twosInput, setTwosInput] = useState<string>('');
  const [overflowInput, setOverflowInput] = useState<string>('0');

  const { latestAnswerTrap, completeAttempt, resetAll } = useFeedbackStore();

  useEffect(() => {
    resetAll();
    const startEvt = {
      eventType: 'step-started' as const,
      moduleId: 'numberSystems',
      stepId: `practice-${mode}`,
    };
    useLogStore.getState().logEvent(startEvt);
    onStepEvent?.(startEvt);
  }, [mode, onStepEvent, resetAll]);

  const handleFinalCheckDivision = () => {
    completeAttempt(
      {
        kind: 'number-conversion-step',
        sourceValue: '156',
        sourceRadix: 10,
        targetRadix: 2,
        intermediateWork: [quotientInput],
        finalAnswer: bitStringInput,
      },
      'numberSystems',
      { expectedFinalAnswer: '10011100' }
    );
  };

  const handleFinalCheckTwos = () => {
    completeAttempt(
      {
        kind: 'number-conversion-step',
        sourceValue: '00000101',
        sourceRadix: 2,
        targetRadix: 2,
        intermediateWork: [],
        finalAnswer: twosInput,
      },
      'numberSystems',
      { expectedFinalAnswer: '11111011' }
    );
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="number-systems-practice">
      {latestAnswerTrap && (
        <AnswerTrapBanner
          flag={latestAnswerTrap}
          onDismiss={() => {
            useFeedbackStore.setState({ latestAnswerTrap: null });
          }}
        />
      )}

      {/* Mode Selector */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setMode('division-156')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            mode === 'division-156'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          156 to Binary (Division)
        </button>
        <button
          type="button"
          onClick={() => setMode('twos-complement')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            mode === 'twos-complement'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Two&apos;s Complement (8-bit)
        </button>
        <button
          type="button"
          onClick={() => setMode('overflow-check')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            mode === 'overflow-check'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Signed Overflow (7 + 5)
        </button>
      </div>

      {mode === 'division-156' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-border bg-card space-y-1">
            <h3 className="text-sm font-bold">Goal: Convert Decimal 156 to Binary</h3>
            <p className="text-xs text-muted-foreground">
              Enter each division quotient/remainder, then read remainders in correct order to form the final binary string.
            </p>
          </div>

          <div id="step-1">
            <StepChecker
              moduleId="numberSystems"
              stepId="step-1"
              title="Step 1: Divide 156 by 2"
              description="Calculate the quotient for 156 / 2."
              buildSubmission={(): StepSubmission => ({
                moduleId: 'numberSystems',
                stepId: 'step-1',
                timestamp: new Date().toISOString(),
                studentAnswer: {
                  kind: 'number-conversion-step',
                  sourceValue: '78',
                  sourceRadix: 10,
                  targetRadix: 10,
                  intermediateWork: ['156 / 2'],
                  finalAnswer: quotientInput.trim(),
                },
              })}
              renderInput={() => (
                <div>
                  <label htmlFor="ns-quotient-1" className="block text-xs font-medium mb-1">
                    Quotient of 156 / 2:
                  </label>
                  <input
                    id="ns-quotient-1"
                    type="text"
                    value={quotientInput}
                    placeholder="e.g. 78"
                    onChange={(e) => setQuotientInput(e.target.value)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border rounded font-mono"
                  />
                </div>
              )}
            />
          </div>

          <div id="step-2">
            <StepChecker
              moduleId="numberSystems"
              stepId="step-2"
              title="Step 2: Final Binary Representation"
              description="Assemble all remainders into the final 8-bit binary string."
              buildSubmission={(): StepSubmission => ({
                moduleId: 'numberSystems',
                stepId: 'step-2',
                timestamp: new Date().toISOString(),
                studentAnswer: {
                  kind: 'number-conversion-step',
                  sourceValue: '156',
                  sourceRadix: 10,
                  targetRadix: 2,
                  intermediateWork: [quotientInput],
                  finalAnswer: bitStringInput.trim(),
                },
              })}
              renderInput={() => (
                <div>
                  <label htmlFor="ns-bitstring" className="block text-xs font-medium mb-1">
                    Final Binary Bit String:
                  </label>
                  <input
                    id="ns-bitstring"
                    type="text"
                    value={bitStringInput}
                    placeholder="e.g. 10011100"
                    onChange={(e) => setBitStringInput(e.target.value)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border rounded font-mono"
                  />
                </div>
              )}
            />
          </div>

          <button
            type="button"
            onClick={handleFinalCheckDivision}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Check Complete Attempt &amp; Trap Detection
          </button>
        </div>
      )}

      {mode === 'twos-complement' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-border bg-card space-y-1">
            <h3 className="text-sm font-bold">Goal: Two&apos;s Complement of 0000 0101 (+5)</h3>
            <p className="text-xs text-muted-foreground">
              Invert all bits (1&apos;s complement) and add 1 to form the 8-bit two&apos;s complement (-5).
            </p>
          </div>

          <div id="step-twos">
            <StepChecker
              moduleId="numberSystems"
              stepId="step-twos"
              title="Two's Complement Calculation"
              buildSubmission={(): StepSubmission => ({
                moduleId: 'numberSystems',
                stepId: 'step-twos',
                timestamp: new Date().toISOString(),
                studentAnswer: {
                  kind: 'number-conversion-step',
                  sourceValue: '00000101',
                  sourceRadix: 2,
                  targetRadix: 2,
                  intermediateWork: [],
                  finalAnswer: twosInput.trim(),
                },
              })}
              context={{ claimedLaw: 'twos-complement', bitWidth: 8 }}
              renderInput={() => (
                <div>
                  <label htmlFor="ns-twos" className="block text-xs font-medium mb-1">
                    Resulting 8-bit String:
                  </label>
                  <input
                    id="ns-twos"
                    type="text"
                    value={twosInput}
                    placeholder="e.g. 11111011"
                    onChange={(e) => setTwosInput(e.target.value)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border rounded font-mono"
                  />
                </div>
              )}
            />
          </div>

          <button
            type="button"
            onClick={handleFinalCheckTwos}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Check Complete Attempt
          </button>
        </div>
      )}

      {mode === 'overflow-check' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-border bg-card space-y-1">
            <h3 className="text-sm font-bold">Goal: Signed Overflow in 4-bit Arithmetic (7 + 5)</h3>
            <p className="text-xs text-muted-foreground">
              0111 (+7) + 0101 (+5) = 1100 (-4 in 4-bit two&apos;s complement). Does signed overflow (V) occur?
            </p>
          </div>

          <div id="step-overflow">
            <StepChecker
              moduleId="numberSystems"
              stepId="step-overflow"
              title="Signed Overflow Evaluation"
              buildSubmission={(): StepSubmission => ({
                moduleId: 'numberSystems',
                stepId: 'step-overflow',
                timestamp: new Date().toISOString(),
                studentAnswer: {
                  kind: 'number-conversion-step',
                  sourceValue: '0111 + 0101',
                  sourceRadix: 2,
                  targetRadix: 2,
                  intermediateWork: [],
                  finalAnswer: overflowInput,
                },
              })}
              context={{
                claimedLaw: 'binary-addition',
                bitWidth: 4,
                isSigned: true,
                detail: 'check-overflow',
              }}
              renderInput={() => (
                <div>
                  <label htmlFor="ns-overflow-select" className="block text-xs font-medium mb-1">
                    Signed Overflow (V Flag):
                  </label>
                  <select
                    id="ns-overflow-select"
                    value={overflowInput}
                    onChange={(e) => setOverflowInput(e.target.value)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border rounded"
                  >
                    <option value="1">1 (Overflow occurs: sum outside [-8..7])</option>
                    <option value="0">0 (No overflow)</option>
                  </select>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
};
