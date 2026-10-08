/**
 * @file DefineDetector.tsx
 * Step 2 component: Sequence Detector Machine Definition (Stage 10D).
 *
 * Provides binary pattern input (0/1 only, 2..8 bits), Mealy vs Moore machine selection
 * with pedagogical trade-off explanations, overlapping detection toggle, and state count projections.
 */

import { type FC, useId, useMemo } from 'react';
import { minStateBits } from '../../engine/sequential/encoding';
import { validateSpec } from '../../engine/sequential/specs';
import type {
  DetectorSpec,
  FlipFlopType,
} from '../../types/sequential';

export interface DefineDetectorProps {
  readonly flipFlop: FlipFlopType;
  readonly value: DetectorSpec | null;
  readonly onChange: (spec: DetectorSpec | null) => void;
  readonly className?: string;
}

export const DefineDetector: FC<DefineDetectorProps> = ({
  flipFlop,
  value,
  onChange,
  className = '',
}) => {
  const baseId = useId();

  const pattern = value?.pattern ?? '101';
  const machine = value?.machine ?? 'mealy';
  const overlapping = value?.overlapping ?? true;

  const updateSpec = (patch: Partial<DetectorSpec>) => {
    const next: DetectorSpec = {
      kind: 'detector',
      flipFlop,
      pattern,
      machine,
      overlapping,
      ...patch,
    };
    onChange(next);
  };

  // Derive projections and engine validations
  const { mealyStates, mooreStates, activeStates, stateBits, errors } = useMemo(() => {
    const pLen = pattern.length;
    const mealyCount = pLen >= 2 ? pLen : 0;
    const mooreCount = pLen >= 2 ? pLen + 1 : 0;
    const active = machine === 'mealy' ? mealyCount : mooreCount;
    const bits = active > 0 ? minStateBits(active) : 1;

    const candidate: DetectorSpec = {
      kind: 'detector',
      flipFlop,
      pattern,
      machine,
      overlapping,
    };

    const val = validateSpec(candidate);
    const errs = val.ok ? [] : val.errors.map((e) => e.message);

    return {
      mealyStates: mealyCount,
      mooreStates: mooreCount,
      activeStates: active,
      stateBits: bits,
      errors: errs,
    };
  }, [flipFlop, pattern, machine, overlapping]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Pattern entry & Machine Style Controls */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Binary Pattern */}
        <div>
          <label htmlFor={`${baseId}-pattern`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            Target Binary Sequence Pattern (2 to 8 bits: 0 and 1 only)
          </label>
          <input
            id={`${baseId}-pattern`}
            type="text"
            value={pattern}
            maxLength={8}
            placeholder="e.g. 1011"
            onChange={(e) => updateSpec({ pattern: e.target.value.trim() })}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-mono text-sm tracking-widest text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Bit length: {pattern.length} / 8 bits.
          </p>
        </div>

        {/* Overlapping checkbox */}
        <div className="flex items-center pt-5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              id={`${baseId}-overlapping`}
              type="checkbox"
              checked={overlapping}
              onChange={(e) => updateSpec({ overlapping: e.target.checked })}
              className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
            />
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Allow Overlapping Sequence Detection
            </span>
          </label>
        </div>
      </div>

      {/* Machine Model Selection: Mealy vs Moore */}
      <fieldset>
        <legend className="text-xs font-bold text-gray-700 dark:text-gray-300">
          FSM Machine Architecture Model
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Mealy Option */}
          <label
            htmlFor={`${baseId}-mealy`}
            className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
              machine === 'mealy'
                ? 'border-blue-600 bg-blue-50/60 shadow-xs dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Mealy Machine
              </span>
              <input
                id={`${baseId}-mealy`}
                type="radio"
                name="detectorMachineModel"
                value="mealy"
                checked={machine === 'mealy'}
                onChange={() => updateSpec({ machine: 'mealy' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
              Outputs depend on present state and current input (faster response; fewer states: {mealyStates} states).
            </p>
          </label>

          {/* Moore Option */}
          <label
            htmlFor={`${baseId}-moore`}
            className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
              machine === 'moore'
                ? 'border-blue-600 bg-blue-50/60 shadow-xs dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Moore Machine
              </span>
              <input
                id={`${baseId}-moore`}
                type="radio"
                name="detectorMachineModel"
                value="moore"
                checked={machine === 'moore'}
                onChange={() => updateSpec({ machine: 'moore' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
              Outputs depend strictly on present state (glitch-free clock-synchronized output: {mooreStates} states).
            </p>
          </label>
        </div>
      </fieldset>

      {/* Validation Errors Box */}
      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-bold">Specification Issues:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Live Machine Architecture Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Active Model States</span>
          <span className="mt-0.5 block text-lg font-bold text-gray-900 dark:text-gray-100">{activeStates}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Flip-Flops Needed</span>
          <span className="mt-0.5 block text-lg font-bold text-blue-600 dark:text-blue-400">{stateBits}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Mealy vs Moore</span>
          <span className="mt-0.5 block text-xs font-bold text-gray-700 dark:text-gray-300">
            Mealy: {mealyStates} | Moore: {mooreStates}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Variables (Q + IN)</span>
          <span className="mt-0.5 block text-lg font-bold text-gray-900 dark:text-gray-100">{stateBits + 1} / 5</span>
        </div>
      </div>
    </div>
  );
};
