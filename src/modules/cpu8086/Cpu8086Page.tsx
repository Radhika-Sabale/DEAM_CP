/**
 * @file Cpu8086Page.tsx
 * Intel 8086 Microprocessor Simulator Page.
 *
 * Provides a responsive layout with assembly code editor, execution controls,
 * register file, status flags, virtualized memory viewer, stack panel, and trace view.
 * Machine state is ephemeral and rebuilt from project source on reload.
 */

import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useCpuSession } from './useCpuSession';
import { CodeEditor } from './CodeEditor';
import { RegisterPanel } from './RegisterPanel';
import { FlagsPanel8086 } from './FlagsPanel8086';
import { MemoryViewer } from './MemoryViewer';
import { StackView } from './StackView';
import { RunControls } from './RunControls';
import { TraceView } from './TraceView';
import { CpuPractice } from './CpuPractice';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { programFromAluOperation } from '../../engine/cpu8086/aluProgram';
import { INSTRUCTION_TABLE, MNEMONIC_ALIASES } from '../../engine/cpu8086/isa';

export const Cpu8086Page: FC = () => {
  const session = useCpuSession();
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

  // Check incoming ALU handoff
  useEffect(() => {
    const isAluHandoff =
      project.lastHandoff?.from === 'alu' &&
      project.lastHandoff?.to === '8086-cpu';

    if (
      isAluHandoff &&
      project.alu &&
      project.lastHandoff?.timestamp !== lastProcessedHandoffRef.current
    ) {
      lastProcessedHandoffRef.current = project.lastHandoff?.timestamp;
      const res = programFromAluOperation(project.alu);
      if (res.available) {
        const curSource = sessionRef.current.source;
        if (!curSource || curSource.trim().length === 0 || curSource.trim() === res.source.trim()) {
          sessionRef.current.setSource(res.source);
          sessionRef.current.assembleAndReset();
        } else if (curSource.trim() !== res.source.trim()) {
          // Existing source present: ask for confirmation with Cancel focused
          setHandoffSource(res.source);
          setShowHandoffConfirm(true);
          setTimeout(() => handoffCancelRef.current?.focus(), 50);
        }
      }
    }
  }, [project.lastHandoff, project.alu]);

  const confirmHandoffReplace = () => {
    session.setSource(handoffSource);
    session.assembleAndReset();
    setShowHandoffConfirm(false);
  };

  const cancelHandoffReplace = () => {
    setShowHandoffConfirm(false);
  };

  const handleHandoffToInterrupts = (): void => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: session.source,
        breakpoints: Array.from(session.breakpoints),
      },
      lastHandoff: {
        from: '8086-cpu',
        to: 'interrupt-controller',
        timestamp: new Date().toISOString(),
        summary: `Handoff from 8086-cpu to interrupt-controller`,
      },
    });
    useProjectStore.getState().markModuleCompleted('8086-cpu');
    useUiStore.getState().setModule('interrupt-controller');
  };

  const panelTabs: TabItem[] = useMemo(
    () => [
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
          />
        ),
      },
      {
        id: 'stack',
        label: 'Stack',
        content: (
          <StackView
            cpuState={session.cpuState}
            lastStackChange={session.lastRecord?.stackChange}
            program={session.program}
          />
        ),
      },
      {
        id: 'trace',
        label: 'Trace',
        content: (
          <TraceView
            rows={session.traceRows}
            historyLength={session.historyLength}
            historyIndex={session.historyIndex}
            historyTruncated={session.historyTruncated}
            onGoTo={session.historyGoTo}
            onReturnToCurrent={() => session.historyGoTo(session.historyLength - 1)}
          />
        ),
      },
    ],
    [session]
  );

  return (
    <div className="module-page page-column cpu-page workflow-stack">
      {/* Page Header */}
      <header className="module-page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="eyebrow">MODULE 06 · ARCHITECTURE</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Intel 8086 Microprocessor Simulator
          </h1>
          <p>Assemble and run instructions while inspecting processor state.</p>
        </div>

        {/* Main Mode Navigation (Simulate vs Practice) & Interrupt Handoff */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleHandoffToInterrupts}
            disabled={!session.source || session.source.trim().length === 0}
            aria-label="Open in Interrupt Simulator"
          >
            Open in Interrupt Simulator →
          </Button>

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
            <span>Machine state is rebuilt from your source; run again.</span>
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
          aria-labelledby="handoff-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 id="handoff-confirm-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              Replace 8086 Program from ALU?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              An incoming assembly program was sent from the ALU module. Would you like to replace your current 8086 code?
            </p>
            <div className="flex justify-end gap-2">
              <Button ref={handoffCancelRef} variant="secondary" size="sm" onClick={cancelHandoffReplace}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={confirmHandoffReplace}>
                Replace
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      {activeMainTab === 'simulate' ? (
        <div className="cpu-simulation-flow workflow-stack">
          <section className="cpu-program-card">
            <div className="workflow-step-heading"><span>01</span><h2>Run your own code</h2></div>
            <CodeEditor
              source={session.source}
              onSourceChange={session.setSource}
              currentLine={session.currentLine}
              breakpoints={session.breakpoints}
              onToggleBreakpoint={session.toggleBreakpoint}
              errors={session.assemblerResult?.ok === false ? session.assemblerResult.errors : []}
            />
            <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
              <summary className="cursor-pointer font-semibold">Supported instructions and directives</summary>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Instructions: {Object.keys(INSTRUCTION_TABLE).join(', ')}.
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                Aliases: {Object.entries(MNEMONIC_ALIASES).filter(([alias, canonical]) => alias !== canonical).map(([alias]) => alias).join(', ')}.
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                Directives: .DATA, .CODE, DB, DW, ORG, VECTOR, END. Unsupported mnemonics and directives are reported against their source line.
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                MUL/IMUL define CF and OF; other status flags are undefined. DIV/IDIV leave status flags undefined. Segment registers and parity/auxiliary-carry/direction flags are not modeled.
              </p>
            </details>
          </section>

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

          <section className="workflow-card cpu-state-card">
            <header className="workflow-card-header"><div className="workflow-step-heading"><span>03</span><h2>CPU State</h2></div></header>
            <div className="workflow-card-body">
            <Tabs tabs={panelTabs} defaultValue="registers" />
            </div>
          </section>
          </div>
      ) : (
        <CpuPractice session={session} />
      )}
    </div>
  );
};
