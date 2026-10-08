/**
 * @file solver.ts
 * Deterministic K-map / Quine-McCluskey / Petrick solver for SOP and POS.
 *
 * Implements:
 * - Full pipeline: Tabular QM -> PI Chart -> EPI extraction -> Dominance reduction -> Petrick.
 * - Deterministic tie-breaking for designating the primary minimal cover.
 * - Comprehensive edge case handling (empty, tautology, single minterm, parity, essentials-only).
 * - Boolean dual minimization for POS.
 * - Grid visual overlay decomposition for the chosen solution.
 * - Self-verifying solver using Boolean evaluation.
 */

import type { BoolNode, TruthTable } from '../../types/ast';
import { evaluateBinary } from '../boolean/evaluator';
import { buildTruthTable, getDontCares, getMinterms } from '../boolean/truthTable';
import type { Cube } from './layout';
import { cubeCells, decomposeCubeToRectangles } from './layout';
import { runQuineMcCluskey } from './quineMcCluskey';
import type { PrimeImplicant } from './primeImplicants';
import {
  buildPiChart,
  cubeToSumString,
  extractPrimeImplicants,
  reducePiChart,
} from './primeImplicants';
import type { PetrickExpansionStep } from './petrick';
import { solvePetrick } from './petrick';
import type {
  KMapGroup,
  KMapInputError,
  KMapSolution,
  MinimalCover,
  SolverResult,
} from './types';
import {
  coverToPosAst,
  coverToSopAst,
  selectPrimaryCover,
  validateInputs,
} from './solverHelpers';

export type {
  KMapGroup,
  KMapInputError,
  KMapSolution,
  MinimalCover,
  SolverResult,
};

/**
 * Solves a Boolean minimization problem in Sum-Of-Products (SOP) form.
 */
