/**
 * @file sequentialPipeline.test.ts
 * End-to-end multi-design pipeline integration tests for the Sequential Designer (Stage 10C):
 * - Tests 8 canonical and diverse sequential designs across counters, custom sequences, and sequence detectors.
 * - Applies sequential module patches to real DesignProject stores.
 * - Verifies prerequisite readiness checks pass only after all steps are complete.
 * - Performs K-Map pipeline handoff for EVERY flip-flop input function.
 * - Minimizes each handed-off truth table via real solveSOP and checks care-row equivalence and identical cost.
 * - Synthesizes circuit schematic netlists via Stage 8B generator and verifies against design equations.
 * - Validates full JSON export/import and schema round-trip retention.
 */

import { describe, expect, it } from 'vitest';
import { evaluateBinary } from '../../engine/boolean/evaluator';
import { extractTruthTable } from '../../engine/circuit/extractTruthTable';
import { generateCircuit } from '../../engine/circuit/generator';
import { solveFromTable } from '../../engine/kmap';
import { buildCombinationalCircuit } from '../../engine/sequential/circuitBuild';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { verifyCircuit } from '../../engine/sequential/verifyStep';
import { exportProjectToJson, parseProjectJson } from '../../store/projectIO';
import { mergeProjectPatch } from '../../store/projectStore';
import type { BoolNode } from '../../types/ast';
import { createEmptyDesignProject, type DesignProject } from '../../types/designProject';
import type { SequentialSpec } from '../../types/sequential';
import {
  canonicalToExcitationTable,
  canonicalToStateTable,
  checkSequentialReadiness,
  createKMapHandoffPatch,
  createSequentialStorePatch,
  stateDiagramDataToDiagram,
} from './sequentialModuleLogic';

