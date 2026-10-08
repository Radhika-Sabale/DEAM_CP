/**
 * @file specs.test.ts
 * Comprehensive unit tests for sequential machine specification validation,
 * error code diagnostics, and async ripple constraints.
 */

import { describe, expect, it } from 'vitest';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { validateSpec } from './specs';

describe('specs.ts validateSpec', () => {
  describe('Positive valid specifications matrix', () => {
    it('validates standard synchronous up counter', () => {
      const spec: CounterSpec = {
        kind: 'counter',
        flipFlop: 'JK',
        style: 'sync',
        direction: 'up',
        modulus: 8,
      };
      const res = validateSpec(spec);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.spec.stateBits).toBe(3);
        expect(res.info.stateBits).toBe(3);
        expect(res.info.stateCount).toBe(8);
        expect(res.info.hasInput).toBe(false);
      }
    });

    it('validates synchronous up-down counter with external DN input', () => {
      const spec: CounterSpec = {
        kind: 'counter',
        flipFlop: 'T',
        style: 'sync',
        direction: 'up-down',
        modulus: 10,
      };
      const res = validateSpec(spec);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.spec.stateBits).toBe(4);
        expect(res.info.hasInput).toBe(true);
        expect(res.info.inputKind).toBe('counter-up-down');
      }
    });

    it('validates custom sequence counter and infers stateBits', () => {
      const spec: CounterSpec = {
        kind: 'counter',
        flipFlop: 'D',
        style: 'sync',
        direction: 'custom',
        modulus: 5,
        sequence: [0, 2, 5, 7, 3],
      };
      const res = validateSpec(spec);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.spec.stateBits).toBe(3);
        expect(res.info.stateCount).toBe(5);
        expect(res.info.hasInput).toBe(false);
      }
    });

    it('validates Mealy sequence detector', () => {
      const spec: DetectorSpec = {
        kind: 'detector',
        flipFlop: 'D',
        pattern: '1011',
        machine: 'mealy',
        overlapping: true,
      };
      const res = validateSpec(spec);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.info.stateCount).toBe(4);
        expect(res.info.stateBits).toBe(2);
        expect(res.info.hasInput).toBe(true);
      }
    });

    it('validates Moore sequence detector with L+1 states', () => {
      const spec: DetectorSpec = {
        kind: 'detector',
        flipFlop: 'JK',
        pattern: '101',
        machine: 'moore',
        overlapping: false,
      };
      const res = validateSpec(spec);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.info.stateCount).toBe(4);
        expect(res.info.stateBits).toBe(2);
      }
    });
  });

  describe('Error code test suite (positive and negative cases)', () => {
    it('bad-kind: rejects non-object or unknown kind', () => {
      const resNull = validateSpec(null);
      expect(resNull.ok).toBe(false);
      if (!resNull.ok) {
        expect(resNull.errors[0]?.code).toBe('bad-kind');
      }

      const resBadKind = validateSpec({ kind: 'arbitrary-machine' });
      expect(resBadKind.ok).toBe(false);
      if (!resBadKind.ok) {
        expect(resBadKind.errors[0]?.code).toBe('bad-kind');
      }
    });

    it('bad-flip-flop: rejects invalid flip-flop type', () => {
      const res = validateSpec({
        kind: 'counter',
        flipFlop: 'INVALID',
        modulus: 4,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.some((e) => e.code === 'bad-flip-flop')).toBe(true);
      }
    });

    it('bad-modulus: rejects modulus out of range 2..16 or non-integer', () => {
      const resLow = validateSpec({
        kind: 'counter',
        flipFlop: 'D',
        modulus: 1,
      });
      expect(resLow.ok).toBe(false);
      if (!resLow.ok) {
        expect(resLow.errors.some((e) => e.code === 'bad-modulus')).toBe(true);
      }

      const resHigh = validateSpec({
        kind: 'counter',
        flipFlop: 'D',
        modulus: 17,
      });
      expect(resHigh.ok).toBe(false);
      if (!resHigh.ok) {
        expect(resHigh.errors.some((e) => e.code === 'bad-modulus')).toBe(true);
      }
    });

    it('bad-sequence: rejects custom sequences with duplicates, length < 2, or non-integers', () => {
      const resShort = validateSpec({
        kind: 'counter',
        flipFlop: 'D',
        direction: 'custom',
        sequence: [1],
      });
      expect(resShort.ok).toBe(false);
      if (!resShort.ok) {
        expect(resShort.errors.some((e) => e.code === 'bad-sequence')).toBe(true);
      }

      const resDup = validateSpec({
        kind: 'counter',
        flipFlop: 'D',
        direction: 'custom',
        sequence: [0, 1, 2, 1],
      });
      expect(resDup.ok).toBe(false);
      if (!resDup.ok) {
        expect(resDup.errors.some((e) => e.code === 'bad-sequence')).toBe(true);
      }
    });

    it('bad-pattern: rejects invalid detector binary patterns', () => {
      const resShort = validateSpec({
        kind: 'detector',
        flipFlop: 'D',
        pattern: '1',
        machine: 'mealy',
        overlapping: true,
      });
      expect(resShort.ok).toBe(false);
      if (!resShort.ok) {
        expect(resShort.errors.some((e) => e.code === 'bad-pattern')).toBe(true);
      }

      const resAlpha = validateSpec({
        kind: 'detector',
        flipFlop: 'D',
        pattern: '101A',
        machine: 'mealy',
        overlapping: true,
      });
      expect(resAlpha.ok).toBe(false);
      if (!resAlpha.ok) {
        expect(resAlpha.errors.some((e) => e.code === 'bad-pattern')).toBe(true);
      }
    });

    it('bad-state-bits: rejects stateBits that are too small or out of range', () => {
      const resSmall = validateSpec({
        kind: 'counter',
        flipFlop: 'JK',
        direction: 'up',
        modulus: 8,
        stateBits: 2, // Needs at least 3
      });
      expect(resSmall.ok).toBe(false);
      if (!resSmall.ok) {
        expect(resSmall.errors.some((e) => e.code === 'bad-state-bits')).toBe(true);
      }
    });

    it('async-unsupported: enforces asynchronous ripple counter rules', () => {
      // Up-down async is unsupported
      const resAsyncUpDown = validateSpec({
        kind: 'counter',
        flipFlop: 'T',
        style: 'async',
        direction: 'up-down',
        modulus: 8,
      });
      expect(resAsyncUpDown.ok).toBe(false);
      if (!resAsyncUpDown.ok) {
        expect(resAsyncUpDown.errors.some((e) => e.code === 'async-unsupported')).toBe(true);
      }

      // Non-power-of-2 async down is unsupported
      const resAsyncDownMod6 = validateSpec({
        kind: 'counter',
        flipFlop: 'T',
        style: 'async',
        direction: 'down',
        modulus: 6,
      });
      expect(resAsyncDownMod6.ok).toBe(false);
      if (!resAsyncDownMod6.ok) {
        expect(resAsyncDownMod6.errors.some((e) => e.code === 'async-unsupported')).toBe(true);
      }

      // Power-of-2 async down IS supported
      const resAsyncDownMod8 = validateSpec({
        kind: 'counter',
        flipFlop: 'T',
        style: 'async',
        direction: 'down',
        modulus: 8,
      });
      expect(resAsyncDownMod8.ok).toBe(true);

      // Async up for any modulus IS supported
      const resAsyncUpMod10 = validateSpec({
        kind: 'counter',
        flipFlop: 'T',
        style: 'async',
        direction: 'up',
        modulus: 10,
      });
      expect(resAsyncUpMod10.ok).toBe(true);
    });
  });
});
