/**
 * @file lockout.ts
 * Rigorous lockout analysis and unused state transition verifier (Stage 10B).
 * Evaluates real Boolean equations across all unused state codes, detects lockout cycles (SCCs),
 * indeterminate flip-flop input conditions, and computes shortest return paths to valid states.
 */

import type { LogicValue } from '../../types/ast';
import type { CanonicalStateTable, FlipFlopType } from '../../types/sequential';
import { nextState } from '../flipflop/models';
import { codeToBits, formatCode } from './encoding';
import { findSCCs } from './lockoutScc';
import { type DerivedEquation, evaluateEquations } from './nextStateEquations';

/** Transition result from an unused state under a specific external input. */
export interface UnusedStateTransition {
  readonly input: number;
  readonly nextCode: number | 'X';
  readonly nextIsValid: boolean;
}

/** Diagnostic classification of an unused state. */
export type UnusedStateStatus = 'returns' | 'locked' | 'indeterminate';

/** Analysis record for a single unused state code. */
export interface UnusedStateAnalysis {
  readonly code: number;
  readonly binaryCode: string;
  readonly transitions: readonly UnusedStateTransition[];
  readonly status: UnusedStateStatus;
  readonly stepsToValid: number | null;
  readonly examplePath: readonly number[];
}

/** Complete lockout report for a sequential machine. */
export interface LockoutReport {
  readonly unusedStates: readonly UnusedStateAnalysis[];
  readonly lockedStates: readonly number[];
  readonly indeterminateStates: readonly number[];
  readonly cycles: readonly (readonly number[])[];
  readonly isSelfCorrecting: boolean;
  readonly maxStepsToValid: number | null;
  readonly messages: readonly { readonly code: number; readonly text: string }[];
}

/** Input payload for lockout analysis. */
export interface AnalyzeLockoutInput {
  readonly table: CanonicalStateTable;
  readonly equations: readonly DerivedEquation[];
  readonly flipFlop: FlipFlopType;
}

/**
 * Computes the next state code for a given present state and input from the real Boolean equations.
 *
 * @param code Integer state code
 * @param inVal External input value (0 or 1)
 * @param stateBits Number of state bits
 * @param flipFlop Flip-flop type ('SR', 'JK', 'D', 'T')
 * @param equations Derived Boolean equations
 * @param hasInput Whether the machine uses an external input
 * @returns Next state code integer, or 'X' if indeterminate
 */
export function computeEquationNextState(
  code: number,
  inVal: number,
  stateBits: number,
  flipFlop: FlipFlopType,
  equations: readonly DerivedEquation[],
  hasInput: boolean
): number | 'X' {
  const ffInputs = evaluateEquations(equations, code, inVal, hasInput);
  const presentBits = codeToBits(code, stateBits);
  const nextBits: (0 | 1)[] = [];

  for (let bit = 0; bit < stateBits; bit++) {
    const q = presentBits[stateBits - 1 - bit] ?? 0;
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
      return 'X';
    }
    nextBits.unshift(nq as 0 | 1);
  }

  let nextCode = 0;
  for (let i = 0; i < stateBits; i++) {
    nextCode = (nextCode << 1) | (nextBits[i] ?? 0);
  }

  return nextCode;
}

/**
 * Analyzes lockout behavior across all unused state codes using the synthesized Boolean equations.
 *
 * @param input Table, derived equations, and flip-flop model
 * @returns Comprehensive LockoutReport
 */
