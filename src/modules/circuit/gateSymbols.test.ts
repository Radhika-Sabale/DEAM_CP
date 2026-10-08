/**
 * @file gateSymbols.test.ts
 * Unit tests for SVG gate symbol metadata, paths, bubbles, and accessible names.
 */

import { describe, it, expect } from 'vitest';
import type { CircuitNode, GateType } from '../../types/circuit';
import { GATE_SYMBOLS, getNodeAccessibleName, getNodeSymbolText } from './gateSymbols';

describe('gateSymbols', () => {
  const allGateTypes: GateType[] = ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT'];

  it('contains complete metadata for all 7 standard logic gate types', () => {
    for (const type of allGateTypes) {
      const sym = GATE_SYMBOLS[type];
      expect(sym).toBeDefined();
      expect(sym.type).toBe(type);
      expect(sym.name).toBeTruthy();
      expect(sym.path).toBeTruthy();
      expect(sym.baseWidth).toBeGreaterThan(0);
      expect(sym.baseHeight).toBeGreaterThan(0);
      expect(sym.minInputCount).toBeGreaterThanOrEqual(1);
      expect(sym.maxInputCount).toBeGreaterThanOrEqual(sym.minInputCount);
    }
  });

  it('correctly sets inversion bubble flags for inverting gate types', () => {
    expect(GATE_SYMBOLS.NOT.hasBubble).toBe(true);
    expect(GATE_SYMBOLS.NAND.hasBubble).toBe(true);
    expect(GATE_SYMBOLS.NOR.hasBubble).toBe(true);
    expect(GATE_SYMBOLS.XNOR.hasBubble).toBe(true);

    expect(GATE_SYMBOLS.AND.hasBubble).toBe(false);
    expect(GATE_SYMBOLS.OR.hasBubble).toBe(false);
    expect(GATE_SYMBOLS.XOR.hasBubble).toBe(false);
  });

  it('includes separate input arc path for XOR and XNOR gates', () => {
    expect(GATE_SYMBOLS.XOR.inputArcPath).toBeDefined();
    expect(GATE_SYMBOLS.XNOR.inputArcPath).toBeDefined();
    expect(GATE_SYMBOLS.AND.inputArcPath).toBeUndefined();
  });

  it('formats accessible names for all node kinds', () => {
    const inputNode: CircuitNode = { id: 'in_a', kind: 'input', label: 'A', value: 1, x: 0, y: 0 };
    expect(getNodeAccessibleName(inputNode)).toBe('Input toggle A (in_a), current value 1');

    const outputNode: CircuitNode = { id: 'out_s', kind: 'output', label: 'Sum', x: 0, y: 0 };
    expect(getNodeAccessibleName(outputNode, '1')).toBe('Output probe Sum (out_s), output 1');

    const gateNode: CircuitNode = {
      id: 'g_nand',
      kind: 'gate',
      gateType: 'NAND',
      inputCount: 3,
      label: 'MainNAND',
      x: 0,
      y: 0,
    };
    expect(getNodeAccessibleName(gateNode, '0')).toBe("NAND Gate 'MainNAND' (g_nand, 3 inputs), output 0");

    const clockNode: CircuitNode = { id: 'clk1', kind: 'clock', label: 'CLK', halfPeriod: 5, startValue: 0, x: 0, y: 0 };
    expect(getNodeAccessibleName(clockNode)).toBe('Clock source CLK (clk1), half period 5 units');

    const constNode: CircuitNode = { id: 'c1', kind: 'const', value: 1, x: 0, y: 0 };
    expect(getNodeAccessibleName(constNode)).toBe('Constant 1 source (c1)');
  });

  it('returns short visible display symbols', () => {
    expect(getNodeSymbolText({ id: 'in_a', kind: 'input', label: 'A', value: 0, x: 0, y: 0 })).toBe('A');
    expect(getNodeSymbolText({ id: 'g1', kind: 'gate', gateType: 'XOR', inputCount: 2, x: 0, y: 0 })).toBe('XOR');
    expect(getNodeSymbolText({ id: 'c1', kind: 'const', value: 0, x: 0, y: 0 })).toBe('0');
  });
});
