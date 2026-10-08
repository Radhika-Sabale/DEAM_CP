/**
 * @file asyncRipple.ts
 * Architectural designer and discrete-event timing simulator for asynchronous ripple counters (Stage 10B).
 * Implements toggle tie rules, trigger polarity chaining, mod-N AND decode clear feedback,
 * and high-resolution glitch and ripple delay transient analysis.
 */

import type { LogicValue } from '../../types/ast';
import type { ValueChange } from '../circuit/simulatorTypes';
import type { CounterSpec, FlipFlopType } from '../../types/sequential';
import { minStateBits } from './encoding';
import {
  type NormalizedCounterSpec,
  type SpecValidationError,
  validateSpec,
} from './specs';

/** Checks whether a number is a positive power of two (2, 4, 8, 16, etc.). */
function isPowerOfTwo(val: number): boolean {
  return val > 0 && (val & (val - 1)) === 0;
}

/** Architectural specification for a single flip-flop stage in a ripple counter. */
export interface AsyncRippleStage {
  readonly bitIndex: number;
  readonly flipFlop: FlipFlopType;
  readonly ties: Record<string, 1 | 'Q' | 'Qbar'>;
  readonly clockSource: 'external' | { readonly stage: number; readonly pin: 'Q' | 'Qbar' };
}

/** Asynchronous decode logic for non-power-of-2 modulus reset. */
export interface AsyncDecodeLogic {
  readonly active: boolean;
  readonly targetNumber: number;
  readonly bitIndices: readonly number[];
  readonly expression: string;
}

/** Complete synthesized asynchronous ripple counter design. */
export interface AsyncRippleDesign {
  readonly spec: NormalizedCounterSpec;
  readonly stateBits: number;
  readonly modulus: number;
  readonly direction: 'up' | 'down';
  readonly flipFlop: FlipFlopType;
  readonly trigger: 'rising' | 'falling';
  readonly stages: readonly AsyncRippleStage[];
  readonly decode: AsyncDecodeLogic;
  readonly notes: readonly string[];
}

/** Discriminated result of designAsyncRipple. */
export type DesignAsyncRippleResult =
  | { readonly ok: true; readonly design: AsyncRippleDesign }
  | { readonly ok: false; readonly errors: readonly SpecValidationError[] };

/** Transient glitch or intermediate state recorded during ripple propagation. */
export interface TransientRecord {
  readonly start: number;
  readonly end: number;
  readonly code: number;
}

/** Per-cycle settled count snapshot and timing metric. */
export interface CycleSample {
  readonly cycle: number;
  readonly settledCount: number;
  readonly settleTime: number;
}

/** Result of discrete-event asynchronous ripple simulation. */
export interface SimulateAsyncRippleResult {
  readonly changes: readonly ValueChange[];
  readonly samples: readonly CycleSample[];
  readonly transients: readonly TransientRecord[];
  readonly maxRippleTime: number;
  readonly warnings: readonly string[];
}

/** Options configuring asynchronous ripple counter discrete-event simulation. */
export interface SimulateAsyncRippleOptions {
  readonly clockCycles?: number;
  readonly clockPeriod?: number;
  readonly stageDelay?: number;
  readonly decodeDelay?: number;
  readonly clearDelay?: number;
  readonly initialCount?: number;
}

/**
 * Synthesizes an asynchronous ripple counter architecture from a specification.
 *
 * @param spec Counter specification
 * @returns Discriminated result with stage connections and decode logic
 */
