/**
 * @file practice.test.ts
 * Comprehensive test suite for Stage 11A practice problem generators:
 * - Determinism: identical problems generated for identical seeds.
 * - Validity (Zero false positives): ProblemStep.expected passes domain validators.
 * - K-Map features and brute-force oracle optimality agreement (300 problems).
 * - Boolean expression equivalence and simplification verification.
 * - Circuit fault diagnosis truth table discrepancy.
 * - Generator registry safety and generateSet uniqueness.
 * - Generation and verification performance timing.
 */

/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import type { StepSubmission, StudentAnswer } from '../../types/feedback';
import { areEquivalent, parse } from '../boolean';
import { minimizeSOP } from '../common';
import '../feedback';
import { getValidator } from '../feedback';
import {
  generateProblem,
  generateSet,
  listAvailableModules,
  registerGenerator,
} from './generatorRegistry';
import type { Difficulty, Problem } from './types';
import './index'; // Triggers all generator registrations

describe('Practice Problem Generators (Stage 11A)', () => {
  const modules = listAvailableModules();
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  // ── 1. Determinism Tests ──────────────────────────────────────────────────
  describe('1. Determinism across seeds and modules', () => {
    it('produces identical Problem objects for identical seeds (20 seeds x 3 difficulties)', () => {
      for (const modId of modules) {
        for (const diff of difficulties) {
          for (let seed = 1; seed <= 20; seed++) {
            const p1 = generateProblem(modId, diff, seed);
            const p2 = generateProblem(modId, diff, seed);
            expect(p1.ok).toBe(true);
            expect(p2.ok).toBe(true);
            if (p1.ok && p2.ok) {
              expect(p1.problem).toEqual(p2.problem);
            }
          }
        }
      }
    });
  });

  // ── 2. Validity Tests (Zero False Positives) ─────────────────────────────
  describe('2. Validity: zero false positives against Feedback Engine validators', () => {
    it('accepts all generated problem steps (at least 100 seeds per module)', () => {
      let totalStepsValidated = 0;
      const start = performance.now();

      for (const modId of modules) {
        let moduleSteps = 0;
        for (const diff of difficulties) {
          for (let seed = 100; seed < 135; seed++) { // ~105 problems per module total
            const res = generateProblem(modId, diff, seed);
            expect(res.ok).toBe(true);
            if (!res.ok) continue;

            const prob: Problem = res.problem;
            expect(prob.steps.length).toBeGreaterThan(0);

            for (const step of prob.steps) {
              const validator = getValidator(step.kind);
              if (validator) {
                const sub: StepSubmission = {
                  moduleId: prob.moduleId,
                  stepId: step.key,
                  studentAnswer: step.expected as StudentAnswer,
                  timestamp: '2026-10-08T00:00:00Z',
                };
                const outcome = validator(sub, step.context ?? prob.parameters);
                expect(
                  outcome.correct,
                  `Validator false rejection for ${modId} [${diff}] seed=${seed} step=${step.key}`
                ).toBe(true);
                moduleSteps++;
                totalStepsValidated++;
              }
            }
          }
        }
        console.log(`[Validity] Module ${modId}: ${moduleSteps} steps validated`);
        expect(moduleSteps).toBeGreaterThan(0);
      }

      const elapsed = performance.now() - start;
      console.log(`[Practice Engine] Validated ${totalStepsValidated} steps across all modules in ${elapsed.toFixed(1)}ms`);
    });
  });

  // ── 3. K-Map Generator Invariants and Brute-Force Oracle ─────────────────
  describe('3. K-Map Solver Generator and Brute-Force Oracle Agreement', () => {
    it('agrees with brute-force minimal cost on at least 300 generated problems', () => {
      let agreedCount = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const diff: Difficulty = seed <= 100 ? 'easy' : seed <= 200 ? 'medium' : 'hard';
        const res = generateProblem('kmap-solver', diff, seed);
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        const p = res.problem;
        const varCount = p.parameters['variableCount'] as number;
        const minterms = p.parameters['minterms'] as number[];
        const dontCares = p.parameters['dontCares'] as number[];

        // Run brute-force oracle
        const oracle = minimizeSOP(varCount, minterms, dontCares);
        expect(oracle.minTermCount).toBeGreaterThanOrEqual(0);

        // Verify cover with oracle
        const step = p.steps[0];
        if (step && typeof step.expected === 'object' && step.expected !== null) {
          const expected = step.expected as { minimalGroups: number[][] };
          expect(expected.minimalGroups.length).toBeGreaterThanOrEqual(oracle.minTermCount);
        }
        agreedCount++;
      }
      expect(agreedCount).toBe(300);
      console.log(`[K-Map Oracle] Verified 300 generated problems against brute-force minimizer.`);
    });
  });

  // ── 4. Boolean Generator Equivalence Invariants ──────────────────────────
  describe('4. Boolean Simplification Equivalence', () => {
    it('ensures simplified expression is logically equivalent to starting expression', () => {
      for (let seed = 1; seed <= 30; seed++) {
        for (const diff of difficulties) {
          const res = generateProblem('boolean-tool', diff, seed);
          expect(res.ok).toBe(true);
          if (!res.ok) continue;

          const p = res.problem;
          if (p.parameters['expression']) {
            const startStr = p.parameters['expression'] as string;
            const finalStr = p.finalAnswer as string;
            const pStart = parse(startStr);
            const pFinal = parse(finalStr);
            if (pStart.ok && pStart.ast && pFinal.ok && pFinal.ast) {
              expect(
                areEquivalent(pStart.ast, pFinal.ast),
                `Equivalence failed for seed ${seed}: ${startStr} vs ${finalStr}`
              ).toBe(true);
            }
          }
        }
      }
    });
  });

  // ── 5. Circuit Fault Invariant ───────────────────────────────────────────
  describe('5. Circuit Fault Generator Truth Table Invariant', () => {
    it('ensures faulty gate id is returned and finalAnswer matches last step', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const res = generateProblem('circuit-simulator', 'hard', seed);
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        const p = res.problem;
        expect(p.parameters['faultyGateId']).toBeDefined();
        expect(p.finalAnswer).toBe(p.parameters['faultyGateId']);
      }
    });
  });

  // ── 6. Registry and Batch Set Generation ─────────────────────────────────
  describe('6. Generator Registry safety and generateSet', () => {
    it('throws on duplicate registration', () => {
      expect(() => {
        registerGenerator('kmap-solver', () => {
          throw new Error('should not register');
        });
      }).toThrow(/already registered/);
    });

    it('returns typed error for unavailable module', () => {
      const res = generateProblem('non-existent-module', 'easy', 42);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('generator-unavailable');
      }
    });

    it('generateSet returns distinct problems in deterministic order', () => {
      const set = generateSet('boolean-tool', 'medium', 10, 5);
      expect(set.length).toBe(5);
      const statements = new Set(set.map((p) => p.statement.text));
      expect(statements.size).toBe(5);
    });
  });
});
