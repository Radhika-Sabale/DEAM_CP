/**
 * @file SequenceDetectorPage.tsx
 * Sequence Detector Finite State Machine designer wizard view (Stage 10E).
 *
 * Implements Mealy and Moore sequence detector synthesis with Step 2 DefineDetector,
 * excitation table verification, equation derivation, lockout analysis, and pattern simulation.
 */

import { type FC, useMemo, useState } from 'react';
import { SendToNextButton } from '../../components/layout/SendToNextButton';
import { useProjectStore } from '../../store/projectStore';
import { AsyncRippleView } from './AsyncRippleView';
import { CircuitPreview } from './CircuitPreview';
import { DefineDetector } from './DefineDetector';
import { ExcitationTableEditor } from './ExcitationTableEditor';
import { InputEquations } from './InputEquations';
import { LockoutCheck } from './LockoutCheck';
import { SelectFlipFlop } from './SelectFlipFlop';
import type { FlipFlopType } from '../../types/sequential';
import { createKMapHandoffPatch } from './sequentialHandoff';
import { SEQUENTIAL_STEP_IDS } from './sequentialSessionTypes';
import { SimulateCounter } from './SimulateCounter';
import { StateDiagramEditor } from './StateDiagramEditor';
import { StateTableEditor } from './StateTableEditor';
import { useSequentialSession, type UseSequentialSessionResult } from './useSequentialSession';
import { WizardStepper } from './WizardStepper';
import { SequentialCompletionSummary } from './SequentialCompletionSummary';

export interface SequenceDetectorPageProps {
  readonly session?: UseSequentialSessionResult;
  readonly className?: string;
}

export const SequenceDetectorPage: FC<SequenceDetectorPageProps> = ({
  session: propSession,
  className = '',
}) => {
  const localSession = useSequentialSession();
  const session = propSession ?? localSession;
  const project = useProjectStore((s) => s.project);

  const { state, selectStep } = session;
  const currentStep = state.currentStep;

  // Selected function for K-Map handoff
  const [selectedKMapFunc, setSelectedKMapFunc] = useState<string>('');
  const [showCircuit, setShowCircuit] = useState<boolean>(false);

  const availableFunctions = session.referenceDesign?.functions ?? [];
  const effectiveKMapFunc = selectedKMapFunc || (availableFunctions[0]?.name ?? '');

  const handoffRes = useMemo(() => {
    if (!effectiveKMapFunc) return { ok: false, error: 'No excitation functions available.' };
    return createKMapHandoffPatch(project, effectiveKMapFunc);
  }, [project, effectiveKMapFunc]);

  // Check if wizard completed
  const isComplete = SEQUENTIAL_STEP_IDS.every(
    (id) => state.steps[id].status === 'verified' || state.steps[id].status === 'assisted'
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sequence Detector Header & Subtitle */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Sequence Detector (Mealy / Moore FSM)
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Synthesize binary bit-sequence pattern recognizers with synchronous state transition logic.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Wizard Stepper */}
        <div className="lg:col-span-1">
          <WizardStepper
            state={state}
            onSelectStep={selectStep}
          />
        </div>

        {/* Right Active Step Container */}
        <div className="space-y-6 lg:col-span-3">
          {currentStep === 'flipflop' && (
            <SelectFlipFlop
              selectedType={
                (session.state.steps.flipflop.draft as FlipFlopType | null) ??
                project.flipFlopType ??
                null
              }
              onSelectType={(type) => session.markVerified('flipflop', type)}
            />
          )}
          {currentStep === 'define' && (
            <DefineDetector
              flipFlop={
                (session.state.steps.flipflop.draft as FlipFlopType) ||
                project.flipFlopType ||
                'D'
              }
              value={session.state.spec?.kind === 'detector' ? session.state.spec : null}
              onChange={(newSpec) => session.setSpec(newSpec)}
            />
          )}
          {currentStep === 'diagram' && <StateDiagramEditor session={session} />}
          {currentStep === 'table' && <StateTableEditor session={session} />}
          {currentStep === 'excitation' && <ExcitationTableEditor session={session} />}
          {currentStep === 'equations' && <InputEquations session={session} />}
          {currentStep === 'lockout' && <LockoutCheck session={session} />}
          {currentStep === 'simulate' && (
            session.state.spec?.kind === 'counter' && session.state.spec.style === 'async' ? (
              <AsyncRippleView session={session} />
            ) : (
              <SimulateCounter session={session} />
            )
          )}

          {/* Toggleable Circuit Preview */}
          {session.referenceDesign && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setShowCircuit((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                aria-expanded={showCircuit}
              >
                <span>Synthesized Schematic Preview</span>
                <span className="text-xs">{showCircuit ? '▲ Hide Circuit' : '▼ Show Circuit'}</span>
              </button>
              {showCircuit && (
                <div className="mt-4">
                  <CircuitPreview session={session} />
                </div>
              )}
            </div>
          )}

          {/* Completion Summary */}
          {isComplete && <SequentialCompletionSummary session={session} />}

          {/* K-Map Handoff Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Choose function to open in the K-Map:
              </label>
              <select
                value={effectiveKMapFunc}
                onChange={(e) => setSelectedKMapFunc(e.target.value)}
                aria-label="Choose function to open in the K-Map"
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-mono text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {availableFunctions.map((fn) => (
                  <option key={fn.name} value={fn.name}>
                    {fn.name} ({fn.variables.length} vars)
                  </option>
                ))}
              </select>
              {!handoffRes.ok && (
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  {handoffRes.error}
                </span>
              )}
            </div>

            <SendToNextButton pendingPatch={handoffRes.ok ? handoffRes.patch : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
};