export function designAsyncRipple(spec: CounterSpec): DesignAsyncRippleResult {
  const validation = validateSpec(spec);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const norm = validation.spec;
  if (norm.kind !== 'counter') {
    return {
      ok: false,
      errors: [
        {
          code: 'bad-kind',
          field: 'kind',
          message: 'Expected counter specification.',
        },
      ],
    };
  }

  const dir = norm.direction;
  if (dir === 'custom' || dir === 'up-down') {
    return {
      ok: false,
      errors: [
        {
          code: 'async-unsupported',
          field: 'direction',
          message: "Asynchronous ripple counters only support 'up' or 'down' counting.",
        },
      ],
    };
  }

  const N = norm.modulus;
  if (dir === 'down' && !isPowerOfTwo(N)) {
    return {
      ok: false,
      errors: [
        {
          code: 'async-unsupported',
          field: 'modulus',
          message: 'Asynchronous ripple down-counters require a power-of-2 modulus (2, 4, 8, 16).',
        },
      ],
    };
  }

  const n = minStateBits(N);
  const ffType: FlipFlopType = norm.flipFlop;
  const trigger: 'rising' | 'falling' = norm.asyncTrigger ?? 'falling';

  // Chaining rule:
  // Falling-edge flip-flops: UP counter clocks from Q; DOWN counter clocks from Qbar.
  // Rising-edge flip-flops: UP counter clocks from Qbar; DOWN counter clocks from Q.
  const chainPin: 'Q' | 'Qbar' =
    trigger === 'falling'
      ? dir === 'up'
        ? 'Q'
        : 'Qbar'
      : dir === 'up'
        ? 'Qbar'
        : 'Q';

  const stages: AsyncRippleStage[] = [];
  for (let b = 0; b < n; b++) {
    let ties: Record<string, 1 | 'Q' | 'Qbar'> = {};
    if (ffType === 'T') {
      ties = { T: 1 };
    } else if (ffType === 'JK') {
      ties = { J: 1, K: 1 };
    } else if (ffType === 'D') {
      ties = { D: 'Qbar' };
    } else if (ffType === 'SR') {
      ties = { S: 'Qbar', R: 'Q' };
    }

    stages.push({
      bitIndex: b,
      flipFlop: ffType,
      ties,
      clockSource: b === 0 ? 'external' : { stage: b - 1, pin: chainPin },
    });
  }

  // Decode logic for non-power-of-2 up counter
  let decode: AsyncDecodeLogic;
  if (dir === 'up' && !isPowerOfTwo(N)) {
    const bitIndices: number[] = [];
    for (let b = 0; b < n; b++) {
      if (((N >> b) & 1) === 1) {
        bitIndices.push(b);
      }
    }
    const expr = bitIndices
      .map((b) => `Q${b}`)
      .reverse()
      .join(' & ');
    decode = {
      active: true,
      targetNumber: N,
      bitIndices,
      expression: expr,
    };
  } else {
    decode = {
      active: false,
      targetNumber: N,
      bitIndices: [],
      expression: '',
    };
  }

  const notes: string[] = [
    `Synthesized ${n}-bit asynchronous ripple ${dir}-counter (MOD-${N}) using ${trigger}-edge ${ffType} flip-flops.`,
  ];
  if (decode.active) {
    notes.push(
      `Asynchronous reset asserts when count reaches ${N} (${decode.expression}).`
    );
  }

  return {
    ok: true,
    design: {
      spec: norm,
      stateBits: n,
      modulus: N,
      direction: dir,
      flipFlop: ffType,
      trigger,
      stages,
      decode,
      notes,
    },
  };
}

/**
 * Discrete-event timing simulation of an asynchronous ripple counter with propagation delays.
 *
 * @param design Synthesized AsyncRippleDesign
 * @param options Simulation timing parameters
 * @returns Waveform value changes, cycle samples, transients, and timing diagnostics
 */
