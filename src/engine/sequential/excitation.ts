/**
 * @file excitation.ts
 * Multi-flip-flop excitation table synthesizer and K-Map function column extraction (Stage 10A).
 * Bridges state transitions to Stage 9A excitation rules and generates columns for Stage 10B K-map minimization.
 *
 * ============================================================================
 * ARCHITECTURAL INTEGRATION WITH STAGE 9A & STAGE 10B:
 * 1. Flip-Flop Excitation Rules:
 *    All flip-flop input requirements are computed strictly by calling the Stage 9A
 *    `excitationInputs(type, q, qNext)` function.
 *
 * 2. Downstream K-Map Integration (Stage 10B):
 *    The `functionColumns()` generator produces isolated, self-contained column vectors
 *    of LogicValue ('0', '1', or 'X') indexed in standard binary minterm order.
 *    Stage 10B will feed these columns directly into the K-map prime implicant solver,
 *    treating 'X' entries as don't-cares to derive minimal SOP/POS excitation equations.
 *
 * 3. Column Ordering Guarantee:
 *    Columns are arranged in deterministic order:
 *    - Flip-flop inputs from MSB flip-flop down to LSB flip-flop:
 *      * SR: [S{n-1}, R{n-1}, ..., S0, R0]
 *      * JK: [J{n-1}, K{n-1}, ..., J0, K0]
 *      * D:  [D{n-1}, ..., D0]
 *      * T:  [T{n-1}, ..., T0]
 *    - Followed by the external output column "Z" if present.
 * ============================================================================
 */

import type { LogicValue } from '../../types/ast';
import type {
  BitExcitationRecord,
  CanonicalExcitationTable,
  CanonicalExcitationTableRow,
  CanonicalStateTable,
  FlipFlopType,
  FunctionColumn,
} from '../../types/sequential';
import { excitationInputs } from '../flipflop/tables';
import {
  codeToBits,
  flipFlopInputNames,
  functionVariables,
  OUTPUT_VARIABLE_NAME,
  stateVariableNames,
} from './encoding';

/**
 * Derives the complete multi-flip-flop excitation table from a canonical state table.
 * Computes required flip-flop input values for every state bit across all 2^n (or 2^(n+1)) rows.
 *
 * @param table Canonical state transition table
 * @param flipFlop Selected flip-flop architecture ('SR', 'JK', 'D', 'T')
 * @returns Fully populated CanonicalExcitationTable
 */
