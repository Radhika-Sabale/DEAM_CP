/**
 * @file assemblerHelpers.ts
 * Helper functions for operand splitting, warning analysis, and entry point resolution.
 */

import type { AssemblerWarning, Instruction, SymbolEntry } from './types';
import type { Token } from './lexer';
import { isTerminatingInstruction } from './isa';

/**
 * Splits operand tokens by top-level commas (outside brackets).
 */
export function splitOperandTokens(tokens: readonly Token[]): Token[][] {
  const groups: Token[][] = [];
  let cur: Token[] = [];
  let bracketDepth = 0;

  for (const t of tokens) {
    if (t.kind === 'LBRACKET') bracketDepth++;
    else if (t.kind === 'RBRACKET') bracketDepth--;

    if (t.kind === 'COMMA' && bracketDepth === 0) {
      if (cur.length > 0) groups.push(cur);
      cur = [];
    } else {
      cur.push(t);
    }
  }
  if (cur.length > 0) groups.push(cur);
  return groups;
}

/**
 * Checks for unused labels, unreachable instructions, and missing HLT.
 */
export function checkAssemblyWarnings(
  instructions: readonly Instruction[],
  symbols: Record<string, SymbolEntry>,
  referencedLabels: Set<string>,
  labelsByCodeAddress: Record<number, string>,
  warnings: AssemblerWarning[]
): void {
  for (const [name, sym] of Object.entries(symbols)) {
    if (name.toLowerCase() !== 'start' && !referencedLabels.has(name)) {
      warnings.push({ line: 1, column: 1, code: 'unused-label', message: `Label '${sym.name}' is defined but never used` });
    }
  }

  for (let i = 0; i < instructions.length - 1; i++) {
    const cur = instructions[i];
    const next = instructions[i + 1];
    if (cur && next && isTerminatingInstruction(cur.mnemonic)) {
      if (!labelsByCodeAddress[next.address]) {
        warnings.push({ line: next.sourceLine, column: 1, code: 'unreachable-code', message: `Unreachable code after ${cur.mnemonic} at line ${next.sourceLine}` });
      }
    }
  }

  if (instructions.length > 0) {
    const last = instructions[instructions.length - 1];
    if (last && last.mnemonic !== 'HLT' && last.mnemonic !== 'RET') {
      warnings.push({ line: last.sourceLine, column: 1, code: 'missing-hlt', message: 'Program does not terminate with HLT' });
    }
  }
}

/**
 * Resolves entry point: looks for code label 'start', else defaults to 0.
 */
export function findEntryPoint(symbols: Record<string, SymbolEntry>, instructionCount: number): number {
  for (const [name, sym] of Object.entries(symbols)) {
    if (name.toLowerCase() === 'start' && sym.kind === 'code') return sym.address;
  }
  return instructionCount > 0 ? 0 : 0;
}
