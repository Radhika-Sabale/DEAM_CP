/**
 * @file SimulateCounter.tsx
 * Step 8 component: Sequential State Machine & Counter Simulation (Stage 10E).
 *
 * Implements interactive stepping/running, initial state select with unused state lockout warnings,
 * reproducible seeded random input sequences, cycle-by-cycle tabular trace, pattern detection markers,
 * SVG waveforms with accessible change events, and module completion telemetry logging.
 */

import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { analyzeLockout, type LockoutReport } from '../../engine/sequential/lockout';
import { simulateDesign, type SimulateDesignResult } from '../../engine/sequential/simulate';
import { formatCode } from '../../engine/sequential/encoding';
import { useLogStore } from '../../store/logStore';
import { SEQUENTIAL_STEP_IDS } from './sequentialSessionTypes';
import { SequentialWaveform } from './SequentialWaveform';
import { SimulateCyclesTable } from './SimulateCyclesTable';
import type { UseSequentialSessionResult } from './useSequentialSession';

export interface SimulateCounterProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

function generateSeededBits(seed: number, length: number): string {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s = 12345;
  let out = '';
  for (let i = 0; i < length; i++) {
    s = (s * 16807) % 2147483647;
    out += s % 2 === 0 ? '0' : '1';
  }
  return out;
}

