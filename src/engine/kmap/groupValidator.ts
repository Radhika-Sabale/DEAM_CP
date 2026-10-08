/**
 * @file groupValidator.ts
 * Pure, deterministic validator for student K-map group drawings and complete covers.
 *
 * Implements:
 * - Group validation checked in exact pedagogical priority order:
 *   1. Empty selection
 *   2. Non-power-of-two size
 *   3. Covering a forbidden cell (0 in SOP, 1 in POS)
 *   4. Non-rectangle / non-subcube shape (detects forgot-wraparound vs diagonal adjacency)
 *   5. Non-maximal group (proper subset of a larger prime implicant)
 *   6. Redundant group (adds no new coverage compared to groups drawn so far)
 *   7. Valid prime implicant (checks if essential)
 * - Complete group set validation (missed minterms, missed don't-cares, redundancy, minimality).
 * - Conversion of student groups to equivalent BoolNode AST and string.
 */

import type { BoolNode, LiteralTerm, ProductTerm, SumTerm } from '../../types/ast';
import type { MisconceptionTag } from '../../types/feedback';
import { posToAst, sopToAst } from '../boolean/canonical';
import { popCount } from '../common/bitUtils';
import type { Cube } from './layout';
import { cellsToCube, cubeCells, decomposeCubeToRectangles, isAdjacent, positionOf } from './layout';
import { cubeToProductString, cubeToSumString } from './primeImplicants';
import type { KMapSolution } from './types';
import { solvePOS, solveSOP } from './solver';

export type KMapMode = 'SOP' | 'POS';

export interface GroupValidationContext {
  readonly variableCount: number;
  readonly minterms: readonly number[];
  readonly dontCares?: readonly number[];
  readonly mode?: KMapMode;
  readonly solverResult?: KMapSolution;
  readonly groupsSoFar?: readonly (readonly number[])[];
  readonly variableNames?: readonly string[];
}

export type GroupValidationErrorType =
  | 'empty-selection'
  | 'grouped-non-power-of-two'
  | 'covered-a-zero'
  | 'group-not-rectangle'
  | 'group-not-maximal'
  | 'redundant-group'
  | 'missed-minterm'
  | 'missed-dont-cares';

export interface GroupValidationFinding {
  readonly errorType: GroupValidationErrorType;
  readonly misconceptionTag?: MisconceptionTag;
  readonly message: string;
  readonly offendingCells?: readonly number[];
  readonly expectedSize?: readonly number[];
  readonly largerGroupCells?: readonly number[];
  readonly largerGroupTerm?: string;
}

export interface SingleGroupValidationResult {
  readonly valid: boolean;
  readonly primaryFinding?: GroupValidationFinding;
  readonly secondaryFindings: readonly GroupValidationFinding[];
  readonly cube?: Cube;
  readonly termString?: string;
  readonly isPrime?: boolean;
  readonly isEssential?: boolean;
}

export interface GroupSetValidationResult {
  readonly valid: boolean;
  readonly isMinimal: boolean;
  readonly errors: readonly GroupValidationFinding[];
  readonly uncoveredCells: readonly number[];
  readonly redundantGroupIndices: readonly number[];
  readonly missedDontCareCells: readonly number[];
  readonly studentTermCount: number;
  readonly studentLiteralCount: number;
  readonly minimalTermCount: number;
  readonly minimalLiteralCount: number;
  readonly missingEssentials: readonly string[];
}

function getSolverSolution(context: GroupValidationContext): KMapSolution {
  if (context.solverResult) return context.solverResult;
  const mode = context.mode ?? 'SOP';
  const res =
    mode === 'SOP'
      ? solveSOP(context.variableCount, context.minterms, context.dontCares ?? [], context.variableNames)
      : solvePOS(context.variableCount, context.minterms, context.dontCares ?? [], context.variableNames);
  if (!res.ok) throw new Error(`Solver error: ${res.error.message}`);
  return res.solution;
}

/**
 * Validates a single group of selected cells against problem context in strict priority order.
 */
