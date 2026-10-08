/**
 * @file tables.ts
 * Deterministic generation of characteristic tables, compact operation tables,
 * excitation lookup tables (for FSM synthesis), and characteristic Boolean equations.
 *
 * Immutability policy:
 * All table generators return fresh copy structures on each invocation.
 */

import type { BoolNode, LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import { parse } from '../boolean/parser';
import { inputNames, isInvalidInput, nextState, operationName } from './models';

/** Row entry in a full binary characteristic truth table. */
export interface CharacteristicTableRow {
  readonly index: number;
  readonly inputs: readonly LogicValue[];
  readonly q: LogicValue;
  readonly qNext: LogicValue;
  readonly operation: string;
  readonly invalid: boolean;
}

/** Row entry in a compact operational table. */
export interface CompactTableRow {
  readonly inputs: readonly (0 | 1)[];
  readonly qNextDescription: string;
  readonly operation: string;
}

/** Row entry in a flip-flop excitation table. */
export interface ExcitationTableRow {
  readonly q: 0 | 1;
  readonly qNext: 0 | 1;
  readonly inputs: Record<string, LogicValue>;
}

/** Alternate equivalent algebraic form representation. */
export interface AlternateForm {
  readonly text: string;
  readonly ast: BoolNode;
}

/** Characteristic Boolean next-state equation model. */
export interface CharacteristicEquation {
  readonly text: string;
  readonly ast: BoolNode;
  readonly variables: readonly string[];
  readonly constraint?: string;
  readonly alternateForms?: readonly AlternateForm[];
}

/**
 * Generates the complete characteristic truth table for a given flip-flop architecture.
 * Ordered by binary value of (inputs..., Q) with the first input as MSB and Q as LSB.
 */
export function characteristicTable(type: FlipFlopType): readonly CharacteristicTableRow[] {
  const names = inputNames(type);
  const inCount = names.length;
  const totalRows = 1 << (inCount + 1);
  const rows: CharacteristicTableRow[] = [];

  for (let idx = 0; idx < totalRows; idx++) {
    const inputs: (0 | 1)[] = [];
    for (let bit = inCount; bit >= 1; bit--) {
      inputs.push(((idx >> bit) & 1) as 0 | 1);
    }
    const q = (idx & 1) as 0 | 1;
    const invalid = isInvalidInput(type, inputs);
    const qNext = invalid ? 'X' : nextState(type, inputs, q);
    rows.push({
      index: idx,
      inputs,
      q,
      qNext,
      operation: operationName(type, inputs),
      invalid,
    });
  }
  return rows;
}

/**
 * Generates the compact operation summary table for a flip-flop type.
 */
export function compactTable(type: FlipFlopType): readonly CompactTableRow[] {
  switch (type) {
    case 'SR':
      return [
        { inputs: [0, 0], qNextDescription: 'Q', operation: 'Hold' },
        { inputs: [0, 1], qNextDescription: '0', operation: 'Reset' },
        { inputs: [1, 0], qNextDescription: '1', operation: 'Set' },
        { inputs: [1, 1], qNextDescription: 'Invalid', operation: 'Invalid' },
      ];
    case 'JK':
      return [
        { inputs: [0, 0], qNextDescription: 'Q', operation: 'Hold' },
        { inputs: [0, 1], qNextDescription: '0', operation: 'Reset' },
        { inputs: [1, 0], qNextDescription: '1', operation: 'Set' },
        { inputs: [1, 1], qNextDescription: "Q'", operation: 'Toggle' },
      ];
    case 'D':
      return [
        { inputs: [0], qNextDescription: '0', operation: 'Load 0' },
        { inputs: [1], qNextDescription: '1', operation: 'Load 1' },
      ];
    case 'T':
      return [
        { inputs: [0], qNextDescription: 'Q', operation: 'Hold' },
        { inputs: [1], qNextDescription: "Q'", operation: 'Toggle' },
      ];
  }
}

/**
 * Derives the required flip-flop input values for a specific state transition (Q -> Q+).
 *
 * Collects all non-invalid input combinations producing the transition:
 * - If all matching combinations agree on 0 or 1 for a pin, returns that value.
 * - If both 0 and 1 occur, returns 'X' (don't-care condition).
 *
 * ARCHITECTURAL NOTE: Stage 10 will call excitationInputs directly and treat "X" as a K-map don't-care.
 */
export function excitationInputs(type: FlipFlopType, q: LogicValue, qNext: LogicValue): Record<string, LogicValue> {
  const names = inputNames(type);
  const inCount = names.length;
  const numCombos = 1 << inCount;

  if (q === 'X' || qNext === 'X') {
    const fallback: Record<string, LogicValue> = {};
    for (const name of names) fallback[name] = 'X';
    return fallback;
  }

  const validMatches: (0 | 1)[][] = [];
  for (let idx = 0; idx < numCombos; idx++) {
    const inputs: (0 | 1)[] = [];
    for (let bit = inCount - 1; bit >= 0; bit--) inputs.push(((idx >> bit) & 1) as 0 | 1);
    if (!isInvalidInput(type, inputs) && nextState(type, inputs, q) === qNext) {
      validMatches.push(inputs);
    }
  }

  const result: Record<string, LogicValue> = {};
  for (let pinIdx = 0; pinIdx < inCount; pinIdx++) {
    const pinName = names[pinIdx] ?? `in${pinIdx}`;
    const seenValues = new Set<0 | 1>();
    for (const match of validMatches) {
      const val = match[pinIdx];
      if (val !== undefined) seenValues.add(val);
    }
    result[pinName] = seenValues.size === 1 ? (seenValues.has(1) ? 1 : 0) : 'X';
  }
  return result;
}

const EXCITATION_TRANSITIONS: readonly (readonly [0 | 1, 0 | 1])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

/**
 * Generates the complete 4-row excitation table for a flip-flop.
 */
export function excitationTable(type: FlipFlopType): readonly ExcitationTableRow[] {
  return EXCITATION_TRANSITIONS.map(([q, qNext]) => ({
    q,
    qNext,
    inputs: excitationInputs(type, q, qNext),
  }));
}

/**
 * Generates the characteristic next-state Boolean equation and AST for a flip-flop.
 * Uses the Stage 4A parser to build authoritative Abstract Syntax Trees.
 */
export function characteristicEquation(type: FlipFlopType): CharacteristicEquation {
  switch (type) {
    case 'SR': {
      const parsed = parse("S + R'Q");
      if (!parsed.ok || !parsed.ast) throw new Error('Failed to parse SR equation');
      return { text: "S + R'Q", ast: parsed.ast, variables: ['S', 'R', 'Q'], constraint: 'S.R = 0' };
    }
    case 'JK': {
      const parsed = parse("JQ' + K'Q");
      if (!parsed.ok || !parsed.ast) throw new Error('Failed to parse JK equation');
      return { text: "JQ' + K'Q", ast: parsed.ast, variables: ['J', 'K', 'Q'] };
    }
    case 'D': {
      const parsed = parse('D');
      if (!parsed.ok || !parsed.ast) throw new Error('Failed to parse D equation');
      return { text: 'D', ast: parsed.ast, variables: ['D', 'Q'] };
    }
    case 'T': {
      const parsedPrimary = parse("TQ' + T'Q");
      const parsedXor = parse('T ^ Q');
      if (!parsedPrimary.ok || !parsedPrimary.ast || !parsedXor.ok || !parsedXor.ast) {
        throw new Error('Failed to parse T equation');
      }
      return {
        text: "TQ' + T'Q",
        ast: parsedPrimary.ast,
        variables: ['T', 'Q'],
        alternateForms: [{ text: 'T ^ Q', ast: parsedXor.ast }],
      };
    }
  }
}
