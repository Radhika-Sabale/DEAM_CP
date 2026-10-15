/**
 * @file historyTrace.ts
 * Formats execution history steps as structured trace table rows.
 */

import type { StepRecord } from './cpuTypes';

export interface TraceTableRow {
  readonly stepNumber: number;
  readonly address: number;
  readonly sourceLine: number;
  readonly instructionText: string;
  readonly registersChanged: string;
  readonly flagsChanged: string;
  readonly memoryWrites: string;
}

export function formatTraceRow(rec: StepRecord, stepNumber: number): TraceTableRow {
  const regStrs = rec.registersChanged.map(
    (r) =>
      `${r.name}: 0x${r.old.toString(16).toUpperCase()} -> 0x${r.new.toString(16).toUpperCase()}`
  );
  const flagStrs = rec.flagsChanged.map((f) => `${f.name}: ${f.old} -> ${f.new}`);
  const memStrs = rec.memoryWrites.map(
    (m) =>
      `[0x${m.address.toString(16).padStart(4, '0').toUpperCase()}]: 0x${m.oldByte.toString(16)} -> 0x${m.newByte.toString(16)}`
  );

  return {
    stepNumber,
    address: rec.address,
    sourceLine: rec.sourceLine,
    instructionText: rec.instruction.sourceText,
    registersChanged: regStrs.join(', '),
    flagsChanged: flagStrs.join(', '),
    memoryWrites: memStrs.join(', '),
  };
}
