/**
 * @file verifyStepTable.ts
 * Verifiers for state transition tables and state diagrams (Stage 10C).
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalStateTable,
  MachineKind,
  StateDiagramData,
  StateTable,
} from '../../types/sequential';
import { formatCode } from './encoding';
import { tableFromDiagram } from './stateDiagram';
import type {
  StepItemResult,
  StepVerificationResult,
  StepVerificationSummary,
} from './verifyStepTypes';

interface NormalizedTableRow {
  readonly key: string;
  readonly presentState: string;
  readonly input?: string;
  readonly nextState: string;
  readonly nextCodeNum?: number;
  readonly output?: LogicValue;
}

function parseOutputValue(val: unknown): LogicValue | undefined {
  if (val === 0 || val === '0') return 0;
  if (val === 1 || val === '1') return 1;
  if (val === 'X' || val === 'x') return 'X';
  return undefined;
}

function parseStateCode(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const clean = val.replace(/^S/i, '').trim();
    const dec = parseInt(clean, 10);
    if (!isNaN(dec)) return dec;
    const bin = parseInt(clean, 2);
    if (!isNaN(bin)) return bin;
  }
  return undefined;
}

function normalizeStateTableRow(
  row: unknown,
  stateBits = 3,
  hasOutput = true,
  hasInput = false,
  machineKind?: string
): NormalizedTableRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  // Canonical row
  if ('code' in r && typeof r.code === 'number') {
    if (r.valid === false) return null; // Ignore unused rows
    const pres = String(r.stateName ?? formatCode(r.code, stateBits));
    const inp = hasInput
      ? (r.inputValue !== undefined ? String(r.inputValue) : (r.input !== undefined ? String(r.input) : '0'))
      : undefined;

    const nextCodeNum = typeof r.nextCode === 'number' ? r.nextCode : undefined;
    const next = r.nextCode !== undefined
      ? (typeof r.nextCode === 'number' ? (r.nextStateName ? String(r.nextStateName) : formatCode(r.nextCode, stateBits)) : String(r.nextCode))
      : String(r.nextState ?? '');

    let out: LogicValue | undefined = undefined;
    if (hasOutput) {
      if (machineKind === 'moore') {
        out = parseOutputValue(r.mooreOutput ?? r.output);
      } else if (machineKind === 'mealy') {
        out = parseOutputValue(r.mealyOutput ?? r.output);
      } else {
        out = parseOutputValue(r.mooreOutput ?? r.mealyOutput ?? r.output);
      }
    }

    return {
      key: `${pres}:${inp ?? ''}`,
      presentState: pres,
      input: inp,
      nextState: next,
      nextCodeNum,
      output: out,
    };
  }

  // Generic StateTableRow
  const pres = String(r.presentState ?? '');
  const inp = hasInput ? String(r.input ?? '0') : undefined;
  const next = String(r.nextState ?? '');
  const nextCodeNum = parseStateCode(next);
  const out = hasOutput ? parseOutputValue(r.output) : undefined;

  return {
    key: `${pres}:${inp ?? ''}`,
    presentState: pres,
    input: inp,
    nextState: next,
    nextCodeNum,
    output: out,
  };
}

/**
 * Verifies student state table submissions cell-by-cell against the canonical reference table.
 */
export function verifyStateTable(
  student: StateTable | CanonicalStateTable,
  reference: CanonicalStateTable | StateTable
): StepVerificationResult {
  const refBits = 'stateBits' in reference ? reference.stateBits : 3;
  const refKind = 'machineKind' in reference ? reference.machineKind : 'counter';
  const refHasInput = 'hasInput' in reference ? reference.hasInput : (refKind === 'mealy' || refKind === 'moore');
  const refHasOutput = refKind === 'mealy' || refKind === 'moore';

  const stuBits = 'stateBits' in student ? student.stateBits : refBits;
  const stuKind = 'machineKind' in student ? student.machineKind : refKind;
  const stuHasInput = 'hasInput' in student ? student.hasInput : refHasInput;
  const stuHasOutput = stuKind === 'mealy' || stuKind === 'moore';

  const refRows = reference.rows
    .map(r => normalizeStateTableRow(r, refBits, refHasOutput, refHasInput, refKind))
    .filter((r): r is NormalizedTableRow => r !== null);

  const stuRowMap = new Map<string, NormalizedTableRow>();
  for (const r of student.rows) {
    const norm = normalizeStateTableRow(r, stuBits, stuHasOutput, stuHasInput, stuKind);
    if (norm) {
      stuRowMap.set(norm.key, norm);
    }
  }

  const items: StepItemResult[] = [];
  let correctCount = 0;

  for (const ref of refRows) {
    const stu = stuRowMap.get(ref.key);

    // Next State check
    const nextId = `next:${ref.key}`;
    if (!stu) {
      items.push({
        id: nextId,
        status: 'missing',
        expected: ref.nextState,
        message: `Missing transition row for state ${ref.presentState}${ref.input !== undefined ? ` with input ${ref.input}` : ''}`,
      });
    } else {
      const isNextCorrect = stu.nextState === ref.nextState ||
        (stu.nextCodeNum !== undefined && ref.nextCodeNum !== undefined && stu.nextCodeNum === ref.nextCodeNum) ||
        stu.nextState.replace(/^S/i, '') === ref.nextState.replace(/^S/i, '');

      if (isNextCorrect) {
        correctCount++;
        items.push({ id: nextId, status: 'correct', expected: ref.nextState, got: stu.nextState });
      } else {
        items.push({
          id: nextId,
          status: 'incorrect',
          expected: ref.nextState,
          got: stu.nextState,
          message: `Expected next state ${ref.nextState}, but received ${stu.nextState}`,
        });
      }
    }

    // Output check
    if (ref.output !== undefined) {
      const outId = `output:${ref.key}`;
      if (!stu || stu.output === undefined) {
        items.push({
          id: outId,
          status: 'missing',
          expected: ref.output,
          message: `Missing output for state ${ref.presentState}${ref.input !== undefined ? ` with input ${ref.input}` : ''}`,
        });
      } else {
        const isOutCorrect = stu.output === ref.output || (ref.output === 'X' && (stu.output === 0 || stu.output === 1));
        if (isOutCorrect) {
          correctCount++;
          items.push({ id: outId, status: 'correct', expected: ref.output, got: stu.output });
        } else {
          items.push({
            id: outId,
            status: 'incorrect',
            expected: ref.output,
            got: stu.output,
            message: `Expected output ${ref.output}, but received ${stu.output}`,
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

/**
 * Verifies student state diagram submissions by converting them losslessly to a State Table.
 */
export function verifyDiagram(
  studentDiagram: StateDiagramData,
  reference: CanonicalStateTable | StateTable
): StepVerificationResult {
  const refBits = 'stateBits' in reference ? reference.stateBits : (studentDiagram.stateBits ?? 3);
  const refHasInput = 'hasInput' in reference ? reference.hasInput : (studentDiagram.machineKind === 'mealy' || studentDiagram.machineKind === 'moore');
  const refMachineKind: MachineKind = 'machineKind' in reference ? reference.machineKind : (studentDiagram.machineKind ?? 'counter');
  const refInputKind = 'inputKind' in reference ? reference.inputKind : 'none';

  const convertedTable = tableFromDiagram(
    studentDiagram,
    refBits,
    refHasInput,
    refMachineKind,
    refInputKind
  );
  return verifyStateTable(convertedTable, reference);
}
