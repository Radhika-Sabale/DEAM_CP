/**
 * @file SequentialWaveform.tsx
 * Pure SVG waveform timing diagram for sequential state machine simulation (Stage 10E).
 *
 * Visualizes CLK, inputs, state flip-flop bits, and output Z value streams over time
 * with high/low rail lines, hatched unknown regions, time grid, and an accessible
 * collapsible changes table.
 */

import { type FC, useMemo, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { ValueChange } from '../../engine/circuit/simulatorTypes';

export interface SequentialWaveformProps {
  readonly changes: readonly ValueChange[];
  readonly signalNames?: readonly string[];
  readonly totalTime: number;
  readonly className?: string;
}

/**
 * Sequential waveform timing display compliant with multi-channel accessibility standards.
 */
export const SequentialWaveform: FC<SequentialWaveformProps> = ({
  changes,
  signalNames: explicitSignalNames,
  totalTime,
  className = '',
}) => {
  const [showTable, setShowTable] = useState(false);

  // Derive active signal names in order
  const signals = useMemo(() => {
    if (explicitSignalNames && explicitSignalNames.length > 0) {
      return explicitSignalNames;
    }
    const found = new Set<string>();
    for (const c of changes) found.add(c.nodeId);
    return Array.from(found);
  }, [explicitSignalNames, changes]);

  const trackHeight = 36;
  const labelWidth = 70;
  const maxTime = Math.max(totalTime, 10);
  const timeScale = 8; // pixels per time unit
  const chartWidth = maxTime * timeScale;
  const svgWidth = labelWidth + chartWidth + 40;
  const svgHeight = signals.length * trackHeight + 36;

  // Build segments for each signal track
  const tracks = useMemo(() => {
    return signals.map((sig, sigIdx) => {
      const sigChanges = changes
        .filter((c) => c.nodeId === sig)
        .sort((a, b) => a.time - b.time);

      const yBase = sigIdx * trackHeight + 24;
      const yHigh = yBase + 6;
      const yLow = yBase + 26;

      // Calculate path segments across time
      let pathD = '';
      let lastVal: LogicValue = sigChanges[0]?.value ?? 0;
      let lastT = 0;

      const segments: { tStart: number; tEnd: number; val: LogicValue }[] = [];

      for (const chg of sigChanges) {
        if (chg.time > lastT) {
          segments.push({ tStart: lastT, tEnd: chg.time, val: lastVal });
        }
        lastT = chg.time;
        lastVal = chg.value;
      }
      if (lastT < maxTime) {
        segments.push({ tStart: lastT, tEnd: maxTime, val: lastVal });
      }

      // Generate SVG path string from segments
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg) continue;
        const x1 = labelWidth + seg.tStart * timeScale;
        const x2 = labelWidth + seg.tEnd * timeScale;
        const yVal = seg.val === 1 ? yHigh : yLow;

        if (i === 0) {
          pathD = `M ${x1} ${yVal} L ${x2} ${yVal}`;
        } else {
          pathD += ` L ${x1} ${yVal} L ${x2} ${yVal}`;
        }
      }

      return {
        id: sig,
        yBase,
        yHigh,
        yLow,
        pathD,
        segments,
      };
    });
  }, [signals, changes, maxTime, timeScale, labelWidth]);

  // Generate time ticks every 10 units
  const ticks = useMemo(() => {
    const list: number[] = [];
    for (let t = 0; t <= maxTime; t += 10) list.push(t);
    return list;
  }, [maxTime]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* SVG Waveform Strip */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-950">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none font-mono"
          style={{ minWidth: `${Math.min(svgWidth, 640)}px`, maxHeight: '340px' }}
        >
          <title>Sequential Simulation Waveforms</title>
          <desc>
            Digital waveform timing diagram displaying clock pulses, input triggers,
            flip-flop state transitions, and output signal changes.
          </desc>

          {/* Time axis background grid */}
          <g className="text-gray-200 dark:text-gray-800">
            {ticks.map((t) => {
              const x = labelWidth + t * timeScale;
              return (
                <line
                  key={t}
                  x1={x}
                  y1={16}
                  x2={x}
                  y2={svgHeight - 16}
                  stroke="currentColor"
                  strokeDasharray="2,2"
                />
              );
            })}
          </g>

          {/* Signal Tracks */}
          {tracks.map((trk) => (
            <g key={trk.id}>
              {/* Signal Name Label */}
              <text
                x={labelWidth - 10}
                y={trk.yLow - 4}
                textAnchor="end"
                className="fill-gray-700 text-xs font-bold dark:fill-gray-300"
              >
                {trk.id}
              </text>

              {/* Hatched Unknown Regions ('X') */}
              {trk.segments
                .filter((s) => s.val === 'X')
                .map((s, idx) => {
                  const x = labelWidth + s.tStart * timeScale;
                  const w = (s.tEnd - s.tStart) * timeScale;
                  return (
                    <rect
                      key={idx}
                      x={x}
                      y={trk.yHigh}
                      width={w}
                      height={trk.yLow - trk.yHigh}
                      className="fill-amber-200/50 stroke-amber-500 stroke-1 dark:fill-amber-950/40 dark:stroke-amber-600"
                    />
                  );
                })}

              {/* Waveform digital rail line */}
              <path
                d={trk.pathD}
                fill="none"
                stroke={trk.id === 'CLK' ? '#2563eb' : trk.id.startsWith('Q') ? '#059669' : '#d97706'}
                strokeWidth="2.5"
                strokeLinecap="square"
              />
            </g>
          ))}

          {/* Time Axis Ticks Labels */}
          <g className="fill-gray-500 text-[10px] dark:fill-gray-400">
            {ticks.map((t) => {
              const x = labelWidth + t * timeScale;
              return (
                <text key={t} x={x} y={svgHeight - 4} textAnchor="middle">
                  {t}
                </text>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Accessible Collapsible Changes Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          aria-expanded={showTable}
        >
          <span>Accessible Signal Changes Table ({changes.length} events recorded)</span>
          <span className="text-xs">{showTable ? '▲ Hide Table' : '▼ Show Table'}</span>
        </button>

        {showTable && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs font-mono dark:divide-gray-800">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Time (t)</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Signal</th>
                  <th scope="col" className="px-3 py-1.5 text-center font-bold">New Value</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-bold">Accessible Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {changes.map((c, idx) => {
                  const valText =
                    c.value === 1 ? '1 (High)' : c.value === 0 ? '0 (Low)' : `${c.value} (Unknown)`;

                  return (
                    <tr key={`${c.time}-${c.nodeId}-${idx}`}>
                      <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">t = {c.time}</td>
                      <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400">{c.nodeId}</td>
                      <td className="px-3 py-1.5 text-center font-bold text-gray-800 dark:text-gray-200">{valText}</td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                        Signal {c.nodeId} transitioned to {valText} at time {c.time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
