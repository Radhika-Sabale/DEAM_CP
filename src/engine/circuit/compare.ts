/**
 * @file compare.ts
 * Truth table and logic column comparison engine with diagnostic heuristic analysis.
 *
 * Implements:
 * - 3-valued truth table comparison with 'X' don't-care and unknown logic distinction.
 * - Named variable re-mapping across disparate column orders.
 * - Failure heuristic pattern diagnosis (inverted output, swapped inputs, stuck-at, unknown values).
 */

import type { LogicValue } from '../../types/ast';
import type { ExtractedTruthTable } from '../../types/circuit';

/**
 * Diagnostic heuristic failure classification.
 */
export interface LikelyCause {
  readonly type: 'inverted-output' | 'swapped-inputs' | 'stuck-at-0' | 'stuck-at-1' | 'unknown-values';
  readonly message: string;
  readonly swappedLabels?: readonly [string, string];
}

/**
 * Detailed per-row comparison verification record.
 */
export interface ComparisonRow {
  readonly index: number;
  readonly inputs: readonly LogicValue[];
  readonly intended: LogicValue;
  readonly actual: LogicValue;
  readonly status: 'match' | 'mismatch' | 'dont-care' | 'unknown';
}

/**
 * Result of comparing two truth table logic columns.
 */
export interface ColumnComparisonResult {
  readonly status: 'match' | 'mismatch';
  readonly rows: readonly ComparisonRow[];
  readonly mismatchCount: number;
  readonly likelyCauses: readonly LikelyCause[];
}

/**
 * Result of comparing an extracted circuit against an intended function specification.
 */
export type CircuitComparisonResult =
  | (ColumnComparisonResult & { readonly status: 'match' | 'mismatch' })
  | {
      readonly status: 'incomparable';
      readonly message: string;
      readonly missingVariables: readonly string[];
      readonly extraVariables: readonly string[];
    };

/**
 * Compares an intended logic column against an actual evaluated column.
 *
 * @param intended Target function values ('X' indicates don't-care)
 * @param actual Simulated/extracted circuit values ('X' indicates unknown)
 * @param inputLabels Optional variable names for input reconstruction and swap detection
 * @returns ColumnComparisonResult with mismatch tally and diagnostic causes
 */
export function compareColumns(
  intended: readonly LogicValue[],
  actual: readonly LogicValue[],
  inputLabels?: readonly string[]
): ColumnComparisonResult {
  const numRows = intended.length;
  const numInputs = Math.round(Math.log2(Math.max(1, numRows)));
  const rows: ComparisonRow[] = [];
  let mismatchCount = 0;

  for (let i = 0; i < numRows; i++) {
    const intVal = intended[i] ?? 'X';
    const actVal = actual[i] ?? 'X';

    const rowInputs: LogicValue[] = [];
    for (let bitIdx = 0; bitIdx < numInputs; bitIdx++) {
      const shift = numInputs - 1 - bitIdx;
      rowInputs.push(((i >> shift) & 1) as LogicValue);
    }

    let status: 'match' | 'mismatch' | 'dont-care' | 'unknown';
    if (intVal === 'X') {
      status = 'dont-care';
    } else if (actVal === 'X') {
      status = 'unknown';
      mismatchCount++;
    } else if (intVal === actVal) {
      status = 'match';
    } else {
      status = 'mismatch';
      mismatchCount++;
    }

    rows.push({
      index: i,
      inputs: rowInputs,
      intended: intVal,
      actual: actVal,
      status,
    });
  }

  const likelyCauses = mismatchCount > 0 ? diagnoseLikelyCauses(intended, actual, inputLabels) : [];

  return {
    status: mismatchCount === 0 ? 'match' : 'mismatch',
    rows,
    mismatchCount,
    likelyCauses,
  };
}

/**
 * Evaluates failure heuristics against mismatched truth table columns.
 */
