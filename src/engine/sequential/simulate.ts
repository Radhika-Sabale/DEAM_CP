/**
 * @file simulate.ts
 * Behavioural sequential waveform timeline simulator (Stage 10B).
 * Executes cycle-by-cycle clock transitions, evaluates synthesized Boolean equations,
 * models flip-flop state updates via Stage 9A nextState, and produces UI-ready ValueChange event streams.
 */

import type { LogicValue } from '../../types/ast';
import type { ValueChange } from '../circuit/simulatorTypes';
import { evaluateBinary } from '../boolean/evaluator';
import { nextState } from '../flipflop/models';
import type { SequentialDesign } from './counterDesigner';
import { codeToBits, inputVariableNames } from './encoding';
import { evaluateEquations } from './nextStateEquations';

/** Single cycle tabular execution snapshot. */
export interface SimulationRow {
  readonly cycle: number;
  readonly time: number;
  readonly state: number | 'X';
  readonly input: number;
  readonly ffInputs: Record<string, LogicValue>;
  readonly output: LogicValue;
  readonly nextState: number | 'X';
}

/** Options configuring behavioural sequential simulation. */
export interface SimulateDesignOptions {
  /** Initial starting state integer code (default: spec initial state code) */
  readonly initialState?: number;
  /** Sequence of binary inputs per clock cycle (default: zeros) */
  readonly inputs?: readonly (0 | 1)[];
  /** Total clock cycles to simulate (default: length of inputs, or 10) */
  readonly cycles?: number;
  /** Clock period duration in arbitrary time units (default: 10) */
  readonly period?: number;
}

/** Successful result of behavioural sequential simulation. */
export interface SimulateDesignResult {
  readonly ok: true;
  readonly rows: readonly SimulationRow[];
  readonly changes: readonly ValueChange[];
  readonly finalState: number | 'X';
  readonly visited: readonly number[];
  readonly warnings: readonly string[];
}