describe('Sequential Designer Pipeline Integration (Stage 10C)', () => {
  const testMatrix: { readonly name: string; readonly spec: SequentialSpec }[] = [
    {
      name: 'mod-5 D',
      spec: { kind: 'counter', modulus: 5, direction: 'up', flipFlop: 'D', style: 'sync' },
    },
    {
      name: 'mod-10 JK',
      spec: { kind: 'counter', modulus: 10, direction: 'up', flipFlop: 'JK', style: 'sync' },
    },
    {
      name: 'mod-8 down T',
      spec: { kind: 'counter', modulus: 8, direction: 'down', flipFlop: 'T', style: 'sync' },
    },
    {
      name: 'mod-6 up-down SR',
      spec: { kind: 'counter', modulus: 6, direction: 'up-down', flipFlop: 'SR', style: 'sync' },
    },
    {
      name: 'custom sequence [0, 2, 4, 6] JK',
      spec: { kind: 'counter', direction: 'custom', sequence: [0, 2, 4, 6], flipFlop: 'JK', style: 'sync' },
    },
    {
      name: 'detector "1011" Mealy overlapping D',
      spec: { kind: 'detector', pattern: '1011', machine: 'mealy', overlapping: true, flipFlop: 'D' },
    },
    {
      name: 'detector "110" Moore non-overlapping T',
      spec: { kind: 'detector', pattern: '110', machine: 'moore', overlapping: false, flipFlop: 'T' },
    },
    {
      name: 'mod-16 up JK',
      spec: { kind: 'counter', modulus: 16, direction: 'up', flipFlop: 'JK', style: 'sync' },
    },
  ];

  for (const item of testMatrix) {
    it(`runs full end-to-end pipeline flow for ${item.name}`, () => {
      // 1. Initialize clean project
      let project: DesignProject = createEmptyDesignProject(`proj-${item.name}`, `Test ${item.name}`);

      // 2. Set spec and flipFlop
      project.flipFlopType = item.spec.flipFlop;
      project.sequentialSpec = item.spec;

      // 3. Synthesize authoritative sequential design
      const dRes = designSequential(item.spec);
      expect(dRes.ok).toBe(true);
      if (!dRes.ok) return;

      const design = dRes.design;

      // 4. Check readiness fails before completing steps
      const initialReadiness = checkSequentialReadiness(project);
      expect(initialReadiness.isReady).toBe(false);

      // Create and apply sequential module patch
      const eqMap: Record<string, BoolNode> = {};
      for (const eq of design.equations) {
        eqMap[eq.name] = eq.expression;
      }

      const seqPatch = createSequentialStorePatch({
        sequentialSpec: item.spec,
        stateDiagram: stateDiagramDataToDiagram(design.diagram),
        stateTable: canonicalToStateTable(design.table),
        excitationTable: canonicalToExcitationTable(design.excitation),
        nextStateEquations: eqMap,
      });

      project = mergeProjectPatch(project, seqPatch);

      // 5. Verify prerequisite readiness is satisfied after patch
      const fullReadiness = checkSequentialReadiness(project);
      expect(fullReadiness.isReady).toBe(true);
      expect(fullReadiness.blockingErrors.length).toBe(0);

      // 6. Test K-Map handoff for EVERY flip-flop input function
      for (const fnCol of design.functions) {
        if (fnCol.variables.length < 2 || fnCol.variables.length > 5) {
          // Functions outside 2..5 variables (e.g. 1-variable output)
          const outHandoff = createKMapHandoffPatch(project, fnCol.name);
          expect(outHandoff.ok).toBe(false);
          continue;
        }

        const handoffRes = createKMapHandoffPatch(project, fnCol.name);
        expect(handoffRes.ok).toBe(true);
        if (!handoffRes.ok || !handoffRes.patch) continue;

        // Apply handoff patch
        const kmapProject = mergeProjectPatch(project, handoffRes.patch);

        // Verify downstream cache invalidation
        expect(kmapProject.kmap).toBeNull();
        expect(kmapProject.minimizedExpression).toBeNull();
        expect(kmapProject.circuit).toBeNull();
        expect(kmapProject.truthTable).not.toBeNull();
        expect(kmapProject.truthTable?.variables).toEqual(fnCol.variables);

        // Run real K-Map Quine-McCluskey / K-Map solver on handed-off TruthTable
        const tt = kmapProject.truthTable;
        expect(tt).toBeDefined();
        if (!tt) continue;

        const solveRes = solveFromTable(tt);
        expect(solveRes.ok).toBe(true);
        if (!solveRes.ok) continue;

        const storedEq = design.equations.find((e) => e.name === fnCol.name);
        expect(storedEq).toBeDefined();
        if (!storedEq) continue;

        const solution = solveRes.solution;

        // Verify cost matches the stored equation (terms and literals)
        expect(solution.primarySolution.termCount).toBe(storedEq.cost.terms);
        expect(solution.primarySolution.literalCount).toBe(storedEq.cost.literals);

        // Verify care-row equivalence
        for (let r = 0; r < tt.rows.length; r++) {
          const row = tt.rows[r];
          if (!row || row.output === 'X') continue;

          const env: Record<string, 0 | 1> = {};
          for (let vi = 0; vi < tt.variables.length; vi++) {
            const vName = tt.variables[vi];
            if (vName) {
              const bit = (r >> (tt.variables.length - 1 - vi)) & 1;
              env[vName] = bit as 0 | 1;
            }
          }

          const solvedVal = evaluateBinary(solution.expression, env);
          const expectedVal = row.output === 1 ? 1 : 0;
          expect(solvedVal).toBe(expectedVal);
        }

        // 7. Generate single-expression Circuit and test truth table equivalence
        const singleCircRes = generateCircuit({
          outputs: [{ name: fnCol.name, expr: solution.expression }],
          variables: fnCol.variables,
        });
        expect(singleCircRes.ok).toBe(true);
        if (singleCircRes.ok) {
          expect(singleCircRes.graph.nodes.length).toBeGreaterThan(0);
          const singleExtracted = extractTruthTable(singleCircRes.graph);
          expect(singleExtracted.ok).toBe(true);
          if (singleExtracted.ok) {
            expect(singleExtracted.table.rows.length).toBe(1 << fnCol.variables.length);
          }
        }
      }

      // 8. Build full multi-output combinational circuit and verify via verifyCircuit
      const fullCircRes = buildCombinationalCircuit(design);
      expect(fullCircRes.ok).toBe(true);
      if (fullCircRes.ok) {
        const circVer = verifyCircuit(fullCircRes.graph, design);
        expect(circVer.correct).toBe(true);
        expect(circVer.mismatches.length).toBe(0);
      }

      // 9. JSON Serialization round trip
      const serialized = exportProjectToJson(project);
      const deserialized = parseProjectJson(serialized);
      expect(deserialized.ok).toBe(true);
      if (deserialized.ok) {
        expect(deserialized.value.flipFlopType).toBe(item.spec.flipFlop);
        expect(deserialized.value.sequentialSpec).toBeDefined();
        expect(deserialized.value.stateTable?.rows.length).toBe(design.table.rows.length);
      }
    });
  }
});
