/**
 * @file circuitModuleLogic.ts
 * Pure business logic and project store synchronization utilities for the
 * Digital Circuit Schematic Simulator module (Stage 8C).
 */

import type { BoolNode } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';
import type { DesignProject, ProjectPatch } from '../../types/designProject';
import { generateCircuit, type GeneratorStyle } from '../../engine/circuit/generator';
import { layoutCircuit } from '../../engine/circuit/layout';

/**
 * Creates a project store patch updating only the circuit schematic graph.
 *
 * @param graph New circuit graph
 * @returns Clean ProjectPatch with updated circuit field
 */
export function createCircuitStorePatch(graph: CircuitGraph): ProjectPatch {
  return {
    circuit: graph,
  };
}

/**
 * Checks whether the project contains a minimized expression suitable for circuit synthesis.
 *
 * @param project Active DesignProject state
 * @returns Tuple of [hasExpression: boolean, description: string]
 */
export function getAvailableExpressionFromProject(
  project: DesignProject
): { readonly expression: BoolNode; readonly label: string; readonly isPos: boolean } | null {
  if (project.minimizedExpression?.sop?.ast) {
    return {
      expression: project.minimizedExpression.sop.ast,
      label: project.minimizedExpression.sop.text ?? 'SOP',
      isPos: false,
    };
  }

  if (project.minimizedExpression?.pos?.ast) {
    return {
      expression: project.minimizedExpression.pos.ast,
      label: project.minimizedExpression.pos.text ?? 'POS',
      isPos: true,
    };
  }

  if (project.expression) {
    return {
      expression: project.expression,
      label: 'Expression from Boolean Tool',
      isPos: false,
    };
  }

  return null;
}

/**
 * Determines valid synthesizer styles available for a given Boolean AST.
 *
 * @param isPos Whether the expression is in POS form
 * @returns Array of valid generator styles with enabled flags
 */
export function getAvailableStylesForExpression(isPos: boolean): readonly {
  readonly style: GeneratorStyle;
  readonly label: string;
  readonly description: string;
  readonly isRecommended: boolean;
}[] {
  return [
    {
      style: isPos ? 'pos-or-and' : 'sop-and-or',
      label: isPos ? 'Two-Level POS (OR-AND)' : 'Two-Level SOP (AND-OR)',
      description: isPos
        ? 'Direct product-of-sums realization using first-stage OR gates and a second-stage AND gate.'
        : 'Direct sum-of-products realization using first-stage AND gates and a second-stage OR gate.',
      isRecommended: true,
    },
    {
      style: isPos ? 'nor-only' : 'nand-only',
      label: isPos ? 'Universal NOR-Only' : 'Universal NAND-Only',
      description: isPos
        ? 'Dual universal NOR implementation preserving exact POS functionality.'
        : 'Dual universal NAND implementation preserving exact SOP functionality.',
      isRecommended: false,
    },
    {
      style: 'direct',
      label: 'Direct AST Tree',
      description: 'Synthesizes the exact unflattened expression AST structure.',
      isRecommended: false,
    },
  ];
}

/**
 * Synthesizes and automatically lays out a circuit schematic from a project expression.
 *
 * @param expression Boolean AST to synthesize
 * @param variables Variable names in order
 * @param style Generator architecture style
 * @param outputName Target output port label (defaults to 'F')
 * @returns Synthesized and laid-out CircuitGraph, or null if synthesis failed
 */
export function synthesizeAndLayoutCircuit(
  expression: BoolNode,
  variables: readonly string[],
  style: GeneratorStyle,
  outputName = 'F'
): { readonly graph: CircuitGraph; readonly appliedStyle: GeneratorStyle; readonly notes: readonly string[] } | null {
  const genRes = generateCircuit({
    variables,
    outputs: [{ name: outputName, expr: expression }],
    style,
    maxFanIn: 4,
    shareInverters: true,
    shareSubexpressions: true,
  });

  if (!genRes.ok) {
    return null;
  }

  const laidOutGraph = layoutCircuit(genRes.graph);
  return {
    graph: laidOutGraph,
    appliedStyle: style,
    notes: genRes.notes,
  };
}