function diagnoseLikelyCauses(
  intended: readonly LogicValue[],
  actual: readonly LogicValue[],
  inputLabels?: readonly string[]
): LikelyCause[] {
  const causes: LikelyCause[] = [];
  const numRows = intended.length;
  const careIndices: number[] = [];

  for (let i = 0; i < numRows; i++) {
    if (intended[i] !== 'X') {
      careIndices.push(i);
    }
  }

  if (careIndices.length === 0) return causes;

  // 1. Unknown / floating values
  const hasUnknowns = careIndices.some((idx) => actual[idx] === 'X');
  if (hasUnknowns) {
    causes.push({
      type: 'unknown-values',
      message: 'The circuit produces unknown (X) logic levels. Check for disconnected or floating gate input pins.',
    });
  }

  // 2. Inverted output
  let invertedMatch = true;
  for (const idx of careIndices) {
    const expected = intended[idx] === 1 ? 0 : 1;
    if (actual[idx] !== expected) {
      invertedMatch = false;
      break;
    }
  }
  if (invertedMatch) {
    causes.push({
      type: 'inverted-output',
      message: 'The circuit output is completely inverted across all care rows. Check for a missing or extra NOT gate or inverted gate type.',
    });
  }

  // 3. Stuck-at-0 and Stuck-at-1
  const allZero = careIndices.every((idx) => actual[idx] === 0);
  const allOne = careIndices.every((idx) => actual[idx] === 1);
  if (allZero && !intended.every((val) => val === 0)) {
    causes.push({
      type: 'stuck-at-0',
      message: 'The circuit output is stuck at constant 0 across all care conditions.',
    });
  }
  if (allOne && !intended.every((val) => val === 1)) {
    causes.push({
      type: 'stuck-at-1',
      message: 'The circuit output is stuck at constant 1 across all care conditions.',
    });
  }

  // 4. Swapped inputs
  const numInputs = Math.round(Math.log2(Math.max(1, numRows)));
  if (inputLabels && inputLabels.length === numInputs && numInputs >= 2 && numInputs <= 6) {
    for (let a = 0; a < numInputs - 1; a++) {
      for (let b = a + 1; b < numInputs; b++) {
        let swapMatches = true;
        for (const idx of careIndices) {
          const bitA = (idx >> (numInputs - 1 - a)) & 1;
          const bitB = (idx >> (numInputs - 1 - b)) & 1;
          if (bitA === bitB) {
            if (actual[idx] !== intended[idx]) {
              swapMatches = false;
              break;
            }
          } else {
            // Swap bitA and bitB in idx to find swappedRowIndex
            const swappedIdx = idx ^ ((1 << (numInputs - 1 - a)) | (1 << (numInputs - 1 - b)));
            if (actual[swappedIdx] !== intended[idx]) {
              swapMatches = false;
              break;
            }
          }
        }
        if (swapMatches) {
          const labelA = inputLabels[a] ?? `IN${a}`;
          const labelB = inputLabels[b] ?? `IN${b}`;
          causes.push({
            type: 'swapped-inputs',
            message: `Inputs '${labelA}' and '${labelB}' appear to be swapped. Swapping their connections satisfies the truth table.`,
            swappedLabels: [labelA, labelB],
          });
        }
      }
    }
  }

  return causes;
}

/**
 * Compares an extracted circuit truth table to an intended Boolean specification by variable name.
 *
 * @param extracted Extracted circuit truth table
 * @param outputName Target circuit output port label
 * @param intended Target function variable names and expected column
 * @returns CircuitComparisonResult
 */
export function compareCircuitToIntended(
  extracted: ExtractedTruthTable,
  outputName: string,
  intended: { readonly variables: readonly string[]; readonly column: readonly LogicValue[] }
): CircuitComparisonResult {
  const extractedInputsSet = new Set(extracted.inputs);
  const intendedInputsSet = new Set(intended.variables);

  const missingVariables = intended.variables.filter((v) => !extractedInputsSet.has(v));
  const extraVariables = extracted.inputs.filter((v) => !intendedInputsSet.has(v));

  if (missingVariables.length > 0 || extraVariables.length > 0) {
    return {
      status: 'incomparable',
      message: `Circuit variable set does not match intended function. Missing: [${missingVariables.join(', ')}], Extra: [${extraVariables.join(', ')}].`,
      missingVariables,
      extraVariables,
    };
  }

  const outIndex = extracted.outputs.indexOf(outputName);
  if (outIndex === -1) {
    return {
      status: 'incomparable',
      message: `Circuit does not contain output terminal named '${outputName}'.`,
      missingVariables: [],
      extraVariables: [],
    };
  }

  // Remap extracted table rows to match intended variable order
  const numVars = intended.variables.length;
  const numRows = 1 << numVars;
  const remappedActual: LogicValue[] = new Array(numRows);

  const extPosInIntended = extracted.inputs.map((eVar) => intended.variables.indexOf(eVar));

  for (const extRow of extracted.rows) {
    let intendedRowIndex = 0;
    for (let eIdx = 0; eIdx < extracted.inputs.length; eIdx++) {
      const bitVal = extRow.inputs[eIdx] === 1 ? 1 : 0;
      const intPos = extPosInIntended[eIdx] ?? 0;
      const shift = numVars - 1 - intPos;
      intendedRowIndex |= bitVal << shift;
    }
    remappedActual[intendedRowIndex] = extRow.outputs[outIndex] ?? 'X';
  }

  const colResult = compareColumns(intended.column, remappedActual, intended.variables);

  return {
    ...colResult,
  };
}
