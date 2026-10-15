/**
 * @file operandParser.ts
 * Parses 8086 assembly operands from token sequences: registers, immediates,
 * memory references ([disp], [label], [base+index+disp]), and label references.
 */

import type { AssemblerError, BaseRegister, IndexRegister, Operand, RegisterName } from './types';
import type { Token } from './lexer';
import { getRegisterName, getRegisterSize, isRegister } from './isa';

export type ParsedOperandResult =
  | { readonly ok: true; readonly operand: Operand }
  | { readonly ok: false; readonly error: AssemblerError };

const UNMODELED_REGISTERS = new Set([
  'BP', 'CS', 'DS', 'SS', 'ES', 'FS', 'GS',
  'EAX', 'EBX', 'ECX', 'EDX', 'ESP', 'EBP', 'ESI', 'EDI',
]);

/**
 * Parses an operand token slice into a structured Operand record.
 */
export function parseOperand(tokens: readonly Token[]): ParsedOperandResult {
  const first = tokens[0];
  if (!first) {
    return {
      ok: false,
      error: { line: 1, column: 1, length: 1, code: 'invalid-operand-form', message: 'Missing operand' },
    };
  }

  let explicitSize: 8 | 16 | undefined;
  let workTokens = tokens;

  // 1. Check for BYTE PTR or WORD PTR prefix
  if (workTokens.length >= 2) {
    const t0 = workTokens[0];
    const t1 = workTokens[1];
    if (t0 && t1 && t0.kind === 'IDENT' && t1.kind === 'IDENT') {
      const w0 = t0.text.toUpperCase();
      const w1 = t1.text.toUpperCase();
      if ((w0 === 'BYTE' || w0 === 'WORD') && w1 === 'PTR') {
        explicitSize = w0 === 'BYTE' ? 8 : 16;
        workTokens = workTokens.slice(2);
        if (workTokens.length === 0) {
          return {
            ok: false,
            error: {
              line: t0.line,
              column: t0.column,
              length: t0.length + 1 + t1.length,
              code: 'invalid-operand-form',
              message: `Incomplete ${w0} PTR specification`,
            },
          };
        }
      }
    }
  }

  const baseToken = workTokens[0];
  if (!baseToken) {
    return {
      ok: false,
      error: { line: 1, column: 1, length: 1, code: 'invalid-operand-form', message: 'Missing operand' },
    };
  }

  // 2. Memory operand: starts with '[' and ends with ']'
  if (baseToken.kind === 'LBRACKET') {
    return parseMemoryOperand(workTokens, explicitSize);
  }

  // 3. Register operand
  if (workTokens.length === 1 && baseToken.kind === 'IDENT') {
    const rawUpper = baseToken.text.toUpperCase();
    if (isRegister(rawUpper)) {
      const regName = getRegisterName(rawUpper) as RegisterName;
      const regSize = getRegisterSize(rawUpper) as 8 | 16;
      if (explicitSize !== undefined && explicitSize !== regSize) {
        return {
          ok: false,
          error: {
            line: baseToken.line,
            column: baseToken.column,
            length: baseToken.length,
            code: 'size-mismatch',
            message: `Explicit size ${explicitSize}-bit conflicts with register ${regName} (${regSize}-bit)`,
          },
        };
      }
      return { ok: true, operand: { kind: 'reg', name: regName, size: regSize } };
    }

    if (UNMODELED_REGISTERS.has(rawUpper)) {
      return {
        ok: false,
        error: {
          line: baseToken.line,
          column: baseToken.column,
          length: baseToken.length,
          code: 'unknown-register',
          message: `Register '${baseToken.text}' is not modeled in this 8086 teaching subset`,
        },
      };
    }

    // Bare identifier: could be a label (code jump or immediate data address)
    return {
      ok: true,
      operand: { kind: 'label', name: baseToken.text },
    };
  }

  // 4. Immediate Number / Char Literal / Signed Number
  if (
    workTokens.length === 1 &&
    (baseToken.kind === 'NUMBER' || baseToken.kind === 'CHAR')
  ) {
    const val = baseToken.numValue ?? 0;
    return { ok: true, operand: { kind: 'imm', value: val, ...(explicitSize ? { size: explicitSize } : {}) } };
  }

  // Signed immediate: -5 or +5
  const s0 = workTokens[0];
  const s1 = workTokens[1];
  if (workTokens.length === 2 && (s0?.kind === 'MINUS' || s0?.kind === 'PLUS') && (s1?.kind === 'NUMBER' || s1?.kind === 'CHAR')) {
    const sign = s0.kind === 'MINUS' ? -1 : 1;
    const absVal = s1.numValue ?? 0;
    return { ok: true, operand: { kind: 'imm', value: sign * absVal, ...(explicitSize ? { size: explicitSize } : {}) } };
  }

  return {
    ok: false,
    error: {
      line: baseToken.line, column: baseToken.column, length: baseToken.length,
      code: 'invalid-operand-form', message: `Invalid operand syntax: "${workTokens.map((t) => t.text).join(' ')}"`,
    },
  };
}

