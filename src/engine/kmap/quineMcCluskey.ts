/**
 * @file quineMcCluskey.ts
 * Tabular Quine-McCluskey algorithm for identifying all prime implicants.
 *
 * Implements:
 * - Grouping minterms and don't-cares by Hamming weight (count of 1s).
 * - Iterative pairwise combination of adjacent implicants differing by 1 bit.
 * - Recording the complete tabular trace across all columns and groups.
 * - Collecting uncombined implicants that cover at least one required minterm.
 */

import { popCount } from '../common/bitUtils';
import type { Cube } from './layout';

/**
 * An individual implicant entry within a Quine-McCluskey table column.
 */
export interface QmImplicant {
  /** Unique binary string descriptor (e.g. "01-0") */
  readonly id: string;
  /** Subcube specification */
  readonly cube: Cube;
  /** Ascending list of all covered minterms and don't-cares */
  readonly minterms: readonly number[];
  /** True if this implicant combined with another in the next column */
  readonly combined: boolean;
  /** Binary representation with '-' for don't-care bits */
  readonly binaryString: string;
}

/**
 * A group of implicants sharing the same count of 1s in their care bits.
 */
export interface QmGroup {
  readonly groupIndex: number;
  readonly implicants: readonly QmImplicant[];
}

/**
 * A column of the Quine-McCluskey table (Column 0 = singles, 1 = pairs, etc.).
 */
export interface QmColumn {
  readonly columnIndex: number;
  readonly termSize: number;
  readonly groups: readonly QmGroup[];
}

/**
 * Complete step-by-step trace of the Quine-McCluskey tabular reduction.
 */
export interface QmTrace {
  readonly columns: readonly QmColumn[];
}

/**
 * Result of the Quine-McCluskey prime implicant generation.
 */
export interface QmResult {
  readonly primeImplicants: readonly QmImplicant[];
  readonly trace: QmTrace;
}

/**
 * Converts a cube into its fixed-width binary string representation (e.g. "01-0").
 * Bit order: variable 0 is MSB (bit varCount - 1).
 */
export function cubeToBinaryString(cube: Cube, varCount: number): string {
  let str = '';
  for (let i = 0; i < varCount; i++) {
    const bitPos = varCount - 1 - i;
    const isCare = ((cube.careMask >>> bitPos) & 1) === 1;
    if (!isCare) {
      str += '-';
    } else {
      const bitVal = ((cube.valueMask >>> bitPos) & 1) === 1;
      str += bitVal ? '1' : '0';
    }
  }
  return str;
}

interface MutableImplicant {
  readonly id: string;
  readonly cube: Cube;
  readonly minterms: readonly number[];
  combined: boolean;
  readonly binaryString: string;
}

interface MutableGroup {
  readonly groupIndex: number;
  readonly implicants: MutableImplicant[];
}

/**
 * Executes the Quine-McCluskey tabular reduction.
 *
 * @param varCount Number of Boolean variables (2..5)
 * @param minterms Required minterms to be covered
 * @param dontCares Optional don't-care minterms that may participate in combinations
 * @returns Prime implicants and full step trace
 */