export function solveSOP(
  variableCount: number,
  minterms: readonly number[],
  dontCares: readonly number[] = [],
  variableNames?: readonly string[]
): SolverResult {
  const err = validateInputs(variableCount, minterms, dontCares);
  if (err) return { ok: false, error: err };

  const names = variableNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, variableCount);
  const sortedMinterms = Array.from(new Set(minterms)).sort((a, b) => a - b);
  const sortedDontCares = Array.from(new Set(dontCares)).sort((a, b) => a - b);

  // Edge case: no minterms (constant 0)
  if (sortedMinterms.length === 0) {
    const emptyCover: MinimalCover = {
      primeImplicants: [],
      termCount: 0,
      literalCount: 0,
      expressionString: '0',
    };
    return {
      ok: true,
      solution: {
        form: 'SOP',
        variableCount,
        variableNames: names,
        minterms: [],
        dontCares: sortedDontCares,
        primeImplicants: [],
        essentialPrimeImplicants: [],
        qmTrace: { columns: [] },
        reductionSteps: [],
        petrickSteps: [],
        cyclicCore: null,
        allMinimalCovers: [emptyCover],
        primarySolution: emptyCover,
        expression: { type: 'constant', value: 0 },
        expressionString: '0',
        groups: [],
      },
    };
  }

  // Edge case: constant 1
  const totalCells = 1 << variableCount;
  if (sortedMinterms.length + sortedDontCares.length === totalCells) {
    const allCube: Cube = { careMask: 0, valueMask: 0 };
    const allCells = Array.from({ length: totalCells }, (_, i) => i);
    const tautologyPi: PrimeImplicant = {
      id: '-'.repeat(variableCount),
      cube: allCube,
      minterms: allCells,
      requiredMinterms: sortedMinterms,
      literalCount: 0,
      termString: '1',
    };
    const tautCover: MinimalCover = {
      primeImplicants: [tautologyPi],
      termCount: 1,
      literalCount: 0,
      expressionString: '1',
    };
    const group: KMapGroup = {
      cube: allCube,
      termString: '1',
      cellIndices: allCells,
      rectangles: decomposeCubeToRectangles(allCube, variableCount),
    };
    return {
      ok: true,
      solution: {
        form: 'SOP',
        variableCount,
        variableNames: names,
        minterms: sortedMinterms,
        dontCares: sortedDontCares,
        primeImplicants: [tautologyPi],
        essentialPrimeImplicants: [tautologyPi],
        qmTrace: { columns: [] },
        reductionSteps: [
          {
            type: 'essential',
            pi: tautologyPi,
            coveredMinterms: sortedMinterms,
            reason: 'Tautology covers all minterms',
          },
        ],
        petrickSteps: [],
        cyclicCore: null,
        allMinimalCovers: [tautCover],
        primarySolution: tautCover,
        expression: { type: 'constant', value: 1 },
        expressionString: '1',
        groups: [group],
      },
    };
  }

  // 1. Quine-McCluskey
  const qmResult = runQuineMcCluskey(variableCount, sortedMinterms, sortedDontCares);
  const primeImplicants = extractPrimeImplicants(qmResult, variableCount, sortedMinterms, names);

  // 2. Prime Implicant Chart Reduction
  const initialChart = buildPiChart(primeImplicants, sortedMinterms);
  const reduction = reducePiChart(initialChart);

  // 3. Petrick if cyclic core remains
  let petrickSteps: readonly PetrickExpansionStep[] = [];
  let minimalCovers: (readonly PrimeImplicant[])[] = [];

  if (reduction.cyclicCore && reduction.cyclicCore.minterms.length > 0) {
    const petrickResult = solvePetrick(reduction.cyclicCore.primeImplicants, reduction.cyclicCore.minterms);
    if (!petrickResult.ok) {
      throw new Error(`Petrick expansion exceeded safety cap of ${petrickResult.termCap} terms.`);
    }
    petrickSteps = petrickResult.steps;
    minimalCovers = petrickResult.minimalCovers.map((coreCover) => [
      ...reduction.essentialPrimeImplicants,
      ...coreCover,
    ]);
  } else {
    minimalCovers = [[...reduction.essentialPrimeImplicants]];
  }

  // 4. Select primary solution and format covers
  const primarySolution = selectPrimaryCover(minimalCovers, variableCount, names, 'SOP');
  const allMinimalCovers = minimalCovers.map((cov) => {
    const sorted = [...cov].sort((a, b) => a.termString.localeCompare(b.termString));
    return {
      primeImplicants: sorted,
      termCount: sorted.length,
      literalCount: sorted.reduce((acc, p) => acc + p.literalCount, 0),
      expressionString: sorted.map((p) => p.termString).join(' + '),
    };
  });

  const expression = coverToSopAst(primarySolution, variableCount, names);
  const groups: KMapGroup[] = primarySolution.primeImplicants.map((pi) => ({
    cube: pi.cube,
    termString: pi.termString,
    cellIndices: cubeCells(pi.cube, variableCount),
    rectangles: decomposeCubeToRectangles(pi.cube, variableCount),
  }));

  return {
    ok: true,
    solution: {
      form: 'SOP',
      variableCount,
      variableNames: names,
      minterms: sortedMinterms,
      dontCares: sortedDontCares,
      primeImplicants,
      essentialPrimeImplicants: reduction.essentialPrimeImplicants,
      qmTrace: qmResult.trace,
      reductionSteps: reduction.reductionSteps,
      petrickSteps,
      cyclicCore: reduction.cyclicCore,
      allMinimalCovers,
      primarySolution,
      expression,
      expressionString: primarySolution.expressionString,
      groups,
    },
  };
}

/**
 * Solves a Boolean minimization problem in Product-Of-Sums (POS) form
 * by minimizing 0-cells with identical don't-cares and dualizing the terms.
 */