export function analyzeLockout(input: AnalyzeLockoutInput): LockoutReport {
  const { table, equations, flipFlop } = input;
  const n = table.stateBits;
  const unusedList = [...table.unusedCodes].sort((a, b) => a - b);
  const validSet = new Set(table.validCodes);
  const inputsToIterate = table.hasInput ? ([0, 1] as const) : ([0] as const);

  if (unusedList.length === 0) {
    return {
      unusedStates: [],
      lockedStates: [],
      indeterminateStates: [],
      cycles: [],
      isSelfCorrecting: true,
      maxStepsToValid: 0,
      messages: [],
    };
  }

  // 1. Evaluate transitions for every unused state
  const stateTransitions = new Map<number, UnusedStateTransition[]>();
  const indeterminateSet = new Set<number>();

  for (const u of unusedList) {
    const transList: UnusedStateTransition[] = [];
    for (const inVal of inputsToIterate) {
      const nextCode = computeEquationNextState(
        u,
        inVal,
        n,
        flipFlop,
        equations,
        table.hasInput
      );

      if (nextCode === 'X') {
        indeterminateSet.add(u);
        transList.push({ input: inVal, nextCode: 'X', nextIsValid: false });
      } else {
        const nextIsValid = validSet.has(nextCode);
        transList.push({ input: inVal, nextCode, nextIsValid });
      }
    }
    stateTransitions.set(u, transList);
  }

  // 2. Lockout Pruning Algorithm
  const remainingSet = new Set<number>();
  for (const u of unusedList) {
    if (!indeterminateSet.has(u)) {
      remainingSet.add(u);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const u of Array.from(remainingSet)) {
      const transitions = stateTransitions.get(u) ?? [];
      const hasEdgeInR = transitions.some(
        (t) => typeof t.nextCode === 'number' && remainingSet.has(t.nextCode)
      );

      if (!hasEdgeInR) {
        remainingSet.delete(u);
        changed = true;
      }
    }
  }

  const lockedStates = Array.from(remainingSet).sort((a, b) => a - b);
  const lockedSet = new Set(lockedStates);
  const indeterminateStates = Array.from(indeterminateSet).sort((a, b) => a - b);

  // 3. Find trapped cycles (SCCs within lockedStates)
  const lockedAdj = new Map<number, number[]>();
  for (const u of lockedStates) {
    const trans = stateTransitions.get(u) ?? [];
    const targets = trans
      .map((t) => t.nextCode)
      .filter((tgt): tgt is number => typeof tgt === 'number' && lockedSet.has(tgt));
    lockedAdj.set(u, targets);
  }

  const sccs = findSCCs(lockedStates, lockedAdj);
  const cycles: number[][] = [];

  for (const scc of sccs) {
    if (scc.length > 1) {
      cycles.push(scc);
    } else if (scc.length === 1) {
      const single = scc[0];
      if (single !== undefined) {
        const neighbors = lockedAdj.get(single) ?? [];
        if (neighbors.includes(single)) {
          cycles.push(scc);
        }
      }
    }
  }

  cycles.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));

  // 4. Shortest path BFS for returning states and example paths
  const unusedAnalysis: UnusedStateAnalysis[] = [];
  const messages: { code: number; text: string }[] = [];
  let maxSteps: number | null = 0;

  for (const u of unusedList) {
    const transitions = stateTransitions.get(u) ?? [];
    const binStr = formatCode(u, n);

    if (indeterminateSet.has(u)) {
      unusedAnalysis.push({
        code: u,
        binaryCode: binStr,
        transitions,
        status: 'indeterminate',
        stepsToValid: null,
        examplePath: [u],
      });
      messages.push({
        code: u,
        text: `Unused state ${binStr} (${u}) produces indeterminate flip-flop excitation (X).`,
      });
    } else if (lockedSet.has(u)) {
      const examplePath = [u];
      let curr = u;
      const seen = new Set<number>([u]);
      for (let step = 0; step < 1 << n; step++) {
        const trans = stateTransitions.get(curr) ?? [];
        const nextInLocked = trans.find(
          (t) => typeof t.nextCode === 'number' && lockedSet.has(t.nextCode)
        );
        if (nextInLocked && typeof nextInLocked.nextCode === 'number') {
          examplePath.push(nextInLocked.nextCode);
          if (seen.has(nextInLocked.nextCode)) break;
          seen.add(nextInLocked.nextCode);
          curr = nextInLocked.nextCode;
        } else {
          break;
        }
      }

      unusedAnalysis.push({
        code: u,
        binaryCode: binStr,
        transitions,
        status: 'locked',
        stepsToValid: null,
        examplePath,
      });
      messages.push({
        code: u,
        text: `Unused state ${binStr} (${u}) is trapped in lockout and cannot return to valid states under all inputs.`,
      });
    } else {
      const queue: { current: number; path: number[] }[] = [{ current: u, path: [u] }];
      const visited = new Set<number>([u]);
      let returnPath: number[] = [u];
      let steps: number | null = null;

      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const trans = stateTransitions.get(item.current) ?? [];
        let reachedValid = false;

        for (const t of trans) {
          if (typeof t.nextCode === 'number') {
            const nextP = [...item.path, t.nextCode];
            if (validSet.has(t.nextCode)) {
              returnPath = nextP;
              steps = nextP.length - 1;
              reachedValid = true;
              break;
            }
            if (!visited.has(t.nextCode)) {
              visited.add(t.nextCode);
              queue.push({ current: t.nextCode, path: nextP });
            }
          }
        }

        if (reachedValid) break;
      }

      unusedAnalysis.push({
        code: u,
        binaryCode: binStr,
        transitions,
        status: 'returns',
        stepsToValid: steps,
        examplePath: returnPath,
      });

      const targetValid = returnPath[returnPath.length - 1] ?? 0;
      messages.push({
        code: u,
        text: `Unused state ${binStr} (${u}) self-corrects to valid state ${formatCode(targetValid, n)} in ${steps ?? 1} step(s).`,
      });

      if (steps !== null && maxSteps !== null) {
        maxSteps = Math.max(maxSteps, steps);
      }
    }
  }

  const isSelfCorrecting =
    lockedStates.length === 0 && indeterminateStates.length === 0;

  return {
    unusedStates: unusedAnalysis,
    lockedStates,
    indeterminateStates,
    cycles,
    isSelfCorrecting,
    maxStepsToValid: isSelfCorrecting ? maxSteps : null,
    messages,
  };
}