export function validateGroup(
  context: GroupValidationContext,
  selectedCells: readonly number[]
): SingleGroupValidationResult {
  const varCount = context.variableCount;
  const mode = context.mode ?? 'SOP';
  const reqSet = new Set(context.minterms);
  const dcSet = new Set(context.dontCares ?? []);
  const names = context.variableNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  const totalCells = 1 << varCount;

  // 1. Empty selection
  if (!selectedCells || selectedCells.length === 0) {
    const finding: GroupValidationFinding = {
      errorType: 'empty-selection',
      message: 'No cells selected. Select at least one cell on the Karnaugh map.',
    };
    return { valid: false, primaryFinding: finding, secondaryFindings: [] };
  }

  const cells = Array.from(new Set(selectedCells)).sort((a, b) => a - b);
  const count = cells.length;

  // 2. Size not a power of two
  if ((count & (count - 1)) !== 0) {
    const validSizes = [1, 2, 4, 8, 16, 32].filter((s) => s <= totalCells);
    const finding: GroupValidationFinding = {
      errorType: 'grouped-non-power-of-two',
      misconceptionTag: 'grouped-non-power-of-two',
      message: `Group size (${count}) is not a power of two. Groups must contain 1, 2, 4, 8, 16, or 32 cells.`,
      expectedSize: validSizes,
    };
    return { valid: false, primaryFinding: finding, secondaryFindings: [] };
  }

  // 3. Covers a forbidden cell (0 in SOP mode, 1 in POS mode)
  const forbiddenCells: number[] = [];
  for (const c of cells) {
    if (mode === 'SOP') {
      if (!reqSet.has(c) && !dcSet.has(c)) {
        forbiddenCells.push(c);
      }
    } else {
      if (reqSet.has(c) && !dcSet.has(c)) {
        forbiddenCells.push(c);
      }
    }
  }

  if (forbiddenCells.length > 0) {
    const forbiddenType = mode === 'SOP' ? '0' : '1';
    const finding: GroupValidationFinding = {
      errorType: 'covered-a-zero',
      misconceptionTag: 'covered-a-zero',
      message: `Group contains ${forbiddenCells.length} forbidden ${forbiddenType}-cell(s): [${forbiddenCells.join(', ')}]. Groups in ${mode} mode may only contain ${mode === 'SOP' ? '1s' : '0s'} and don't-cares (X).`,
      offendingCells: forbiddenCells,
    };
    return { valid: false, primaryFinding: finding, secondaryFindings: [] };
  }

  // 4. Valid subcube geometry
  const cubeRes = cellsToCube(cells, varCount);
  if (!cubeRes.ok) {
    // Distinguish forgot-wraparound vs diagonal adjacency
    let isDiagonal = false;
    if (cells.length === 2) {
      const c0 = cells[0];
      const c1 = cells[1];
      if (c0 !== undefined && c1 !== undefined) {
        const p0 = positionOf(c0, varCount);
        const p1 = positionOf(c1, varCount);
        if (!isAdjacent(c0, c1, varCount)) {
          const rowDiff = Math.abs(p0.row - p1.row);
          const colDiff = Math.abs(p0.col - p1.col);
          if (rowDiff >= 1 && colDiff >= 1) {
            isDiagonal = true;
          }
        }
      }
    }

    const finding: GroupValidationFinding = {
      errorType: 'group-not-rectangle',
      misconceptionTag: 'group-not-rectangle',
      message: isDiagonal
        ? 'Cells are diagonally adjacent. In Boolean algebra, adjacent cells must differ by exactly one bit.'
        : `Selected cells do not form a valid rectangular subcube: ${cubeRes.reason}`,
      offendingCells: cells,
    };
    return { valid: false, primaryFinding: finding, secondaryFindings: [] };
  }

  const derivedCube = cubeRes.cube;
  const termStr =
    mode === 'SOP'
      ? cubeToProductString(derivedCube, varCount, names)
      : cubeToSumString(derivedCube, varCount, names);

  // 5. Valid group but NOT maximal
  const sol = getSolverSolution(context);
  const targetPis = sol.primeImplicants;
  let largerPi: (typeof targetPis)[number] | undefined;

  for (const pi of targetPis) {
    if (pi.cube.careMask !== derivedCube.careMask || pi.cube.valueMask !== derivedCube.valueMask) {
      const piCells = cubeCells(pi.cube, varCount);
      const isProperSubset =
        piCells.length > cells.length && cells.every((c) => piCells.includes(c));
      if (isProperSubset) {
        largerPi = pi;
        break;
      }
    }
  }

  if (largerPi) {
    const decomp = decomposeCubeToRectangles(largerPi.cube, varCount);
    const hasWrap = decomp.some((r) => r.wrap !== 'none');
    const tag: MisconceptionTag = hasWrap
      ? 'forgot-wraparound-grouping'
      : 'group-not-maximal';
    const finding: GroupValidationFinding = {
      errorType: 'group-not-maximal',
      misconceptionTag: tag,
      message: hasWrap
        ? `Group is valid but can be enlarged by wrapping around the map edges to form ${largerPi.termString}.`
        : `Group is valid but not maximal. It can be doubled to form the larger prime implicant ${largerPi.termString}.`,
      largerGroupCells: cubeCells(largerPi.cube, varCount),
      largerGroupTerm: largerPi.termString,
    };
    return {
      valid: false,
      primaryFinding: finding,
      secondaryFindings: [],
      cube: derivedCube,
      termString: termStr,
    };
  }

  // 6. Redundant with groups drawn so far
  const groupsSoFar = context.groupsSoFar ?? [];
  if (groupsSoFar.length > 0) {
    const coveredAlready = new Set<number>();
    for (const g of groupsSoFar) {
      for (const c of g) {
        if (mode === 'SOP' ? reqSet.has(c) : !reqSet.has(c) && !dcSet.has(c)) {
          coveredAlready.add(c);
        }
      }
    }

    const addsNewCell = cells.some((c) => {
      const isTarget = mode === 'SOP' ? reqSet.has(c) : !reqSet.has(c) && !dcSet.has(c);
      return isTarget && !coveredAlready.has(c);
    });

    if (!addsNewCell) {
      const finding: GroupValidationFinding = {
        errorType: 'redundant-group',
        misconceptionTag: 'redundant-group',
        message: 'This group is redundant: every required cell in it is already covered by your previous groups.',
      };
      return {
        valid: false,
        primaryFinding: finding,
        secondaryFindings: [],
        cube: derivedCube,
        termString: termStr,
        isPrime: true,
      };
    }
  }

  // 7. Correct Prime Implicant
  const isEssential = sol.essentialPrimeImplicants.some(
    (epi) => epi.cube.careMask === derivedCube.careMask && epi.cube.valueMask === derivedCube.valueMask
  );

  return {
    valid: true,
    secondaryFindings: [],
    cube: derivedCube,
    termString: termStr,
    isPrime: true,
    isEssential,
  };
}

