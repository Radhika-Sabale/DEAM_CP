/**
 * @file assembler.ts
 * Two-pass 8086 Assembler.
 * Converts 8086 assembly source code into a decoded Program representation
 * with deterministic error handling (up to 50 errors in source order) and warnings.
 */

import type {
  AssemblerError,
  AssemblerResult,
  AssemblerWarning,
  CanonicalMnemonic,
  DataSegment,
  Instruction,
  Program,
  SectionKind,
  SymbolEntry,
} from './types';
import { isRegister, resolveMnemonic } from './isa';
import { tokenizeLine, type Token } from './lexer';
import { parseDataDefinition, parseOrgDirective } from './dataParser';
import { parseOperand } from './operandParser';
import { validateAndResolveInstruction } from './instructionValidator';
import { checkAssemblyWarnings, findEntryPoint, splitOperandTokens } from './assemblerHelpers';
import { parseVectorDirective, resolveVectorDirectives, type RawVector } from './vectorParser';

interface RawInstruction {
  readonly address: number;
  readonly mnemonic: CanonicalMnemonic;
  readonly operandTokens: readonly (readonly Token[])[];
  readonly sourceLine: number;
  readonly sourceText: string;
  readonly col: number;
}

const MAX_ERRORS = 50;

/**
 * Assembles 8086 assembly source text into a decoded Program structure.
 */
