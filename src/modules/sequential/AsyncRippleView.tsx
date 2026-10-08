/**
 * @file AsyncRippleView.tsx
 * Architecture inspector and discrete-event ripple simulator for asynchronous counters (Stage 10E).
 *
 * Visualizes stage clock source descriptions in plain words, mod-N decode gates,
 * clock period and stage delay configuration, glitch/transient state reporting,
 * propagation delay warnings, and CLK/Q/CLR waveform tracks.
 */

import { type FC, useMemo, useState } from 'react';
import type { CounterSpec } from '../../types/sequential';
import {
  designAsyncRipple,
  simulateAsyncRipple,
  type AsyncRippleDesign,
  type SimulateAsyncRippleResult,
} from '../../engine/sequential/asyncRipple';
import { formatCode } from '../../engine/sequential/encoding';
import { SequentialWaveform } from './SequentialWaveform';
import type { UseSequentialSessionResult } from './useSequentialSession';

export interface AsyncRippleViewProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

/**
 * Visualizes asynchronous ripple counter propagation delays, stage clock chains,
 * and transient states with interactive timing controls.
 */
export const AsyncRippleView: FC<AsyncRippleViewProps> = ({ session, className = '' }) => {
  const spec = session.state.spec as CounterSpec | null;

  const [clockPeriod, setClockPeriod] = useState<number>(40);
  const [stageDelay, setStageDelay] = useState<number>(2);

  // Synthesize async architecture
  const designRes = useMemo(() => {
    if (!spec) return null;
    return designAsyncRipple(spec);
  }, [spec]);

  // Simulate discrete-event timing
  const simResult: SimulateAsyncRippleResult | null = useMemo(() => {
    if (!designRes || !designRes.ok) return null;
    return simulateAsyncRipple(designRes.design, {
      clockPeriod,
      stageDelay,
      clockCycles: designRes.design.modulus * 2,
    });
  }, [designRes, clockPeriod, stageDelay]);

  if (!spec) {
    return <div className="p-4 text-xs text-gray-500">No counter specification defined.</div>;
  }

  if (!designRes || !designRes.ok) {
    const errorMsg =
      designRes?.errors.map((e) => e.message).join('; ') ??
      'Asynchronous ripple counter unsupported for this specification.';
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p className="font-bold">Asynchronous Counter Architecture Notice:</p>
        <p className="mt-1">{errorMsg}</p>
      </div>
    );
  }

  const design: AsyncRippleDesign = designRes.design;
  const n = design.stateBits;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Stage Clock Chains */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Asynchronous Ripple Counter Stages ({design.stateBits}-Bit MOD-{design.modulus})
        </h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Flip-flops trigger successively down the ripple chain rather than on a shared clock edge.
        </p>

        {/* Stage List in Words */}
        <div className="mt-4 space-y-2">
          {design.stages.map((stage, idx) => {
            const desc =
              stage.clockSource === 'external'
                ? 'Stage 0 is clocked by the external clock input'
                : `Stage ${idx} is clocked by ${stage.clockSource.pin === 'Qbar' ? `Q${stage.clockSource.stage}#` : `Q${stage.clockSource.stage}`}'s ${design.trigger} edge`;

            return (
              <div
                key={stage.bitIndex}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 dark:bg-gray-950 dark:text-gray-200"
              >
                <span className="font-bold text-blue-600 dark:text-blue-400">Bit {stage.bitIndex}:</span>
                <span>{desc}</span>
              </div>
            );
          })}
        </div>

        {/* Decode Gate for non-power-of-2 */}
        <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-xs text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300">
          <span className="font-bold">Decode Reset Gate: </span>
          {design.decode.active ? (
            <span>
              AND decode gate <code className="font-mono font-bold">{design.decode.expression}</code> asserts CLR when count reaches {design.decode.targetNumber} to reset the counter to 0.
            </span>
          ) : (
            <span>None required (natural power-of-2 rollover).</span>
          )}
        </div>
      </div>

      {/* Timing Controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span>Clock Period (T):</span>
          <input
            type="number"
            min={4}
            max={200}
            value={clockPeriod}
            onChange={(e) => setClockPeriod(Math.max(4, Number(e.target.value)))}
            aria-label="Clock Period"
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span>Stage Delay (t_pd):</span>
          <input
            type="number"
            min={1}
            max={50}
            value={stageDelay}
            onChange={(e) => setStageDelay(Math.max(1, Number(e.target.value)))}
            aria-label="Stage Delay"
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </label>
      </div>

      {/* Ripple Time Warning */}
      {simResult && simResult.warnings.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <svg className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Warning: The clock is faster than the counter can settle, so the count is unreliable.</span>
        </div>
      )}

      {/* Transients & Settled Counts Table */}
      {simResult && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Settled Counts & Transient States Table
          </h5>

          {/* Explanation of Transient States */}
          {design.decode.active && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-bold">Why transient states exist: </span>
              In an asynchronous counter, flip-flops toggle sequentially rather than simultaneously. Before clearing to 0, the counter momentarily enters state {formatCode(design.decode.targetNumber, n)} ({design.decode.targetNumber}) until the asynchronous reset signal propagates through the reset path.
            </p>
          )}

          {/* Table of Cycle Samples and Glitches */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Cycle</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Settled Count</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Transient Glitch / Reset State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {simResult.samples.map((s) => {
                  const cycleStart = s.cycle * clockPeriod;
                  const cycleEnd = (s.cycle + 1) * clockPeriod;
                  const trans = simResult.transients.find(
                    (t) => t.start >= cycleStart && t.start < cycleEnd
                  );

                  return (
                    <tr key={s.cycle}>
                      <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">#{s.cycle}</td>
                      <td className="px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
                        {s.settledCount} ({formatCode(s.settledCount, n)})
                      </td>
                      <td className="px-3 py-1.5 text-amber-600 dark:text-amber-400">
                        {trans
                          ? `State ${formatCode(trans.code, n)} appears for ${trans.end - trans.start} time units before the counter clears`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ripple Waveforms */}
      {simResult && (
        <SequentialWaveform
          changes={simResult.changes}
          totalTime={design.modulus * 2 * clockPeriod}
          signalNames={['CLK', ...Array.from({ length: n }, (_, b) => `Q${b}`), ...(design.decode.active ? ['CLR'] : [])]}
        />
      )}
    </div>
  );
};
