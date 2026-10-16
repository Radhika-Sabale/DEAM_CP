/**
 * @file SequentialPage.tsx
 * Top-level Sequential Circuit Designer Module host page (Stage 10E).
 *
 * Provides header with PipelineStepper, mode switching tabs ("Counter designer" / "Sequence detector"),
 * WizardStepper navigation, active step host, CircuitPreview, completion summary,
 * and K-Map pipeline handoff controls.
 */

import { type FC, useMemo, useState } from 'react';
import { PipelineStepper } from '../../components/layout/PipelineStepper';
import { SendToNextButton } from '../../components/layout/SendToNextButton';
import { useProjectStore } from '../../store/projectStore';
import type { FlipFlopType } from '../../types/sequential';
import { AsyncRippleView } from './AsyncRippleView';
import { CircuitPreview } from './CircuitPreview';
import { DefineCounter } from './DefineCounter';
import { ExcitationTableEditor } from './ExcitationTableEditor';
import { InputEquations } from './InputEquations';
import { LockoutCheck } from './LockoutCheck';
import { SelectFlipFlop } from './SelectFlipFlop';
import { SequenceDetectorPage } from './SequenceDetectorPage';
import { createKMapHandoffPatch } from './sequentialHandoff';
import { SEQUENTIAL_STEP_IDS } from './sequentialSessionTypes';
import { SimulateCounter } from './SimulateCounter';
import { StateDiagramEditor } from './StateDiagramEditor';
import { StateTableEditor } from './StateTableEditor';
import { useSequentialSession } from './useSequentialSession';
import { WizardStepper } from './WizardStepper';
import { SequentialCompletionSummary } from './SequentialCompletionSummary';

export interface SequentialPageProps {
  readonly className?: string;
}

export const SequentialPage: FC<SequentialPageProps> = ({ className = '' }) => {
  const session = useSequentialSession();
  const project = useProjectStore((s) => s.project);

  const { state, selectStep, setSpec } = session;
  const currentStep = state.currentStep;

  // Active tab: 'counter' vs 'detector'
  const [activeTab, setActiveTab] = useState<'counter' | 'detector'>(
    project.sequentialSpec?.kind === 'detector' ? 'detector' : 'counter'
  );

  // Selected function for K-Map handoff
  const [selectedKMapFunc, setSelectedKMapFunc] = useState<string>('');
  const [showCircuit, setShowCircuit] = useState<boolean>(false);

  const availableFunctions = session.referenceDesign?.functions ?? [];
  const effectiveKMapFunc = selectedKMapFunc || (availableFunctions[0]?.name ?? '');

  const handoffRes = useMemo(() => {
    if (!effectiveKMapFunc) return { ok: false, error: 'No excitation functions available.' };
    return createKMapHandoffPatch(project, effectiveKMapFunc);
  }, [project, effectiveKMapFunc]);

  const isComplete = SEQUENTIAL_STEP_IDS.every(
    (id) => state.steps[id].status === 'verified' || state.steps[id].status === 'assisted'
  );

  const handleTabChange = (tab: 'counter' | 'detector') => {
    setActiveTab(tab);
    if (tab === 'detector' && state.spec?.kind !== 'detector') {
      setSpec({
        kind: 'detector',
        pattern: '1011',
        machine: 'mealy',
        overlapping: true,
        flipFlop: project.flipFlopType ?? 'D',
      });
    } else if (tab === 'counter' && state.spec?.kind === 'detector') {
      setSpec({
        kind: 'counter',
        modulus: 8,
        direction: 'up',
        flipFlop: project.flipFlopType ?? 'D',
        style: 'sync',
      });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header with Pipeline Stepper */}
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-block rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              Module ID: sequential-designer
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Synchronous Sequential Circuit Designer
            </h2>
            <div role="status" aria-live="polite" className="sr-only">
              Current active design step: {currentStep}
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => handleTabChange('counter')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'counter'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-700 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Counter designer
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('detector')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'detector'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-700 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Sequence detector
            </button>
          </div>
        </div>

        {/* Global Pipeline Progress */}
        <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
          <PipelineStepper />
        </div>
      </header>

      {/* Body View: Detector vs Counter */}
      {activeTab === 'detector' ? (
        <SequenceDetectorPage session={session} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Left Wizard Navigation */}
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
              <DefineCounter
                flipFlop={
                  (session.state.steps.flipflop.draft as FlipFlopType) ||
                  project.flipFlopType ||
                  'D'
                }
                value={session.state.spec?.kind === 'counter' ? session.state.spec : null}
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

            {/* Wizard Completion Summary */}
            {isComplete && <SequentialCompletionSummary session={session} />}

            {/* K-Map Pipeline Handoff Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="kmap-func-counter" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Choose function to open in the K-Map:
                </label>
                <select
                  id="kmap-func-counter"
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
      )}
    </div>
  );
};
