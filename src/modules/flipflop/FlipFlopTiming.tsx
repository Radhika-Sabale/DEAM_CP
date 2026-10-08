/**
 * @file FlipFlopTiming.tsx
 * Timing diagram container hosting waveform zoom controls, discrete-event waveform visualization,
 * instantaneous cursor signal inspection table, and accessible complete audit log of transitions.
 */

import { useMemo, useState, type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import { inputNames } from '../../engine/flipflop/models';
import type { UseFlipFlopSessionResult } from './useFlipFlopSession';
import { WaveformStrip, type SignalTrack } from './WaveformStrip';

export interface FlipFlopTimingProps {
  readonly session: UseFlipFlopSessionResult;
  readonly className?: string;
}

export const FlipFlopTiming: FC<FlipFlopTimingProps> = ({ session, className = '' }) => {
  const {
    state,
    simulationResult,
    cursorValues,
    eventsUpToCursor,
    maxTraceTime,
    changes,
    setCursor,
  } = session;

  const [zoomScale, setZoomScale] = useState<number>(20);
  const [showAuditTable, setShowAuditTable] = useState<boolean>(false);

  const activeSignals = useMemo<SignalTrack[]>(() => {
    const list: SignalTrack[] = [];
    list.push({ id: 'CLK', label: 'CLK', kind: 'clock' });

    const names = inputNames(state.config.type);
    for (const name of names) {
      list.push({ id: name, label: name, kind: 'input' });
    }

    if (state.config.asyncControls) {
      list.push({ id: 'PRE', label: 'PRE', kind: 'async' });
      list.push({ id: 'CLR', label: 'CLR', kind: 'async' });
    }

    list.push({ id: 'Q', label: 'Q', kind: 'output' });
    list.push({ id: 'Qbar', label: "Q'", kind: 'output' });
    return list;
  }, [state.config.type, state.config.asyncControls]);

  // Build signal historical point series from changes
  const signalHistories = useMemo(() => {
    const historyMap = new Map<string, { time: number; value: LogicValue }[]>();

    for (const sig of activeSignals) {
      let initVal: LogicValue = 0;
      if (sig.id === 'CLK') initVal = state.initialClock;
      else if (sig.id === 'PRE') initVal = state.initialPreset ?? (state.config.asyncActiveLow ? 1 : 0);
      else if (sig.id === 'CLR') initVal = state.initialClear ?? (state.config.asyncActiveLow ? 1 : 0);
      else if (sig.id === 'Q') initVal = state.initialQ;
      else if (sig.id === 'Qbar') initVal = state.initialQ === 1 ? 0 : state.initialQ === 0 ? 1 : 'X';
      else initVal = state.initialInputs[sig.id] ?? 0;

      const points: { time: number; value: LogicValue }[] = [{ time: 0, value: initVal }];
      for (const ch of changes) {
        if (ch.nodeId === sig.id) {
          points.push({ time: ch.time, value: ch.value });
        }
      }
      historyMap.set(sig.id, points);
    }
    return historyMap;
  }, [activeSignals, changes, state]);

  const allEvents = simulationResult.ok ? simulationResult.events : eventsUpToCursor;

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs space-y-4 ${className}`}
    >
      {/* Waveform Header & Zoom Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Timing Waveforms & Signal Inspector
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Discrete-event waveform transitions, clock active windows, and event annotations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-600 dark:text-gray-400 text-[11px]">
            Time Scale:
          </span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(8, z - 4))}
            aria-label="Zoom out time axis"
            className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            −
          </button>
          <span className="font-mono text-xs">{zoomScale}px</span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(60, z + 4))}
            aria-label="Zoom in time axis"
            className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            +
          </button>
        </div>
      </div>

      {/* SVG Waveform Graphic */}
      <WaveformStrip
        config={state.config}
        activeSignals={activeSignals}
        signalHistories={signalHistories}
        events={allEvents}
        maxTraceTime={maxTraceTime}
        cursorTime={state.cursor}
        zoomScale={zoomScale}
        onCursorClick={(t) => setCursor(t)}
      />

      {/* Instantaneous Values at Cursor Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <tr>
              <th scope="col" className="p-2 font-bold uppercase tracking-wider text-[11px] font-sans">
                Signal
              </th>
              <th scope="col" className="p-2 font-bold uppercase tracking-wider text-[11px] font-sans">
                Role
              </th>
              <th scope="col" className="p-2 font-bold uppercase tracking-wider text-[11px] font-sans text-right">
                Value at t = {state.cursor}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {activeSignals.map((sig) => {
              let val: LogicValue = 0;
              if (sig.id === 'CLK') val = cursorValues.CLK;
              else if (sig.id === 'PRE') val = cursorValues.PRE ?? (state.config.asyncActiveLow ? 1 : 0);
              else if (sig.id === 'CLR') val = cursorValues.CLR ?? (state.config.asyncActiveLow ? 1 : 0);
              else if (sig.id === 'Q') val = cursorValues.Q;
              else if (sig.id === 'Qbar') val = cursorValues.Qbar;
              else val = cursorValues.inputs[sig.id] ?? 0;

              return (
                <tr key={sig.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="p-2 font-bold text-gray-900 dark:text-gray-100">{sig.label}</td>
                  <td className="p-2 font-sans uppercase text-[10px] text-gray-500">{sig.kind}</td>
                  <td className="p-2 text-right">
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-bold ${
                        val === 1
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                          : val === 0
                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                      }`}
                    >
                      {val}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Accessible Collapsible State Transition Audit Table */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setShowAuditTable((v) => !v)}
          aria-expanded={showAuditTable}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <span>
            {showAuditTable ? '▼ Hide' : '▶ Show'} Complete Trace Event Log ({changes.length} transitions)
          </span>
        </button>

        {showAuditTable && (
          <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 font-sans">
                <tr>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300">
                    Timestamp
                  </th>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300">
                    Signal / Node
                  </th>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300 text-right">
                    New Logic Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {changes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center italic text-gray-500 font-sans">
                      No transitions recorded yet. Toggle clock or inputs to simulate.
                    </td>
                  </tr>
                ) : (
                  changes.map((ch, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="p-2 text-gray-600 dark:text-gray-400">t = {ch.time}</td>
                      <td className="p-2 font-bold text-gray-800 dark:text-gray-200">{ch.nodeId}</td>
                      <td className="p-2 text-right font-bold text-blue-600 dark:text-blue-400">
                        {ch.value}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
