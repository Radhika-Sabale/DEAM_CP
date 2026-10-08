/**
 * @file verifyStepExcitation.ts
 * Verifier for flip-flop excitation tables (Stage 10C).
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalExcitationTable,
  ExcitationTable,
} from '../../types/sequential';
import type {
  StepItemResult,
  StepVerificationResult,
  StepVerificationSummary,
} from './verifyStepTypes';

interface NormalizedExcitationRow {
  readonly rowIndex: number;
  readonly code: number;
  readonly inputStr: string;
  readonly inputs: Record<string, LogicValue>;
}

function extractInputsFromRow(row: Record<string, unknown>): Record<string, LogicValue> {
  const inputs: Record<string, LogicValue> = {};

  if (row.flipFlopInputs && typeof row.flipFlopInputs === 'object') {
    for (const [k, v] of Object.entries(row.flipFlopInputs as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        for (const [pin, val] of Object.entries(v as Record<string, unknown>)) {
          const bitNum = k.replace(/\D/g, '');
          const inputName = /\d$/.test(pin) ? pin : `${pin}${bitNum}`;
          inputs[inputName] = (val as LogicValue) ?? 'X';
        }
      } else {
        inputs[k] = (v as LogicValue) ?? 'X';
      }
    }
  }

  if (row.inputs && typeof row.inputs === 'object') {
    for (const [k, v] of Object.entries(row.inputs as Record<string, unknown>)) {
      inputs[k] = (v as LogicValue) ?? 'X';
    }
  }

  return inputs;
}

function normalizeExcitationRows(table: ExcitationTable | CanonicalExcitationTable): NormalizedExcitationRow[] {
  const result: NormalizedExcitationRow[] = [];

  for (let i = 0; i < table.rows.length; i++) {
    const raw = table.rows[i] as unknown;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;

    if (r.valid === false) continue; // Ignore unused rows

    const code = typeof r.code === 'number'
      ? r.code
      : (typeof r.presentState === 'string' ? parseInt(r.presentState.replace(/\D/g, ''), 2) || 0 : i);

    const inputStr = r.inputValue !== undefined
      ? String(r.inputValue)
      : (r.input !== undefined ? String(r.input) : '');

    const rowIndex = typeof r.rowIndex === 'number' ? r.rowIndex : i;
    const inputs = extractInputsFromRow(r);

    result.push({
      rowIndex,
      code,
      inputStr,
      inputs,
    });
  }

  return result;
}

/**
 * Verifies excitation table cell submissions.
 * Distinguishes concrete values on don't-care cells ("dont-care-ok") from don't-cares on care cells ("incorrect").
 */
export function verifyExcitationTable(
  student: ExcitationTable | CanonicalExcitationTable,
  reference: CanonicalExcitationTable | ExcitationTable
): StepVerificationResult {
  const refRows = normalizeExcitationRows(reference);
  const stuRows = normalizeExcitationRows(student);

  const stuRowMap = new Map<number, NormalizedExcitationRow>();
  for (const s of stuRows) {
    stuRowMap.set(s.rowIndex, s);
  }

  const items: StepItemResult[] = [];
  let correctCount = 0;

  for (const ref of refRows) {
    const stu = stuRowMap.get(ref.rowIndex);

    for (const [inputName, expectedVal] of Object.entries(ref.inputs)) {
      const cellId = `row-${ref.rowIndex}-input-${inputName}`;

      if (!stu || stu.inputs[inputName] === undefined) {
        items.push({
          id: cellId,
          status: 'missing',
          expected: expectedVal,
          message: `Missing flip-flop excitation value for ${inputName} on row ${ref.rowIndex}`,
        });
        continue;
      }

      const gotVal = stu.inputs[inputName];
      if (expectedVal === 'X') {
        if (gotVal === 'X' || gotVal === 0 || gotVal === 1) {
          correctCount++;
          items.push({
            id: cellId,
            status: gotVal === 'X' ? 'correct' : 'dont-care-ok',
            expected: expectedVal,
            got: gotVal,
            message: gotVal !== 'X' ? `Concrete value ${gotVal} matches don't-care condition` : undefined,
          });
        } else {
          items.push({
            id: cellId,
            status: 'incorrect',
            expected: expectedVal,
            got: gotVal,
            message: `Invalid logic value ${gotVal}`,
          });
        }
      } else {
        if (gotVal === expectedVal) {
          correctCount++;
          items.push({ id: cellId, status: 'correct', expected: expectedVal, got: gotVal });
        } else {
          items.push({
            id: cellId,
            status: 'incorrect',
            expected: expectedVal,
            got: gotVal,
            message: gotVal === 'X'
              ? `Specified don't-care 'X' on required care value ${expectedVal}`
              : `Expected ${expectedVal} but received ${gotVal}`,
          });
        }
      }
    }
  }

  const total = items.length;
  const summary: StepVerificationSummary = {
    allCorrect: total > 0 && correctCount === total,
    correctCount,
    total,
  };

  return { items, summary };
}
