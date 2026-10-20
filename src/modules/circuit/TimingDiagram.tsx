/**
 * @file TimingDiagram.tsx
 * Interactive digital waveform timing diagram and logic hazard analyzer.
 * Renders SVG waveforms, time-step cursor inspection table, dynamic hazard indicators,
 * and a collapsible accessible audit log of all signal state transitions.
 */

import { useMemo, useState, type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';
import type { SimulationTrace } from '../../engine/circuit';

export interface TimingDiagramProps {
  readonly graph: CircuitGraph;
  readonly trace: SimulationTrace;
  readonly currentTime: number;
}

interface SignalTrack {
  readonly id: string;
  readonly label: string;
  readonly kind: 'input' | 'output' | 'clock' | 'gate' | 'const';
}

export const TimingDiagram: FC<TimingDiagramProps> = ({ graph, trace, currentTime }) => {
  const [visibleSignalIds, setVisibleSignalIds] = useState<string[]>([]);
  const [cursorTime, setCursorTime] = useState<number>(currentTime);
  const [zoomScale, setZoomScale] = useState<number>(20); // pixels per time unit
  const [showChangesTable, setShowChangesTable] = useState<boolean>(false);

  // All monitorable signals
  const allSignals = useMemo<SignalTrack[]>(() => {
    return graph.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      kind: n.kind,
    }));
  }, [graph.nodes]);

  // Default visible signals: inputs, outputs, clocks
  const activeSignals = useMemo(() => {
    if (visibleSignalIds.length > 0) {
      return allSignals.filter((s) => visibleSignalIds.includes(s.id));
    }
    return allSignals.filter((s) => s.kind === 'input' || s.kind === 'output' || s.kind === 'clock');
  }, [allSignals, visibleSignalIds]);

  // Determine max timeline duration
  const maxTraceTime = useMemo(() => {
    let maxT = Math.max(10, currentTime);
    for (const ch of trace.changes) {
      if (ch.time > maxT) maxT = ch.time;
    }
    return maxT;
  }, [trace.changes, currentTime]);

  // Compute signal value history across discrete intervals
  const signalHistories = useMemo(() => {
    const historyMap = new Map<string, { time: number; value: LogicValue }[]>();

    for (const sig of activeSignals) {
      const transitions = trace.changes.filter((c) => c.nodeId === sig.id);
      const initialNode = graph.nodes.find((n) => n.id === sig.id);
      const initialVal: LogicValue = initialNode?.kind === 'input' ? initialNode.value : 'X';

      const points: { time: number; value: LogicValue }[] = [{ time: 0, value: initialVal }];
      for (const t of transitions) {
        points.push({ time: t.time, value: t.value });
      }
      historyMap.set(sig.id, points);
    }

    return historyMap;
  }, [activeSignals, trace.changes, graph.nodes]);

  // Static hazard analysis (glitch detection on combinational circuits)
  const detectedHazards = useMemo(() => {
    const hazards: { time: number; signalId: string; message: string }[] = [];
    const hasClock = graph.nodes.some((n) => n.kind === 'clock');
    if (hasClock) return hazards;

    // Detect momentary pulses / glitches where a signal toggles and reverts within 1-2 delta/time units
    const byNode = new Map<string, { time: number; value: LogicValue }[]>();
    for (const ch of trace.changes) {
      const arr = byNode.get(ch.nodeId) ?? [];
      arr.push(ch);
      byNode.set(ch.nodeId, arr);
    }

    for (const [nodeId, changes] of byNode.entries()) {
      for (let i = 1; i < changes.length - 1; i++) {
        const prev = changes[i - 1];
        const curr = changes[i];
        const next = changes[i + 1];

        if (prev && curr && next) {
          if (curr.value !== prev.value && next.value === prev.value && next.time - prev.time <= 2) {
            const node = graph.nodes.find((n) => n.id === nodeId);
            hazards.push({
              time: curr.time,
              signalId: nodeId,
              message: `Static logic hazard detected on output '${node?.label || nodeId}' at t=${curr.time} (momentary glitch ${prev.value} → ${curr.value} → ${next.value}).`,
            });
          }
        }
      }
    }

    return hazards;
  }, [trace.changes, graph.nodes]);

  // Helper to query signal value at exact cursor time
  const getValueAtTime = (signalId: string, queryTime: number): LogicValue => {
    const points = signalHistories.get(signalId);
    if (!points || points.length === 0) return 'X';

    let currentVal = points[0]?.value ?? 'X';
    for (const pt of points) {
      if (pt.time <= queryTime) {
        currentVal = pt.value;
      } else {
        break;
      }
    }
    return currentVal;
  };

  const trackHeight = 36;
  const labelWidth = 100;
  const svgWidth = Math.max(500, labelWidth + maxTraceTime * zoomScale + 40);
  const svgHeight = activeSignals.length * trackHeight + 40;

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs">
      {/* Header & Zoom Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Timing Waveform Diagram & Signal Inspector
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Discrete-event waveform trace, logic glitch detection, and cursor timing inspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="timing-zoom" className="font-semibold text-gray-600 dark:text-gray-400 text-[11px]">
            Scale:
          </label>
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
            onClick={() => setZoomScale((z) => Math.min(50, z + 4))}
            aria-label="Zoom in time axis"
            className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            +
          </button>
        </div>
      </div>

      {/* Hazard Warning Alerts */}
      {detectedHazards.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 space-y-1"
        >
          <span className="font-bold flex items-center gap-1">
            <span>Static Logic Hazard Detected:</span>
          </span>
          {detectedHazards.map((h, idx) => (
            <p key={idx} className="text-[11px]">
              • {h.message}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
        <span className="font-semibold text-gray-700 dark:text-gray-300 text-[11px]">Visible Signals:</span>
        {allSignals.map((sig) => {
          const isChecked = activeSignals.some((s) => s.id === sig.id);
          return (
            <label key={sig.id} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  if (e.target.checked) {
                    setVisibleSignalIds((prev) =>
                      prev.length === 0 ? [...activeSignals.map((s) => s.id), sig.id] : [...prev, sig.id]
                    );
                  } else {
                    const next = activeSignals.map((s) => s.id).filter((id) => id !== sig.id);
                    setVisibleSignalIds(next);
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              <span>{sig.label}</span>
              <span className="text-gray-400 text-[10px]">({sig.kind})</span>
            </label>
          );
        })}
      </div>

      {/* SVG Waveform Chart */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-gray-50 dark:border-gray-800 dark:bg-gray-950 p-2">
        <svg
          width={svgWidth}
          height={svgHeight}
          role="img"
          aria-label="Digital timing waveform chart"
          className="select-none font-mono"
        >
          <title>Digital Circuit Simulation Timing Waveforms</title>
          <desc>
            Displays logic signal transitions over discrete simulation time for inputs, clocks, and outputs.
          </desc>

          <defs>
            {/* Hatched pattern for Unknown logic levels (X) */}
            <pattern id="hatch-unknown" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" strokeWidth="1.5" />
            </pattern>
          </defs>

          {/* Time Axis Grid Lines & Ticks */}
          {Array.from({ length: maxTraceTime + 1 }, (_, t) => {
            const x = labelWidth + t * zoomScale;
            return (
              <g key={`tick_${t}`}>
                <line
                  x1={x}
                  y1={20}
                  x2={x}
                  y2={svgHeight - 15}
                  stroke="#e5e7eb"
                  strokeDasharray="2,2"
                  className="dark:stroke-gray-800"
                />
                <text
                  x={x}
                  y={12}
                  textAnchor="middle"
                  className="text-[10px] fill-gray-400 dark:fill-gray-500 font-semibold"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Signal Tracks */}
          {activeSignals.map((sig, trackIdx) => {
            const trackY = 25 + trackIdx * trackHeight;
            const points = signalHistories.get(sig.id) ?? [];

            return (
              <g key={sig.id} transform={`translate(0, ${trackY})`}>
                {/* Track separator */}
                <line
                  x1={0}
                  y1={trackHeight}
                  x2={svgWidth}
                  y2={trackHeight}
                  stroke="#f3f4f6"
                  className="dark:stroke-gray-900"
                />

                {/* Signal Name Label */}
                <text
                  x={labelWidth - 10}
                  y={trackHeight / 2 + 3}
                  textAnchor="end"
                  className="text-[11px] font-bold fill-gray-700 dark:fill-gray-300"
                >
                  {sig.label}
                </text>

                {/* Waveform Polyline / Segments */}
                {(() => {
                  const highY = 6;
                  const lowY = trackHeight - 8;
                  const midY = trackHeight / 2;

                  let currentVal: LogicValue = points[0]?.value ?? 'X';
                  const segments: JSX.Element[] = [];

                  for (let t = 0; t < maxTraceTime; t++) {
                    const startX = labelWidth + t * zoomScale;
                    const endX = labelWidth + (t + 1) * zoomScale;

                    // Check for transition at timestamp t
                    const changeAtT = points.find((p) => p.time === t);
                    if (changeAtT) {
                      currentVal = changeAtT.value;
                    }

                    if (currentVal === 1) {
                      segments.push(
                        <line
                          key={`w_${t}`}
                          x1={startX}
                          y1={highY}
                          x2={endX}
                          y2={highY}
                          stroke="#2563eb"
                          strokeWidth={2}
                        />
                      );
                    } else if (currentVal === 0) {
                      segments.push(
                        <line
                          key={`w_${t}`}
                          x1={startX}
                          y1={lowY}
                          x2={endX}
                          y2={lowY}
                          stroke="#4b5563"
                          strokeWidth={1.5}
                        />
                      );
                    } else {
                      // Unknown 'X' band
                      segments.push(
                        <g key={`w_${t}`}>
                          <rect
                            x={startX}
                            y={highY}
                            width={zoomScale}
                            height={lowY - highY}
                            fill="url(#hatch-unknown)"
                            stroke="#f59e0b"
                            strokeWidth={1}
                          />
                          <text
                            x={startX + zoomScale / 2}
                            y={midY + 3}
                            textAnchor="middle"
                            className="text-[9px] font-bold fill-amber-700 dark:fill-amber-300"
                          >
                            X
                          </text>
                        </g>
                      );
                    }

                    // Draw vertical transition edge
                    const nextPt = points.find((p) => p.time === t + 1);
                    if (nextPt && nextPt.value !== currentVal) {
                      const nextY = nextPt.value === 1 ? highY : nextPt.value === 0 ? lowY : midY;
                      const curY = currentVal === 1 ? highY : currentVal === 0 ? lowY : midY;
                      segments.push(
                        <line
                          key={`edge_${t}`}
                          x1={endX}
                          y1={curY}
                          x2={endX}
                          y2={nextY}
                          stroke="#3b82f6"
                          strokeWidth={1.5}
                        />
                      );
                    }
                  }

                  return segments;
                })()}
              </g>
            );
          })}

          {/* Time Inspection Cursor Line */}
          <line
            x1={labelWidth + cursorTime * zoomScale}
            y1={15}
            x2={labelWidth + cursorTime * zoomScale}
            y2={svgHeight - 10}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
        </svg>
      </div>

      {/* Cursor Range Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
          <label htmlFor="timing-cursor-slider">
            Inspection Cursor Position: <span className="font-mono font-bold text-red-600">t = {cursorTime}</span> units
          </label>
          <span className="text-gray-500 font-normal">Drag slider to probe signal values</span>
        </div>
        <input
          id="timing-cursor-slider"
          type="range"
          min={0}
          max={maxTraceTime}
          value={cursorTime}
          onChange={(e) => setCursorTime(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-red-600"
        />
      </div>

      {/* Signal Values at Cursor Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th scope="col" className="p-2 font-bold uppercase text-[11px] text-gray-600 dark:text-gray-300">
                Signal Name
              </th>
              <th scope="col" className="p-2 font-bold uppercase text-[11px] text-gray-600 dark:text-gray-300">
                Kind
              </th>
              <th scope="col" className="p-2 font-bold uppercase text-[11px] text-gray-600 dark:text-gray-300 text-right">
                Value at t = {cursorTime}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            {activeSignals.map((sig) => {
              const val = getValueAtTime(sig.id, cursorTime);
              return (
                <tr key={sig.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="p-2 font-bold text-gray-900 dark:text-gray-100">{sig.label}</td>
                  <td className="p-2 text-gray-500 uppercase text-[11px] font-sans">{sig.kind}</td>
                  <td className="p-2 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-sm font-bold text-xs ${
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

      {/* Accessible Collapsible Signal State Transition Table */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setShowChangesTable((v) => !v)}
          aria-expanded={showChangesTable}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <span>{showChangesTable ? 'Hide' : 'Show'} Complete Trace Event Log ({trace.changes.length} events)</span>
        </button>

        {showChangesTable && (
          <div className="mt-3 max-h-52 overflow-y-auto border border-gray-200 rounded-lg dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300">
                    Timestamp
                  </th>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300">
                    Signal / Node ID
                  </th>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-600 dark:text-gray-300 text-right">
                    New Logic Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {trace.changes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center italic text-gray-500">
                      No state transitions recorded yet. Advance simulation time to log trace events.
                    </td>
                  </tr>
                ) : (
                  trace.changes.map((ch, idx) => (
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
