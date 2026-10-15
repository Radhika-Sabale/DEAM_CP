/**
 * @file vectorParser.ts
 * Parser and validator for the 8086 VECTOR n, label directive.
 */

import type { AssemblerError, AssemblerWarning } from './types';
import type { Token } from './lexer';
import { splitOperandTokens } from './assemblerHelpers';

export interface RawVector {
  readonly vector: number;
  readonly labelName: string;
  readonly line: number;
  readonly col: number;
  readonly labelCol: number;
  readonly labelLen: number;
}

export type ParseVectorResult =
  | { readonly ok: true; readonly rawVector: RawVector }
  | { readonly ok: false; readonly error: AssemblerError };

/**
 * Parses operand tokens for the `VECTOR n, label` directive.
 */
export function parseVectorDirective(
  operandTokens: readonly Token[],
  lineNum: number,
  col: number,
  len: number
): ParseVectorResult {
  const groups = splitOperandTokens(operandTokens);
  if (groups.length !== 2) {
    return {
      ok: false,
      error: {
        line: lineNum,
        column: col,
        length: len,
        code: 'wrong-operand-count',
        message: `Directive VECTOR expects 2 operand(s), got ${groups.length}`,
      },
    };
  }

  const vTokens = groups[0];
  const lTokens = groups[1];
  const vFirst = vTokens?.[0];

  if (!vFirst || vFirst.kind !== 'NUMBER' || vFirst.numValue === undefined) {
    return {
      ok: false,
      error: {
        line: lineNum,
        column: vFirst?.column ?? col,
        length: vFirst?.length ?? 1,
        code: 'invalid-operand-form',
        message: 'VECTOR vector must be an immediate number',
      },
    };
  }

  const val = vFirst.numValue;

  if (isNaN(val) || val < 0 || val > 255) {
    return {
      ok: false,
      error: {
        line: lineNum,
        column: vFirst.column,
        length: vFirst.length,
        code: 'vector-out-of-range',
        message: `Vector number ${vFirst.text} out of range (0..255)`,
      },
    };
  }

  const lFirst = lTokens?.[0];
  if (!lFirst || lFirst.kind !== 'IDENT') {
    return {
      ok: false,
      error: {
        line: lineNum,
        column: lFirst?.column ?? col,
        length: lFirst?.length ?? 1,
        code: 'invalid-operand-form',
        message: 'VECTOR target must be a label',
      },
    };
  }

  return {
    ok: true,
    rawVector: {
      vector: val,
      labelName: lFirst.text,
      line: lineNum,
      col,
      labelCol: lFirst.column,
      labelLen: lFirst.length,
    },
  };
}

/**
 * Resolves raw VECTOR directives against symbol definitions in Pass 2.
 */
export function resolveVectorDirectives(
  rawVectors: readonly RawVector[],
  symbols: Readonly<Record<string, { kind: 'code' | 'data'; address: number; name: string }>>,
  errors: AssemblerError[],
  warnings: AssemblerWarning[],
  referencedLabels: Set<string>
): readonly { readonly vector: number; readonly handlerAddress: number; readonly label: string }[] {
  const installedVectors = [];
  for (const rv of rawVectors) {
    const sym = symbols[rv.labelName];
    if (!sym) {
      errors.push({
        line: rv.line,
        column: rv.labelCol,
        length: rv.labelLen,
        code: 'undefined-label',
        message: `Undefined label '${rv.labelName}' in VECTOR directive`,
      });
    } else if (sym.kind !== 'code') {
      errors.push({
        line: rv.line,
        column: rv.labelCol,
        length: rv.labelLen,
        code: 'vector-target-is-data-label',
        message: `Vector target '${rv.labelName}' is a data label, expected code label`,
      });
    } else {
      if (sym.address === 0) {
        warnings.push({
          line: rv.line,
          column: rv.col,
          code: 'vector-at-zero',
          message: 'Handler at instruction address 0 is not supported through the IVT',
        });
      }
      referencedLabels.add(rv.labelName);
      installedVectors.push({
        vector: rv.vector,
        handlerAddress: sym.address,
        label: rv.labelName,
      });
    }
  }
  return installedVectors;
}