export function solvePOS(
  variableCount: number,
  minterms: readonly number[],
  dontCares: readonly number[] = [],
  variableNames?: readonly string[]
): SolverResult {
  const err = validateInputs(variableCount, minterms, dontCares);
  if (err) return { ok: false, error: err };

  const names = variableNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, variableCount);
  const totalCells = 1 << variableCount;
  const mSet = new Set(minterms);
  const dSet = new Set(dontCares);

  const zeroCells: number[] = [];
  for (let c = 0; c < totalCells; c++) {
    if (!mSet.has(c) && !dSet.has(c)) {
      zeroCells.push(c);
    }
  }

  // Edge case: no zero cells (constant 1)
  if (zeroCells.length === 0) {
    const emptyCover: MinimalCover = {
      primeImplicants: [],
      termCount: 0,
      literalCount: 0,
      expressionString: '1',
    };
    return {
      ok: true,
      solution: {
        form: 'POS',
        variableCount,
        variableNames: names,
        minterms,
        dontCares,
        primeImplicants: [],
        essentialPrimeImplicants: [],
        qmTrace: { columns: [] },
        reductionSteps: [],
        petrickSteps: [],
        cyclicCore: null,
        allMinimalCovers: [emptyCover],
        primarySolution: emptyCover,
        expression: { type: 'constant', value: 1 },
        expressionString: '1',
        groups: [],
      },
    };
  }

  // Solve the zero function using SOP solver
  const dualResult = solveSOP(variableCount, zeroCells, dontCares, names);
  if (!dualResult.ok) return dualResult;
  const dualSol = dualResult.solution;

  const dualAllCovers = dualSol.allMinimalCovers.map((cov) => {
    const sorted = [...cov.primeImplicants].sort((a, b) =>
      cubeToSumString(a.cube, variableCount, names).localeCompare(
        cubeToSumString(b.cube, variableCount, names)
      )
    );
    return {
      primeImplicants: sorted,
      termCount: sorted.length,
      literalCount: sorted.reduce((acc, p) => acc + p.literalCount, 0),
      expressionString: sorted.map((p) => cubeToSumString(p.cube, variableCount, names)).join(''),
    };
  });

  const primarySolution = selectPrimaryCover(
    dualSol.allMinimalCovers.map((c) => c.primeImplicants),
    variableCount,
    names,
    'POS'
  );

  const expression = coverToPosAst(primarySolution, variableCount, names);
  const groups: KMapGroup[] = primarySolution.primeImplicants.map((pi) => ({
    cube: pi.cube,
    termString: cubeToSumString(pi.cube, variableCount, names),
    cellIndices: cubeCells(pi.cube, variableCount),
    rectangles: decomposeCubeToRectangles(pi.cube, variableCount),
  }));

  return {
    ok: true,
    solution: {
      form: 'POS',
      variableCount,
      variableNames: names,
      minterms,
      dontCares,
      primeImplicants: dualSol.primeImplicants,
      essentialPrimeImplicants: dualSol.essentialPrimeImplicants,
      qmTrace: dualSol.qmTrace,
      reductionSteps: dualSol.reductionSteps,
      petrickSteps: dualSol.petrickSteps,
      cyclicCore: dualSol.cyclicCore,
      allMinimalCovers: dualAllCovers,
      primarySolution,
      expression,
      expressionString: primarySolution.expressionString,
      groups,
    },
  };
}

/**
 * Convenience wrapper solving directly from a TruthTable.
 */
export function solveFromTable(table: TruthTable, form: 'SOP' | 'POS' = 'SOP'): SolverResult {
  const minterms = getMinterms(table);
  const dontCares = getDontCares(table);
  return form === 'SOP'
    ? solveSOP(table.variables.length, minterms, dontCares, table.variables)
    : solvePOS(table.variables.length, minterms, dontCares, table.variables);
}

/**
 * Convenience wrapper solving directly from a BoolNode AST.
 */
export function solveFromExpression(
  ast: BoolNode,
  variableNames?: readonly string[],
  form: 'SOP' | 'POS' = 'SOP'
): SolverResult {
  const tableResult = buildTruthTable(ast, variableNames);
  if (!tableResult.ok) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VARIABLE_COUNT',
        message: tableResult.error,
      },
    };
  }
  const table = tableResult.table;
  const vars = variableNames ?? table.variables;
  const minterms = getMinterms(table);
  const dontCares = getDontCares(table);
  return form === 'SOP'
    ? solveSOP(vars.length, minterms, dontCares, vars)
    : solvePOS(vars.length, minterms, dontCares, vars);
}

/**
 * Self-verifying solver that executes Boolean equivalence checking on the result
 * before returning. Throws an Error if logical equivalence fails.
 */
export function solveSOPVerified(
  variableCount: number,
  minterms: readonly number[],
  dontCares: readonly number[] = [],
  variableNames?: readonly string[]
): SolverResult {
  const res = solveSOP(variableCount, minterms, dontCares, variableNames);
  if (!res.ok) return res;

  const sol = res.solution;
  const totalCells = 1 << variableCount;
  const mSet = new Set(minterms);
  const dSet = new Set(dontCares);

  for (let m = 0; m < totalCells; m++) {
    if (dSet.has(m)) continue;
    const assignment: Record<string, 0 | 1> = {};
    for (let i = 0; i < variableCount; i++) {
      const bitPos = variableCount - 1 - i;
      const vName = sol.variableNames[i] ?? String.fromCharCode(65 + i);
      assignment[vName] = ((m >>> bitPos) & 1) === 1 ? 1 : 0;
    }
    const evaluated = evaluateBinary(sol.expression, assignment);
    const expected = mSet.has(m) ? 1 : 0;
    if (evaluated !== expected) {
      throw new Error(`Self-verification failed: minterm ${m} expected ${expected} but evaluated to ${evaluated}`);
    }
  }

  return res;
}