/**
 * Validates a complete set of groups submitted by a student as their final solution.
 */
export function validateGroupSet(
  context: GroupValidationContext,
  groups: readonly (readonly number[])[]
): GroupSetValidationResult {
  const varCount = context.variableCount;
  const mode = context.mode ?? 'SOP';
  const reqSet = new Set(context.minterms);
  const dcSet = new Set(context.dontCares ?? []);
  const totalCells = 1 << varCount;
  const sol = getSolverSolution(context);

  const errors: GroupValidationFinding[] = [];
  const coveredCells = new Set<number>();

  // Determine required cells
  const allRequiredCells: number[] = [];
  for (let c = 0; c < totalCells; c++) {
    if (mode === 'SOP') {
      if (reqSet.has(c)) allRequiredCells.push(c);
    } else {
      if (!reqSet.has(c) && !dcSet.has(c)) allRequiredCells.push(c);
    }
  }

  // Validate each group individually
  const validCubes: Cube[] = [];
  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx] ?? [];
    const gRes = validateGroup(
      { ...context, groupsSoFar: groups.slice(0, idx) },
      g
    );
    if (!gRes.valid && gRes.primaryFinding) {
      errors.push(gRes.primaryFinding);
    }
    if (gRes.cube) {
      validCubes.push(gRes.cube);
    }
    for (const c of g) {
      coveredCells.add(c);
    }
  }

  // Check uncovered required minterms
  const uncovered = allRequiredCells.filter((c) => !coveredCells.has(c));
  if (uncovered.length > 0) {
    errors.push({
      errorType: 'empty-selection',
      misconceptionTag: 'missed-minterm',
      message: `The following required cell(s) were not covered: [${uncovered.join(', ')}].`,
      offendingCells: uncovered,
    });
  }

  // Check missed don't-cares opportunity
  const missedDc: number[] = [];
  if (dcSet.size > 0) {
    for (const g of groups) {
      const cubeRes = cellsToCube(g, varCount);
      if (cubeRes.ok) {
        for (const dc of dcSet) {
          if (!g.includes(dc)) {
            const augmented = [...g, dc];
            const augCube = cellsToCube(augmented, varCount);
            if (augCube.ok) {
              missedDc.push(dc);
            }
          }
        }
      }
    }
  }

  if (missedDc.length > 0) {
    const uniqueDc = Array.from(new Set(missedDc));
    errors.push({
      errorType: 'group-not-maximal',
      misconceptionTag: 'missed-dont-cares',
      message: `Don't-care cell(s) [${uniqueDc.join(', ')}] could have been included to enlarge your group.`,
      offendingCells: uniqueDc,
    });
  }

  // Check redundancy in the overall set
  const redundantGroupIndices: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const otherCells = new Set<number>();
    for (let j = 0; j < groups.length; j++) {
      if (i !== j) {
        const gj = groups[j] ?? [];
        for (const c of gj) otherCells.add(c);
      }
    }
    const gi = groups[i] ?? [];
    const allCoveredWithoutI = gi.every((c) => {
      const isReq = mode === 'SOP' ? reqSet.has(c) : !reqSet.has(c) && !dcSet.has(c);
      return !isReq || otherCells.has(c);
    });
    if (allCoveredWithoutI && gi.length > 0) {
      redundantGroupIndices.push(i);
    }
  }

  if (redundantGroupIndices.length > 0) {
    errors.push({
      errorType: 'redundant-group',
      misconceptionTag: 'redundant-group',
      message: `Group(s) at index [${redundantGroupIndices.map((i) => i + 1).join(', ')}] are redundant and can be removed without leaving any cell uncovered.`,
    });
  }

  // Cost calculations
  const studentTermCount = validCubes.length;
  let studentLiteralCount = 0;
  for (const c of validCubes) {
    studentLiteralCount += popCount(c.careMask);
  }

  const minimalTermCount = sol.primarySolution.termCount;
  const minimalLiteralCount = sol.primarySolution.literalCount;

  // Missing essentials
  const missingEssentials: string[] = [];
  for (const epi of sol.essentialPrimeImplicants) {
    const studentHasEpi = validCubes.some(
      (c) => c.careMask === epi.cube.careMask && c.valueMask === epi.cube.valueMask
    );
    if (!studentHasEpi) {
      missingEssentials.push(epi.termString);
    }
  }

  const isCompleteCover = uncovered.length === 0 && errors.filter((e) => e.errorType !== 'redundant-group').length === 0;
  const isMinimal =
    isCompleteCover &&
    studentTermCount === minimalTermCount &&
    studentLiteralCount === minimalLiteralCount &&
    redundantGroupIndices.length === 0;

  return {
    valid: isCompleteCover && redundantGroupIndices.length === 0,
    isMinimal,
    errors,
    uncoveredCells: uncovered,
    redundantGroupIndices,
    missedDontCareCells: Array.from(new Set(missedDc)),
    studentTermCount,
    studentLiteralCount,
    minimalTermCount,
    minimalLiteralCount,
    missingEssentials,
  };
}