/**
 * Parses memory bracket syntax: [disp], [label], [BX], [SI], [DI], [BX+SI], [BX+DI] + disp.
 */
function parseMemoryOperand(
  tokens: readonly Token[],
  explicitSize?: 8 | 16
): ParsedOperandResult {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (!first || !last || first.kind !== 'LBRACKET' || last.kind !== 'RBRACKET') {
    return {
      ok: false,
      error: { line: first?.line ?? 1, column: first?.column ?? 1, length: 1, code: 'invalid-operand-form', message: 'Malformed memory operand; expected [ ... ]' },
    };
  }

  const inner = tokens.slice(1, -1);
  if (inner.length === 0) {
    return {
      ok: false,
      error: { line: first.line, column: first.column, length: 2, code: 'invalid-operand-form', message: 'Empty memory brackets []' },
    };
  }

  let base: BaseRegister | undefined;
  let index: IndexRegister | undefined;
  let disp = 0;
  let label: string | undefined;

  let currentSign: 1 | -1 = 1;
  let idx = 0;

  while (idx < inner.length) {
    const tok = inner[idx];
    if (!tok) break;

    if (tok.kind === 'PLUS') {
      currentSign = 1;
      idx++;
      continue;
    }
    if (tok.kind === 'MINUS') {
      currentSign = -1;
      idx++;
      continue;
    }

    if (tok.kind === 'IDENT') {
      const upper = tok.text.toUpperCase();
      if (upper === 'BX') {
        if (base) {
          return memErr(tok, 'duplicate-base', 'Base register BX specified multiple times');
        }
        base = 'BX';
      } else if (upper === 'SI' || upper === 'DI') {
        if (index) {
          return memErr(tok, 'invalid-operand-form', `Cannot combine index registers (already has ${index})`);
        }
        index = upper as IndexRegister;
      } else if (isRegister(upper)) {
        return memErr(tok, 'invalid-operand-form', `Register ${upper} cannot be used in memory addressing (only BX, SI, DI)`);
      } else if (UNMODELED_REGISTERS.has(upper)) {
        return memErr(tok, 'unknown-register', `Register '${tok.text}' is not modeled in this 8086 teaching subset`);
      } else {
        if (label) {
          return memErr(tok, 'invalid-operand-form', `Multiple labels in memory operand: ${label} and ${tok.text}`);
        }
        label = tok.text;
      }
      idx++;
      continue;
    }

    if (tok.kind === 'NUMBER' || tok.kind === 'CHAR') {
      const val = tok.numValue ?? 0;
      disp += currentSign * val;
      idx++;
      continue;
    }

    return memErr(tok, 'invalid-operand-form', `Unexpected token in memory brackets: "${tok.text}"`);
  }

  return {
    ok: true,
    operand: {
      kind: 'mem',
      ...(base ? { base } : {}),
      ...(index ? { index } : {}),
      disp,
      ...(label ? { label } : {}),
      ...(explicitSize ? { size: explicitSize } : {}),
    },
  };
}

function memErr(tok: Token, code: string, message: string): ParsedOperandResult {
  return {
    ok: false,
    error: { line: tok.line, column: tok.column, length: tok.length, code, message },
  };
}
