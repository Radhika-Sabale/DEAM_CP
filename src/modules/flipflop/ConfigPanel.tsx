/**
 * @file ConfigPanel.tsx
 * Architecture configuration panel for flip-flops and latches.
 * Controls flip-flop type, trigger mode with live pedagogical explanations,
 * asynchronous preset/clear polarities, propagation delays, setup/hold constraints,
 * and initial state valuation.
 */

import { type FC, useId } from 'react';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType, TriggerMode } from '../../types/sequential';
import { explainTrigger } from '../../engine/flipflop/explain';
import type { FlipFlopConfig } from '../../engine/flipflop/models';

export interface ConfigPanelProps {
  readonly config: FlipFlopConfig;
  readonly initialQ: LogicValue;
  readonly onTypeChange: (type: FlipFlopType) => void;
  readonly onConfigChange: (config: FlipFlopConfig) => void;
  readonly onInitialQChange: (q: LogicValue) => void;
  readonly className?: string;
}

const FLIP_FLOP_TYPES: readonly { readonly type: FlipFlopType; readonly label: string }[] = [
  { type: 'SR', label: 'SR Latch / Flip-Flop' },
  { type: 'JK', label: 'JK Flip-Flop' },
  { type: 'D', label: 'D (Data) Flip-Flop' },
  { type: 'T', label: 'T (Toggle) Flip-Flop' },
];

const TRIGGER_MODES: readonly { readonly mode: TriggerMode; readonly label: string }[] = [
  { mode: 'rising', label: 'Positive Edge (Rising 0 → 1)' },
  { mode: 'falling', label: 'Negative Edge (Falling 1 → 0)' },
  { mode: 'level-high', label: 'Level-Sensitive High (Transparent 1)' },
  { mode: 'level-low', label: 'Level-Sensitive Low (Transparent 0)' },
];

export const ConfigPanel: FC<ConfigPanelProps> = ({
  config,
  initialQ,
  onTypeChange,
  onConfigChange,
  onInitialQChange,
  className = '',
}) => {
  const triggerSelectId = useId();
  const asyncCheckId = useId();
  const asyncPolarityId = useId();
  const propDelayId = useId();
  const setupTimeId = useId();
  const holdTimeId = useId();
  const initialQId = useId();

  const isLevelTriggered = config.trigger === 'level-high' || config.trigger === 'level-low';
  const triggerInfo = explainTrigger(config.trigger);

  return (
    <div
      className={`flipflop-config-card rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Component Configuration
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select flip-flop architecture, clock triggering, timing parameters, and async pins.
        </p>
      </div>

      <div className="flipflop-config-controls mt-4 space-y-4 text-xs">
        {/* Flip-Flop Type Radio Group */}
        <div>
          <fieldset>
            <legend className="font-semibold text-gray-700 dark:text-gray-300">
              Flip-Flop Architecture:
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FLIP_FLOP_TYPES.map(({ type, label }) => {
                const isChecked = config.type === type;
                return (
                  <label
                    key={type}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-center transition-all ${
                      isChecked
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ff-type"
                      value={type}
                      checked={isChecked}
                      onChange={() => onTypeChange(type)}
                      className="sr-only"
                    />
                    <span className="font-mono text-sm">{type}</span>
                    <span className="text-[10px] opacity-75">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Trigger Mode Select & Explanation */}
        <div>
          <label
            htmlFor={triggerSelectId}
            className="block font-semibold text-gray-700 dark:text-gray-300"
          >
            Clock Triggering Mechanism:
          </label>
          <select
            id={triggerSelectId}
            value={config.trigger}
            onChange={(e) =>
              onConfigChange({
                ...config,
                trigger: e.target.value as TriggerMode,
              })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {TRIGGER_MODES.map(({ mode, label }) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            &bull; {triggerInfo.description}
          </p>
        </div>

        {/* Asynchronous PRESET & CLEAR Controls */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-950/40 space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              id={asyncCheckId}
              type="checkbox"
              checked={config.asyncControls}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  asyncControls: e.target.checked,
                })
              }
              className="tog focus:ring-blue-500"
            />
            <label
              htmlFor={asyncCheckId}
              className="font-semibold text-gray-800 dark:text-gray-200"
            >
              Asynchronous PRESET & CLEAR Controls
            </label>
          </div>

          {config.asyncControls && (
            <div>
              <label
                htmlFor={asyncPolarityId}
                className="block text-[11px] font-medium text-gray-600 dark:text-gray-400"
              >
                Control Assertion Active Level:
              </label>
              <select
                id={asyncPolarityId}
                value={config.asyncActiveLow ? 'active-low' : 'active-high'}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    asyncActiveLow: e.target.value === 'active-low',
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="active-low">Active-Low (PRE=0 sets Q=1, CLR=0 resets Q=0)</option>
                <option value="active-high">Active-High (PRE=1 sets Q=1, CLR=1 resets Q=0)</option>
              </select>
            </div>
          )}
        </div>

        {/* Timing Parameters: Delay, Setup, Hold */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor={propDelayId}
              className="block font-medium text-gray-700 dark:text-gray-300"
            >
              Propagation Delay (t_pd):
            </label>
            <input
              id={propDelayId}
              type="number"
              min={0}
              max={100}
              value={config.propagationDelay}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  propagationDelay: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor={setupTimeId}
              className={`block font-medium ${
                isLevelTriggered
                  ? 'text-gray-400 dark:text-gray-600'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              Setup Time (t_setup):
            </label>
            <input
              id={setupTimeId}
              type="number"
              min={0}
              max={100}
              disabled={isLevelTriggered}
              value={config.setupTime}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  setupTime: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor={holdTimeId}
              className={`block font-medium ${
                isLevelTriggered
                  ? 'text-gray-400 dark:text-gray-600'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              Hold Time (t_hold):
            </label>
            <input
              id={holdTimeId}
              type="number"
              min={0}
              max={100}
              disabled={isLevelTriggered}
              value={config.holdTime}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  holdTime: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {isLevelTriggered && (
          <p className="text-[11px] italic text-gray-500 dark:text-gray-400">
            Note: Setup and hold times apply only to edge-triggered flip-flops.
          </p>
        )}

        {/* Initial Output State Q */}
        <div>
          <label
            htmlFor={initialQId}
            className="block font-semibold text-gray-700 dark:text-gray-300"
          >
            Initial Output State Q(0):
          </label>
          <select
            id={initialQId}
            value={String(initialQ)}
            onChange={(e) => {
              const val = e.target.value;
              onInitialQChange(val === '1' ? 1 : val === '0' ? 0 : 'X');
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="0">0 (Reset output)</option>
            <option value="1">1 (Set output)</option>
            <option value="X">X (Indeterminate / Unknown state)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