export function runQuineMcCluskey(
  varCount: number,
  minterms: readonly number[],
  dontCares: readonly number[] = []
): QmResult {
  const reqSet = new Set(minterms);
  const allTerms = Array.from(new Set([...minterms, ...dontCares])).sort((a, b) => a - b);

  if (allTerms.length === 0 || reqSet.size === 0) {
    return {
      primeImplicants: [],
      trace: { columns: [] },
    };
  }

  const fullCareMask = varCount === 32 ? 0xffffffff : ((1 << varCount) - 1) >>> 0;

  // Step 1: Initialize Column 0
  const col0GroupsMap = new Map<number, MutableImplicant[]>();

  for (const m of allTerms) {
    const cube: Cube = { careMask: fullCareMask, valueMask: m >>> 0 };
    const bStr = cubeToBinaryString(cube, varCount);
    const ones = popCount(m);
    const imp: MutableImplicant = {
      id: bStr,
      cube,
      minterms: [m],
      combined: false,
      binaryString: bStr,
    };
    const list = col0GroupsMap.get(ones);
    if (list) {
      list.push(imp);
    } else {
      col0GroupsMap.set(ones, [imp]);
    }
  }

  const sortedOnes = Array.from(col0GroupsMap.keys()).sort((a, b) => a - b);
  let currentGroups: MutableGroup[] = sortedOnes.map((ones) => ({
    groupIndex: ones,
    implicants: col0GroupsMap.get(ones) ?? [],
  }));

  const allColumns: QmColumn[] = [];
  const candidatePrimeImplicants: QmImplicant[] = [];
  let columnIndex = 0;

  while (currentGroups.length > 0) {
    const nextGroupsMap = new Map<number, MutableImplicant[]>();
    const seenInNext = new Set<string>();

    // Compare adjacent groups
    for (let i = 0; i < currentGroups.length; i++) {
      const gA = currentGroups[i];
      if (!gA) continue;

      for (let j = i + 1; j < currentGroups.length; j++) {
        const gB = currentGroups[j];
        if (!gB) continue;

        if (gB.groupIndex !== gA.groupIndex + 1) {
          continue;
        }

        for (const impA of gA.implicants) {
          for (const impB of gB.implicants) {
            if (impA.cube.careMask !== impB.cube.careMask) {
              continue;
            }

            const diff = (impA.cube.valueMask ^ impB.cube.valueMask) >>> 0;
            // Diff must be exactly 1 bit
            if (diff !== 0 && (diff & (diff - 1)) === 0) {
              // impA must have 0 at diff bit, impB must have 1
              if ((impA.cube.valueMask & diff) === 0) {
                impA.combined = true;
                impB.combined = true;

                const newCare = (impA.cube.careMask & ~diff) >>> 0;
                const newVal = (impA.cube.valueMask & ~diff) >>> 0;
                const newCube: Cube = { careMask: newCare, valueMask: newVal };
                const newBStr = cubeToBinaryString(newCube, varCount);

                if (!seenInNext.has(newBStr)) {
                  seenInNext.add(newBStr);
                  const mergedMinterms = Array.from(new Set([...impA.minterms, ...impB.minterms])).sort(
                    (a, b) => a - b
                  );
                  const combinedImp: MutableImplicant = {
                    id: newBStr,
                    cube: newCube,
                    minterms: mergedMinterms,
                    combined: false,
                    binaryString: newBStr,
                  };

                  const targetGroupIndex = gA.groupIndex;
                  const targetList = nextGroupsMap.get(targetGroupIndex);
                  if (targetList) {
                    targetList.push(combinedImp);
                  } else {
                    nextGroupsMap.set(targetGroupIndex, [combinedImp]);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Freeze current column
    const frozenGroups: QmGroup[] = currentGroups.map((g) => ({
      groupIndex: g.groupIndex,
      implicants: g.implicants.map((imp) => {
        const frozen: QmImplicant = {
          id: imp.id,
          cube: imp.cube,
          minterms: imp.minterms,
          combined: imp.combined,
          binaryString: imp.binaryString,
        };
        if (!imp.combined) {
          candidatePrimeImplicants.push(frozen);
        }
        return frozen;
      }),
    }));

    allColumns.push({
      columnIndex,
      termSize: 1 << columnIndex,
      groups: frozenGroups,
    });

    // Advance to next column
    const nextGroupKeys = Array.from(nextGroupsMap.keys()).sort((a, b) => a - b);
    currentGroups = nextGroupKeys.map((k) => ({
      groupIndex: k,
      implicants: nextGroupsMap.get(k) ?? [],
    }));
    columnIndex++;
  }

  // Filter prime implicants: must cover at least one required minterm
  const primeImplicants = candidatePrimeImplicants.filter((pi) =>
    pi.minterms.some((m) => reqSet.has(m))
  );

  return {
    primeImplicants,
    trace: { columns: allColumns },
  };
}
