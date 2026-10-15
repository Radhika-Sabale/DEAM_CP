/**
 * @file cpu8086Rules.ts
 * Memory, stack, and branch pedagogical validation rules for 8086 CPU steps.
 */

import { readByte, readWord } from '../../cpu8086/memory';
import { getReg } from '../../cpu8086/registers';
import type {
  CpuMemoryAnswer,
  CpuNextIpAnswer,
  CpuStackAnswer,
  MisconceptionTag,
  StepSubmission,
} from '../../../types/feedback';
import type { StepContext, ValidationOutcome } from '../types';
import { getCpuRun } from './cpu8086Run';

export function validateCpuMemory(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'cpu-memory') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'cpu-memory', address: 0, width: 8, expectedValue: 0 },
      got: { kind: 'cpu-memory', address: 0, width: 8, studentValue: 0 },
    };
  }
  const ans = sub.studentAnswer as CpuMemoryAnswer;
  const run = getCpuRun(context);
  if (!run) return { correct: true };

  const { postState } = run;
  const expectedVal =
    ans.width === 8
      ? readByte(postState.memory, ans.address)
      : readWord(postState.memory, ans.address);

  if (ans.value === expectedVal) return { correct: true };

  let tag: MisconceptionTag = 'other';
  let details = `Expected memory at [0x${ans.address.toString(16).padStart(4, '0')}] to be 0x${expectedVal.toString(16)}, received 0x${ans.value.toString(16)}.`;

  if (ans.width === 16) {
    const low = readByte(postState.memory, ans.address);
    const high = readByte(postState.memory, (ans.address + 1) & 0xffff);
    if (low !== high && ans.value === ((low << 8) | high)) {
      tag = 'wrong-byte-order';
      details =
        '8086 stores 16-bit words in little-endian order: low byte at base address, high byte at base+1.';
    }
  }

  const symAddr = context?.cpu8086?.sourceSymbolAddress;
  if (symAddr !== undefined && ans.value === symAddr) {
    tag = 'wrong-address-vs-value';
    details =
      'Immediate address was stored or referenced instead of dereferenced memory content.';
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'cpu-memory',
      address: ans.address,
      width: ans.width,
      expectedValue: expectedVal,
    },
    got: {
      kind: 'cpu-memory',
      address: ans.address,
      width: ans.width,
      studentValue: ans.value,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

export function validateCpuStack(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'cpu-stack') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: {
        kind: 'cpu-stack',
        op: 'push',
        expectedSp: 0,
        expectedAddress: 0,
        expectedValue: 0,
      },
      got: {
        kind: 'cpu-stack',
        op: 'push',
        studentSp: 0,
        studentAddress: 0,
        studentValue: 0,
      },
    };
  }
  const ans = sub.studentAnswer as CpuStackAnswer;
  const run = getCpuRun(context);
  if (!run) return { correct: true };

  const { preState, instr } = run;
  const oldSp = preState.registers.SP;
  const isPush = ans.op === 'push';
  const expectedSp = isPush ? (oldSp - 2) & 0xffff : (oldSp + 2) & 0xffff;
  const expectedAddr = isPush ? (oldSp - 2) & 0xffff : oldSp;

  let expectedVal = 0;
  if (isPush) {
    expectedVal =
      instr.mnemonic === 'CALL'
        ? (preState.registers.IP + 1) & 0xffff
        : instr.operands[0]?.kind === 'reg'
          ? getReg(preState.registers, instr.operands[0].name)
          : 0;
  } else {
    expectedVal = readWord(preState.memory, oldSp);
  }

  if (
    ans.sp === expectedSp &&
    ans.address === expectedAddr &&
    ans.value === expectedVal
  ) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected SP=0x${expectedSp.toString(16)}, address=0x${expectedAddr.toString(16)}, value=0x${expectedVal.toString(16)}.`;

  if (isPush) {
    if (
      (ans.sp === expectedSp && ans.address === oldSp) ||
      (ans.sp === oldSp &&
        (ans.address === oldSp || ans.address === ((oldSp - 2) & 0xffff)))
    ) {
      tag = 'wrong-push-order';
      details =
        'On PUSH, SP must be decremented before the write occurs at the new SP.';
    } else if (
      ans.sp === ((oldSp + 2) & 0xffff) &&
      (ans.address === ((oldSp + 2) & 0xffff) || ans.address === oldSp)
    ) {
      tag = 'wrong-stack-direction';
      details =
        '8086 stack grows downward toward address 0x0000; PUSH decrements SP instead of incrementing it.';
    } else if (
      ans.sp === expectedSp &&
      ans.address === expectedAddr &&
      ans.value !== expectedVal &&
      instr.mnemonic === 'CALL'
    ) {
      tag = 'wrong-call-return-address';
      details =
        'CALL pushes the return address of the next sequential instruction (IP + 1) onto the stack.';
    }
  } else {
    if (
      (ans.sp === expectedSp && ans.address === ((oldSp + 2) & 0xffff)) ||
      (ans.sp === oldSp && ans.address === oldSp)
    ) {
      tag = 'wrong-push-order';
      details =
        'On POP, the stack top word is read from current SP before SP is incremented.';
    } else if (ans.sp === ((oldSp - 2) & 0xffff)) {
      tag = 'wrong-stack-direction';
      details =
        'On POP, SP increments toward higher memory to release the popped stack frame.';
    }
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'cpu-stack',
      op: ans.op,
      expectedSp,
      expectedAddress: expectedAddr,
      expectedValue: expectedVal,
    },
    got: {
      kind: 'cpu-stack',
      op: ans.op,
      studentSp: ans.sp,
      studentAddress: ans.address,
      studentValue: ans.value,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

export function validateCpuNextIp(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'cpu-next-ip') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'cpu-next-ip', expectedIp: 0 },
      got: { kind: 'cpu-next-ip', studentNextIp: 0 },
    };
  }
  const ans = sub.studentAnswer as CpuNextIpAnswer;
  const run = getCpuRun(context);
  if (!run) return { correct: true };

  const { preState, postState, instr } = run;
  const expectedIp = postState.registers.IP;

  if (ans.nextIp === expectedIp) return { correct: true };

  const currentIp = preState.registers.IP;
  const fallthroughIp = (currentIp + 1) & 0xffff;
  const targetIp = postState.halted
    ? expectedIp
    : expectedIp === fallthroughIp
      ? ans.nextIp
      : expectedIp;

  let tag: MisconceptionTag = 'other';
  let details = `Expected next IP to be ${expectedIp}, received ${ans.nextIp}.`;

  const mnem = instr.mnemonic;

  const unsignedMap: Record<string, string> = {
    JA: 'JG',
    JAE: 'JGE',
    JB: 'JL',
    JBE: 'JLE',
    JG: 'JA',
    JGE: 'JAE',
    JL: 'JB',
    JLE: 'JBE',
  };
  if (unsignedMap[mnem]) {
    tag = 'wrong-cmp-relation';
    details = `Branch condition ${mnem} was evaluated using the opposing signed/unsigned relational flags.`;
  } else if (
    ['JZ', 'JE', 'JNZ', 'JNE', 'JC', 'JNC', 'JS', 'JNS', 'JO', 'JNO'].includes(mnem)
  ) {
    tag = 'wrong-jcc-condition';
    details = `Mnemonic ${mnem} condition flag was evaluated with inverted polarity or incorrect status flag.`;
  } else if (ans.nextIp === fallthroughIp || ans.nextIp === targetIp) {
    tag = 'wrong-ip-after-jump';
    details = 'Branch prediction took the opposite path of the governing condition code.';
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: { kind: 'cpu-next-ip', expectedIp },
    got: {
      kind: 'cpu-next-ip',
      studentNextIp: ans.nextIp,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}