/**
 * Converts a student's list of cell groups into equivalent BoolNode AST and string representation.
 */
export function convertGroupsToExpression(
  context: GroupValidationContext,
  groups: readonly (readonly number[])[]
): { readonly expression: BoolNode; readonly expressionString: string } {
  const varCount = context.variableCount;
  const mode = context.mode ?? 'SOP';
  const names = context.variableNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);

  if (groups.length === 0) {
    return {
      expression: { type: 'constant', value: mode === 'SOP' ? 0 : 1 },
      expressionString: mode === 'SOP' ? '0' : '1',
    };
  }

  const cubes: Cube[] = [];
  for (const g of groups) {
    const res = cellsToCube(g, varCount);
    if (res.ok) {
      cubes.push(res.cube);
    }
  }

  if (cubes.length === 0) {
    return {
      expression: { type: 'constant', value: mode === 'SOP' ? 0 : 1 },
      expressionString: mode === 'SOP' ? '0' : '1',
    };
  }

  if (mode === 'SOP') {
    const productTerms: ProductTerm[] = cubes.map((c) => {
      const literals: LiteralTerm[] = [];
      for (let i = 0; i < varCount; i++) {
        const bitPos = varCount - 1 - i;
        if (((c.careMask >>> bitPos) & 1) === 1) {
          const isOne = ((c.valueMask >>> bitPos) & 1) === 1;
          literals.push({
            variable: names[i] ?? String.fromCharCode(65 + i),
            negated: !isOne,
          });
        }
      }
      return { literals };
    });

    const ast = sopToAst(productTerms);
    const str = cubes.map((c) => cubeToProductString(c, varCount, names)).join(' + ');
    return { expression: ast, expressionString: str };
  } else {
    const sumTerms: SumTerm[] = cubes.map((c) => {
      const literals: LiteralTerm[] = [];
      for (let i = 0; i < varCount; i++) {
        const bitPos = varCount - 1 - i;
        if (((c.careMask >>> bitPos) & 1) === 1) {
          const isOne = ((c.valueMask >>> bitPos) & 1) === 1;
          literals.push({
            variable: names[i] ?? String.fromCharCode(65 + i),
            negated: isOne,
          });
        }
      }
      return { literals };
    });

    const ast = posToAst(sumTerms);
    const str = cubes.map((c) => cubeToSumString(c, varCount, names)).join('');
    return { expression: ast, expressionString: str };
  }
}
