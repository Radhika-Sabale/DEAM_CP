/**
 * @file generators/kmap.ts
 * Practice-problem generator for the K-Map Solver module (Stage 11A).
 *
 * Generates minimization problems with minterms and don't-cares for 3-5 variables.
 * Hard problems deterministically search for target features (wrap-around groups,
 * cyclic core, critical don't-cares) by incrementing seed until found (bounded search).
 *
 * All solutions are computed and verified by the existing kmap solver + verifyCover oracle.
 */

import type { MisconceptionTag } from '../../../types/feedback';
import { verifyCover } from '../../common';
import { solveSOP } from '../../kmap';
import type { KMapSolution } from '../../kmap';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, intInRange, shuffle } from '../random';

const MODULE_ID = 'kmap-solver';

function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

/** Check if a solution has any wrap-around groups (cells on opposite edges). */
function hasWrapAround(sol: KMapSolution): boolean {
  for (const g of sol.groups) {
    const cells = g.cellIndices;
    const n = sol.variableCount;
    const cols = n <= 3 ? 4 : 4;
    const rows = n <= 3 ? 2 : 4;
    // Check column wrap: cells in col 0 and col (cols-1)
    const colSet = new Set(cells.map((c) => c % cols));
    const rowSet = new Set(cells.map((c) => Math.floor(c / cols)));
    if (colSet.has(0) && colSet.has(cols - 1)) return true;
    if (rows > 2 && rowSet.has(0) && rowSet.has(rows - 1)) return true;
  }
  return false;
}

/** Check if solution has a cyclic core (Petrick's method was needed). */
function hasCyclicCore(sol: KMapSolution): boolean {
  return sol.cyclicCore !== null;
}

/** Check if don't-cares affect optimality (are actually used in groups). */
function dontCaresAffectResult(sol: KMapSolution): boolean {
  if (sol.dontCares.length === 0) return false;
  const dcSet = new Set(sol.dontCares);
  for (const g of sol.groups) {
    if (g.cellIndices.some((c) => dcSet.has(c))) return true;
  }
  return false;
}

/**
 * Generates a random K-map problem with the given variable count.
 * Returns null if the solver fails (e.g. no minterms generated).
 */
function tryGenerate(
  prng: () => number,
  varCount: number,
  addDontCares: boolean
): { minterms: number[]; dontCares: number[]; solution: KMapSolution } | null {
  const total = 1 << varCount;
  const mintermCount = intInRange(prng, 1, Math.max(1, total - 2));
  const allCells = Array.from({ length: total }, (_, i) => i);
  const shuffled = shuffle(prng, allCells);
  const minterms = shuffled.slice(0, mintermCount).sort((a, b) => a - b);

  let dontCares: number[] = [];
  if (addDontCares) {
    const remaining = shuffled.slice(mintermCount);
    const dcCount = intInRange(prng, 1, Math.min(remaining.length, Math.max(1, total >> 2)));
    dontCares = remaining.slice(0, dcCount).sort((a, b) => a - b);
  }

  const result = solveSOP(varCount, minterms, dontCares);
  if (!result.ok) return null;

  return { minterms, dontCares, solution: result.solution };
}

/**
 * Bounded deterministic search for a K-map problem with a target feature.
 * Increments seed-based PRNG state until the feature is found or maxAttempts is reached.
 *
 * @param baseSeed Starting seed
 * @param varCount Number of variables
 * @param featureCheck Predicate on the solution
 * @param maxAttempts Maximum number of seeds to try (default: 200)
 * @returns Problem data or null if feature not found within bounds
 */
function searchForFeature(
  baseSeed: number,
  varCount: number,
  featureCheck: (sol: KMapSolution) => boolean,
  maxAttempts = 200
): { minterms: number[]; dontCares: number[]; solution: KMapSolution; usedSeed: number } | null {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const s = baseSeed + offset * 7919; // Large prime spacing
    const prng = createPrng(s);
    const result = tryGenerate(prng, varCount, true);
    if (result && featureCheck(result.solution)) {
      return { ...result, usedSeed: s };
    }
  }
  return null;
}

function generate(difficulty: Difficulty, seed: number): Problem {
  const prng = createPrng(seed);

  let varCount: number;
  let result: { minterms: number[]; dontCares: number[]; solution: KMapSolution };

  switch (difficulty) {
    case 'easy': {
      varCount = 3;
      const gen = tryGenerate(prng, varCount, false);
      if (!gen) throw new Error('K-map easy generation failed');
      result = gen;
      break;
    }
    case 'medium': {
      varCount = 4;
      const gen = tryGenerate(prng, varCount, true);
      if (!gen) throw new Error('K-map medium generation failed');
      result = gen;
      break;
    }
    case 'hard': {
      varCount = intInRange(prng, 4, 5);
      // Search for a problem with interesting features
      const found =
        searchForFeature(seed, varCount, (s) => hasWrapAround(s) || dontCaresAffectResult(s)) ??
        searchForFeature(seed, varCount, (s) => hasCyclicCore(s)) ??
        searchForFeature(seed, varCount, () => true); // Fallback

      if (!found) throw new Error('K-map hard generation failed');
      result = found;
      break;
    }
  }

  const sol = result.solution;
  const vars = sol.variableNames;

  // Verify cover with brute-force oracle
  const solCubes = sol.primarySolution.primeImplicants.map((pi) => pi.cube);
  const coverRes = verifyCover(varCount, result.minterms, result.dontCares, solCubes);
  const coverOk = coverRes.coversAllMinterms && coverRes.coversNoZeros;
  if (!coverOk) {
    throw new Error('K-map solution failed verifyCover assertion');
  }

  const groupIndices = sol.groups.map((g) => g.cellIndices);

  const steps: ProblemStep[] = [
    {
      key: 'kmap-groups',
      prompt: `Identify all prime implicant groups on the ${varCount}-variable K-map.`,
      expected: {
        kind: 'kmap-group-set' as const,
        groups: groupIndices,
        minimalGroups: groupIndices,
        minimalExpression: sol.expressionString,
        expression: sol.expressionString,
      },
      kind: 'kmap-group-set',
      context: {
        kmap: {
          variableCount: varCount,
          minterms: result.minterms,
          dontCares: result.dontCares,
        },
      },
    },
  ];

  const tags: MisconceptionTag[] = [];
  if (hasWrapAround(sol)) tags.push('forgot-wraparound-grouping');
  if (result.dontCares.length > 0) tags.push('missed-dont-cares');
  tags.push('grouped-non-power-of-two', 'group-not-rectangle');

  const featureNotes: string[] = [];
  if (hasWrapAround(sol)) featureNotes.push('wrap-around');
  if (hasCyclicCore(sol)) featureNotes.push('cyclic-core');
  if (dontCaresAffectResult(sol)) featureNotes.push('critical-dont-cares');

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `${varCount}-variable K-map minimization`,
    statement: {
      text: `Minimize the ${varCount}-variable function F(${vars.join(', ')}) = Σm(${result.minterms.join(', ')})${result.dontCares.length > 0 ? ` + Σd(${result.dontCares.join(', ')})` : ''}.`,
      data: {
        variables: vars,
        minterms: result.minterms,
        dontCares: result.dontCares,
        features: featureNotes,
      },
    },
    parameters: {
      variableCount: varCount,
      variables: vars,
      minterms: result.minterms,
      dontCares: result.dontCares,
    },
    steps,
    finalAnswer: sol.expressionString,
    tags,
  };
}

registerGenerator(MODULE_ID, generate);

export { generate, hasWrapAround, hasCyclicCore, dontCaresAffectResult };
