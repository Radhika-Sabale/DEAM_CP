/**
 * @file binaryArithmeticHandoff.ts
 * Operand normalization and inter-module handoff routines from Binary Arithmetic to the ALU.
 */

import { checkHandoffReadiness } from '../registry';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import type { AluOpId } from '../../types/designProject';

/**
 * Converts a signed or unsigned operand input (string or number) to its
 * unsigned bit pattern representation for the specified bit width.
 */
export function operandToUnsigned(val: string | number, width: number): number {
  const mask = width >= 32 ? 0xffffffff : ((1 << width) - 1) >>> 0;
  if (typeof val === 'number') {
    return (val >>> 0) & mask;
  }
  const clean = val.trim();
  if (/^[01]+$/.test(clean)) {
    return parseInt(clean, 2) & mask;
  }
  const parsed = parseInt(clean, 10);
  if (!Number.isNaN(parsed)) {
    return (parsed >>> 0) & mask;
  }
  return 0;
}

/**
 * Executes a verified handoff of binary arithmetic operands to the ALU module.
 *
 * @param op The active arithmetic operation
 * @param operandA Raw operand A
 * @param operandB Raw operand B
 * @param width Bit width
 */
export function executeAluHandoff(
  op: 'add' | 'subtract',
  operandA: string | number,
  operandB: string | number,
  width: number
): { ok: boolean; error?: string } {
  const project = useProjectStore.getState().project;
  const applyPatch = useProjectStore.getState().applyPatch;
  const markModuleCompleted = useProjectStore.getState().markModuleCompleted;
  const setModule = useUiStore.getState().setModule;
  const pushToast = useUiStore.getState().pushToast;

  const readinessErrors = checkHandoffReadiness(project, 'number-systems', 'alu');
  if (readinessErrors.length > 0) {
    pushToast({
      level: 'warning',
      title: 'Prerequisites Not Met',
      message: readinessErrors.join(' '),
    });
    return { ok: false, error: readinessErrors.join(' ') };
  }

  const aluOp: AluOpId = op === 'add' ? 'ADD' : 'SUB';
  const clampedWidth = Math.min(Math.max(width, 2), 16);
  const uA = operandToUnsigned(operandA, clampedWidth);
  const uB = operandToUnsigned(operandB, clampedWidth);

  applyPatch({
    alu: {
      op: aluOp,
      width: clampedWidth,
      a: uA,
      b: uB,
    },
    lastHandoff: {
      from: 'number-systems',
      to: 'alu',
      timestamp: new Date().toISOString(),
      summary: `Handoff from Number Systems to ALU: ${aluOp} A=${uA}, B=${uB} (${clampedWidth}-bit)`,
    },
  });

  markModuleCompleted('number-systems');
  setModule('alu');

  pushToast({
    level: 'success',
    title: 'Handoff to ALU Successful',
    message: `Navigated to ALU with ${aluOp} operands A=${uA}, B=${uB}.`,
  });

  return { ok: true };
}
