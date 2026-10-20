/**
 * @file RaceAroundExplorer.tsx
 * Interactive laboratory tool for exploring race-around conditions in level-sensitive latches,
 * tuning pulse width vs propagation delay, comparing theoretical vs simulated toggle counts,
 * and verifying remedies like edge-triggering.
 */

import { type FC, useMemo } from 'react';
import { analyzeRaceAround, remedies } from '../../engine/flipflop/hazards';
import { simulateTimeline } from '../../engine/flipflop/stepper';
import type { UseFlipFlopSessionResult } from './useFlipFlopSession';

export interface RaceAroundExplorerProps {
  readonly session: UseFlipFlopSessionResult;
  readonly className?: string;
}

export const RaceAroundExplorer: FC<RaceAroundExplorerProps> = ({ session, className = '' }) => {
  const {
    state,
    cursorValues,
    setConfig,
    setInput,
    setPulseWidth,
  } = session;

  const isLevel = state.config.trigger === 'level-high' || state.config.trigger === 'level-low';

  // Theoretical analytical breakdown
  const analysis = useMemo(() => {
    return analyzeRaceAround(state.config, cursorValues.inputs, state.pulseWidth);
  }, [state.config, cursorValues.inputs, state.pulseWidth]);

  // Actual simulated execution under current parameters
  const actualSimulation = useMemo(() => {
    const isFallingOrLow = state.config.trigger === 'falling' || state.config.trigger === 'level-low';
    const firstVal = isFallingOrLow ? 0 : 1;
    const secondVal = isFallingOrLow ? 1 : 0;

    const simRes = simulateTimeline(state.config, {
      initialQ: 0,
      initialInputs: cursorValues.inputs,
      initialClock: secondVal,
      events: [
        { time: 5, signal: 'CLK', value: firstVal },
        { time: 5 + state.pulseWidth, signal: 'CLK', value: secondVal },
      ],
      endTime: 5 + state.pulseWidth + 10,
    });

    if (!simRes.ok) return { toggleCount: 0, finalQ: 'X', qToggles: 0 };
    return {
      toggleCount: simRes.stats.qTogglesCount,
      finalQ: simRes.finalState.q,
      qToggles: simRes.stats.qTogglesCount,
    };
  }, [state.config, cursorValues.inputs, state.pulseWidth]);

  const hazardRemedies = useMemo(() => remedies(state.config), [state.config]);

  const handleSetAlwaysFlip = () => {
    if (state.config.type === 'JK') {
      setInput('J', 1);
      setInput('K', 1);
    } else if (state.config.type === 'T') {
      setInput('T', 1);
    } else if (state.config.type === 'SR') {
      setInput('S', 1);
      setInput('R', 0);
    } else if (state.config.type === 'D') {
      setInput('D', 1);
    }
  };

  const handleMakeEdgeTriggered = () => {
    setConfig({
      ...state.config,
      trigger: 'rising',
    });
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs space-y-5 ${className}`}
    >
      <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-bold">
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Race-Around Condition Explorer
          </h3>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Analyze continuous oscillation in level-sensitive latches when clock pulse duration exceeds internal propagation delay (t_w &gt; t_pd).
        </p>
      </div>

      {!isLevel ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/40 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200">
          <p className="font-bold">Edge-Triggering Active (Immune to Race-Around)</p>
          <p className="mt-1 text-[11px] leading-relaxed">
            The component is currently configured as <strong>{state.config.trigger} edge-triggered</strong>. Data inputs are sampled only during voltage transitions, eliminating continuous feedback race oscillation.
          </p>
          <button
            type="button"
            onClick={() => setConfig({ ...state.config, trigger: 'level-high' })}
            className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500"
          >
            Switch to Level-Sensitive High to Explore Hazard
          </button>
        </div>
      ) : (
        <>
          {/* Controls: Pulse Width & Propagation Delay */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <div>
              <label htmlFor="ra-pulse-width" className="block font-semibold text-gray-700 dark:text-gray-300">
                Active Clock Pulse Width (t_w):
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="ra-pulse-width"
                  type="number"
                  min={1}
                  max={100}
                  value={state.pulseWidth}
                  onChange={(e) => setPulseWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <span className="text-gray-500 text-[11px]">time units</span>
              </div>
            </div>

            <div>
              <label htmlFor="ra-prop-delay" className="block font-semibold text-gray-700 dark:text-gray-300">
                Internal Propagation Delay (t_pd):
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="ra-prop-delay"
                  type="number"
                  min={0}
                  max={50}
                  value={state.config.propagationDelay}
                  onChange={(e) =>
                    setConfig({
                      ...state.config,
                      propagationDelay: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <span className="text-gray-500 text-[11px]">time units</span>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSetAlwaysFlip}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                Set Inputs to Continuous Toggle (e.g. J=K=1)
              </button>

              <button
                type="button"
                onClick={handleMakeEdgeTriggered}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500"
              >
                Make it Edge-Triggered (Eliminate Hazard)
              </button>
            </div>
          </div>

          {/* Analysis & Simulation Toggle Count Comparison */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-sans">
                Theoretical Formula: ceil(t_w / t_pd)
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-amber-950 dark:text-amber-100">
                {analysis.toggleCount} toggle{analysis.toggleCount === 1 ? '' : 's'} predicted
              </p>
              <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                Final settled state relative to start: <strong>{analysis.finalQRelation}</strong>.
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 font-sans">
                Discrete-Event Simulated Result
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-blue-950 dark:text-blue-100">
                {actualSimulation.toggleCount} toggle{actualSimulation.toggleCount === 1 ? '' : 's'} recorded
              </p>
              <p className="mt-1 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                Output settled to Q = {actualSimulation.finalQ} after clock pulse.
              </p>
            </div>
          </div>

          {/* Engineering Remedies List */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wider">
              Standard Engineering Remedies for Race-Around Hazard
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {hazardRemedies.map((rem) => (
                <div
                  key={rem.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 space-y-1"
                >
                  <p className="font-bold text-gray-800 dark:text-gray-200 text-xs">
                    {rem.title}
                  </p>
                  <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {rem.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
