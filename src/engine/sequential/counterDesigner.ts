/**
 * @file counterDesigner.ts
 * High-level orchestrator for synchronous counter and sequence detector synthesis (Stage 10B).
 * Connects machine models, excitation mapping, state table redirection, and K-map Boolean derivation.
 */

import type { FunctionColumn } from '../../types/sequential';
import {
  type CanonicalExcitationTable,
  type CanonicalStateTable,
  type FlipFlopType,
  type SequentialSpec,
  type StateDiagramData,
} from '../../types/sequential';
import { functionVariables } from './encoding';
import { buildExcitationTable } from './excitation';
import {
  deriveEquations,
  type DerivedEquation,
  type EquationCost,
  totalCost,
} from './nextStateEquations';
import { counterMachine } from './counterMachines';
import { detectorMachine } from './detectorMachines';
import {
  type NormalizedCounterSpec,
  type NormalizedDetectorSpec,
  validateSpec,
} from './specs';
import { diagramFromTable } from './stateDiagram';

/** Completed synthesis product of synchronous sequential design. */
export interface SequentialDesign {
  readonly spec: NormalizedCounterSpec | NormalizedDetectorSpec;
  readonly table: CanonicalStateTable;
  readonly diagram: StateDiagramData;
  readonly stateNames: Record<number, string>;
  readonly excitation: CanonicalExcitationTable;
  readonly functions: readonly FunctionColumn[];
  readonly equations: readonly DerivedEquation[];
  readonly totalCost: EquationCost;
  readonly variableOrder: readonly string[];
  readonly unusedRedirects: Record<number, number>;
  readonly notes: readonly string[];
}

/** Error diagnostic returned on sequential design failure. */
export interface SequentialDesignError {
  readonly code: string;
  readonly field?: string;
  readonly message: string;
}

/** Options configuring sequential synthesis and unused state redirection. */
export interface DesignSequentialOptions {
  /** Optional redirect map for unused state codes (code -> targetCode) */
  readonly unusedRedirects?: Record<number, number>;
}

/** Discriminated result of sequential machine synthesis. */
export type DesignSequentialResult =
  | { readonly ok: true; readonly design: SequentialDesign }
  | { readonly ok: false; readonly errors: readonly SequentialDesignError[] };

/**
 * Orchestrates full synthesis of a synchronous counter or sequence detector FSM.
 * Derives canonical tables, excitation matrices, and minimal SOP Boolean equations.
 *
 * @param spec High-level sequential specification (counter or detector)
 * @param options Optional configuration including unused state redirect targets
 * @returns Discriminated result containing the complete synthesized design or validation errors
 */
export function designSequential(
  spec: SequentialSpec,
  options: DesignSequentialOptions = {}
): DesignSequentialResult {
  // 1. Initial specification validation
  const validation = validateSpec(spec);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const normSpec = validation.spec;

  // 2. Reject asynchronous counter requests with specific diagnostic code
  if (normSpec.kind === 'counter' && normSpec.style === 'async') {
    return {
      ok: false,
      errors: [
        {
          code: 'use-async-designer',
          field: 'style',
          message:
            'Asynchronous ripple counters must be synthesized using designAsyncRipple.',
        },
      ],
    };
  }

  // 3. Build base machine (table and diagram)
  let baseTable: CanonicalStateTable;
  let stateNames: Record<number, string>;

  if (normSpec.kind === 'counter') {
    const machineRes = counterMachine(normSpec);
    if (!machineRes.ok) {
      return { ok: false, errors: machineRes.errors };
    }
    baseTable = machineRes.machine.table;
    stateNames = machineRes.machine.stateNames;
  } else {
    const machineRes = detectorMachine(normSpec);
    if (!machineRes.ok) {
      return { ok: false, errors: machineRes.errors };
    }
    baseTable = machineRes.machine.table;
    stateNames = machineRes.machine.stateNames;
  }

  // 4. Apply unused state redirects if requested
  const redirects = options.unusedRedirects ?? {};
  let finalTable = baseTable;
  const redirectKeys = Object.keys(redirects).map(Number);
  const notes: string[] = [];

  if (redirectKeys.length > 0) {
    const validSet = new Set(baseTable.validCodes);
    const updatedRows = baseTable.rows.map((row) => {
      const target = redirects[row.code];
      if (target !== undefined && !validSet.has(row.code)) {
        const targetName = stateNames[target] ?? `S${target}`;
        return {
          ...row,
          valid: true,
          nextCode: target,
          nextStateName: targetName,
          mealyOutput: 'X' as const,
          mooreOutput: 'X' as const,
        };
      }
      return row;
    });

    finalTable = {
      ...baseTable,
      rows: updatedRows,
    };

    notes.push(
      `Applied unused state redirects for codes: ${redirectKeys.join(', ')}.`
    );
  }

  const finalDiagram = diagramFromTable(finalTable, stateNames);

  // 5. Derive multi-flip-flop excitation table
  const flipFlop: FlipFlopType = normSpec.flipFlop;
  const excitation = buildExcitationTable(finalTable, flipFlop);
  const functions = excitation.functionColumns;

  // 6. Synthesize minimal SOP Boolean equations via Stage 7A K-map solver
  const eqResult = deriveEquations(functions);
  if (!eqResult.ok) {
    return {
      ok: false,
      errors: [
        {
          code: eqResult.error.code,
          field: 'equations',
          message: eqResult.error.message,
        },
      ],
    };
  }

  const equations = eqResult.equations;
  const cost = totalCost(equations);
  const variableOrder = functionVariables(
    finalTable.stateBits,
    finalTable.hasInput,
    finalTable.inputKind
  );

  // Record notes for constant equations
  for (const eq of equations) {
    if (eq.constant !== null) {
      notes.push(`Equation for ${eq.name} is constant ${eq.constant}.`);
    }
  }

  return {
    ok: true,
    design: {
      spec: normSpec,
      table: finalTable,
      diagram: finalDiagram,
      stateNames,
      excitation,
      functions,
      equations,
      totalCost: cost,
      variableOrder,
      unusedRedirects: redirects,
      notes,
    },
  };
}
