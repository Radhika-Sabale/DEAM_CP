/**
 * @file disassembler.ts
 * Disassembles a decoded Program back into canonical 8086 assembly source code.
 * Ensures that re-assembling the disassembled source produces an identical program.
 */

import type { Instruction, Operand, Program } from './types';

/**
 * Disassembles a Program into canonical 8086 assembly source text.
 */
export function disassemble(program: Program): string {
  const lines: string[] = [];

  // 1. Data section
  if (program.dataSegments.length > 0) {
    lines.push('.data');
    for (const seg of program.dataSegments) {
      const defaultOrg = program.usesInterrupts ? 0x0400 : 0x0100;
      if (seg.address !== defaultOrg) {
        lines.push(`ORG 0x${seg.address.toString(16).toUpperCase()}`);
      }

      // Group symbols by address
      const dataSymbolsByAddr: Record<number, string[]> = {};
      for (const sym of Object.values(program.symbols)) {
        if (sym.kind === 'data') {
          if (!dataSymbolsByAddr[sym.address]) dataSymbolsByAddr[sym.address] = [];
          dataSymbolsByAddr[sym.address]?.push(sym.name);
        }
      }

      let offset = 0;
      while (offset < seg.bytes.length) {
        const currentAddr = seg.address + offset;
        const symNames = dataSymbolsByAddr[currentAddr];
        if (symNames && symNames.length > 0) {
          for (const s of symNames) {
            lines.push(`${s}:`);
          }
        }

        // Emit up to 16 bytes per DB line
        const chunk = seg.bytes.slice(offset, offset + 16);
        lines.push(`DB ${chunk.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', ')}`);
        offset += chunk.length;
      }
    }
  }

  // 2. Code section
  lines.push('.code');

  if (program.installedVectors && program.installedVectors.length > 0) {
    for (const v of program.installedVectors) {
      lines.push(`VECTOR ${v.vector}, ${v.label}`);
    }
  }

  // Map code symbols to instruction address
  const codeSymbolsByAddr: Record<number, string[]> = {};
  for (const sym of Object.values(program.symbols)) {
    if (sym.kind === 'code') {
      if (!codeSymbolsByAddr[sym.address]) codeSymbolsByAddr[sym.address] = [];
      codeSymbolsByAddr[sym.address]?.push(sym.name);
    }
  }

  for (const inst of program.instructions) {
    const syms = codeSymbolsByAddr[inst.address];
    if (syms) {
      for (const s of syms) {
        lines.push(`${s}:`);
      }
    }
    lines.push(formatInstruction(inst));
  }

  return lines.join('\n');
}

function formatInstruction(inst: Instruction): string {
  if (inst.operands.length === 0) {
    return inst.mnemonic;
  }
  const formattedOps = inst.operands.map((op) => formatOperand(op));
  return `${inst.mnemonic} ${formattedOps.join(', ')}`;
}

function formatOperand(op: Operand): string {
  switch (op.kind) {
    case 'reg':
      return op.name;

    case 'imm':
      if (op.label) return op.label;
      return String(op.value);

    case 'label':
      return op.name;

    case 'mem': {
      const parts: string[] = [];
      if (op.label) parts.push(op.label);
      if (op.base) parts.push(op.base);
      if (op.index) parts.push(op.index);
      let inner = parts.join(' + ');
      if (op.disp !== 0 && !op.label) {
        if (inner.length > 0) {
          inner += op.disp > 0 ? ` + ${op.disp}` : ` - ${Math.abs(op.disp)}`;
        } else {
          inner = String(op.disp);
        }
      }
      const bracketStr = `[${inner}]`;
      if (op.size) {
        return `${op.size === 8 ? 'BYTE PTR ' : 'WORD PTR '}${bracketStr}`;
      }
      return bracketStr;
    }
  }
}