export const SimulateCounter: FC<SimulateCounterProps> = ({ session, className = '' }) => {
  const { state, markVerified } = session;
  const design: SequentialDesign | null =
    (session.activeDesign && session.activeDesign.kind === 'sync'
      ? session.activeDesign.design
      : null) ?? session.referenceDesign;
  const logEvent = useLogStore((s) => s.logEvent);
  const loggedCompletionRef = useRef(false);

  const stateBits = design?.table?.stateBits ?? 3;
  const totalStateCount = 1 << stateBits;
  const hasInput = design?.table?.hasInput ?? false;
  const inputLabel = design?.variableOrder.find((v) => !v.startsWith('Q')) ?? 'IN';
  const hasOutput = (design?.equations.some((e) => e.name === 'Z') || design?.spec.kind === 'detector') ?? false;

  const [initialState, setInitialState] = useState<number>(0);
  const [cycleCount, setCycleCount] = useState<number>(10);
  const [inputBits, setInputBits] = useState<string>('10110110');
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [announcement, setAnnouncement] = useState<string>('');

  // Lockout analysis on active design
  const lockoutReport: LockoutReport | null = useMemo(() => {
    if (!design) return null;
    return analyzeLockout({ table: design.table, equations: design.equations, flipFlop: design.spec.flipFlop });
  }, [design]);

  // Parse typed input bits
  const parsedInputs: (0 | 1)[] = useMemo(() => {
    const arr: (0 | 1)[] = [];
    for (const ch of inputBits) {
      arr.push(ch === '1' ? 1 : 0);
    }
    while (arr.length < cycleCount) arr.push(0);
    return arr.slice(0, cycleCount);
  }, [inputBits, cycleCount]);

  // Run behavioral simulation
  const simResult: SimulateDesignResult | null = useMemo(() => {
    if (!design) return null;
    const res = simulateDesign(design, {
      initialState,
      inputs: hasInput ? parsedInputs : undefined,
      cycles: cycleCount,
      period: 10,
    });
    return res.ok ? res : null;
  }, [design, initialState, hasInput, parsedInputs, cycleCount]);

  // Check if initial state is in unused states
  const unusedStartInfo = useMemo(() => {
    if (!lockoutReport) return null;
    return lockoutReport.unusedStates.find((u) => u.code === initialState) ?? null;
  }, [lockoutReport, initialState]);

  // Detector matches
  const detectorMatches = useMemo(() => {
    if (!simResult || design?.spec.kind !== 'detector') return [];
    const matches: number[] = [];
    simResult.rows.forEach((r, idx) => {
      if (r.output === 1) matches.push(idx);
    });
    return matches;
  }, [simResult, design?.spec.kind]);

  const handleStep = () => {
    if (!simResult) return;
    const nextIdx = Math.min(currentCycle + 1, simResult.rows.length - 1);
    setCurrentCycle(nextIdx);
    const row = simResult.rows[nextIdx];
    const text = `Step ${nextIdx + 1} of ${simResult.rows.length}: Current state is S${row?.state}`;
    setAnnouncement(text);
    markVerified('simulate', { completed: true });
  };

  const handleRun = () => {
    if (!simResult) return;
    const lastIdx = simResult.rows.length - 1;
    setCurrentCycle(lastIdx);
    setAnnouncement(`Simulation completed all ${simResult.rows.length} cycles.`);
    markVerified('simulate', { completed: true });
  };

  const handleReset = () => {
    setCurrentCycle(0);
    setAnnouncement('Simulation reset to cycle 0.');
  };

  const handleGenerateRandom = () => {
    const bits = generateSeededBits(randomSeed, cycleCount);
    setInputBits(bits);
    setCurrentCycle(0);
  };

  // Completion logging once per session
  useEffect(() => {
    if (loggedCompletionRef.current) return;
    const allCompleted = SEQUENTIAL_STEP_IDS.every(
      (id) => id === 'simulate' || state.steps[id].status === 'verified' || state.steps[id].status === 'assisted'
    );
    if (allCompleted && state.steps.simulate.status === 'verified') {
      loggedCompletionRef.current = true;
      logEvent({
        eventType: 'module-completed',
        moduleId: 'sequential-designer',
        durationMs: 0,
      });
    }
  }, [state.steps, logEvent]);

  if (!design || !simResult) {
    return (
      <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
        Simulation unavailable. Please complete earlier steps first.
      </div>
    );
  }

  const unusedCodes = new Set(lockoutReport?.unusedStates.map((u) => u.code) ?? []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        {/* Initial State Select */}
        <div>
          <label htmlFor="sim-initial-state" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            Initial State:
          </label>
          <select
            id="sim-initial-state"
            value={initialState}
            onChange={(e) => {
              setInitialState(Number(e.target.value));
              setCurrentCycle(0);
            }}
            aria-label="Initial State Select"
            className="mt-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-mono text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {Array.from({ length: totalStateCount }, (_, i) => {
              const isUnused = unusedCodes.has(i);
              return (
                <option key={i} value={i}>
                  S{i} ({formatCode(i, stateBits)}) {isUnused ? '— (Unused)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Input Sequence (for machines with inputs) */}
        {hasInput && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="sim-input-bits" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Input Sequence ({inputLabel}):
              </label>
              <input
                id="sim-input-bits"
                type="text"
                value={inputBits}
                onChange={(e) => {
                  setInputBits(e.target.value.replace(/[^01]/g, ''));
                  setCurrentCycle(0);
                }}
                aria-label="Input Bit Sequence"
                className="mt-1 w-36 rounded-lg border border-gray-300 px-2.5 py-1.5 font-mono text-xs text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label htmlFor="sim-random-seed" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Seed:
              </label>
              <input
                id="sim-random-seed"
                type="number"
                value={randomSeed}
                onChange={(e) => setRandomSeed(Number(e.target.value))}
                aria-label="Random PRNG Seed"
                className="mt-1 w-20 rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Random
            </button>
          </div>
        )}

        {/* Total Cycles */}
        <div>
          <label htmlFor="sim-clock-pulses" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            Clock Pulses:
          </label>
          <input
            id="sim-clock-pulses"
            type="number"
            min={1}
            max={50}
            value={cycleCount}
            onChange={(e) => {
              setCycleCount(Math.max(1, Math.min(50, Number(e.target.value))));
              setCurrentCycle(0);
            }}
            aria-label="Number of Clock Pulses"
            className="mt-1 w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Stepping Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStep}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Step
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            Run
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Unused Start State Lockout Analysis Callout */}
      {unusedStartInfo && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <span className="font-bold">Initial state S{unusedStartInfo.code} is an unused state: </span>
            <span>
              {unusedStartInfo.status === 'returns'
                ? `Returns to valid operation: ${unusedStartInfo.examplePath.map((c) => formatCode(c, stateBits)).join(' -> ')}`
                : unusedStartInfo.status === 'locked'
                ? `Locked in invalid cycle: ${unusedStartInfo.examplePath.map((c) => formatCode(c, stateBits)).join(' -> ')}`
                : 'Indeterminate next-state recovery path.'}
            </span>
          </div>
        </div>
      )}

      {/* Pattern Detector Markers */}
      {detectorMatches.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {detectorMatches.map((bitIdx) => (
            <div key={bitIdx} className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Detected the pattern at bit {bitIdx}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live announcement region */}
      <div role="status" aria-live="polite" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        {announcement || `Cycle ${currentCycle} of ${simResult.rows.length - 1}`}
      </div>

      {/* Cycles Execution Table */}
      <SimulateCyclesTable
        rows={simResult.rows}
        currentCycle={currentCycle}
        stateBits={stateBits}
        hasInput={hasInput}
        inputLabel={inputLabel}
        hasOutput={hasOutput}
      />

      {/* Waveforms */}
      <SequentialWaveform
        changes={simResult.changes}
        totalTime={cycleCount * 10}
        signalNames={['CLK', ...(hasInput ? [inputLabel] : []), ...Array.from({ length: stateBits }, (_, b) => `Q${b}`), ...(hasOutput ? ['Z'] : [])]}
      />
    </div>
  );
};
