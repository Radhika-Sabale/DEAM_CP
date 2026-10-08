/**
 * @file circuitBuild.ts
 * Synthesizes combinational steering and excitation circuit schematics for sequential state machines (Stage 10B).
 * Translates Boolean equations into CircuitGraph netlists via Stage 8B generateCircuit,
 * computes flip-flop block layouts, and executes strict truth-table extraction self-checks.
 *
 * ============================================================================
 * ARCHITECTURAL NOTICE:
 * The Circuit engine has no internal flip-flop node type; flip-flops are modelled
 * behaviourally and represented visually as external functional blocks. The synthesized
 * circuit graph represents the combinational next-state, excitation, and output logic.
 * ============================================================================
 */

import type { CircuitGraph } from '../../types/circuit';
import type { FlipFlopType } from '../../types/sequential';
import { extractTruthTable } from '../circuit/extractTruthTable';
import { generateCircuit } from '../circuit/generator';
import type { GeneratorStyle } from '../circuit/generatorTypes';
import { layoutCircuit } from '../circuit/layout';
import type { SequentialDesign } from './counterDesigner';
import { flipFlopInputNames } from './encoding';

/** Visual block specification for an external flip-flop register bit. */
export interface FlipFlopBlock {
  readonly bitIndex: number;
  readonly type: FlipFlopType;
  readonly inputNames: readonly string[];
  readonly stateName: string;
}

/** Verification report comparing extracted circuit truth table with sequential function columns. */
export interface CircuitSelfCheckReport {
  readonly passed: boolean;
  readonly checkedOutputs: readonly string[];
  readonly errors: readonly string[];
}

/** Options configuring combinational sequential circuit schematic synthesis. */
export interface BuildCombinationalCircuitOptions {
  /** Target gate topology style (default: 'direct') */
  readonly style?: GeneratorStyle;
  /** Maximum gate input fan-in (2..8, default: 4) */
  readonly maxFanIn?: number;
  /** Whether to share common subexpressions (default: true) */
  readonly shareSubexpressions?: boolean;
}

/** Successful result of combinational sequential circuit generation. */
export interface CombinationalCircuitBuildResult {
  readonly ok: true;
  readonly graph: CircuitGraph;
  readonly gateCount: number;
  readonly styleApplied: GeneratorStyle;
  readonly flipFlopBlocks: readonly FlipFlopBlock[];
  readonly selfCheck: CircuitSelfCheckReport;
}

/** Circuit build synthesis error. */
export interface CombinationalCircuitBuildError {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** Discriminated response of buildCombinationalCircuit. */
export type BuildCombinationalCircuitResponse =
  | CombinationalCircuitBuildResult
  | CombinationalCircuitBuildError;

/**
 * Builds the combinational excitation and output schematic for a sequential design.
 *
 * @param design Complete synthesized SequentialDesign
 * @param options Schematic style and fan-in options
 * @returns Schematic graph, flip-flop block descriptors, and self-check report
 */
export function buildCombinationalCircuit(
  design: SequentialDesign,
  options: BuildCombinationalCircuitOptions = {}
): BuildCombinationalCircuitResponse {
  const variables = design.variableOrder;
  const outputs = design.equations.map((eq) => ({
    name: eq.name,
    expr: eq.expression,
  }));

  const style = options.style ?? 'direct';

  // 1. Synthesize schematic using Stage 8B generator
  const genRes = generateCircuit({
    variables,
    outputs,
    style,
    maxFanIn: options.maxFanIn,
    shareSubexpressions: options.shareSubexpressions,
  });

  if (!genRes.ok) {
    return {
      ok: false,
      error: {
        code: genRes.error.code,
        message: genRes.error.message,
      },
    };
  }

  // 2. Perform automated grid layout
  const layoutedGraph = layoutCircuit(genRes.graph);

  // 3. Generate behavioural flip-flop block descriptors
  const stateBits = design.table.stateBits;
  const ffType = design.spec.flipFlop;
  const flipFlopBlocks: FlipFlopBlock[] = [];

  for (let bit = stateBits - 1; bit >= 0; bit--) {
    flipFlopBlocks.push({
      bitIndex: bit,
      type: ffType,
      inputNames: flipFlopInputNames(ffType, bit),
      stateName: `Q${bit}`,
    });
  }

  // 4. Perform strict self-check: extract truth table from graph and compare against function columns
  const outputOrder = design.equations.map((e) => e.name);
  const extractRes = extractTruthTable(layoutedGraph, {
    inputOrder: variables,
    outputOrder,
  });

  const checkErrors: string[] = [];
  const checkedOutputs: string[] = [];

  if (!extractRes.ok) {
    checkErrors.push(`Truth table extraction failed: ${extractRes.error.message}`);
  } else {
    const extractedTable = extractRes.table;

    for (let outIdx = 0; outIdx < outputOrder.length; outIdx++) {
      const outName = outputOrder[outIdx];
      if (!outName) continue;
      checkedOutputs.push(outName);

      const fnCol = design.functions.find((f) => f.name === outName);
      if (!fnCol) {
        checkErrors.push(`Missing function column for output '${outName}'.`);
        continue;
      }

      const totalExtractedRows = extractedTable.rows.length;
      for (let r = 0; r < totalExtractedRows; r++) {
        const extractedRow = extractedTable.rows[r];
        if (!extractedRow) continue;

        // Map extracted row variable valuations to the specific function column's variable space
        let fnRowIdx = 0;
        for (const varName of fnCol.variables) {
          const varPos = variables.indexOf(varName);
          const bitVal = varPos >= 0 ? (extractedRow.inputs[varPos] ?? 0) : 0;
          fnRowIdx = (fnRowIdx << 1) | (bitVal === 1 ? 1 : 0);
        }

        const expected = fnCol.column[fnRowIdx];
        if (expected === 0 || expected === 1) {
          const actual = extractedRow.outputs[outIdx];
          if (actual !== expected) {
            checkErrors.push(
              `Output '${outName}' mismatch at circuit row ${r} (fn row ${fnRowIdx}): extracted ${actual}, expected ${expected}.`
            );
          }
        }
      }
    }
  }

  const selfCheck: CircuitSelfCheckReport = {
    passed: checkErrors.length === 0,
    checkedOutputs,
    errors: checkErrors,
  };

  return {
    ok: true,
    graph: layoutedGraph,
    gateCount: genRes.gateCount,
    styleApplied: genRes.styleApplied,
    flipFlopBlocks,
    selfCheck,
  };
}
