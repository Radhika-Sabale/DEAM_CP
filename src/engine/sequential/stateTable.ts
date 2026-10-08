/**
 * @file stateTable.ts
 * Canonical sequential state transition table representation, lookup utilities,
 * reachability graphs, completeness validators, and discrete step simulators (Stage 10A).
 *
 * ============================================================================
 * TIMING CONVENTIONS:
 * 1. Mealy Outputs:
 *    Mealy outputs depend on BOTH the present state AND the current external input.
 *    Therefore, the Mealy output belongs to the exact clock cycle in which the input
 *    is applied (instantaneous with input during the active cycle).
 *
 * 2. Moore Outputs:
 *    Moore outputs depend SOLELY on the present state bits. The Moore output reflects
 *    the state reached as a result of previous clock transitions (evaluated upon entry
 *    to the present state, and constant throughout the entire cycle regardless of current input).
 * ============================================================================
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalStateTable,
  CanonicalStateTableRow,
  MachineKind,
} from '../../types/sequential';
import { formatCode, inputVariableNames, rowIndex } from './encoding';

/** Issue diagnostic returned by table completeness validation. */
export interface TableValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly code: 'missing-transition' | 'unreachable-state' | 'invalid-next-state';
  readonly message: string;
}

/** Single step record produced during a sequential table simulation trace. */
export interface TableRunStep {
  readonly stepIndex: number;
  readonly state: number;
  readonly stateName: string;
  readonly input: number;
  readonly nextState: number | 'X';
  readonly nextStateName: string;
  readonly mealyOutput: LogicValue;
  readonly mooreOutputOfPresentState: LogicValue;
}

/**
 * Creates a CanonicalStateTable from specified transitions, state counts, and metadata.
 * Populates all 2^n state codes, automatically marking non-valid codes as unused with 'X'.
 *
 * @param stateBits Number of state bits n (1..4)
 * @param validCodes Array of valid state codes in the design
 * @param initialStateCode Starting / reset state code
 * @param hasInput Whether the machine accepts an external input
 * @param inputKind Input variable type ('none', 'counter-up-down', 'detector')
 * @param machineKind FSM classification ('counter', 'mealy', 'moore')
 * @param transitions Transition map for valid states: key is `rowIndex(code, input, hasInput)`
 * @param stateNames Optional custom state names keyed by code
 * @returns Fully constructed CanonicalStateTable
 */
export function createCanonicalStateTable(
  stateBits: number,
  validCodes: readonly number[],
  initialStateCode: number,
  hasInput: boolean,
  inputKind: 'none' | 'counter-up-down' | 'detector',
  machineKind: MachineKind,
  transitions: ReadonlyMap<
    number,
    {
      readonly nextCode: number;
      readonly mealyOutput?: LogicValue;
      readonly mooreOutput?: LogicValue;
    }
  >,
  stateNames?: Readonly<Record<number, string>>
): CanonicalStateTable {
  const totalCodes = 1 << stateBits;
  const validSet = new Set(validCodes);
  const rows: CanonicalStateTableRow[] = [];

  const defaultNames: Record<number, string> = {};
  for (let c = 0; c < totalCodes; c++) {
    defaultNames[c] = stateNames?.[c] ?? `S${c} (${formatCode(c, stateBits)})`;
  }

  const inNames = inputVariableNames(inputKind);
  const inName = inNames[0];

  const inputsToIterate = hasInput ? ([0, 1] as const) : ([0] as const);

  for (let code = 0; code < totalCodes; code++) {
    const isValid = validSet.has(code);
    const sName = defaultNames[code] ?? `S${code}`;

    for (const inVal of inputsToIterate) {
      const idx = rowIndex(code, inVal, hasInput);

      if (isValid) {
        const trans = transitions.get(idx);
        const nextCode = trans ? trans.nextCode : code;
        const nextStateName = defaultNames[nextCode] ?? `S${nextCode}`;
        const mealyOutput: LogicValue = trans?.mealyOutput ?? 0;
        const mooreOutput: LogicValue = trans?.mooreOutput ?? 0;

        rows.push({
          index: idx,
          code,
          stateName: sName,
          inputValue: inVal,
          inputName: hasInput ? inName : undefined,
          valid: true,
          nextCode,
          nextStateName,
          mealyOutput,
          mooreOutput,
        });
      } else {
        // Unused state row
        rows.push({
          index: idx,
          code,
          stateName: sName,
          inputValue: inVal,
          inputName: hasInput ? inName : undefined,
          valid: false,
          nextCode: 'X',
          nextStateName: 'X (Unused)',
          mealyOutput: 'X',
          mooreOutput: 'X',
        });
      }
    }
  }

  const unusedCodes: number[] = [];
  for (let c = 0; c < totalCodes; c++) {
    if (!validSet.has(c)) {
      unusedCodes.push(c);
    }
  }

  return {
    stateBits,
    stateCount: validCodes.length,
    hasInput,
    inputKind,
    machineKind,
    initialStateCode,
    validCodes: [...validCodes],
    unusedCodes,
    stateNames: defaultNames,
    rows,
  };
}