export function buildExcitationTable(
  table: CanonicalStateTable,
  flipFlop: FlipFlopType
): CanonicalExcitationTable {
  const n = table.stateBits;
  const rows: CanonicalExcitationTableRow[] = [];

  for (const row of table.rows) {
    const presentBits = codeToBits(row.code, n);
    const inVal = table.hasInput ? (row.inputValue as 0 | 1) : undefined;

    if (row.valid && typeof row.nextCode === 'number') {
      const nextBits = codeToBits(row.nextCode, n);
      const transitions: BitExcitationRecord[] = [];
      const combinedInputs: Record<string, LogicValue> = {};

      for (let bit = 0; bit < n; bit++) {
        // bitIndex: 0 is LSB, n-1 is MSB.
        // In MSB-first array `presentBits`: index (n - 1 - bit) corresponds to bitIndex `bit`.
        const arrIdx = n - 1 - bit;
        const q = presentBits[arrIdx] ?? 0;
        const qNext = nextBits[arrIdx] ?? 0;

        // Authoritative Stage 9A excitation inputs lookup
        const bitInputs = excitationInputs(flipFlop, q, qNext);
        const pinNames = flipFlopInputNames(flipFlop, bit);

        // Map generic pin names (e.g. "J", "K") to subscripted names (e.g. "J1", "K1")
        const mappedBitInputs: Record<string, LogicValue> = {};
        if (flipFlop === 'SR') {
          mappedBitInputs[pinNames[0] ?? `S${bit}`] = bitInputs['S'] ?? 'X';
          mappedBitInputs[pinNames[1] ?? `R${bit}`] = bitInputs['R'] ?? 'X';
        } else if (flipFlop === 'JK') {
          mappedBitInputs[pinNames[0] ?? `J${bit}`] = bitInputs['J'] ?? 'X';
          mappedBitInputs[pinNames[1] ?? `K${bit}`] = bitInputs['K'] ?? 'X';
        } else if (flipFlop === 'D') {
          mappedBitInputs[pinNames[0] ?? `D${bit}`] = bitInputs['D'] ?? 'X';
        } else if (flipFlop === 'T') {
          mappedBitInputs[pinNames[0] ?? `T${bit}`] = bitInputs['T'] ?? 'X';
        }

        Object.assign(combinedInputs, mappedBitInputs);

        transitions.push({
          bitIndex: bit,
          q,
          qNext,
          inputs: mappedBitInputs,
        });
      }

      rows.push({
        rowIndex: row.index,
        code: row.code,
        presentBits,
        inputValue: inVal,
        valid: true,
        nextCode: row.nextCode,
        nextBits,
        transitions,
        flipFlopInputs: combinedInputs,
      });
    } else {
      // Unused state row: next bits and all flip-flop excitation inputs are 'X'
      const nextBits: LogicValue[] = new Array(n).fill('X');
      const transitions: BitExcitationRecord[] = [];
      const combinedInputs: Record<string, LogicValue> = {};

      for (let bit = 0; bit < n; bit++) {
        const arrIdx = n - 1 - bit;
        const q = presentBits[arrIdx] ?? 0;
        const pinNames = flipFlopInputNames(flipFlop, bit);

        const mappedBitInputs: Record<string, LogicValue> = {};
        for (const pin of pinNames) {
          mappedBitInputs[pin] = 'X';
        }
        Object.assign(combinedInputs, mappedBitInputs);

        transitions.push({
          bitIndex: bit,
          q,
          qNext: 'X',
          inputs: mappedBitInputs,
        });
      }

      rows.push({
        rowIndex: row.index,
        code: row.code,
        presentBits,
        inputValue: inVal,
        valid: false,
        nextCode: 'X',
        nextBits,
        transitions,
        flipFlopInputs: combinedInputs,
      });
    }
  }

  const resultTable: CanonicalExcitationTable = {
    stateBits: n,
    flipFlop,
    hasInput: table.hasInput,
    rows,
    functionColumns: [],
  };

  const cols = functionColumns(resultTable, table);
  return {
    ...resultTable,
    functionColumns: cols,
  };
}

/**
 * Extracts discrete truth-table function columns for each flip-flop input and machine output.
 * Output columns are sorted deterministically from MSB flip-flop down to LSB flip-flop,
 * followed by the external output "Z".
 *
 * @param excitationTable Populated excitation table
 * @param stateTable Parent canonical state table
 * @returns Array of FunctionColumn objects ready for K-map minimization
 */
export function functionColumns(
  excitationTable: CanonicalExcitationTable,
  stateTable: CanonicalStateTable
): readonly FunctionColumn[] {
  const n = excitationTable.stateBits;
  const flipFlop = excitationTable.flipFlop;
  const hasInput = stateTable.hasInput;
  const inputKind = stateTable.inputKind;

  const fnVars = functionVariables(n, hasInput, inputKind);
  const columns: FunctionColumn[] = [];

  // 1. Flip-flop excitation input columns: from MSB bit (n-1) down to bit 0
  for (let bit = n - 1; bit >= 0; bit--) {
    const pinNames = flipFlopInputNames(flipFlop, bit);

    for (const pin of pinNames) {
      const colValues: LogicValue[] = [];
      for (const row of excitationTable.rows) {
        const val = row.flipFlopInputs[pin] ?? 'X';
        colValues.push(val);
      }

      columns.push({
        name: pin,
        variables: fnVars,
        column: colValues,
      });
    }
  }

  // 2. Machine Output Column "Z" (for detector machines)
  if (stateTable.machineKind === 'mealy') {
    // Mealy output depends on stateBits + external input
    const colValues: LogicValue[] = [];
    for (const row of stateTable.rows) {
      colValues.push(row.mealyOutput);
    }

    columns.push({
      name: OUTPUT_VARIABLE_NAME,
      variables: fnVars,
      column: colValues,
    });
  } else if (stateTable.machineKind === 'moore') {
    // Moore output depends ONLY on present state bits (length 2^n)
    const stateVars = stateVariableNames(n);
    const totalStates = 1 << n;
    const colValues: LogicValue[] = [];

    for (let code = 0; code < totalStates; code++) {
      // Find row for this state code
      const sampleRow = stateTable.rows.find((r) => r.code === code);
      colValues.push(sampleRow ? sampleRow.mooreOutput : 'X');
    }

    columns.push({
      name: OUTPUT_VARIABLE_NAME,
      variables: stateVars,
      column: colValues,
    });
  }

  return columns;
}
