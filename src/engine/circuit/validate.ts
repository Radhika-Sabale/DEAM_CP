/**
 * @file validate.ts
 * Static topology and semantic netlist validator for digital circuits.
 *
 * Emits sorted, actionable diagnostics covering structural integrity,
 * wiring correctness, floating inputs, naming hygiene, dead logic,
 * and combinational vs sequential feedback loops.
 */

import type {
  CircuitDiagnostic,
  CircuitDiagnosticCode,
  CircuitDiagnosticSeverity,
  CircuitGraph,
  CircuitNode,
} from '../../types/circuit';
import { buildIndex } from './graphAnalysis';
import {
  checkCycles,
  checkFloatingAndUndriven,
  checkLabels,
  checkUsageAndDeadLogic,
  checkWiresAndDrivers,
} from './validateRules';

/**
 * Options for circuit validation.
 */
export interface ValidateCircuitOptions {
  /**
   * If true, cycles are treated as informational feedback-loop diagnostics
   * instead of blocking/critical combinational-loop errors (used for latches/flip-flops).
   */
  readonly allowFeedback?: boolean;
}

/**
 * Result of circuit validation analysis.
 */
export interface ValidationResult {
  readonly diagnostics: readonly CircuitDiagnostic[];
  readonly hasErrors: boolean;
  readonly hasBlockingErrors: boolean;
}

const severityRank: Record<CircuitDiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const blockingCodes: CircuitDiagnosticCode[] = [
  'invalid-reference',
  'invalid-pin',
  'multiple-drivers',
];

/**
 * Validates a digital circuit graph for structural and semantic correctness.
 *
 * @param graph Circuit graph to validate
 * @param options Validation options (e.g. allowFeedback)
 * @returns Validation result with sorted diagnostics and error flags
 */
export function validateCircuit(
  graph: CircuitGraph,
  options: ValidateCircuitOptions = {}
): ValidationResult {
  const allowFeedback = options.allowFeedback ?? false;
  const diagnostics: CircuitDiagnostic[] = [];

  const nodeMap = new Map<string, CircuitNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  // 1. Wire endpoints, pin bounds, and multiple drivers
  checkWiresAndDrivers(graph, nodeMap, diagnostics);

  // 2. Terminal label uniqueness and format
  checkLabels(graph, diagnostics);

  // 3. Connectivity indexing
  const index = buildIndex(graph);

  // 4. Floating pins & undriven outputs
  checkFloatingAndUndriven(graph, index, diagnostics);

  // 5. Unused inputs, dangling gates & dead logic
  checkUsageAndDeadLogic(graph, index, diagnostics);

  // 6. Cycles and feedback loops
  checkCycles(index, nodeMap, allowFeedback, diagnostics);

  // Sort deterministically:
  // 1. Severity: error (0), warning (1), info (2)
  // 2. Code alphabetically
  // 3. First node ID alphabetically
  diagnostics.sort((a, b) => {
    const sDiff = severityRank[a.severity] - severityRank[b.severity];
    if (sDiff !== 0) return sDiff;
    const cDiff = a.code.localeCompare(b.code);
    if (cDiff !== 0) return cDiff;
    const aNode = a.nodeIds[0] ?? '';
    const bNode = b.nodeIds[0] ?? '';
    return aNode.localeCompare(bNode);
  });

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const hasBlockingErrors = diagnostics.some((d) => blockingCodes.includes(d.code));

  return {
    diagnostics,
    hasErrors,
    hasBlockingErrors,
  };
}