/** Simulation error report. */
export interface SimulateDesignError {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** Discriminated response of simulateDesign. */
export type SimulateDesignResponse = SimulateDesignResult | SimulateDesignError;

/**
 * Simulates the behavioral clock-by-clock execution of a synthesized sequential design.
 *
 * @param design Synthesized sequential design
 * @param options Simulation parameters (initialState, inputs, cycles, period)
 * @returns Simulation rows, waveform changes, visited states, and diagnostic warnings
 */
export function simulateDesign(
  design: SequentialDesign,
  options: SimulateDesignOptions = {}
): SimulateDesignResponse {
  const n = design.table.stateBits;
  const period = options.period ?? 10;
  const hasInput = design.table.hasInput;
  const inNames = inputVariableNames(design.table.inputKind);
  const inLabel = inNames[0] ?? 'IN';
  const flipFlop = design.spec.flipFlop;

  const totalCycles =
    options.cycles ?? (options.inputs ? options.inputs.length : 10);

  if (totalCycles < 1) {
    return {
      ok: false,
      error: {
        code: 'bad-cycles',
        message: 'Cycle count must be at least 1.',
      },
    };
  }

  const startState = options.initialState ?? design.table.initialStateCode;
  const maxStateCode = (1 << n) - 1;
  if (startState < 0 || startState > maxStateCode) {
    return {
      ok: false,
      error: {
        code: 'bad-initial-state',
        message: `Initial state ${startState} is outside valid binary range [0, ${maxStateCode}].`,
      },
    };
  }

  const inputs = options.inputs ?? new Array(totalCycles).fill(0);
  const changes: ValueChange[] = [];
  const currentSignals = new Map<string, LogicValue>();

  function setSignal(time: number, nodeId: string, val: LogicValue) {
    const prev = currentSignals.get(nodeId);
    if (prev !== val) {
      currentSignals.set(nodeId, val);
      changes.push({ time, nodeId, value: val });
    }
  }

  const zEquation = design.equations.find((e) => e.name === 'Z');

  // Initialize signals at time t = 0
  setSignal(0, 'CLK', 0);

  const initBits = codeToBits(startState, n);
  for (let b = 0; b < n; b++) {
    setSignal(0, `Q${b}`, initBits[n - 1 - b] ?? 0);
  }

  const in0 = hasInput ? (inputs[0] ?? 0) : 0;
  if (hasInput) {
    setSignal(0, inLabel, in0);
  }

  // Initial output Z valuation at t = 0
  let initialZ: LogicValue = 0;
  if (zEquation) {
    if (zEquation.constant !== null) {
      initialZ = zEquation.constant;
    } else {
      const env: Record<string, 0 | 1> = {};
      for (let b = 0; b < n; b++) {
        env[`Q${b}`] = initBits[n - 1 - b] ?? 0;
      }
      if (hasInput && zEquation.variables.includes(inLabel)) {
        env[inLabel] = in0;
      }
      initialZ = evaluateBinary(zEquation.expression, env);
    }
    setSignal(0, 'Z', initialZ);
  }

  const rows: SimulationRow[] = [];
  const visitedList: number[] = [startState];
  const visitedSet = new Set<number>([startState]);
  const warnings: string[] = [];
  let currentState: number | 'X' = startState;

  for (let k = 0; k < totalCycles; k++) {
    const tStart = k * period;
    const tEdge = k * period + Math.floor(period / 2);

    // Apply CLK low at cycle start
    if (k > 0) {
      setSignal(tStart, 'CLK', 0);
    }

    const inVal: 0 | 1 = hasInput ? (inputs[k] ?? 0) : 0;
    if (hasInput) {
      setSignal(tStart, inLabel, inVal);
    }

    // Evaluate equations for present state & input
    const ffInputs = evaluateEquations(
      design.equations,
      currentState,
      inVal,
      hasInput
    );

    let outVal: LogicValue = 0;
    if (zEquation) {
      outVal = ffInputs['Z'] ?? initialZ;
      setSignal(tStart, 'Z', outVal);
    }

    // Compute next state for each flip-flop bit
    const presentBits = codeToBits(currentState, n);
    const nextBits: (0 | 1)[] = [];
    let hasX = false;

    for (let bit = 0; bit < n; bit++) {
      const q = presentBits[n - 1 - bit] ?? 0;
      let inVec: LogicValue[] = [];

      if (flipFlop === 'SR') {
        inVec = [ffInputs[`S${bit}`] ?? 'X', ffInputs[`R${bit}`] ?? 'X'];
      } else if (flipFlop === 'JK') {
        inVec = [ffInputs[`J${bit}`] ?? 'X', ffInputs[`K${bit}`] ?? 'X'];
      } else if (flipFlop === 'D') {
        inVec = [ffInputs[`D${bit}`] ?? 'X'];
      } else if (flipFlop === 'T') {
        inVec = [ffInputs[`T${bit}`] ?? 'X'];
      }

      const nq = nextState(flipFlop, inVec, q);
      if (nq === 'X') {
        hasX = true;
      } else {
        nextBits.unshift(nq as 0 | 1);
      }
    }

    let nextCode: number | 'X';
    if (hasX) {
      nextCode = 'X';
      warnings.push(
        `Cycle ${k} (t=${tEdge}): Invalid flip-flop inputs produced indeterminate next state 'X'.`
      );
    } else {
      let codeVal = 0;
      for (let i = 0; i < n; i++) {
        codeVal = (codeVal << 1) | (nextBits[i] ?? 0);
      }
      nextCode = codeVal;
    }

    rows.push({
      cycle: k,
      time: tStart,
      state: currentState,
      input: inVal,
      ffInputs,
      output: outVal,
      nextState: nextCode,
    });

    // Rising clock edge at tEdge
    setSignal(tEdge, 'CLK', 1);

    if (nextCode === 'X') {
      for (let b = 0; b < n; b++) {
        setSignal(tEdge, `Q${b}`, 'X');
      }
      if (zEquation) {
        setSignal(tEdge, 'Z', 'X');
      }
      currentState = 'X';
      break;
    }

    const nextBitsArr = codeToBits(nextCode, n);
    for (let b = 0; b < n; b++) {
      setSignal(tEdge, `Q${b}`, nextBitsArr[n - 1 - b] ?? 0);
    }

    currentState = nextCode;
    if (!visitedSet.has(currentState)) {
      visitedSet.add(currentState);
      visitedList.push(currentState);
    }

    // Moore output updates immediately after state transition at rising edge
    if (design.table.machineKind === 'moore' && zEquation) {
      const mooreEnv: Record<string, 0 | 1> = {};
      for (let b = 0; b < n; b++) {
        mooreEnv[`Q${b}`] = nextBitsArr[n - 1 - b] ?? 0;
      }
      const updatedZ = evaluateBinary(zEquation.expression, mooreEnv);
      setSignal(tEdge, 'Z', updatedZ);
    }
  }

  // End of simulation CLK low at tFinal
  const tFinal = totalCycles * period;
  setSignal(tFinal, 'CLK', 0);

  return {
    ok: true,
    rows,
    changes,
    finalState: currentState,
    visited: visitedList,
    warnings,
  };
}
