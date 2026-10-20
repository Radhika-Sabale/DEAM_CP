/**
 * @file seed.test.ts
 * Authoritative verification test suite for the curated Seed Problems repository (Stage 12A).
 * Proves every seed solution against domain engines, Feedback validators, and reference oracles.
 */

/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import { createEmptyDesignProject, type ModuleId } from '../../../types/designProject';
import { areEquivalent } from '../../boolean/equivalence';
import { parse } from '../../boolean/parser';
import { extractTruthTable } from '../../circuit/extractTruthTable';
import '../../feedback'; // Auto-register all domain validators
import { getMisconception } from '../../feedback/misconceptions';
import { MODULE_REGISTRY } from '../../../modules/registry';
import { checkHandoffReadiness } from '../../../modules/registry';
import { solvePOS, solveSOP } from '../../kmap/solver';
import { parseProjectJson } from '../../../store/projectIO';
import { designSequential } from '../../sequential/counterDesigner';
import { loadSeedProblems, seedToProject } from './loader';
import {
  referenceMealy101Overlap,
  referenceMoore1011NonOverlap,
  simulateCounterCycle,
  verifyProblemSteps,
  type VerificationMetrics,
} from './seedTestHelpers';

describe('Seed Problems Stage 12A Authoritative Test Suite', () => {
  const loadResult = loadSeedProblems();
  const allProblems = loadResult.problems;

  describe('1. Structural and Schema Integrity', () => {
    it('parses all files with zero validation errors and zero duplicate IDs', () => {
      expect(loadResult.errors).toEqual([]);
      expect(allProblems.length).toBeGreaterThanOrEqual(24);
    });

    it('contains at least 3 problems per module file and spans all difficulty tiers', () => {
      const difficulties = new Set<string>();
      const moduleCounts = new Map<ModuleId, number>();

      for (const p of allProblems) {
        difficulties.add(p.difficulty);
        moduleCounts.set(p.moduleId, (moduleCounts.get(p.moduleId) ?? 0) + 1);
      }

      expect(difficulties.has('easy')).toBe(true);
      expect(difficulties.has('medium')).toBe(true);
      expect(difficulties.has('hard')).toBe(true);

      for (const count of moduleCounts.values()) {
        expect(count).toBeGreaterThanOrEqual(3);
      }
    });

    it('verifies every misconception tag exists in the catalog and every moduleId is registered', () => {
      const validModuleIds = new Set(MODULE_REGISTRY.map((m) => m.id));

      for (const p of allProblems) {
        expect(validModuleIds.has(p.moduleId), `Unknown moduleId "${p.moduleId}" in ${p.id}`).toBe(true);
        for (const tag of p.tags) {
          expect(() => getMisconception(tag)).not.toThrow();
        }
      }
    });

    it('is completely deterministic on multiple consecutive loads', () => {
      const load2 = loadSeedProblems();
      expect(load2).toEqual(loadResult);
    });
  });

  describe('2. Feedback Engine Step Verification across ALL Problems', () => {
    it('verifies that every ProblemStep.expected passes with correct=true and 0 mismatches', () => {
      const metricsByModule = new Map<string, VerificationMetrics>();

      for (const p of allProblems) {
        if (!metricsByModule.has(p.moduleId)) {
          metricsByModule.set(p.moduleId, { problemsChecked: 0, stepsValidated: 0, mismatches: 0 });
        }
        const m = metricsByModule.get(p.moduleId)!;
        const errs = verifyProblemSteps(p, m);
        expect(errs, `Step errors in problem ${p.id}`).toEqual([]);
      }

      console.log('\n================== SEED PROBLEMS VERIFICATION REPORT ==================');
      console.log('Module                  | Problems | Steps Validated | Mismatches');
      console.log('------------------------------------------------------------------------');
      let totalP = 0;
      let totalS = 0;
      let totalM = 0;

      for (const [modId, m] of metricsByModule.entries()) {
        totalP += m.problemsChecked;
        totalS += m.stepsValidated;
        totalM += m.mismatches;
        console.log(
          `${modId.padEnd(23)} | ${String(m.problemsChecked).padStart(8)} | ${String(m.stepsValidated).padStart(15)} | ${String(m.mismatches).padStart(10)}`
        );
      }
      console.log('------------------------------------------------------------------------');
      console.log(
        `${'TOTAL'.padEnd(23)} | ${String(totalP).padStart(8)} | ${String(totalS).padStart(15)} | ${String(totalM).padStart(10)}`
      );
      console.log('========================================================================\n');

      expect(totalM).toBe(0);
      expect(totalP).toBe(allProblems.length);
    });
  });

  describe('3. Module-Specific Engine Checks', () => {
    it('verifies K-Map seeds against the solver (minimal covers and cost oracle)', () => {
      const kmapProblems = allProblems.filter((p) => p.moduleId === 'kmap-solver');
      expect(kmapProblems.length).toBeGreaterThanOrEqual(6);

      for (const p of kmapProblems) {
        const params = p.parameters as {
          varCount?: number;
          variableCount?: number;
          variables?: string[];
          minterms: number[];
          dontCares?: number[];
          isPOS?: boolean;
          expectedMinimalCover?: string;
          allMinimalCovers?: string[];
        };
        const varCount = params.varCount ?? params.variableCount ?? params.variables?.length ?? 4;

        if (params.isPOS) {
          const posRes = solvePOS(varCount, params.minterms, params.dontCares ?? []);
          expect(posRes.ok).toBe(true);
          if (posRes.ok && params.expectedMinimalCover) {
            expect(posRes.solution.allMinimalCovers.map((c) => c.expressionString)).toContain(params.expectedMinimalCover);
          }
        } else {
          const sopRes = solveSOP(varCount, params.minterms, params.dontCares ?? []);
          expect(sopRes.ok).toBe(true);
          if (sopRes.ok) {
            if (params.allMinimalCovers) {
              expect(sopRes.solution.allMinimalCovers.map((c) => c.expressionString).sort()).toEqual([...params.allMinimalCovers].sort());
            } else if (params.expectedMinimalCover) {
              expect(sopRes.solution.allMinimalCovers.map((c) => c.expressionString)).toContain(params.expectedMinimalCover);
            }
          }
        }
      }
    });

    it('verifies Boolean seeds with AST equivalence checker at every step', () => {
      const booleanProblems = allProblems.filter((p) => p.moduleId === 'boolean-tool');
      expect(booleanProblems.length).toBeGreaterThanOrEqual(6);

      for (const p of booleanProblems) {
        const initialExpr = (p.parameters['expression'] as string | undefined) ?? '';
        const parsedInit = parse(initialExpr);

        if (parsedInit.ok && parsedInit.ast && p.id !== 'bool-equivalence-counterexample') {
          for (const step of p.steps) {
            const expAns = step.expected as { resultingExpression?: string };
            if (expAns.resultingExpression) {
              const parsedStep = parse(expAns.resultingExpression);
              expect(parsedStep.ok, `Step "${step.key}" parse failed`).toBe(true);
              if (parsedStep.ok && parsedStep.ast) {
                expect(
                  areEquivalent(parsedInit.ast, parsedStep.ast),
                  `Step expression "${expAns.resultingExpression}" not equivalent to initial "${initialExpr}"`
                ).toBe(true);
              }
            }
          }
        }
      }
    });

    it('verifies Circuit seeds by extracting truth tables or detecting valid feedback loops', () => {
      const circuitProblems = allProblems.filter((p) => p.moduleId === 'circuit-simulator');
      expect(circuitProblems.length).toBeGreaterThanOrEqual(6);

      for (const p of circuitProblems) {
        if (p.projectSeed.circuit) {
          const extractRes = extractTruthTable(p.projectSeed.circuit);
          if (p.id === 'circ-sr-latch-nor') {
            expect(extractRes.ok).toBe(false);
            if (!extractRes.ok) {
              expect(extractRes.error.code).toBe('has-feedback');
            }
          } else if (p.id === 'circ-master-slave-d-flipflop') {
            expect(extractRes.ok).toBe(false);
            if (!extractRes.ok) {
              expect(extractRes.error.code).toBe('has-clock');
            }
          } else {
            expect(extractRes.ok, `Failed to extract truth table for circuit ${p.id}`).toBe(true);
          }
        }
      }
    });


    it('verifies Counter seeds through sequential engine synthesis and cycle simulation', () => {
      const counterProblems = allProblems.filter((p) => p.id.startsWith('counter-'));
      expect(counterProblems.length).toBeGreaterThanOrEqual(4);

      for (const p of counterProblems) {
        const spec = p.projectSeed.sequentialSpec;
        if (!spec) continue;

        const synthRes = designSequential(spec);
        expect(synthRes.ok, `Failed to synthesize counter ${p.id}`).toBe(true);
        if (synthRes.ok && spec.kind === 'counter') {
          const cycleSeq =
            spec.direction === 'custom' && spec.sequence
              ? spec.sequence
              : spec.direction === 'down'
                ? [7, 6, 5, 4, 3, 2, 1, 0]
                : Array.from({ length: spec.modulus ?? 4 }, (_, i) => i);

          const cycleOk = simulateCounterCycle(cycleSeq, (curr) => {
            const row = synthRes.design.table.rows.find((r) => r.code === curr);
            return (row?.nextCode as number) ?? curr;
          });
          expect(cycleOk, `Counter ${p.id} failed full cycle simulation`).toBe(true);
        }
      }
    });

    it('verifies Sequence Detector seeds against a brute-force reference detector over all 2^10 test sequences', () => {
      const mealyDetector = allProblems.find((p) => p.id === 'seq-detector-mealy-101-overlap');
      const mooreDetector = allProblems.find((p) => p.id === 'seq-detector-moore-1011-nonoverlap');
      expect(mealyDetector).toBeDefined();
      expect(mooreDetector).toBeDefined();

      const mealySpec = mealyDetector!.projectSeed.sequentialSpec!;
      const mooreSpec = mooreDetector!.projectSeed.sequentialSpec!;

      const mealySynth = designSequential(mealySpec);
      const mooreSynth = designSequential(mooreSpec);
      expect(mealySynth.ok).toBe(true);
      expect(mooreSynth.ok).toBe(true);

      if (!mealySynth.ok || !mooreSynth.ok) return;

      // Exhaustively test all 2^10 = 1024 binary sequences of length 10
      for (let num = 0; num < 1024; num++) {
        const bits: (0 | 1)[] = [];
        for (let b = 9; b >= 0; b--) {
          bits.push(((num >> b) & 1) as 0 | 1);
        }

        // Test Mealy against reference
        const refMealyOut = referenceMealy101Overlap(bits);
        let mealyState = 0;
        const actualMealyOut: (0 | 1)[] = [];
        for (const bit of bits) {
          const row = mealySynth.design.table.rows.find((r) => r.code === mealyState && r.inputValue === bit);
          expect(row, `Mealy row missing for state ${mealyState} in=${bit}`).toBeDefined();
          actualMealyOut.push(row!.mealyOutput === 1 ? 1 : 0);
          mealyState = row!.nextCode as number;
        }
        expect(actualMealyOut).toEqual(refMealyOut);

        // Test Moore against reference
        const refMooreOut = referenceMoore1011NonOverlap(bits);
        let mooreState = 0;
        const actualMooreOut: (0 | 1)[] = [];
        for (const bit of bits) {
          const row = mooreSynth.design.table.rows.find((r) => r.code === mooreState && r.inputValue === bit);
          expect(row, `Moore row missing for state ${mooreState} in=${bit}`).toBeDefined();
          mooreState = row!.nextCode as number;
          const nextRow = mooreSynth.design.table.rows.find((r) => r.code === mooreState);
          actualMooreOut.push(nextRow?.mooreOutput === 1 ? 1 : 0);
        }
        expect(actualMooreOut).toEqual(refMooreOut);
      }
    });
  });

  describe('4. seedToProject and Handoff Readiness Verification', () => {
    it('proves that every seed problem produces a valid DesignProject passing projectIO and handoff checks', () => {
      for (const p of allProblems) {
        const payload = seedToProject(p);
        expect(payload.name).toBe(p.title);
        expect(payload.targetModule).toBe(p.moduleId);

        const project = {
          ...createEmptyDesignProject(p.id, p.title),
          ...payload.patch,
        };

        const json = JSON.stringify(project);
        const parseRes = parseProjectJson(json);
        expect(parseRes.ok, `Project JSON failed validation for ${p.id}`).toBe(true);

        // Verify home module prerequisites are satisfied
        if (p.moduleId === 'kmap-solver') {
          const missing = checkHandoffReadiness(project, 'boolean-tool', 'kmap-solver');
          expect(missing, `K-Map prerequisites missing for ${p.id}`).toEqual([]);
        } else if (p.moduleId === 'circuit-simulator') {
          const missing = checkHandoffReadiness(project, 'kmap-solver', 'circuit-simulator');
          expect(missing, `Circuit prerequisites missing for ${p.id}`).toEqual([]);
        } else if (p.moduleId === 'sequential-designer') {
          const missing = checkHandoffReadiness(project, 'flipflop-simulator', 'sequential-designer');
          expect(missing, `Sequential prerequisites missing for ${p.id}`).toEqual([]);
        }
      }
    });
  });
});
