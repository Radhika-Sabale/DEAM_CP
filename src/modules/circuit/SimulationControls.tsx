/**
 * @file SimulationControls.tsx
 * Runtime discrete-event simulation control bar.
 * Provides Step, Run N units, Settle, Play/Pause, Reset, Delay Mode selector, and Feedback Loop toggle.
 */

import { useState, type FC } from 'react';
import type { DelayMode, SimulationStatus } from '../../engine/circuit';
import { Button } from '../../components/ui/Button';

export interface SimulationControlsProps {
  readonly time: number;
  readonly status: SimulationStatus;
  readonly oscillationMessage: string | null;
  readonly isPlaying: boolean;
  readonly delayMode: DelayMode;
  readonly allowFeedback: boolean;
  readonly onStep: () => void;
  readonly onRunFor: (units: number) => void;
  readonly onRunToNextEvent: () => void;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onReset: () => void;
  readonly onSetDelayMode: (mode: DelayMode) => void;
  readonly onSetAllowFeedback: (allow: boolean) => void;
}

export const SimulationControls: FC<SimulationControlsProps> = ({
  time,
  status,
  oscillationMessage,
  isPlaying,
  delayMode,
  allowFeedback,
  onStep,
  onRunFor,
  onRunToNextEvent,
  onPlay,
  onPause,
  onReset,
  onSetDelayMode,
  onSetAllowFeedback,
}) => {
  const [runUnits, setRunUnits] = useState<number>(10);

  return (
    <div className="space-y-2">
      {/* Oscillation / Limit Warning Banner */}
      {oscillationMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
        >
          <span className="font-bold text-red-600 dark:text-red-400">⚠️ Simulation Oscillation:</span>
          <span>{oscillationMessage}</span>
        </div>
      )}

      {/* Main Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        {/* Left: Playback buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isPlaying ? (
            <Button variant="secondary" size="sm" onClick={onPause} aria-label="Pause continuous simulation">
              ⏸ Pause
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onPlay}
              disabled={status === 'oscillating'}
              aria-label="Play continuous clock & event simulation"
            >
              ▶ Play
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={onStep} aria-label="Advance simulation by 1 time unit">
            Step (+1)
          </Button>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={1000}
              value={runUnits}
              onChange={(e) => setRunUnits(Number(e.target.value))}
              aria-label="Number of simulation time units to run"
              className="w-14 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRunFor(runUnits)}
              aria-label={`Run simulation for ${runUnits} time units`}
            >
              Run
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRunToNextEvent}
            aria-label="Advance to next scheduled event or settle"
          >
            Settle
          </Button>

          <Button variant="ghost" size="sm" onClick={onReset} aria-label="Reset simulation to time t = 0">
            ↺ Reset
          </Button>
        </div>

        {/* Center: Current time & status badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
            <span className="text-[11px] font-semibold text-gray-500 uppercase">Sim Time:</span>
            <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
              t = {time} units
            </span>
          </div>

          {/* Status Badge (Icon + Word, never color alone) */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status === 'ok'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : status === 'oscillating'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
            }`}
          >
            <span>{status === 'ok' ? '✓' : status === 'oscillating' ? '⚠' : '⌛'}</span>
            <span className="capitalize">{status === 'ok' ? 'Settled' : status}</span>
          </span>
        </div>

        {/* Right: Delay mode & Feedback toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="sim-delay-mode" className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Delay Mode:
            </label>
            <select
              id="sim-delay-mode"
              value={delayMode}
              onChange={(e) => onSetDelayMode(e.target.value as DelayMode)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="unit">Unit Delay (1 unit)</option>
              <option value="zero">Zero Delay (Ideal)</option>
              <option value="per-gate">Per-Gate Custom</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allowFeedback}
              onChange={(e) => onSetAllowFeedback(e.target.checked)}
              className="tog focus:ring-blue-500"
            />
            <span>Allow Feedback (Latches)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
