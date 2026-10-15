/**
 * @file cpu8086Run.ts
 * Helper extracting pre/post CPU state and executed instruction for feedback validators.
 */

import { step } from '../../cpu8086/cpu';
import type { CpuState, StepResult } from '../../cpu8086/cpuTypes';
import type { Instruction } from '../../cpu8086/types';
import type { StepContext } from '../types';

export function getCpuRun(context?: StepContext): {
  preState: CpuState;
  postState: CpuState;
  instr: Instruction;
} | null {
  const c = context?.cpu8086;
  if (!c) return null;
  const res: StepResult = c.stepResult ?? step(c.state, c.program);
  const instr = c.program.instructions[c.state.registers.IP];
  if (!instr) return null;
  return { preState: c.state, postState: res.state, instr };
}
