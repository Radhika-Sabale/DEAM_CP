/**
 * @file instructionValidator.ts
 * Semantic validation and operand resolution for 8086 instructions:
 * Jumps, CALL, RET, PUSH, POP, INC, DEC, SHL, SHR, HLT, NOP.
 */

import type {
  AssemblerError,
  AssemblerWarning,
  CanonicalMnemonic,
  Instruction,
  Operand,
  SymbolEntry,
} from './types';
import { INSTRUCTION_TABLE, isJumpInstruction } from './isa';
import { validateBinaryInstruction } from './binaryValidator';

export interface ValidatedInstructionResult {
  readonly ok: true;
  readonly instruction: Instruction;
  readonly warnings: readonly AssemblerWarning[];
  readonly referencedLabels: readonly string[];
}

export type InstructionValidationResult =
  | ValidatedInstructionResult
  | { readonly ok: false; readonly errors: readonly AssemblerError[]; readonly warnings: readonly AssemblerWarning[] };

function err(line: number, col: number, len: number, code: string, msg: string): InstructionValidationResult {
  return { ok: false, errors: [{ line, column: col, length: len, code, message: msg }], warnings: [] };
}

/**
 * Validates an instruction record and resolves its operands against symbol definitions.
 */
export function validateAndResolveInstruction(
  address: number,
  mnemonic: CanonicalMnemonic,
  rawOperands: readonly Operand[],
  sourceLine: number,
  sourceText: string,
  symbols: Readonly<Record<string, SymbolEntry>>,
  col: number
): InstructionValidationResult {
  const rule = INSTRUCTION_TABLE[mnemonic];
  const warnings: AssemblerWarning[] = [];
  const referencedLabels: string[] = [];

  // 1. Operand count check
  if (rawOperands.length < rule.minOperands || rawOperands.length > rule.maxOperands) {
    const exp = rule.minOperands === rule.maxOperands ? rule.minOperands : `${rule.minOperands}-${rule.maxOperands}`;
    return err(sourceLine, col, mnemonic.length, 'wrong-operand-count', `Instruction '${mnemonic}' expects ${exp} operand(s), got ${rawOperands.length}`);
  }

  // 2. Control & zero-operand instructions
  if (
    mnemonic === 'HLT' ||
    mnemonic === 'NOP' ||
    mnemonic === 'IRET' ||
    mnemonic === 'CLI' ||
    mnemonic === 'STI' ||
    mnemonic === 'PUSHF' ||
    mnemonic === 'POPF'
    || mnemonic === 'CBW'
    || mnemonic === 'CWD'
  ) {
    const size = mnemonic === 'PUSHF' || mnemonic === 'POPF' ? 16 : undefined;
    return { ok: true, instruction: { address, mnemonic, operands: [], size, sourceLine, sourceText }, warnings, referencedLabels };
  }

  // 2b. Software interrupt: INT n (immediate in 0..255)
  if (mnemonic === 'INT') {
    const op = rawOperands[0];
    if (!op || op.kind !== 'imm') {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', 'INT operand must be an immediate byte (0..255)');
    }
    if (op.value < 0 || op.value > 255) {
      return err(sourceLine, col, mnemonic.length, 'immediate-out-of-range', `INT interrupt vector ${op.value} out of range (0..255)`);
    }
    return {
      ok: true,
      instruction: { address, mnemonic, operands: [{ ...op, size: 8 }], size: 8, sourceLine, sourceText },
      warnings,
      referencedLabels,
    };
  }

  // 3. Jumps and CALL (target must be a code label)
  if (isJumpInstruction(mnemonic) || mnemonic === 'CALL') {
    const targetOp = rawOperands[0];
    if (!targetOp || targetOp.kind !== 'label') {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', `${mnemonic} target must be a label, received ${targetOp?.kind ?? 'unknown'}`);
    }
    referencedLabels.push(targetOp.name);
    const sym = symbols[targetOp.name];
    if (!sym) {
      return err(sourceLine, col, targetOp.name.length, 'undefined-label', `Undefined label '${targetOp.name}' referenced by ${mnemonic}`);
    }
    if (sym.kind === 'data') {
      return err(sourceLine, col, targetOp.name.length, 'jump-target-is-data-label', `Jump target '${targetOp.name}' is a data label, expected code label`);
    }
    return { ok: true, instruction: { address, mnemonic, operands: [targetOp], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
  }

  if (mnemonic === 'XCHG') {
    const [left, right] = rawOperands;
    if (!left || !right || (left.kind !== 'reg' && left.kind !== 'mem') || (right.kind !== 'reg' && right.kind !== 'mem')) {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', 'XCHG requires register or memory operands');
    }
    if (left.kind === 'mem' && right.kind === 'mem') return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', 'XCHG cannot use two memory operands');
    const size = left.kind === 'reg' ? left.size : right.kind === 'reg' ? right.size : left.size;
    if (size === undefined || (left.kind === 'mem' && left.size !== undefined && left.size !== size) || (right.kind === 'mem' && right.size !== undefined && right.size !== size)) {
      return err(sourceLine, col, mnemonic.length, 'size-mismatch', 'XCHG operands must have the same explicit size');
    }
    const resolved = rawOperands.map((op) => op.kind === 'mem' ? { ...resolveMemoryOperand(op, symbols, referencedLabels), size } : op);
    return { ok: true, instruction: { address, mnemonic, operands: resolved, size, sourceLine, sourceText }, warnings, referencedLabels };
  }

  if (mnemonic === 'LEA') {
    const [dest, source] = rawOperands;
    if (!dest || dest.kind !== 'reg' || dest.size !== 16 || !source || source.kind !== 'mem') {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', 'LEA requires a 16-bit register and a memory address');
    }
    return { ok: true, instruction: { address, mnemonic, operands: [dest, resolveMemoryOperand(source, symbols, referencedLabels)], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
  }

  if (mnemonic === 'NOT' || mnemonic === 'NEG' || mnemonic === 'MUL' || mnemonic === 'IMUL' || mnemonic === 'DIV' || mnemonic === 'IDIV') {
    const op = rawOperands[0];
    if (!op || (op.kind !== 'reg' && op.kind !== 'mem')) return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', `${mnemonic} requires a register or memory operand`);
    if (op.kind === 'mem' && op.size === undefined) return err(sourceLine, col, mnemonic.length, 'ambiguous-operand-size', `Ambiguous operand size for ${mnemonic}; specify BYTE PTR or WORD PTR`);
    const size = op.kind === 'reg' ? op.size : op.size!;
    const resolved = op.kind === 'mem' ? resolveMemoryOperand(op, symbols, referencedLabels) : op;
    return { ok: true, instruction: { address, mnemonic, operands: [resolved], size, sourceLine, sourceText }, warnings, referencedLabels };
  }

  // 4. RET (0 operands or 1 immediate pop-bytes)
  if (mnemonic === 'RET') {
    if (rawOperands.length === 0) {
      return { ok: true, instruction: { address, mnemonic, operands: [], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
    }
    const op = rawOperands[0];
    if (op && op.kind === 'imm') {
      if (op.value < 0 || op.value > 0xffff) {
        return err(sourceLine, col, 3, 'immediate-out-of-range', `RET pop-bytes ${op.value} out of 16-bit range (0..65535)`);
      }
      return { ok: true, instruction: { address, mnemonic, operands: [op], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
    }
    return err(sourceLine, col, 3, 'invalid-operand-form', 'RET operand must be an immediate 16-bit value');
  }

  // 5. Stack operations: PUSH and POP (16-bit only)
  if (mnemonic === 'PUSH' || mnemonic === 'POP') {
    const op = rawOperands[0];
    if (!op || (op.kind !== 'reg' && op.kind !== 'mem')) {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', `${mnemonic} requires a 16-bit register or memory operand`);
    }
    if (op.kind === 'reg') {
      if (op.size === 8) {
        return err(sourceLine, col, op.name.length, 'size-mismatch', `${mnemonic} requires 16-bit operand; register ${op.name} is 8-bit`);
      }
      if (mnemonic === 'POP' && op.name === 'IP') {
        return err(sourceLine, col, op.name.length, 'invalid-operand-form', 'Cannot POP directly into IP register');
      }
      return { ok: true, instruction: { address, mnemonic, operands: [op], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
    }
    if (op.size === 8) {
      return err(sourceLine, col, 8, 'size-mismatch', `${mnemonic} requires 16-bit operand; BYTE PTR specified`);
    }
    const resolvedMem = resolveMemoryOperand(op, symbols, referencedLabels);
    return { ok: true, instruction: { address, mnemonic, operands: [{ ...resolvedMem, size: 16 }], size: 16, sourceLine, sourceText }, warnings, referencedLabels };
  }

  // 6. INC and DEC (1 operand: reg or mem)
  if (mnemonic === 'INC' || mnemonic === 'DEC') {
    const op = rawOperands[0];
    if (!op || (op.kind !== 'reg' && op.kind !== 'mem')) {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', `${mnemonic} operand must be a register or memory location`);
    }
    if (op.kind === 'reg') {
      return { ok: true, instruction: { address, mnemonic, operands: [op], size: op.size, sourceLine, sourceText }, warnings, referencedLabels };
    }
    if (op.size === undefined) {
      return err(sourceLine, col, mnemonic.length, 'ambiguous-operand-size', `Ambiguous operand size for ${mnemonic}; specify BYTE PTR or WORD PTR`);
    }
    const resolvedMem = resolveMemoryOperand(op, symbols, referencedLabels);
    return { ok: true, instruction: { address, mnemonic, operands: [resolvedMem], size: op.size, sourceLine, sourceText }, warnings, referencedLabels };
  }

  // 7. Shifts: SHL and SHR (dest, count: count must be 1 or CL)
  if (mnemonic === 'SHL' || mnemonic === 'SHR') {
    const dest = rawOperands[0];
    const count = rawOperands[1];
    if (!dest || !count) {
      return err(sourceLine, col, mnemonic.length, 'wrong-operand-count', `${mnemonic} requires 2 operands`);
    }
    const isCountValid = (count.kind === 'imm' && count.value === 1) || (count.kind === 'reg' && count.name === 'CL');
    if (!isCountValid) {
      const countDesc = count.kind === 'reg' ? count.name : count.kind === 'imm' ? String(count.value) : count.kind;
      return err(sourceLine, col, mnemonic.length, 'invalid-shift-count', `Shift count must be 1 or CL, received ${countDesc}`);
    }
    if (dest.kind !== 'reg' && dest.kind !== 'mem') {
      return err(sourceLine, col, mnemonic.length, 'invalid-operand-form', 'Shift destination must be a register or memory');
    }
    let size: 8 | 16;
    let resolvedDest: Operand;
    if (dest.kind === 'reg') {
      size = dest.size;
      resolvedDest = dest;
    } else {
      if (dest.size === undefined) {
        return err(sourceLine, col, mnemonic.length, 'ambiguous-operand-size', `Ambiguous operand size for ${mnemonic}; specify BYTE PTR or WORD PTR`);
      }
      size = dest.size;
      resolvedDest = resolveMemoryOperand(dest, symbols, referencedLabels);
    }
    return { ok: true, instruction: { address, mnemonic, operands: [resolvedDest, count], size, sourceLine, sourceText }, warnings, referencedLabels };
  }

  // 8. Binary Two-Operand: MOV, ADD, SUB, CMP, AND, OR, XOR
  return validateBinaryInstruction(address, mnemonic, rawOperands, sourceLine, sourceText, symbols, col, warnings, referencedLabels);
}

function resolveMemoryOperand(
  mem: Extract<Operand, { kind: 'mem' }>,
  symbols: Readonly<Record<string, SymbolEntry>>,
  referencedLabels: string[]
): Extract<Operand, { kind: 'mem' }> {
  if (mem.label) {
    referencedLabels.push(mem.label);
    const sym = symbols[mem.label];
    if (sym) {
      return { ...mem, disp: sym.address + mem.disp };
    }
  }
  return mem;
}
