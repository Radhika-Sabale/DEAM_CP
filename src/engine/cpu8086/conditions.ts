/**
 * @file conditions.ts
 * Evaluation of conditional jump conditions against 8086 CPU status flags.
 *
 * ============================================================================
 * CONDITIONAL JUMP FORMULAS (PROVEN IN STAGE 13A ALU TESTS):
 *
 * Unsigned relations (rely on CF and ZF):
 * - JE / JZ:   ZF = 1
 * - JNE / JNZ: ZF = 0
 * - JC / JB:   CF = 1
 * - JNC / JAE: CF = 0
 * - JA:        CF = 0 AND ZF = 0
 * - JBE:       CF = 1 OR ZF = 1
 *
 * Signed relations (rely on SF, OF, and ZF):
 * - JL:        SF != OF
 * - JGE:       SF == OF
 * - JG:        ZF = 0 AND SF == OF
 * - JLE:       ZF = 1 OR SF != OF
 *
 * Direct flag checks:
 * - JS:        SF = 1
 * - JNS:       SF = 0
 * - JO:        OF = 1
 * - JNO:       OF = 0
 *
 * UNDEFINED FLAG SEMANTICS:
 * When a shift or rotate with count > 1 executes, the 8086 specification dictates
 * that the Overflow Flag (OF) becomes 'undefined'. If a subsequent conditional jump
 * depends on an undefined OF (JO, JNO, JL, JGE, JG, JLE), the CPU refuses to guess
 * a pseudo-random verdict. Instead, execution halts with a typed runtime fault:
 * "branch-on-undefined-flag".
 * ============================================================================
 */

import type { CanonicalMnemonic } from './types';

/**
 * Flag state structure for condition evaluation.
 */
export interface ConditionFlags {
  readonly Z: 0 | 1;
  readonly C: 0 | 1;
  readonly S: 0 | 1;
  readonly O: 0 | 1 | 'undefined';
}

/**
 * Result of evaluating a conditional branch instruction.
 */
export type ConditionResult =
  | {
      readonly ok: true;
      readonly taken: boolean;
    }
  | {
      readonly ok: false;
      readonly fault: 'branch-on-undefined-flag';
      readonly flag: 'OF';
      readonly message: string;
      readonly explanation: string;
    };

/**
 * Evaluates whether a conditional jump should be taken based on current CPU flags.
 *
 * @param mnemonic The branch mnemonic (e.g., 'JE', 'JL', 'JA', 'JO').
 * @param flags The current CPU flags (ZF, CF, SF, OF).
 * @param instructionText Canonical source text for error reporting.
 * @returns ConditionResult indicating whether branch is taken, or a typed fault if OF is undefined.
 */
export function evaluateCondition(
  mnemonic: CanonicalMnemonic | string,
  flags: ConditionFlags,
  instructionText: string = mnemonic
): ConditionResult {
  const norm = mnemonic.toUpperCase();

  // Helper to ensure OF is defined for signed checks
  const requireDefinedOf = (): 0 | 1 | null => {
    if (flags.O === 'undefined') {
      return null;
    }
    return flags.O;
  };

  switch (norm) {
    // Unsigned & Equality jumps (independent of OF)
    case 'JE':
    case 'JZ':
      return { ok: true, taken: flags.Z === 1 };

    case 'JNE':
    case 'JNZ':
      return { ok: true, taken: flags.Z === 0 };

    case 'JC':
    case 'JB':
    case 'JNAE':
      return { ok: true, taken: flags.C === 1 };

    case 'JNC':
    case 'JAE':
    case 'JNB':
      return { ok: true, taken: flags.C === 0 };

    case 'JA':
    case 'JNBE':
      return { ok: true, taken: flags.C === 0 && flags.Z === 0 };

    case 'JBE':
    case 'JNA':
      return { ok: true, taken: flags.C === 1 || flags.Z === 1 };

    case 'JS':
      return { ok: true, taken: flags.S === 1 };

    case 'JNS':
      return { ok: true, taken: flags.S === 0 };

    // Signed & Overflow jumps (depend on OF)
    case 'JO': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: of === 1 };
    }

    case 'JNO': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: of === 0 };
    }

    case 'JL':
    case 'JNGE': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: flags.S !== of };
    }

    case 'JGE':
    case 'JNL': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: flags.S === of };
    }

    case 'JG':
    case 'JNLE': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: flags.Z === 0 && flags.S === of };
    }

    case 'JLE':
    case 'JNG': {
      const of = requireDefinedOf();
      if (of === null) return undefinedFlagFault(instructionText);
      return { ok: true, taken: flags.Z === 1 || flags.S !== of };
    }

    default:
      return { ok: true, taken: false };
  }
}

function undefinedFlagFault(instructionText: string): ConditionResult {
  return {
    ok: false,
    fault: 'branch-on-undefined-flag',
    flag: 'OF',
    message: `Conditional branch "${instructionText}" evaluated undefined Overflow Flag (OF).`,
    explanation:
      'The Overflow Flag (OF) is undefined after a multi-bit shift and cannot be safely used for conditional jumps.',
  };
}
