/**
 * @file binaryValidator.ts
 * Semantic validation for two-operand binary 8086 instructions:
 * MOV, ADD, SUB, CMP, AND, OR, XOR. Handles size deduction, label resolution,
 * memory-to-memory prevention, and immediate bounds checking.
 */

import type {
  AssemblerWarning,
  CanonicalMnemonic,
  Operand,
  SymbolEntry,
} from './types';
import type { InstructionValidationResult } from './instructionValidator';
import { fitImmediateToSize } from './numberParser';

/**
 * Validates binary data/arithmetic instructions (MOV, ADD, SUB, CMP, AND, OR, XOR).
 */
export function validateBinaryInstruction(
  address: number,
  mnemonic: CanonicalMnemonic,
  rawOperands: readonly Operand[],
  line: number,
  sourceText: string,
  symbols: Readonly<Record<string, SymbolEntry>>,
  col: number,
  warnings: AssemblerWarning[],
  referencedLabels: string[]
): InstructionValidationResult {
  const dest = rawOperands[0];
  const src = rawOperands[1];

  if (!dest || !src) {
    return {
      ok: false,
      errors: [{ line, column: col, length: mnemonic.length, code: 'wrong-operand-count', message: `${mnemonic} requires 2 operands` }],
      warnings,
    };
  }

  // Destination cannot be immediate or bare label
  if (dest.kind === 'imm' || dest.kind === 'label') {
    const name = dest.kind === 'label' ? dest.name : String(dest.value);
    return {
      ok: false,
      errors: [{
        line, column: col, length: mnemonic.length, code: 'invalid-operand-form',
        message: `Destination cannot be an immediate or label '${name}'. Use '[${name}]' for memory write.`,
      }],
      warnings,
    };
  }

  // Memory to memory is not supported
  if (dest.kind === 'mem' && src.kind === 'mem') {
    return {
      ok: false,
      errors: [{ line, column: col, length: mnemonic.length, code: 'invalid-operand-form', message: `Memory-to-memory operations are not supported in 8086: ${mnemonic}` }],
      warnings,
    };
  }

  // Resolve source bare label (immediate address)
  let resolvedSrc: Operand = src;
  if (src.kind === 'label') {
    referencedLabels.push(src.name);
    const sym = symbols[src.name];
    if (!sym) {
      return {
        ok: false,
        errors: [{ line, column: col, length: src.name.length, code: 'undefined-label', message: `Undefined label '${src.name}' in source operand` }],
        warnings,
      };
    }
    resolvedSrc = { kind: 'imm', value: sym.address, size: 16, label: sym.name };
  } else if (src.kind === 'mem') {
    resolvedSrc = resolveMem(src, symbols, referencedLabels);
  }

  const resolvedDest: Operand = dest.kind === 'mem' ? resolveMem(dest, symbols, referencedLabels) : dest;

  // Determine and reconcile operand size
  let deducedSize: 8 | 16 | undefined;
  if (resolvedDest.kind === 'reg') deducedSize = resolvedDest.size;
  else if (resolvedDest.size !== undefined) deducedSize = resolvedDest.size;

  if (resolvedSrc.kind === 'reg') {
    if (deducedSize !== undefined && deducedSize !== resolvedSrc.size) {
      return sizeMismatch(line, col, mnemonic, deducedSize, resolvedSrc.size, warnings);
    }
    deducedSize = resolvedSrc.size;
  } else if (resolvedSrc.kind === 'mem' && resolvedSrc.size !== undefined) {
    if (deducedSize !== undefined && deducedSize !== resolvedSrc.size) {
      return sizeMismatch(line, col, mnemonic, deducedSize, resolvedSrc.size, warnings);
    }
    deducedSize = resolvedSrc.size;
  }

  if (deducedSize === undefined) {
    return {
      ok: false,
      errors: [{ line, column: col, length: mnemonic.length, code: 'ambiguous-operand-size', message: `Ambiguous operand size for ${mnemonic}; specify BYTE PTR or WORD PTR` }],
      warnings,
    };
  }

  // Immediate bounds check
  if (resolvedSrc.kind === 'imm') {
    const rawVal = resolvedSrc.value;
    if (rawVal >= 0) {
      if (deducedSize === 8 && rawVal > 255) {
        return {
          ok: false,
          errors: [{ line, column: col, length: mnemonic.length, code: 'immediate-out-of-range', message: `Immediate value ${rawVal} exceeds 8-bit range (0..255)` }],
          warnings,
        };
      }
      if (deducedSize === 16 && rawVal > 65535) {
        return {
          ok: false,
          errors: [{ line, column: col, length: mnemonic.length, code: 'immediate-out-of-range', message: `Immediate value ${rawVal} exceeds 16-bit range (0..65535)` }],
          warnings,
        };
      }
    }

    const { value: fittedVal, truncated } = fitImmediateToSize(rawVal, deducedSize);
    if (truncated) {
      warnings.push({ line, column: col, code: 'immediate-truncated', message: `Immediate value ${rawVal} was truncated to fit ${deducedSize}-bit width` });
    }
    resolvedSrc = { ...resolvedSrc, value: fittedVal, size: deducedSize };
  }

  const finalDest = resolvedDest.kind === 'mem' ? { ...resolvedDest, size: deducedSize } : resolvedDest;
  const finalSrc = resolvedSrc.kind === 'mem' ? { ...resolvedSrc, size: deducedSize } : resolvedSrc;

  return {
    ok: true,
    instruction: { address, mnemonic, operands: [finalDest, finalSrc], size: deducedSize, sourceLine: line, sourceText },
    warnings,
    referencedLabels,
  };
}

function sizeMismatch(
  line: number,
  col: number,
  mnemonic: string,
  dSize: number,
  sSize: number,
  warnings: AssemblerWarning[]
): InstructionValidationResult {
  return {
    ok: false,
    errors: [{
      line, column: col, length: mnemonic.length, code: 'size-mismatch',
      message: `Operand size mismatch: destination is ${dSize}-bit, source is ${sSize}-bit`,
    }],
    warnings,
  };
}

function resolveMem(
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
