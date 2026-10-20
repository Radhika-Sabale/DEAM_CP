/**
 * @file RunControls.tsx
 * Execution toolbar with assemble, reset, step, step over/out, run, pause,
 * run to cursor, speed selector, stop-reason message, and watchpoints.
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { RunSpeed, SessionStatus } from './useCpuSession';
import type { StopReason, Watchpoint } from '../../engine/cpu8086/runner';
import type { RegisterName } from '../../engine/cpu8086/types';
import type { CpuFlags } from '../../engine/cpu8086/cpuTypes';

export interface RunControlsProps {
  readonly status: SessionStatus;
  readonly stopReason: StopReason | null;
  readonly stopReasonMessage: string | null;
  readonly totalSteps: number;
  readonly hasProgram: boolean;
  readonly isHalted: boolean;
  readonly isFaulted: boolean;

  readonly speed: RunSpeed;
  readonly setSpeed: (spd: RunSpeed) => void;

  readonly watchpoints: readonly Watchpoint[];
  readonly onAddWatchpoint: (w: Watchpoint) => void;
  readonly onRemoveWatchpoint: (index: number) => void;

  readonly currentLine: number;
  readonly onAssemble: () => void;
  readonly onReset: () => void;
  readonly onStep: () => void;
  readonly onStepOver: () => void;
  readonly onStepOut: () => void;
  readonly onRun: () => void;
  readonly onPause: () => void;
  readonly onRunToCursor: (line: number) => void;

  readonly canStepBack: boolean;
  readonly canStepForward: boolean;
  readonly onStepBack: () => void;
  readonly onStepForward: () => void;

  readonly className?: string;
}

export const RunControls: FC<RunControlsProps> = ({
  status,
  stopReasonMessage,
  totalSteps,
  hasProgram,
  isHalted,
  isFaulted,
  speed,
  setSpeed,
  watchpoints,
  onAddWatchpoint,
  onRemoveWatchpoint,
  currentLine,
  onAssemble,
  onReset,
  onStep,
  onStepOver,
  onStepOut,
  onRun,
  onPause,
  onRunToCursor,
  canStepBack,
  canStepForward,
  onStepBack,
  onStepForward,
  className = '',
}) => {
  const [showWatchpointUI, setShowWatchpointUI] = useState(false);
  const [wpType, setWpType] = useState<'register' | 'flag' | 'memory'>('register');
  const [wpTarget, setWpTarget] = useState('AX');

  const isRunning = status === 'running';
  const canExecute = hasProgram && !isHalted && !isFaulted && !isRunning;

  const handleAddWp = () => {
    if (wpType === 'register') {
      onAddWatchpoint({ type: 'register', register: wpTarget as RegisterName });
    } else if (wpType === 'flag') {
      onAddWatchpoint({ type: 'flag', flag: wpTarget as keyof CpuFlags });
    } else {
      const addr = wpTarget.startsWith('0x') ? parseInt(wpTarget.slice(2), 16) : parseInt(wpTarget, 10);
      onAddWatchpoint({ type: 'memory', address: Number.isNaN(addr) ? 0 : addr });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Accessible Status & Stop Reason Message */}
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">
            {isRunning ? 'Running' : isHalted ? 'Halted' : isFaulted ? 'Fault' : status === 'assembled' ? 'Ready' : 'Paused'}
          </span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {stopReasonMessage ?? (isRunning ? 'Executing…' : status === 'assembled' ? 'Ready to run' : 'Idle')}
          </span>
        </div>
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          Steps: {totalSteps}
        </span>
      </div>

      {/* Primary Execution Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onAssemble}
          aria-label="Assemble source code and reset CPU"
          title="Assemble (Ctrl+Enter)"
        >
          Assemble
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onReset}
          disabled={!hasProgram || isRunning}
          aria-label="Reset CPU to initial state"
          title="Reset (Ctrl+R)"
        >
          Reset
        </Button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        <Button
          variant="secondary"
          size="sm"
          onClick={onStep}
          disabled={!canExecute}
          aria-label="Execute one instruction"
          title="Step (F7)"
        >
          → Step
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onStepOver}
          disabled={!canExecute}
          aria-label="Step over subroutine call"
          title="Step Over (F8)"
        >
          ⤵ Over
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onStepOut}
          disabled={!canExecute}
          aria-label="Step out of subroutine"
          title="Step Out (Shift+F8)"
        >
          ⤴ Out
        </Button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        {isRunning ? (
          <Button
            variant="danger"
            size="sm"
            onClick={onPause}
            aria-label="Pause program execution"
            title="Pause execution"
          >
            Pause
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            disabled={!canExecute}
            aria-label="Run program to halt or breakpoint"
            title="Run (F5)"
          >
            Run
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRunToCursor(currentLine > 0 ? currentLine : 1)}
          disabled={!canExecute}
          aria-label="Run to cursor line"
          title="Run to cursor line"
        >
          ⤓ To Cursor
        </Button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        {/* Speed Selector */}
        <div className="flex items-center gap-1 text-xs">
          <label htmlFor="speed-select" className="text-gray-500 font-semibold dark:text-gray-400">
            Speed:
          </label>
          <select
            id="speed-select"
            value={speed}
            onChange={(e) => setSpeed(e.target.value as RunSpeed)}
            aria-label="Execution speed selector"
            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="1">1 step/s</option>
            <option value="5">5 steps/s</option>
            <option value="20">20 steps/s</option>
            <option value="max">Max speed</option>
          </select>
        </div>
      </div>

      {/* History and Watchpoints bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-400 dark:text-gray-500">History:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onStepBack}
            disabled={!canStepBack || isRunning}
            aria-label="Step backward in execution history"
          >
            ← Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onStepForward}
            disabled={!canStepForward || isRunning}
            aria-label="Step forward in execution history"
          >
            Forward →
          </Button>
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWatchpointUI(!showWatchpointUI)}
            aria-label="Configure execution watchpoints"
          >
            Watchpoints ({watchpoints.length})
          </Button>
        </div>
      </div>

      {/* Watchpoint manager drawer */}
      {showWatchpointUI && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs space-y-2 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Stop when:</span>
            <select
              value={wpType}
              onChange={(e) => {
                const t = e.target.value as 'register' | 'flag' | 'memory';
                setWpType(t);
                setWpTarget(t === 'register' ? 'AX' : t === 'flag' ? 'Z' : '0x0200');
              }}
              className="rounded border border-gray-300 px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-800"
              aria-label="Watchpoint type"
            >
              <option value="register">Register changes</option>
              <option value="flag">Flag changes</option>
              <option value="memory">Memory write</option>
            </select>

            <input
              type="text"
              value={wpTarget}
              onChange={(e) => setWpTarget(e.target.value)}
              placeholder={wpType === 'memory' ? '0x0200' : 'AX'}
              aria-label="Watchpoint target"
              className="w-20 rounded border border-gray-300 px-1.5 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-800"
            />
            <Button variant="secondary" size="sm" onClick={handleAddWp}>
              + Add
            </Button>
          </div>

          {watchpoints.length > 0 && (
            <ul className="space-y-1">
              {watchpoints.map((w, idx) => (
                <li key={idx} className="flex items-center justify-between rounded bg-white px-2 py-1 dark:bg-gray-800">
                  <span className="font-mono text-[11px]">
                    {w.type === 'register' && `stop when ${w.register} changes`}
                    {w.type === 'flag' && `stop when flag ${w.flag} changes`}
                    {w.type === 'memory' && `stop when memory [0x${w.address.toString(16).toUpperCase()}] is written`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveWatchpoint(idx)}
                    className="text-red-600 dark:text-red-400 font-bold hover:underline"
                    aria-label={`Remove watchpoint ${idx + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
