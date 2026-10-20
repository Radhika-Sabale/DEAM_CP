/**
 * @file InterruptPage.tsx
 * Intel 8086 Interrupt Controller & Subsystem Simulator Page (Stage 15B).
 *
 * Integrates:
 * - CodeEditor and RunControls from 8086 module
 * - Hardware line indicators (NMI, INTR, IF, TF, STI shadow)
 * - 5-step micro-sequence entry stepper
 * - Labeled interrupt stack frames
 * - 256-entry Interrupt Vector Table (IVT) inspector
 * - External hardware interrupt scenario editor
 * - Execution audit timeline with latency tracking
 * - Adaptive prediction practice workbench
 * - Rebuild notice and incoming 8086 handoff modal
 */

import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useInterruptSession } from './useInterruptSession';
import { CodeEditor } from '../cpu8086/CodeEditor';
import { RegisterPanel } from '../cpu8086/RegisterPanel';
import { FlagsPanel8086 } from '../cpu8086/FlagsPanel8086';
import { MemoryViewer } from '../cpu8086/MemoryViewer';
import { RunControls } from '../cpu8086/RunControls';
import { IvtViewer } from './IvtViewer';
import { ScenarioEditor } from './ScenarioEditor';
import { InterruptLines } from './InterruptLines';
import { EntrySequenceView } from './EntrySequenceView';
import { FrameStackView } from './FrameStackView';
import { InterruptTimeline } from './InterruptTimeline';
import { InterruptPractice } from './InterruptPractice';
import { INTERRUPT_SAMPLE_PROGRAMS } from './samplePrograms';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../store/projectStore';

