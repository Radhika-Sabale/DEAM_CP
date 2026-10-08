/**
 * @file DefineCounter.tsx
 * Step 2 component: Synchronous and Asynchronous Counter Machine Definition (Stage 10D).
 *
 * Provides style selection, direction (up, down, up/down with DN polarity explanation, custom),
 * modulus number entry, custom sequence parsing, state bits override, and live pedagogical metrics.
 */

import { type FC, useId, useMemo } from 'react';
import { minStateBits } from '../../engine/sequential/encoding';
import { validateSpec } from '../../engine/sequential/specs';
import { designAsyncRipple } from '../../engine/sequential/asyncRipple';
import type {
  CounterDirection,
  CounterSpec,
  FlipFlopType,
} from '../../types/sequential';

export interface DefineCounterProps {
  readonly flipFlop: FlipFlopType;
  readonly value: CounterSpec | null;
  readonly onChange: (spec: CounterSpec | null) => void;
  readonly className?: string;
}

export const DefineCounter: FC<DefineCounterProps> = ({
  flipFlop,
  value,
  onChange,
  className = '',
}) => {
  const baseId = useId();

  // Current field states with clean defaults
  const style = value?.style ?? 'sync';
  const direction: CounterDirection = value?.direction ?? 'up';
  const modulus = value?.modulus ?? 4;
  const asyncTrigger = value?.asyncTrigger ?? 'falling';
  const rawSequence = value?.sequence ? value.sequence.join(', ') : '';
  const customBits = value?.stateBits;

  // Update helper
  const updateSpec = (patch: Partial<CounterSpec>) => {
    const next: CounterSpec = {
      kind: 'counter',
      flipFlop,
      style,
      direction,
      modulus,
      asyncTrigger,
      stateBits: customBits,
      sequence: value?.sequence,
      ...patch,
    };
    onChange(next);
  };

  // Custom sequence parser
  const sequenceParse = useMemo(() => {
    if (direction !== 'custom') return { ok: true, sequence: [], error: null };
    if (!rawSequence.trim()) {
      return { ok: false, sequence: [], error: 'Enter a comma-separated sequence of state numbers.' };
    }
    const parts = rawSequence.split(',').map((s) => s.trim()).filter(Boolean);
    const nums: number[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (isNaN(n) || !Number.isInteger(n) || n < 0 || n > 15) {
        return { ok: false, sequence: [], error: `Invalid state number "${p}". Numbers must be integers 0..15.` };
      }
      nums.push(n);
    }
    if (nums.length < 2) return { ok: false, sequence: [], error: 'A custom counter must visit at least 2 distinct states.' };
    if (new Set(nums).size !== nums.length) return { ok: false, sequence: [], error: 'Custom sequence states must be unique.' };
    return { ok: true, sequence: nums, error: null };
  }, [direction, rawSequence]);

  // Derive machine metrics & validation errors
  const { stateCount, stateBits, unusedCodes, varCount, errors } = useMemo(() => {
    const errs: string[] = [];

    // Calculate states visited
    let count = direction === 'custom' ? (sequenceParse.ok ? sequenceParse.sequence.length : 0) : modulus;
    count = Math.max(0, count);

    const minBits = count > 0 ? minStateBits(count) : 1;
    const effectiveBits = customBits ?? minBits;
    const totalCapacity = 1 << effectiveBits;

    // Determine visited vs unused codes
    const visitedSet = new Set<number>();
    if (direction === 'custom') {
      for (const n of sequenceParse.sequence) visitedSet.add(n);
    } else {
      for (let i = 0; i < count && i < totalCapacity; i++) visitedSet.add(i);
    }

    const unused: number[] = [];
    for (let c = 0; c < totalCapacity; c++) {
      if (!visitedSet.has(c)) unused.push(c);
    }

    // Input variable count: 0 for up/down/custom, 1 for up-down (DN)
    const inVars = direction === 'up-down' ? 1 : 0;
    const totalVars = effectiveBits + inVars;

    // Validate using engine specs
    const candidate: CounterSpec = {
      kind: 'counter',
      flipFlop,
      style,
      direction,
      modulus: direction === 'custom' ? (sequenceParse.sequence.length || 2) : modulus,
      sequence: direction === 'custom' ? sequenceParse.sequence : undefined,
      stateBits: effectiveBits,
      asyncTrigger,
    };

    if (sequenceParse.error) {
      errs.push(sequenceParse.error);
    } else {
      const val = validateSpec(candidate);
      if (!val.ok) {
        for (const e of val.errors) errs.push(e.message);
      } else if (style === 'async' && val.spec.kind === 'counter') {
        const aRes = designAsyncRipple(val.spec);
        if (!aRes.ok) {
          for (const e of aRes.errors) errs.push(e.message);
        }
      }
    }

    return {
      stateCount: count,
      stateBits: effectiveBits,
      unusedCodes: unused,
      varCount: totalVars,
      errors: errs,
    };
  }, [direction, modulus, sequenceParse, customBits, flipFlop, style, asyncTrigger]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Configuration Controls Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Style selection */}
        <div>
          <label htmlFor={`${baseId}-style`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            Clock Synchronization Style
          </label>
          <select
            id={`${baseId}-style`}
            value={style}
            onChange={(e) => updateSpec({ style: e.target.value as 'sync' | 'async' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="sync">Synchronous (Common clock to all flip-flops)</option>
            <option value="async">Asynchronous (Ripple clock propagation)</option>
          </select>
        </div>

        {/* Direction selection */}
        <div>
          <label htmlFor={`${baseId}-direction`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            Counting Direction
          </label>
          <select
            id={`${baseId}-direction`}
            value={direction}
            onChange={(e) => updateSpec({ direction: e.target.value as CounterDirection })}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="up">Count Up (0 &rarr; 1 &rarr; 2 ...)</option>
            <option value="down">Count Down (N-1 &rarr; ... &rarr; 0)</option>
            <option value="up-down">Bidirectional Up/Down (Controlled by input DN)</option>
            <option value="custom">Custom Sequence (Arbitrary state cycle)</option>
          </select>
          {direction === 'up-down' && (
            <p className="mt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              Control mode: DN = 0 counts up, DN = 1 counts down.
            </p>
          )}
        </div>

        {/* Modulus entry (when not custom) */}
        {direction !== 'custom' && (
          <div>
            <label htmlFor={`${baseId}-modulus`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Modulus (States per cycle: 2..16)
            </label>
            <input
              id={`${baseId}-modulus`}
              type="number"
              min={2}
              max={16}
              value={modulus}
              onChange={(e) => updateSpec({ modulus: parseInt(e.target.value, 10) || 2 })}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        {/* Custom sequence input */}
        {direction === 'custom' && (
          <div className="md:col-span-2">
            <label htmlFor={`${baseId}-sequence`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Custom Sequence (Comma-separated state numbers, e.g. 0, 1, 3, 5)
            </label>
            <input
              id={`${baseId}-sequence`}
              type="text"
              value={rawSequence}
              placeholder="e.g. 0, 2, 4, 6"
              onChange={(e) => {
                const parts = e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                updateSpec({ sequence: parts });
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        {/* Async Trigger selection */}
        {style === 'async' && (
          <div>
            <label htmlFor={`${baseId}-async-trigger`} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Clock Trigger Edge
            </label>
            <select
              id={`${baseId}-async-trigger`}
              value={asyncTrigger}
              onChange={(e) => updateSpec({ asyncTrigger: e.target.value as 'rising' | 'falling' })}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="falling">Falling-Edge Triggered (Negative clock edge)</option>
              <option value="rising">Rising-Edge Triggered (Positive clock edge)</option>
            </select>
          </div>
        )}
      </div>

      {/* Validation Errors Box */}
      {errors.length > 0 && (
        <div role="alert" aria-live="assertive" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-bold">Specification Issues:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {errors.map((msg, i) => (<li key={i}>{msg}</li>))}
          </ul>
        </div>
      )}

      {/* Live Machine Architecture Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">States Visited</span>
          <span className="mt-0.5 block text-lg font-bold text-gray-900 dark:text-gray-100">{stateCount}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">State Bits</span>
          <span className="mt-0.5 block text-lg font-bold text-gray-900 dark:text-gray-100">{stateBits}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Flip-Flops Needed</span>
          <span className="mt-0.5 block text-lg font-bold text-blue-600 dark:text-blue-400">{stateBits}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Unused States</span>
          <span className="mt-0.5 block text-lg font-bold text-amber-600 dark:text-amber-400">{unusedCodes.length} {unusedCodes.length > 0 ? `(${unusedCodes.join(', ')})` : ''}</span>
        </div>
        <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-center sm:col-span-1 dark:border-gray-800 dark:bg-gray-800/40">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Total Variables</span>
          <span className="mt-0.5 block text-lg font-bold text-gray-900 dark:text-gray-100">{varCount} / 5</span>
        </div>
      </div>
    </div>
  );
};
