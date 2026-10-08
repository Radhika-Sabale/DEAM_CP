/**
 * @file index.ts
 * Module definition, contract validators, input/output extractors, and component exports
 * for the Boolean Expression Analysis laboratory module.
 */

import type {
  BoolNode,
  TruthTable,
} from '../../types/ast';
import type {
  DesignProject,
  ProjectPatch,
} from '../../types/designProject';
import type {
  CreateProjectPatch,
  ExtractModuleInputs,
  ModuleContract,
  ModuleDefinition,
} from '../../types/moduleInterface';
import { BooleanPage } from './BooleanPage';

export { BooleanPage } from './BooleanPage';
export { ExpressionInput } from './ExpressionInput';
export { TruthTableView } from './TruthTableView';
export { SimplificationSteps } from './SimplificationSteps';
export { EquivalencePanel } from './EquivalencePanel';
export { UniversalGatePanel } from './UniversalGatePanel';

/**
 * Architectural specification for the Boolean module registered in the central catalog.
 */
export const booleanModuleDefinition: ModuleDefinition = {
  id: 'boolean-tool',
  title: 'Boolean Expression Analysis',
  description:
    'Symbolic AST parsing, step-by-step algebraic simplification, truth table generation, and universal gate synthesis.',
  icon: 'code',
  reads: ['variables', 'expression', 'truthTable'],
  writes: ['variables', 'expression', 'truthTable'],
  nextModules: ['kmap-solver'],
};

export interface BooleanModuleInputs {
  readonly variables?: readonly string[];
  readonly expression?: BoolNode | null;
  readonly truthTable?: TruthTable | null;
}

export interface BooleanModuleOutputs {
  readonly variables: readonly string[];
  readonly expression: BoolNode | null;
  readonly truthTable: TruthTable | null;
}

/**
 * Pure extractor pulling required sub-state from DesignProject.
 */
export const extractBooleanInputs: ExtractModuleInputs<BooleanModuleInputs> = (
  project: DesignProject
): BooleanModuleInputs => ({
  variables: project.variables,
  expression: project.expression,
  truthTable: project.truthTable,
});

/**
 * Pure patch generator formatting student outputs for project persistence.
 */
export const createBooleanPatch: CreateProjectPatch<BooleanModuleOutputs> = (
  outputs: BooleanModuleOutputs
): ProjectPatch => ({
  variables: outputs.variables,
  expression: outputs.expression,
  truthTable: outputs.truthTable,
});

/**
 * Pedagogical prerequisite validator for the Boolean module.
 * Verifies that an expression or truth table with 2 to 5 variables is ready for K-Map solving.
 *
 * @param project The active DesignProject
 * @returns Array of readable missing prerequisite messages, or null if ready
 */
export function validateBooleanPrerequisites(
  project: DesignProject
): readonly string[] | null {
  const hasExpression = project.expression !== null && project.expression !== undefined;
  const hasTruthTable =
    project.truthTable &&
    project.truthTable.rows &&
    project.truthTable.rows.length > 0;

  if (!hasExpression && !hasTruthTable) {
    return [
      'Please enter and parse a Boolean expression or generate a Truth Table before proceeding to the K-Map solver.',
    ];
  }

  const varCount =
    project.variables?.length ?? (project.truthTable?.variables.length ?? 0);

  if (varCount < 2 || varCount > 5) {
    return [
      `K-maps support 2 to 5 variables; your expression has ${varCount}.`,
    ];
  }

  return null;
}

/**
 * Unified ModuleContract implementation for host integration.
 */
export const booleanModuleContract: ModuleContract<
  BooleanModuleInputs,
  BooleanModuleOutputs
> = {
  definition: booleanModuleDefinition,
  extractInputs: extractBooleanInputs,
  createPatch: createBooleanPatch,
  validatePrerequisites: validateBooleanPrerequisites,
};

export default BooleanPage;