export function simulateAsyncRipple(
  design: AsyncRippleDesign,
  options: SimulateAsyncRippleOptions = {}
): SimulateAsyncRippleResult {
  const n = design.stateBits;
  const clockPeriod = options.clockPeriod ?? 40;
  const stageDelay = options.stageDelay ?? 2;
  const decodeDelay = options.decodeDelay ?? 1;
  const clearDelay = options.clearDelay ?? 1;
  const totalCycles = options.clockCycles ?? design.modulus * 2;
  let currentCount = options.initialCount ?? 0;

  const changes: ValueChange[] = [];
  const currentSignals = new Map<string, LogicValue>();

  function setSignal(time: number, nodeId: string, val: LogicValue) {
    if (currentSignals.get(nodeId) !== val) {
      currentSignals.set(nodeId, val);
      changes.push({ time, nodeId, value: val });
    }
  }

  // Initial state setup at t = 0
  setSignal(0, 'CLK', 0);
  setSignal(0, 'CLR', 0);
  const qBits: (0 | 1)[] = [];
  for (let b = 0; b < n; b++) {
    const bitVal = ((currentCount >> b) & 1) as 0 | 1;
    qBits.push(bitVal);
    setSignal(0, `Q${b}`, bitVal);
  }

  const samples: CycleSample[] = [];
  const transients: TransientRecord[] = [];
  const warnings: string[] = [];
  let maxRipple = 0;

  for (let k = 0; k < totalCycles; k++) {
    const tStart = k * clockPeriod;
    const tActive =
      design.trigger === 'falling'
        ? tStart + Math.floor(clockPeriod / 2)
        : tStart;
    const tInactive =
      design.trigger === 'falling'
        ? tStart
        : tStart + Math.floor(clockPeriod / 2);

    // Apply master clock transitions
    setSignal(tInactive, 'CLK', design.trigger === 'falling' ? 1 : 0);
    setSignal(tActive, 'CLK', design.trigger === 'falling' ? 0 : 1);

    // Discrete-event propagation through ripple stages
    let tCurr = tActive;
    let stageIndex = 0;
    let shouldToggle = true;

    while (stageIndex < n && shouldToggle) {
      tCurr += stageDelay;
      const oldBit = qBits[stageIndex] ?? 0;
      const newBit: 0 | 1 = (1 - oldBit) as 0 | 1;
      qBits[stageIndex] = newBit;
      setSignal(tCurr, `Q${stageIndex}`, newBit);

      // Check if this transition triggers the next stage
      if (stageIndex + 1 < n) {
        const nextStage = design.stages[stageIndex + 1];
        if (nextStage && typeof nextStage.clockSource === 'object') {
          const pin = nextStage.clockSource.pin;
          // Transition on driving pin:
          // pin === 'Q': oldBit -> newBit
          // pin === 'Qbar': (1-oldBit) -> (1-newBit)
          const pinOld = pin === 'Q' ? oldBit : 1 - oldBit;
          const pinNew = pin === 'Q' ? newBit : 1 - newBit;
          const isFalling = pinOld === 1 && pinNew === 0;
          const isRising = pinOld === 0 && pinNew === 1;

          shouldToggle =
            design.trigger === 'falling' ? isFalling : isRising;
        } else {
          shouldToggle = false;
        }
      }

      stageIndex++;
    }

    const rippleDuration = tCurr - tActive;
    maxRipple = Math.max(maxRipple, rippleDuration);

    // Check if mod-N decode reset triggers
    let countNow = 0;
    for (let b = 0; b < n; b++) {
      countNow |= (qBits[b] ?? 0) << b;
    }

    if (design.decode.active && countNow === design.decode.targetNumber) {
      const tDetect = tCurr;
      const tClrAssert = tDetect + decodeDelay;
      const tReset = tClrAssert + clearDelay;
      const tClrDeassert = tReset + decodeDelay;

      setSignal(tClrAssert, 'CLR', 1);

      // Reset all stages to 0
      for (let b = 0; b < n; b++) {
        qBits[b] = 0;
        setSignal(tReset, `Q${b}`, 0);
      }

      setSignal(tClrDeassert, 'CLR', 0);

      transients.push({
        start: tDetect,
        end: tReset,
        code: design.decode.targetNumber,
      });

      countNow = 0;
      tCurr = tReset;
    }

    const settleTime = tCurr - tActive;
    if (settleTime >= clockPeriod / 2) {
      warnings.push(
        `The clock is faster than the counter can settle, so the count is unreliable at cycle ${k}.`
      );
    }

    currentCount = countNow;
    samples.push({
      cycle: k,
      settledCount: currentCount,
      settleTime,
    });
  }

  // Sort changes chronologically
  changes.sort((a, b) => a.time - b.time);

  return {
    changes,
    samples,
    transients,
    maxRippleTime: maxRipple,
    warnings,
  };
}
