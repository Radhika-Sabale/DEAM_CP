/**
 * @file EntrySequenceView.tsx
 * Micro-step sequence inspector for the 8086 5-step interrupt entry hardware sequence.
 *
 * Steps:
 * 1. Push FLAGS onto stack (SP -= 2)
 * 2. Clear IF and TF in flags register
 * 3. Push CS onto stack (SP -= 2)
 * 4. Push IP (return address) onto stack (SP -= 2)
 * 5. Fetch handler CS:IP from IVT at vector × 4
 */

import type { FC } from 'react';
import type { InterruptRecord } from '../../engine/interrupts';
import { Button } from '../../components/ui/Button';

export interface EntrySequenceViewProps {
  readonly lastInterruptRecord: InterruptRecord | null;
  readonly microStepIndex: number;
  readonly onStepIntoMicroStep: () => void;
  readonly onPrevMicroStep: () => void;
  readonly onShowAllMicroSteps: () => void;
  readonly onResetMicroSteps: () => void;
  readonly className?: string;
}

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export const EntrySequenceView: FC<EntrySequenceViewProps> = ({
  lastInterruptRecord,
  microStepIndex,
  onStepIntoMicroStep,
  onPrevMicroStep,
  onShowAllMicroSteps,
  onResetMicroSteps,
  className = '',
}) => {
  if (!lastInterruptRecord) {
    return (
      <div
        role="region"
        aria-label="Interrupt entry sequence inspector"
        className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Hardware Interrupt Entry Sequence (5 Micro-Steps)
        </h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">
          No interrupt entry currently active. Trigger an INT n instruction, NMI, or INTR to inspect the 5 micro-steps.
        </p>
      </div>
    );
  }

  const steps = lastInterruptRecord.microSteps;
  const currentStep = microStepIndex >= 0 && microStepIndex < steps.length ? steps[microStepIndex] : null;

  return (
    <div
      role="region"
      aria-label="Hardware interrupt entry sequence inspector"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Entry Sequence: {lastInterruptRecord.kind.toUpperCase()} (Vector {lastInterruptRecord.vector})
          </h3>
          <span className="font-mono text-gray-500">
            Step {Math.max(1, microStepIndex + 1)} of {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevMicroStep}
            disabled={microStepIndex <= 0}
            aria-label="Previous micro-step"
          >
            ◀ Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onStepIntoMicroStep}
            disabled={microStepIndex >= steps.length - 1}
            aria-label="Next micro-step"
          >
            Next Step ▶
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowAllMicroSteps}
            aria-label="Complete all micro-steps"
          >
            All Steps
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetMicroSteps}
            aria-label="Reset micro-step sequence view"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Screen Reader Live Announcement */}
      <div aria-live="polite" className="sr-only">
        {currentStep ? `Step ${currentStep.stepNumber} of 5: ${currentStep.description}` : 'Entry sequence idle'}
      </div>

      {/* Stepper Tabs Bar */}
      <div className="grid grid-cols-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 text-[11px] font-mono text-center">
        {steps.map((st, idx) => {
          const isDone = idx < microStepIndex;
          const isCurrent = idx === microStepIndex;

          return (
            <div
              key={st.stepNumber}
              className={`p-2 border-r last:border-r-0 border-gray-100 dark:border-gray-800 transition-colors ${
                isCurrent
                  ? 'bg-blue-100 font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200'
                  : isDone
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider">
                {isDone ? '✔ Step ' + st.stepNumber : 'Step ' + st.stepNumber}
              </div>
              <div className="truncate font-semibold mt-0.5">
                {st.kind === 'push-flags' && 'Push FLAGS'}
                {st.kind === 'clear-if-tf' && 'Clear IF & TF'}
                {st.kind === 'push-cs' && 'Push CS'}
                {st.kind === 'push-ip' && 'Push IP'}
                {st.kind === 'read-vector' && 'Load Vector'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Detail Card */}
      {currentStep && (
        <div className="p-3 text-xs space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="font-bold text-blue-950 dark:text-blue-100 text-sm">
              Step {currentStep.stepNumber}: {currentStep.description}
            </div>
            <div className="mt-1 text-gray-700 dark:text-gray-300 text-xs">
              {currentStep.kind === 'push-flags' &&
                'The CPU decrements SP by 2 and writes the 16-bit FLAGS register onto the stack to preserve status, carry, zero, interrupt and trap flags.'}
              {currentStep.kind === 'clear-if-tf' &&
                'The CPU automatically clears IF (disabling maskable INTR interrupts to prevent re-entrancy) and clears TF (pausing single-step debug traps inside the handler).'}
              {currentStep.kind === 'push-cs' &&
                'The CPU decrements SP by 2 and pushes the Code Segment (CS) onto the stack.'}
              {currentStep.kind === 'push-ip' &&
                'The CPU decrements SP by 2 and pushes the return Instruction Pointer (IP) of the next instruction.'}
              {currentStep.kind === 'read-vector' &&
                `The CPU reads the 4-byte pointer at memory address ${formatHex16(
                  lastInterruptRecord.vectorAddress
                )} (vector ${lastInterruptRecord.vector} × 4) and loads IP with handler address ${formatHex16(
                  lastInterruptRecord.handlerIp
                )}.`}
            </div>
          </div>

          {/* Micro Changes: Registers, Flags, Memory */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[11px]">
            {/* Registers Changed */}
            <div className="rounded-md border border-gray-200 p-2 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <span className="font-bold text-gray-600 dark:text-gray-400 block mb-1">
                Registers Modified:
              </span>
              {currentStep.registersChanged.length === 0 ? (
                <span className="text-gray-400 italic">None</span>
              ) : (
                currentStep.registersChanged.map((rc) => (
                  <div key={rc.name} className="flex justify-between">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{rc.name}</span>
                    <span className="text-gray-500">
                      {formatHex16(rc.old)} → <strong className="text-blue-600">{formatHex16(rc.new)}</strong>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Flags Changed */}
            <div className="rounded-md border border-gray-200 p-2 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <span className="font-bold text-gray-600 dark:text-gray-400 block mb-1">
                Flags Modified:
              </span>
              {currentStep.flagsChanged.length === 0 ? (
                <span className="text-gray-400 italic">None</span>
              ) : (
                currentStep.flagsChanged.map((fc) => (
                  <div key={fc.name} className="flex justify-between">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{fc.name}</span>
                    <span className="text-gray-500">
                      {String(fc.old)} → <strong className="text-amber-600">{String(fc.new)}</strong>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Memory Writes */}
            <div className="rounded-md border border-gray-200 p-2 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <span className="font-bold text-gray-600 dark:text-gray-400 block mb-1">
                Memory Writes:
              </span>
              {currentStep.memoryWrites.length === 0 ? (
                <span className="text-gray-400 italic">None</span>
              ) : (
                currentStep.memoryWrites.map((mw) => (
                  <div key={mw.address} className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">[{formatHex16(mw.address)}]</span>
                    <span className="text-gray-500">
                      {formatHex16(mw.oldByte).slice(2)} → <strong className="text-emerald-600">{formatHex16(mw.newByte).slice(2)}</strong>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
        Total Frame Size: 6 bytes pushed onto stack (FLAGS: 2 bytes, CS: 2 bytes, IP: 2 bytes). IRET reverses this order by popping IP, CS, and FLAGS.
      </div>
    </div>
  );
};
