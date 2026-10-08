/**
 * @file sequentialHandoff.ts
 * Pipeline handoff builders for passing excitation functions to the K-Map solver.
 */

import type { TruthTable, TruthTableRow } from '../../types/ast';
import type { DesignProject, ProjectPatch } from '../../types/designProject';
import { designFromProject } from './sequentialPrerequisites';

/** Result object for K-Map handoff patch creation. */
export interface KMapHandoffResult {
  readonly ok: boolean;
  readonly patch?: ProjectPatch;
  readonly targetFunction?: string;
  readonly variableCount?: number;
  readonly error?: string;
}

/**
 * Builds a project patch to hand off a specific flip-flop excitation function to the K-Map solver.
 *
 * Populates truthTable and variables in explicit order, writes lastHandoff metadata,
 * and clears downstream stale caches (kmap: null, minimizedExpression: null, circuit: null).
 */
export function createKMapHandoffPatch(
  project: DesignProject,
  functionName: string
): KMapHandoffResult {
  const design = designFromProject(project);
  if (!design) {
    return { ok: false, error: 'Cannot create K-Map handoff: invalid or missing sequential specification.' };
  }

  const fn = design.functions.find((f) => f.name === functionName);
  if (!fn) {
    return { ok: false, error: `Function '${functionName}' not found in excitation functions for this design.` };
  }

  const varCount = fn.variables.length;
  if (varCount < 2 || varCount > 5) {
    return {
      ok: false,
      error: `K-Map solver supports 2 to 5 variables, but function '${functionName}' has ${varCount} variable(s).`,
    };
  }

  const numRows = 1 << varCount;
  const rows: TruthTableRow[] = [];
  for (let r = 0; r < numRows; r++) {
    const inputs: (0 | 1)[] = [];
    for (let bit = 0; bit < varCount; bit++) {
      const bitVal = (r >> (varCount - 1 - bit)) & 1;
      inputs.push(bitVal as 0 | 1);
    }
    const val = fn.column[r] ?? 'X';
    rows.push({
      index: r,
      inputs,
      output: val,
    });
  }

  const truthTable: TruthTable = {
    variables: [...fn.variables],
    rows,
  };

  const patch: ProjectPatch = {
    variables: [...fn.variables],
    truthTable,
    // Invalidate stale downstream artifacts
    kmap: null,
    minimizedExpression: null,
    circuit: null,
    lastHandoff: {
      from: 'sequential-designer',
      to: 'kmap-solver',
      timestamp: new Date().toISOString(),
      summary: `Handoff excitation function ${functionName} to K-Map solver`,
    },
  };

  return {
    ok: true,
    patch,
    targetFunction: functionName,
    variableCount: varCount,
  };
}
