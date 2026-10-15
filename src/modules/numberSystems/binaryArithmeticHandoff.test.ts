/**
 * @file binaryArithmeticHandoff.test.ts
 * Unit tests for binary arithmetic handoff routines and operand conversion.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { executeAluHandoff, operandToUnsigned } from './binaryArithmeticHandoff';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

describe('binaryArithmeticHandoff', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useUiStore.setState({ currentModule: 'number-systems' });
  });

  describe('operandToUnsigned', () => {
    it('converts positive numbers and strings within width', () => {
      expect(operandToUnsigned(5, 4)).toBe(5);
      expect(operandToUnsigned('5', 4)).toBe(5);
      expect(operandToUnsigned('0101', 4)).toBe(5);
    });

    it('converts negative signed numbers and decimal strings to unsigned bit pattern', () => {
      // 4-bit: -3 is 13 (1101_2)
      expect(operandToUnsigned(-3, 4)).toBe(13);
      expect(operandToUnsigned('-3', 4)).toBe(13);

      // 4-bit: -1 is 15 (1111_2)
      expect(operandToUnsigned(-1, 4)).toBe(15);
      expect(operandToUnsigned('-1', 4)).toBe(15);

      // 8-bit: -128 is 128 (10000000_2)
      expect(operandToUnsigned(-128, 8)).toBe(128);
      expect(operandToUnsigned('-128', 8)).toBe(128);

      // 8-bit: -1 is 255 (11111111_2)
      expect(operandToUnsigned(-1, 8)).toBe(255);
      expect(operandToUnsigned('-1', 8)).toBe(255);
    });

    it('handles out of range bits by masking to specified bit width', () => {
      expect(operandToUnsigned(17, 4)).toBe(1); // 17 = 0b10001, 4-bit masked to 1
      expect(operandToUnsigned(300, 8)).toBe(44); // 300 = 0x12C, 8-bit masked to 0x2C (44)
    });
  });

  describe('executeAluHandoff', () => {
    it('successfully hands off add operation with converted operands', () => {
      const result = executeAluHandoff('add', '-3', '5', 4);
      expect(result.ok).toBe(true);

      const project = useProjectStore.getState().project;
      expect(project.alu).toEqual({
        op: 'ADD',
        width: 4,
        a: 13, // -3 in 4-bit two's complement
        b: 5,
      });

      expect(project.lastHandoff?.from).toBe('number-systems');
      expect(project.lastHandoff?.to).toBe('alu');
      expect(useUiStore.getState().currentModule).toBe('alu');
    });

    it('successfully hands off subtract operation', () => {
      const result = executeAluHandoff('subtract', '7', '2', 8);
      expect(result.ok).toBe(true);

      const project = useProjectStore.getState().project;
      expect(project.alu).toEqual({
        op: 'SUB',
        width: 8,
        a: 7,
        b: 2,
      });
      expect(useUiStore.getState().currentModule).toBe('alu');
    });
  });
});
