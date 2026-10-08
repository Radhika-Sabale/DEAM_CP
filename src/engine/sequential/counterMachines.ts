/**
 * @file counterMachines.ts
 * Automated machine builders for synchronous and custom sequence counters (Stage 10A).
 * Generates canonical transition tables, state diagram graphs, and state metadata.
 */

import type {
  CanonicalStateTable,
  CounterSpec,
  StateDiagramData,
} from '../../types/sequential';
import { formatCode, rowIndex } from './encoding';
import {
  type NormalizedCounterSpec,
  type SpecValidationError,
  validateSpec,
} from './specs';
import { diagramFromTable } from './stateDiagram';
import { createCanonicalStateTable } from './stateTable';

/** Result object returned by the counter machine synthesizer. */
export interface BuiltCounterMachine {
  readonly spec: NormalizedCounterSpec;
  readonly table: CanonicalStateTable;
  readonly diagram: StateDiagramData;
  readonly stateNames: Record<number, string>;
  readonly info: {
    readonly stateBits: number;
    readonly stateCount: number;
    readonly hasInput: boolean;
  };
}

/** Discriminated result of counterMachine. */
export type CounterMachineResult =
  | { readonly ok: true; readonly machine: BuiltCounterMachine }
  | { readonly ok: false; readonly errors: readonly SpecValidationError[] };

/**
 * Synthesizes a complete counter finite state machine model from a specification.
 * Supports up, down, up-down, and arbitrary custom sequence counters.
 *
 * @param spec Counter specification (validated internally)
 * @returns Discriminated result with machine tables, diagrams, and metadata
 */
export function counterMachine(spec: CounterSpec): CounterMachineResult {
  const validation = validateSpec(spec);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  if (validation.spec.kind !== 'counter') {
    return {
      ok: false,
      errors: [
        {
          code: 'bad-kind',
          field: 'kind',
          message: "Expected counter specification with kind: 'counter'",
        },
      ],
    };
  }

  const normSpec = validation.spec;
  const { stateBits, stateCount, hasInput } = validation.info;

  const validCodes: number[] = [];
  const stateNames: Record<number, string> = {};
  const transitions = new Map<number, { readonly nextCode: number }>();

  if (normSpec.direction === 'custom' && normSpec.sequence) {
    const seq = normSpec.sequence;
    const len = seq.length;

    for (let i = 0; i < len; i++) {
      const code = seq[i];
      const nextCode = seq[(i + 1) % len];
      if (code === undefined || nextCode === undefined) continue;

      validCodes.push(code);
      stateNames[code] = `S${i} (${formatCode(code, stateBits)})`;

      const idx = rowIndex(code, 0, false);
      transitions.set(idx, { nextCode });
    }
  } else {
    // Standard up, down, or up-down counter
    const N = normSpec.modulus;
    for (let c = 0; c < N; c++) {
      validCodes.push(c);
      stateNames[c] = `S${c} (${formatCode(c, stateBits)})`;

      if (normSpec.direction === 'up') {
        const nextCode = (c + 1) % N;
        const idx = rowIndex(c, 0, false);
        transitions.set(idx, { nextCode });
      } else if (normSpec.direction === 'down') {
        const nextCode = (c - 1 + N) % N;
        const idx = rowIndex(c, 0, false);
        transitions.set(idx, { nextCode });
      } else if (normSpec.direction === 'up-down') {
        // DN = 0 (Count Up)
        const nextUp = (c + 1) % N;
        const idxUp = rowIndex(c, 0, true);
        transitions.set(idxUp, { nextCode: nextUp });

        // DN = 1 (Count Down)
        const nextDown = (c - 1 + N) % N;
        const idxDown = rowIndex(c, 1, true);
        transitions.set(idxDown, { nextCode: nextDown });
      }
    }
  }

  const initialCode = validCodes[0] ?? 0;
  const inputKind = hasInput ? 'counter-up-down' : 'none';

  const table = createCanonicalStateTable(
    stateBits,
    validCodes,
    initialCode,
    hasInput,
    inputKind,
    'counter',
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
      info: {
        stateBits,
        stateCount,
        hasInput,
      },
    },
  };
}