/**
 * Looks up the row corresponding to a specific state code and external input value.
 *
 * @param table Canonical state transition table
 * @param code Integer state code
 * @param inputValue External input value (defaults to 0)
 * @returns Matching CanonicalStateTableRow, or undefined if index out of bounds
 */
export function tableRow(
  table: CanonicalStateTable,
  code: number,
  inputValue = 0
): CanonicalStateTableRow | undefined {
  const idx = rowIndex(code, inputValue, table.hasInput);
  return table.rows[idx];
}

/**
 * Returns all unused state integer codes in the table (codes where valid is false).
 *
 * @param table Canonical state table
 * @returns Array of unused codes
 */
export function unusedStates(table: CanonicalStateTable): readonly number[] {
  return table.unusedCodes;
}

/**
 * Returns all valid state integer codes in the table.
 *
 * @param table Canonical state table
 * @returns Array of valid codes
 */
export function validStates(table: CanonicalStateTable): readonly number[] {
  return table.validCodes;
}

/**
 * Returns the designated initial / reset state code of the machine.
 *
 * @param table Canonical state table
 * @returns Initial state code
 */
export function initialState(table: CanonicalStateTable): number {
  return table.initialStateCode;
}

/**
 * Performs a breadth-first search (BFS) starting from `startCode` across all valid transitions,
 * returning the set of all reachable state codes.
 *
 * @param table Canonical state table
 * @param startCode Origin state code
 * @returns Array of reachable state codes in discovery order
 */
export function reachableFrom(
  table: CanonicalStateTable,
  startCode: number
): readonly number[] {
  const visited = new Set<number>();
  const queue: number[] = [startCode];
  visited.add(startCode);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const inputs = table.hasInput ? ([0, 1] as const) : ([0] as const);
    for (const inVal of inputs) {
      const row = tableRow(table, current, inVal);
      if (row && row.valid && typeof row.nextCode === 'number') {
        if (!visited.has(row.nextCode)) {
          visited.add(row.nextCode);
          queue.push(row.nextCode);
        }
      }
    }
  }

  return Array.from(visited);
}

/**
 * Validates the completeness and structural consistency of a state table.
 * Checks for unreachable valid states and missing/invalid next-state targets.
 *
 * @param table Canonical state table
 * @returns Array of validation issues (errors and warnings)
 */
export function isComplete(table: CanonicalStateTable): readonly TableValidationIssue[] {
  const issues: TableValidationIssue[] = [];
  const validSet = new Set(table.validCodes);

  // 1. Check valid rows
  for (const row of table.rows) {
    if (row.valid) {
      if (row.nextCode === 'X' || typeof row.nextCode !== 'number') {
        issues.push({
          severity: 'error',
          code: 'missing-transition',
          message: `State ${row.stateName} has missing next state for input ${row.inputValue}.`,
        });
      } else if (!validSet.has(row.nextCode)) {
        issues.push({
          severity: 'warning',
          code: 'invalid-next-state',
          message: `State ${row.stateName} transitions to unused state code ${row.nextCode}.`,
        });
      }
    }
  }

  // 2. Reachability check from initial state
  const reachable = new Set(reachableFrom(table, table.initialStateCode));
  for (const validCode of table.validCodes) {
    if (!reachable.has(validCode)) {
      const sName = table.stateNames[validCode] ?? `S${validCode}`;
      issues.push({
        severity: 'warning',
        code: 'unreachable-state',
        message: `State ${sName} is not reachable from initial state ${table.stateNames[table.initialStateCode] ?? 'S0'}.`,
      });
    }
  }

  return issues;
}

/**
 * Runs a deterministic simulation trace over a sequence of input values.
 *
 * @param table Canonical state table
 * @param initialCode Starting state code
 * @param inputs Array of binary inputs (0 or 1). Ignored for machines without input.
 * @returns Sequence of simulation steps
 */
export function runTable(
  table: CanonicalStateTable,
  initialCode: number,
  inputs: readonly (0 | 1)[]
): readonly TableRunStep[] {
  const steps: TableRunStep[] = [];
  let currentState = initialCode;

  const count = table.hasInput ? inputs.length : Math.max(1, inputs.length);

  for (let i = 0; i < count; i++) {
    const inVal = table.hasInput ? (inputs[i] ?? 0) : 0;
    const row = tableRow(table, currentState, inVal);

    if (!row) {
      break;
    }

    const nextState = row.nextCode;
    const mooreOut = row.mooreOutput;
    const mealyOut = row.mealyOutput;

    steps.push({
      stepIndex: i,
      state: currentState,
      stateName: row.stateName,
      input: inVal,
      nextState,
      nextStateName: row.nextStateName,
      mealyOutput: mealyOut,
      mooreOutputOfPresentState: mooreOut,
    });

    if (nextState === 'X' || typeof nextState !== 'number') {
      break;
    }
    currentState = nextState;
  }

  return steps;
}
