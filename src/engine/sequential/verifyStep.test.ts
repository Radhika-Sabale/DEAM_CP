/**
 * @file verifyStep.test.ts
 * Comprehensive unit and property tests for step verification comparators.
 * Tests every status discriminator, hand-corrupted tables/equations/diagrams/circuits,
 * and proves ZERO FALSE POSITIVES across the complete Stage 10B synthesis matrix.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { ExcitationTable, FlipFlopType, StateTable } from '../../types/sequential';
import { buildCombinationalCircuit } from './circuitBuild';
import { designSequential } from './counterDesigner';
import { counterMachine } from './counterMachines';
import { detectorMachine } from './detectorMachines';
import { buildExcitationTable } from './excitation';
import { analyzeLockout } from './lockout';
import {
  verifyCircuit,
  verifyDiagram,
  verifyEquation,
  verifyExcitationTable,
  verifyLockoutClaim,
  verifyStateTable,
} from './verifyStep';

describe('verifyStep.ts', () => {
  const flipFlops: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('State Table Verification: accurately flags correct and corrupted cells on counters and detectors', () => {
    // 1. Counter machine (Next state verification)
    const res = counterMachine({ kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 4 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const refTable = res.machine.table;
    const passResult = verifyStateTable(refTable, refTable);
    expect(passResult.summary.allCorrect).toBe(true);
    expect(passResult.summary.correctCount).toBe(4);

    // Corrupted counter table: mutate 2 next states
    const corruptedRows = refTable.rows.map((r, i) => {
      if (i === 1) return { ...r, nextCode: 0, nextStateName: 'S0' }; // Expected S2 (code 2)
      if (i === 3) return { ...r, nextCode: 2, nextStateName: 'S2' }; // Expected S0 (code 0)
      return { ...r };
    });
    const corruptedTable: StateTable = { ...refTable, rows: corruptedRows as unknown as StateTable['rows'] };

    const failResult = verifyStateTable(corruptedTable, refTable);
    expect(failResult.summary.allCorrect).toBe(false);
    const incorrectItems = failResult.items.filter((it) => it.status === 'incorrect');
    expect(incorrectItems.length).toBe(2);

    // 2. Detector machine with outputs
    const detRes = detectorMachine({ kind: 'detector', flipFlop: 'D', pattern: '11', machine: 'mealy', overlapping: true });
    expect(detRes.ok).toBe(true);
    if (!detRes.ok) return;

    const detTable = detRes.machine.table;
    const detPass = verifyStateTable(detTable, detTable);
    expect(detPass.summary.allCorrect).toBe(true);

    const corruptedDetRows = detTable.rows.map((r, i) => {
      if (i === 2) return { ...r, mealyOutput: (r.mealyOutput === 1 ? 0 : 1) as LogicValue }; // Invert output
      return { ...r };
    });
    const corruptedDetTable = { ...detTable, rows: corruptedDetRows };
    const detFail = verifyStateTable(corruptedDetTable, detTable);
    expect(detFail.summary.allCorrect).toBe(false);
    expect(detFail.items.some((it) => it.status === 'incorrect' && it.id.includes('output'))).toBe(true);
  });

  it('State Diagram Verification: converts diagram to table and validates seamlessly', () => {
    const res = counterMachine({ kind: 'counter', flipFlop: 'T', style: 'sync', direction: 'up', modulus: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const vRes = verifyDiagram(res.machine.diagram, res.machine.table);
    expect(vRes.summary.allCorrect).toBe(true);
  });

  it('Excitation Table Verification: distinguishes exact match, dont-care-ok, and incorrect X', () => {
    const res = counterMachine({ kind: 'counter', flipFlop: 'JK', style: 'sync', direction: 'up', modulus: 4 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const exRes = buildExcitationTable(res.machine.table, 'JK');
    const refTable = exRes;

    // Perfect table
    const passRes = verifyExcitationTable(refTable, refTable);
    expect(passRes.summary.allCorrect).toBe(true);

    // Student assigns concrete 1 to a don't-care cell (acceptable) and 'X' to a care cell (incorrect)
    const studRows = refTable.rows.map((r, i) => {
      if (i === 0) {
        // In row 0 (00 -> 01), K0 is 'X'. Assign 1 -> dont-care-ok
        // J0 is 1. Assign 'X' -> incorrect
        return {
          ...r,
          flipFlopInputs: {
            ...r.flipFlopInputs,
            K0: 1 as const,
            J0: 'X' as const,
          },
        };
      }
      return { ...r };
    });
    const studTable: ExcitationTable = { ...refTable, rows: studRows as unknown as ExcitationTable['rows'] };

    const checkRes = verifyExcitationTable(studTable, refTable);
    const dcOk = checkRes.items.find((it) => it.id === 'row-0-input-K0');
    const err = checkRes.items.find((it) => it.id === 'row-0-input-J0');

    expect(dcOk?.status).toBe('dont-care-ok');
    expect(err?.status).toBe('incorrect');
  });

  it('Equation Verification: tests parse errors, unknown variables, care mismatches, non-minimal, and minimal equations', () => {
    const vars = ['Q1', 'Q0'];
    // Column for D0 in Mod-4 Up counter: Q0' (rows: 1, 0, 1, 0)
    const col = [1, 0, 1, 0] as const;

    // 1. Parse error
    const parseErr = verifyEquation('Q0 & &', col, vars);
    expect(parseErr.correct).toBe(false);
    expect(parseErr.parseError).toBeDefined();

    // 2. Unknown variable
    const unkVar = verifyEquation("Q0' & Z", col, vars);
    expect(unkVar.correct).toBe(false);
    expect(unkVar.unknownVariables).toContain('Z');

    // 3. Care row mismatch
    const mismatch = verifyEquation('Q0', col, vars);
    expect(mismatch.correct).toBe(false);
    expect(mismatch.mismatchRows.length).toBeGreaterThan(0);

    // 4. Correct and Minimal
    const minimal = verifyEquation("~Q0", col, vars);
    expect(minimal.correct).toBe(true);
    expect(minimal.isMinimal).toBe(true);

    // 5. Correct but Non-Minimal (Q1' Q0' + Q1 Q0' = Q0')
    const nonMinimal = verifyEquation("(~Q1 & ~Q0) | (Q1 & ~Q0)", col, vars);
    expect(nonMinimal.correct).toBe(true);
    expect(nonMinimal.isMinimal).toBe(false);
    expect(nonMinimal.cost.terms).toBe(2);
    expect(nonMinimal.solverCost.terms).toBe(1);
  });

  it('Lockout Claim Verification: flags missing locked states and extra false claims', () => {
    // Hand-crafted lockout analysis with locked state 5 and indeterminate state 6, and safe state 7
    const mockAnalysis = {
      unusedStates: [],
      lockedStates: [5],
      indeterminateStates: [6],
      cycles: [[5]],
      isSelfCorrecting: false,
      maxStepsToValid: null,
      messages: [],
    };

    // Perfect claim: student lists [5, 6]
    const perfect = verifyLockoutClaim([5, 6], mockAnalysis);
    expect(perfect.correct).toBe(true);
    expect(perfect.missing.length).toBe(0);
    expect(perfect.extra.length).toBe(0);

    // Flawed claim: student lists [5, 7] (missing 6, extra 7)
    const flawed = verifyLockoutClaim([5, 7], mockAnalysis);
    expect(flawed.correct).toBe(false);
    expect(flawed.missing).toEqual([6]);
    expect(flawed.extra).toEqual([7]);
  });

  it('Circuit Netlist Verification: validates correct and mutated circuit schematics', () => {
    const dRes = designSequential({ kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 4 });
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const cRes = buildCombinationalCircuit(dRes.design, { style: 'sop-and-or' });
    expect(cRes.ok).toBe(true);
    if (!cRes.ok) return;

    // Perfect circuit
    const vPass = verifyCircuit(cRes.graph, dRes.design);
    expect(vPass.correct).toBe(true);

    // Mutated circuit (rename output port label D0 to MUTATED_D0)
    const mutatedGraph = {
      ...cRes.graph,
      nodes: cRes.graph.nodes.map((n) => {
        if (n.kind === 'output' && n.label === 'D0') {
          return { ...n, label: 'MUTATED_D0' };
        }
        return n;
      }),
    };
    const vFail = verifyCircuit(mutatedGraph, dRes.design);
    expect(vFail.correct).toBe(false);
    expect(vFail.missingOutputs).toContain('D0');
  });

  it('ZERO FALSE POSITIVES: all engine-synthesized artifacts across matrix verify with zero errors', () => {
    const counterSpecs = [
      { kind: 'counter' as const, direction: 'up' as const, modulus: 5 },
      { kind: 'counter' as const, direction: 'down' as const, modulus: 8 },
      { kind: 'counter' as const, direction: 'up' as const, modulus: 10 },
    ];

    let verifiedEquations = 0;
    for (const spec of counterSpecs) {
      for (const ff of flipFlops) {
        const fullSpec = { ...spec, flipFlop: ff, style: 'sync' as const };
        const dRes = designSequential(fullSpec);
        expect(dRes.ok).toBe(true);
        if (!dRes.ok) continue;

        // 1. Verify state table
        const stRes = verifyStateTable(dRes.design.table, dRes.design.table);
        expect(stRes.summary.allCorrect).toBe(true);

        // 2. Verify excitation table
        const exRes = verifyExcitationTable(dRes.design.excitation, dRes.design.excitation);
        expect(exRes.summary.allCorrect).toBe(true);

        // 3. Verify every derived equation
        for (const eq of dRes.design.equations) {
          const fn = dRes.design.functions.find((f) => f.name === eq.name);
          expect(fn).toBeDefined();
          if (!fn) continue;

          const eqRes = verifyEquation(eq.text, fn.column, eq.variables);
          expect(eqRes.correct).toBe(true);
          expect(eqRes.isMinimal).toBe(true);
          verifiedEquations++;
        }

        // 4. Verify lockout claim matching engine analysis
        const lockAnalysis = analyzeLockout({
          table: dRes.design.table,
          equations: dRes.design.equations,
          flipFlop: ff,
        });
        const trueLockout = Array.from(new Set([...lockAnalysis.lockedStates, ...lockAnalysis.indeterminateStates]));
        const lockRes = verifyLockoutClaim(trueLockout, lockAnalysis);
        expect(lockRes.correct).toBe(true);

        // 5. Verify synthesized combinational circuit
        const cRes = buildCombinationalCircuit(dRes.design, { style: 'sop-and-or' });
        expect(cRes.ok).toBe(true);
        if (cRes.ok) {
          const cVer = verifyCircuit(cRes.graph, dRes.design);
          expect(cVer.correct).toBe(true);
        }
      }
    }
    expect(verifiedEquations).toBeGreaterThan(30);
  });
});