export const InterruptPage: FC = () => {
  const session = useInterruptSession();
  const project = useProjectStore((s) => s.project);

  const [activeMainTab, setActiveMainTab] = useState<'simulate' | 'practice'>('simulate');
  const [rebuiltNoticeVisible, setRebuiltNoticeVisible] = useState<boolean>(false);
  const [showHandoffConfirm, setShowHandoffConfirm] = useState<boolean>(false);
  const [handoffSource, setHandoffSource] = useState<string>('');
  const handoffCancelRef = useRef<HTMLButtonElement>(null);

  const isInitialMount = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastProcessedHandoffRef = useRef<string | number | undefined>(undefined);

  // Rebuild machine state on reload from stored source
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (sessionRef.current.source && sessionRef.current.source.trim().length > 0) {
        sessionRef.current.assembleAndReset();
        setRebuiltNoticeVisible(true);
      }
    }
  }, []);

  // Check incoming 8086 handoff
  useEffect(() => {
    const isCpuHandoff =
      project.lastHandoff?.from === '8086-cpu' &&
      project.lastHandoff?.to === 'interrupt-controller';

    if (
      isCpuHandoff &&
      project.cpu8086?.source &&
      project.lastHandoff?.timestamp !== lastProcessedHandoffRef.current
    ) {
      lastProcessedHandoffRef.current = project.lastHandoff?.timestamp;
      const src = project.cpu8086.source;
      const curSource = sessionRef.current.source;
      if (!curSource || curSource.trim().length === 0 || curSource.trim() === src.trim()) {
        sessionRef.current.setSource(src);
        sessionRef.current.assembleAndReset();
      } else if (curSource.trim() !== src.trim()) {
        setHandoffSource(src);
        setShowHandoffConfirm(true);
        setTimeout(() => handoffCancelRef.current?.focus(), 50);
      }
    }
  }, [project.lastHandoff, project.cpu8086]);

  const confirmHandoffReplace = () => {
    session.setSource(handoffSource);
    session.assembleAndReset();
    setShowHandoffConfirm(false);
  };

  const cancelHandoffReplace = () => {
    setShowHandoffConfirm(false);
  };

  const handleSelectSample = (sampleId: string) => {
    const sample = INTERRUPT_SAMPLE_PROGRAMS.find((p) => p.id === sampleId);
    if (!sample) return;
    session.setSource(sample.source);
    if (sample.defaultScenario) {
      session.setScenario(sample.defaultScenario);
    }
    session.assembleAndReset();
  };

  const rightTabs: TabItem[] = useMemo(
    () => [
      {
        id: 'ivt',
        label: 'IVT Table',
        content: (
          <IvtViewer
            memory={session.cpuState?.memory ?? null}
            program={session.program}
            onSelectVector={(_v, addr) => {
              session.editMemoryByte(addr, session.cpuState?.memory ? 0 : 0);
            }}
          />
        ),
      },
      {
        id: 'registers',
        label: 'Registers',
        content: (
          <RegisterPanel
            cpuState={session.cpuState}
            lastChanges={session.lastRecord?.registersChanged}
            program={session.program}
            onSetRegister={session.setInitialRegister}
          />
        ),
      },
      {
        id: 'flags',
        label: 'Flags',
        content: (
          <FlagsPanel8086
            flags={session.cpuState?.flags ?? null}
            lastChanges={session.lastRecord?.flagsChanged}
            faultMessage={session.cpuState?.fault?.message}
            useInterruptDescriptions={true}
          />
        ),
      },
      {
        id: 'memory',
        label: 'Memory',
        content: (
          <MemoryViewer
            memory={session.cpuState?.memory ?? null}
            lastWrites={session.lastRecord?.memoryWrites}
            cpuState={session.cpuState}
            program={session.program}
            onEditByte={session.editMemoryByte}
            highlightIvt={true}
          />
        ),
      },
    ],
    [session]
  );

  return (
    <div className="module-page page-column interrupt-page workflow-stack">
      {/* Page Header */}
      <header className="module-page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="eyebrow">MODULE 07 · INTERRUPTS</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            8086 Interrupt Controller & Subsystem
          </h1>
          <p>Configure interrupt events and inspect CPU response state.</p>
        </div>

        {/* Sample Program Picker & Main Mode Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="sample-program-select" className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Sample:
            </label>
            <select
              id="sample-program-select"
              onChange={(e) => handleSelectSample(e.target.value)}
              defaultValue=""
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="" disabled>Select a scenario sample...</option>
              {INTERRUPT_SAMPLE_PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setActiveMainTab('simulate')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeMainTab === 'simulate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              Simulate
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('practice')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeMainTab === 'practice'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              Practice
            </button>
          </div>
        </div>
      </header>

      {/* Ephemeral Rebuilt State Notice */}
      {rebuiltNoticeVisible && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <div className="flex items-center gap-2">
            <span>Machine state is rebuilt from your project source; run or step to begin execution.</span>
          </div>
          <button
            type="button"
            onClick={() => setRebuiltNoticeVisible(false)}
            className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Handoff Replacement Confirmation Dialog */}
      {showHandoffConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="int-handoff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 id="int-handoff-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              Replace Program from 8086 Simulator?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              An incoming assembly program was sent from the 8086 CPU module. Would you like to load it into the Interrupt Simulator?
            </p>
            <div className="flex justify-end gap-2">
              <Button ref={handoffCancelRef} variant="secondary" size="sm" onClick={cancelHandoffReplace}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={confirmHandoffReplace}>
                Replace & Assemble
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Mode Content */}
      {activeMainTab === 'simulate' ? (
        <div className="interrupt-simulation-flow workflow-stack">
          <section className="interrupt-program-card">
            <div className="workflow-step-heading"><span>01</span><h2>Program</h2></div>
            <CodeEditor
              source={session.source}
              onSourceChange={session.setSource}
              currentLine={session.currentLine}
              breakpoints={session.breakpoints}
              onToggleBreakpoint={session.toggleBreakpoint}
              errors={session.assemblerResult && !session.assemblerResult.ok ? session.assemblerResult.errors : undefined}
            />
          </section>

          {/* Sticky simulation controls remain between program and scenario. */}
          <div className="run-control-bar">
          <div className="workflow-step-heading"><span>02</span><h2>Run Controls</h2></div>
          <RunControls
            status={session.status}
            stopReason={session.stopReason}
            stopReasonMessage={session.stopReasonMessage}
            totalSteps={session.totalSteps}
            hasProgram={session.program !== null}
            isHalted={session.cpuState?.halted ?? false}
            isFaulted={session.cpuState?.fault !== undefined}
            speed={session.speed}
            setSpeed={session.setSpeed}
            watchpoints={session.watchpoints}
            onAddWatchpoint={session.addWatchpoint}
            onRemoveWatchpoint={session.removeWatchpoint}
            currentLine={session.currentLine}
            onAssemble={session.assembleAndReset}
            onReset={session.reset}
            onStep={session.stepSingle}
            onStepOver={session.stepOverFn}
            onStepOut={session.stepOutFn}
            onRun={session.run}
            onPause={session.pause}
            onRunToCursor={session.runToCursor}
            canStepBack={session.canStepBack}
            canStepForward={session.canStepForward}
            onStepBack={session.historyStepBack}
            onStepForward={session.historyStepForward}
          />
          </div>

          <section className="workflow-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>03</span><h2>Scenario</h2></div></header>
            <div className="workflow-card-body">
              <ScenarioEditor
                scenario={session.scenario}
                currentTick={session.currentTick}
                onAddEvent={session.addScenarioEvent}
                onRemoveEvent={session.removeScenarioEvent}
                onSetScenario={session.setScenario}
                onImportJson={session.importScenarioJson}
                onExportJson={session.exportScenarioJson}
              />
            </div>
          </section>

          <section className="workflow-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>04</span><h2>Interrupt Lines &amp; Priority Queue</h2></div></header>
            <div className="workflow-card-body interrupt-lines-card">
              <InterruptLines
                currentTick={session.currentTick}
                pendingLines={session.pendingLines}
                pendingList={session.pendingList}
                hasInterruptWatchpoint={session.hasInterruptWatchpoint}
                onToggleInterruptWatchpoint={session.toggleInterruptWatchpoint}
              />
            </div>
          </section>

          <section className="workflow-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>05</span><h2>Entry Sequence</h2></div></header>
            <div className="workflow-card-body">
              <EntrySequenceView
                lastInterruptRecord={session.lastInterruptRecord}
                microStepIndex={session.microStepIndex}
                onStepIntoMicroStep={session.stepIntoMicroStep}
                onPrevMicroStep={session.prevMicroStep}
                onShowAllMicroSteps={session.showAllMicroSteps}
                onResetMicroSteps={session.resetMicroSteps}
              />
            </div>
          </section>

          <section className="workflow-card interrupt-state-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>06</span><h2>CPU State</h2></div></header>
            <div className="workflow-card-body">
              <Tabs tabs={rightTabs} defaultValue="ivt" />
            </div>
          </section>

          <section className="workflow-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>07</span><h2>Interrupt Timeline</h2></div></header>
            <div className="workflow-card-body">
              <details className="interrupt-timeline-details">
                <summary>Timeline ({session.interruptLog.length})</summary>
                <InterruptTimeline interruptLog={session.interruptLog} currentTick={session.currentTick} />
              </details>
            </div>
          </section>

          <section className="workflow-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>08</span><h2>Interrupt Stack</h2></div></header>
            <div className="workflow-card-body">
              <FrameStackView
                cpuState={session.cpuState}
                interruptLog={session.interruptLog}
                program={session.program}
                lastStackChange={session.lastRecord?.stackChange}
              />
            </div>
          </section>
        </div>
      ) : (
        <InterruptPractice session={session} />
      )}
    </div>
  );
};
