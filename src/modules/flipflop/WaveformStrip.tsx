/**
 * @file WaveformStrip.tsx
 * Pure SVG waveform renderer for flip-flop signal tracks, hatched unknown bands,
 * active clock windows, event markers with text labels, and vertical inspection cursor line.
 */

import { type FC, type JSX, useMemo } from 'react';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopConfig } from '../../engine/flipflop/models';
import type { FlipFlopEvent } from '../../engine/flipflop/stepperRules';

export interface SignalTrack {
  readonly id: string;
  readonly label: string;
  readonly kind: 'clock' | 'input' | 'async' | 'output';
}

export interface WaveformStripProps {
  readonly config: FlipFlopConfig;
  readonly activeSignals: readonly SignalTrack[];
  readonly signalHistories: Map<string, readonly { time: number; value: LogicValue }[]>;
  readonly events: readonly FlipFlopEvent[];
  readonly maxTraceTime: number;
  readonly cursorTime: number;
  readonly zoomScale: number;
  readonly onCursorClick?: (time: number) => void;
}

export const WaveformStrip: FC<WaveformStripProps> = ({
  config,
  activeSignals,
  signalHistories,
  events,
  maxTraceTime,
  cursorTime,
  zoomScale,
  onCursorClick,
}) => {
  const trackHeight = 36;
  const labelWidth = 100;
  const svgWidth = Math.max(500, labelWidth + maxTraceTime * zoomScale + 60);
  const svgHeight = activeSignals.length * trackHeight + 55;

  // Active level windows for level-sensitive modes
  const levelWindows = useMemo(() => {
    if (config.trigger !== 'level-high' && config.trigger !== 'level-low') return [];
    const clkPoints = signalHistories.get('CLK') ?? [];
    const isHigh = config.trigger === 'level-high';
    const activeLevel: LogicValue = isHigh ? 1 : 0;
    const windows: { start: number; end: number }[] = [];

    let currentStart: number | null = null;
    for (let t = 0; t <= maxTraceTime; t++) {
      let valAtT: LogicValue = 0;
      for (const p of clkPoints) {
        if (p.time <= t) valAtT = p.value;
      }
      if (valAtT === activeLevel) {
        if (currentStart === null) currentStart = t;
      } else if (currentStart !== null) {
        windows.push({ start: currentStart, end: t });
        currentStart = null;
      }
    }
    if (currentStart !== null) windows.push({ start: currentStart, end: maxTraceTime });
    return windows;
  }, [config.trigger, signalHistories, maxTraceTime]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onCursorClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX >= labelWidth) {
      const clickedT = Math.round((clickX - labelWidth) / zoomScale);
      onCursorClick(Math.max(0, Math.min(maxTraceTime, clickedT)));
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950">
      <svg
        width={svgWidth}
        height={svgHeight}
        role="img"
        aria-label="Digital flip-flop timing waveform chart"
        onClick={handleSvgClick}
        className="cursor-crosshair select-none font-mono"
      >
        <title>Digital Flip-Flop Timing Waveforms</title>
        <desc>
          Visual timing diagrams showing signal logic levels and clock transitions over discrete simulation time.
        </desc>

        <defs>
          {/* Hatched pattern for Unknown logic levels (X) */}
          <pattern
            id="ff-hatch-unknown"
            width="6"
            height="6"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#d97706" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* Level-Triggered Active Window Highlighting */}
        {levelWindows.map((win, idx) => {
          const x = labelWidth + win.start * zoomScale;
          const w = Math.max(zoomScale, (win.end - win.start) * zoomScale);
          return (
            <g key={`win_${idx}`}>
              <rect
                x={x}
                y={22}
                width={w}
                height={svgHeight - 42}
                fill="#3b82f6"
                fillOpacity={0.06}
                stroke="#60a5fa"
                strokeDasharray="2,2"
              />
              <text
                x={x + w / 2}
                y={15}
                textAnchor="middle"
                className="text-[9px] font-bold fill-blue-600 dark:fill-blue-400 font-sans"
              >
                [Clock active]
              </text>
            </g>
          );
        })}

        {/* Time Axis Grid Lines & Ticks */}
        {Array.from({ length: maxTraceTime + 1 }, (_, t) => {
          const x = labelWidth + t * zoomScale;
          return (
            <g key={`tick_${t}`}>
              <line
                x1={x}
                y1={24}
                x2={x}
                y2={svgHeight - 20}
                stroke="#e5e7eb"
                strokeDasharray="2,2"
                className="dark:stroke-gray-800"
              />
              <text
                x={x}
                y={svgHeight - 6}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-gray-400 dark:fill-gray-500"
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
          const highY = 6;
          const lowY = trackHeight - 8;
          const midY = trackHeight / 2;

          return (
            <g key={sig.id} transform={`translate(0, ${trackY})`}>
              {/* Track Separator Line */}
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
                x={labelWidth - 12}
                y={trackHeight / 2 + 3}
                textAnchor="end"
                className="text-[11px] font-bold fill-gray-700 dark:fill-gray-300"
              >
                {sig.label}
              </text>

              {/* Waveform Segments */}
              {(() => {
                let currentVal: LogicValue = points[0]?.value ?? 'X';
                const segments: JSX.Element[] = [];

                for (let t = 0; t < maxTraceTime; t++) {
                  const startX = labelWidth + t * zoomScale;
                  const endX = labelWidth + (t + 1) * zoomScale;

                  const changeAtT = points.find((p) => p.time === t);
                  if (changeAtT) currentVal = changeAtT.value;

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
                    segments.push(
                      <g key={`w_${t}`}>
                        <rect
                          x={startX}
                          y={highY}
                          width={zoomScale}
                          height={lowY - highY}
                          fill="url(#ff-hatch-unknown)"
                          stroke="#d97706"
                          strokeWidth={1}
                        />
                        <text
                          x={startX + zoomScale / 2}
                          y={midY + 3}
                          textAnchor="middle"
                          className="text-[9px] font-bold fill-amber-800 dark:fill-amber-300"
                        >
                          X
                        </text>
                      </g>
                    );
                  }

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

        {/* Event Annotations & Markers (Text + Icon) */}
        {events.map((ev, idx) => {
          const markerX = labelWidth + ev.time * zoomScale;

          if (ev.kind === 'active-edge') {
            return (
              <g key={`ev_${idx}`}>
                <polygon
                  points={`${markerX - 4},18 ${markerX + 4},18 ${markerX},24`}
                  fill="#2563eb"
                />
                <text
                  x={markerX}
                  y={14}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-blue-700 dark:fill-blue-300 font-sans"
                >
                  ▲ Edge: {ev.operation}
                </text>
              </g>
            );
          }

          if (ev.kind === 'race-around-toggle') {
            return (
              <g key={`ev_${idx}`}>
                <text
                  x={markerX}
                  y={svgHeight - 24}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-amber-700 dark:fill-amber-300 font-sans"
                >
                  ⚡ Race #{ev.toggleIndex}
                </text>
              </g>
            );
          }

          if (ev.kind === 'invalid-input') {
            return (
              <g key={`ev_${idx}`}>
                <text
                  x={markerX}
                  y={14}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-red-700 dark:fill-red-400 font-sans"
                >
                  ⚠ Invalid Input
                </text>
              </g>
            );
          }

          if (ev.kind === 'async-conflict') {
            return (
              <g key={`ev_${idx}`}>
                <text
                  x={markerX}
                  y={14}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-red-700 dark:fill-red-400 font-sans"
                >
                  ⚠ PRE/CLR Conflict
                </text>
              </g>
            );
          }

          if (ev.kind === 'timing-violation') {
            return (
              <g key={`ev_${idx}`}>
                <text
                  x={markerX}
                  y={14}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-red-700 dark:fill-red-400 font-sans"
                >
                  ⏱ {ev.violationType === 'setup' ? 'Setup' : 'Hold'} Violation
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* Inspection Cursor Line */}
        <line
          x1={labelWidth + cursorTime * zoomScale}
          y1={18}
          x2={labelWidth + cursorTime * zoomScale}
          y2={svgHeight - 16}
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      </svg>
    </div>
  );
};