export function assemble(source: string): AssemblerResult {
  const lines = source.split(/\r?\n/);
  let endEntryLabel: string | undefined;
  const endLineIndex = lines.findIndex((line) => {
    const clean = line.replace(/;.*$/, '');
    const match = /^\s*END(?:\s+([A-Za-z_][\w]*))?\s*$/i.exec(clean);
    if (match) endEntryLabel = match[1];
    return Boolean(match);
  });
  if (endLineIndex >= 0) lines.splice(endLineIndex + 1);
  const errors: AssemblerError[] = [];
  const warnings: AssemblerWarning[] = [];
  const symbols: Record<string, SymbolEntry> = {};
  const referencedLabels = new Set<string>();

  // Pre-scan: detect if program utilizes any interrupt features
  let usesInterrupts = false;
  for (const line of lines) {
    const clean = line.replace(/;.*$/, '');
    if (/\b(INT|IRET|CLI|STI|PUSHF|POPF|VECTOR)\b/i.test(clean)) {
      usesInterrupts = true;
      break;
    }
  }

  let section: SectionKind = '.code';
  let orgAddr = usesInterrupts ? 0x0400 : 0x0100;
  let currentDataAddr = orgAddr;
  let hasExplicitOrg = false;
  let orgLine = -1;
  let orgCol = 1;
  let orgLen = 3;
  let firstDataLine = -1;
  let hasEmittedData = false;
  const dataBytes: number[] = [];

  const rawVectors: RawVector[] = [];
  const rawInstructions: RawInstruction[] = [];
  let instructionIndex = 0;
  const labelsByCodeAddress: Record<number, string> = {};

  // ==========================================
  // PASS 1: Tokenize, Sections, Symbols & Data
  // ==========================================
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const lineText = lines[lineIdx] ?? '';
    const { tokens, errors: lexErrors } = tokenizeLine(lineText, lineNum);
    errors.push(...lexErrors);

    if (tokens.length === 0 || lexErrors.length > 0) continue;

    // Check for section switch
    const firstTok = tokens[0];
    if (firstTok?.kind === 'DOT_IDENT') {
      const lower = firstTok.text.toLowerCase();
      if (lower === '.data') section = '.data';
      else if (lower === '.code') section = '.code';
      else errors.push({ line: lineNum, column: firstTok.column, length: firstTok.length, code: 'unknown-directive', message: `Unknown directive '${firstTok.text}'` });
      continue;
    }

    let tokenIdx = 0;
    // Check for label definition: IDENT followed by COLON
    if (tokens.length >= 2 && tokens[0]?.kind === 'IDENT' && tokens[1]?.kind === 'COLON') {
      const labelTok = tokens[0];
      const labelName = labelTok.text;
      tokenIdx = 2;

      if (isRegister(labelName)) {
        errors.push({ line: lineNum, column: labelTok.column, length: labelTok.length, code: 'duplicate-label', message: `Label cannot be a register name: '${labelName}'` });
      } else if (resolveMnemonic(labelName) && labelName.toUpperCase() !== 'LOOP') {
        errors.push({ line: lineNum, column: labelTok.column, length: labelTok.length, code: 'duplicate-label', message: `Label cannot be an instruction mnemonic: '${labelName}'` });
      } else if (symbols[labelName]) {
        const existing = symbols[labelName];
        if (existing.kind !== (section === '.code' ? 'code' : 'data')) {
          errors.push({ line: lineNum, column: labelTok.column, length: labelTok.length, code: 'label-code-and-data', message: `Label '${labelName}' cannot be defined in both .code and .data sections` });
        } else {
          errors.push({ line: lineNum, column: labelTok.column, length: labelTok.length, code: 'duplicate-label', message: `Duplicate label '${labelName}' defined on line ${lineNum}` });
        }
      } else {
        if (section === '.code') {
          symbols[labelName] = { name: labelName, kind: 'code', address: instructionIndex };
          labelsByCodeAddress[instructionIndex] = labelName;
        } else {
          symbols[labelName] = { name: labelName, kind: 'data', address: currentDataAddr };
        }
      }
    }

    const remainingTokens = tokens.slice(tokenIdx);
    if (remainingTokens.length === 0) continue;

    const opTok = remainingTokens[0];
    if (!opTok || opTok.kind !== 'IDENT') {
      errors.push({ line: lineNum, column: opTok?.column ?? 1, length: opTok?.length ?? 1, code: 'invalid-operand-form', message: `Unexpected token '${opTok?.text ?? ''}'` });
      continue;
    }

    const opUpper = opTok.text.toUpperCase();

    if (opUpper === 'END') continue;

    if (section === '.data') {
      if (opUpper === 'ORG') {
        if (hasEmittedData) {
          errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'misplaced-org', message: 'ORG directive is only allowed at the beginning of the .data section' });
        } else {
          hasExplicitOrg = true;
          orgLine = lineNum;
          orgCol = opTok.column;
          orgLen = opTok.length;
          const orgRes = parseOrgDirective(remainingTokens.slice(1));
          if (orgRes.ok) { orgAddr = orgRes.address; currentDataAddr = orgRes.address; }
          else errors.push(orgRes.error);
        }
        continue;
      }
      if (opUpper === 'DB' || opUpper === 'DW') {
        hasEmittedData = true;
        if (firstDataLine === -1) firstDataLine = lineNum;
        const dataRes = parseDataDefinition(opUpper, remainingTokens.slice(1), currentDataAddr);
        if (dataRes.ok) {
          dataBytes.push(...dataRes.result.bytes);
          currentDataAddr += dataRes.result.bytes.length;
        } else errors.push(dataRes.error);
        continue;
      }
      if (resolveMnemonic(opUpper)) {
        errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'misplaced-directive', message: `Instruction '${opTok.text}' is not allowed in .data section` });
      } else {
        errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'unknown-directive', message: `Unknown directive '${opTok.text}' in .data section` });
      }
    } else {
      // section === '.code'
      if (opUpper === 'DB' || opUpper === 'DW' || opUpper === 'ORG') {
        errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'misplaced-directive', message: `Data directive '${opTok.text}' is not allowed in .code section` });
        continue;
      }

      if (opUpper === 'VECTOR') {
        const vRes = parseVectorDirective(remainingTokens.slice(1), lineNum, opTok.column, opTok.length);
        if (vRes.ok) rawVectors.push(vRes.rawVector);
        else errors.push(vRes.error);
        continue;
      }

      const canonical = resolveMnemonic(opUpper);
      if (!canonical) {
        errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'unknown-mnemonic', message: `Unknown mnemonic: '${opTok.text}'` });
        continue;
      }

      if (instructionIndex >= 4096) {
        errors.push({ line: lineNum, column: opTok.column, length: opTok.length, code: 'program-too-large', message: 'Program exceeds maximum limit of 4096 instructions' });
        break;
      }

      const opGroups = splitOperandTokens(remainingTokens.slice(1));
      rawInstructions.push({
        address: instructionIndex++,
        mnemonic: canonical,
        operandTokens: opGroups,
        sourceLine: lineNum,
        sourceText: lineText.trim(),
        col: opTok.column,
      });
    }
  }

  // Check data origin warning and IVT overlap errors
  if (usesInterrupts && hasEmittedData) {
    if (!hasExplicitOrg) {
      warnings.push({
        line: firstDataLine > 0 ? firstDataLine : 1,
        column: 1,
        code: 'default-origin-0x0400',
        message: 'data origin defaulted to 0x0400 because the program uses interrupts',
      });
    }
    if (orgAddr < 0x0400) {
      errors.push({
        line: orgLine > 0 ? orgLine : firstDataLine > 0 ? firstDataLine : 1,
        column: orgCol,
        length: orgLen,
        code: 'data-overlaps-ivt',
        message: 'Data overlaps IVT (0x0000-0x03FF)',
      });
    }
  }

  // ==========================================
  // PASS 2: Parse Operands & Validate Instructions
  // ==========================================
  const instructions: Instruction[] = [];

  for (const raw of rawInstructions) {
    const parsedOperands = [];
    let operandError = false;

    for (const group of raw.operandTokens) {
      const opRes = parseOperand(group);
      if (opRes.ok) parsedOperands.push(opRes.operand);
      else { errors.push(opRes.error); operandError = true; }
    }

    if (!operandError) {
      const vRes = validateAndResolveInstruction(
        raw.address, raw.mnemonic, parsedOperands, raw.sourceLine, raw.sourceText, symbols, raw.col
      );
      if (vRes.ok) {
        instructions.push(vRes.instruction);
        warnings.push(...vRes.warnings);
        vRes.referencedLabels.forEach((lbl) => referencedLabels.add(lbl));
      } else {
        errors.push(...vRes.errors);
        warnings.push(...vRes.warnings);
      }
    }
  }

  // Resolve VECTOR directives
  const installedVectors = resolveVectorDirectives(
    rawVectors,
    symbols,
    errors,
    warnings,
    referencedLabels
  );

  // Warnings: unreachable code, unused labels, missing HLT
  checkAssemblyWarnings(instructions, symbols, referencedLabels, labelsByCodeAddress, warnings);

  errors.sort((a, b) => a.line - b.line || a.column - b.column);
  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, MAX_ERRORS), warnings };
  }

  const dataSegments: DataSegment[] = dataBytes.length > 0 ? [{ address: orgAddr, bytes: dataBytes }] : [];
  let entryPoint = findEntryPoint(symbols, instructions.length);
  if (endEntryLabel) {
    const entrySymbol = symbols[endEntryLabel];
    if (!entrySymbol || entrySymbol.kind !== 'code') {
      return { ok: false, errors: [{ line: endLineIndex + 1, column: 1, length: 3, code: 'undefined-label', message: `END entry label '${endEntryLabel}' is not a defined code label` }], warnings };
    }
    entryPoint = entrySymbol.address;
  }

  const program: Program = {
    instructions,
    dataSegments,
    symbols,
    entryPoint,
    installedVectors,
    usesInterrupts,
  };
  return { ok: true, program, symbols, warnings };
}
