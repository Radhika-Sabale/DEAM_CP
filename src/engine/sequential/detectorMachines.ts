/**
 * @file detectorMachines.ts
 * Automated synthesizer for Mealy and Moore binary sequence detectors (Stage 10A).
 * Constructs minimal prefix-tracking state transition graphs for overlapping and non-overlapping patterns.
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalStateTable,
  DetectorSpec,
  StateDiagramData,
} from '../../types/sequential';
import { formatCode, rowIndex } from './encoding';
import {
  type NormalizedDetectorSpec,
  type SpecValidationError,
  validateSpec,
} from './specs';
import { diagramFromTable } from './stateDiagram';
import { createCanonicalStateTable } from './stateTable';

/** Result object returned by the sequence detector synthesizer. */
export interface BuiltDetectorMachine {
  readonly spec: NormalizedDetectorSpec;
  readonly table: CanonicalStateTable;
  readonly diagram: StateDiagramData;
  readonly stateNames: Record<number, string>;
  readonly stateDescriptions: Record<number, string>;
  readonly info: {
    readonly stateBits: number;
    readonly stateCount: number;
    readonly hasInput: boolean;
  };
}

/** Discriminated result of detectorMachine. */
export type DetectorMachineResult =
  | { readonly ok: true; readonly machine: BuiltDetectorMachine }
  | { readonly ok: false; readonly errors: readonly SpecValidationError[] };

/**
 * Returns a human-readable educational description of a sequence detector state.
 *
 * @param prefixLength Number of pattern characters matched so far (0..L)
 * @param pattern Target binary pattern string
 * @returns Human-friendly description (e.g. "Seen prefix '10'")
 */
export function describeState(prefixLength: number, pattern: string): string {
  if (prefixLength === 0) {
    return 'Initial state (no prefix matched)';
  }
  const prefix = pattern.slice(0, prefixLength);
  if (prefixLength === pattern.length) {
    return `Full pattern '${pattern}' recognized`;
  }
  return `Matched prefix '${prefix}'`;
}

/**
 * Finds the length of the longest prefix of pattern P that is a suffix of candidate string S.
 *
 * @param S Current accumulated history string
 * @param P Target pattern string
 * @param properOnly If true, restricts match to proper prefixes strictly shorter than P
 * @returns Length of longest matching prefix (0..P.length)
 */
export function findLongestPrefixSuffix(
  S: string,
  P: string,
  properOnly = false
): number {
  const maxLen = properOnly ? Math.min(S.length, P.length - 1) : Math.min(S.length, P.length);
  for (let len = maxLen; len >= 1; len--) {
    const targetPrefix = P.slice(0, len);
    const candidateSuffix = S.slice(S.length - len);
    if (targetPrefix === candidateSuffix) {
      return len;
    }
  }
  return 0;
}

/**
 * Synthesizes a binary sequence detector machine from a specification.
 * Supports Mealy and Moore machine architectures, with overlapping and non-overlapping detection.
 *
 * @param spec Detector specification (validated internally)
 * @returns Discriminated result with canonical table, state diagram, and prefix descriptions
 */
export function detectorMachine(spec: DetectorSpec): DetectorMachineResult {
  const validation = validateSpec(spec);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  if (validation.spec.kind !== 'detector') {
    return {
      ok: false,
      errors: [
        {
          code: 'bad-kind',
          field: 'kind',
          message: "Expected detector specification with kind: 'detector'",
        },
      ],
    };
  }

  const normSpec = validation.spec;
  const { pattern, machine, overlapping } = normSpec;
  const L = pattern.length;
  const { stateBits, stateCount } = validation.info;

  const validCodes: number[] = [];
  const stateNames: Record<number, string> = {};
  const stateDescriptions: Record<number, string> = {};

  for (let s = 0; s < stateCount; s++) {
    validCodes.push(s);
    stateNames[s] = `S${s} (${formatCode(s, stateBits)})`;
    stateDescriptions[s] = describeState(s, pattern);
  }

  const transitions = new Map<
    number,
    {
      readonly nextCode: number;
      readonly mealyOutput: LogicValue;
      readonly mooreOutput: LogicValue;
    }
  >();

  if (machine === 'mealy') {
    // Mealy: L states (S0..S_{L-1})
    for (let k = 0; k < L; k++) {
      const currentPrefix = pattern.slice(0, k);

      for (const inBit of [0, 1] as const) {
        const nextCandidate = currentPrefix + String(inBit);
        const idx = rowIndex(k, inBit, true);

        if (nextCandidate === pattern) {
          // Pattern complete! Mealy output is 1
          let nextStateCode = 0;
          if (overlapping) {
            nextStateCode = findLongestPrefixSuffix(nextCandidate, pattern, true);
          } else {
            nextStateCode = 0;
          }
          transitions.set(idx, {
            nextCode: nextStateCode,
            mealyOutput: 1,
            mooreOutput: 0,
          });
        } else {
          // Incomplete match: Mealy output is 0
          const nextStateCode = findLongestPrefixSuffix(nextCandidate, pattern, false);
          transitions.set(idx, {
            nextCode: nextStateCode,
            mealyOutput: 0,
            mooreOutput: 0,
          });
        }
      }
    }
  } else {
    // Moore: L + 1 states (S0..S_L)
    // S0..S_{L-1} have Moore output 0; S_L has Moore output 1
    for (let k = 0; k <= L; k++) {
      const isMatchState = k === L;
      const mooreOutput: LogicValue = isMatchState ? 1 : 0;

      for (const inBit of [0, 1] as const) {
        const idx = rowIndex(k, inBit, true);

        if (k < L) {
          const currentPrefix = pattern.slice(0, k);
          const nextCandidate = currentPrefix + String(inBit);
          const nextStateCode = findLongestPrefixSuffix(nextCandidate, pattern, false);

          transitions.set(idx, {
            nextCode: nextStateCode,
            mealyOutput: 0,
            mooreOutput,
          });
        } else {
          // From match state S_L (where k === L)
          if (overlapping) {
            const nextCandidate = pattern + String(inBit);
            const nextStateCode = findLongestPrefixSuffix(nextCandidate, pattern, false);
            transitions.set(idx, {
              nextCode: nextStateCode,
              mealyOutput: 0,
              mooreOutput,
            });
          } else {
            // Non-overlapping: restart matching on next candidate = String(inBit)
            const nextStateCode = String(inBit) === pattern[0] ? 1 : 0;
            transitions.set(idx, {
              nextCode: nextStateCode,
              mealyOutput: 0,
              mooreOutput,
            });
          }
        }
      }
    }
  }

  const table = createCanonicalStateTable(
    stateBits,
    validCodes,
    0,
    true,
    'detector',
    machine,
    transitions,
    stateNames
  );

  const diagram = diagramFromTable(table, stateNames);

  return {
    ok: true,
    machine: {
      spec: normSpec,
      table,
      diagram,
      stateNames,
      stateDescriptions,
      info: {
        stateBits,
        stateCount,
        hasInput: true,
      },
    },
  };
}
