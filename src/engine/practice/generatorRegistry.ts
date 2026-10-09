/**
 * @file generatorRegistry.ts
 * Typed registry mapping module IDs to practice-problem generator functions (Stage 11A).
 *
 * Follows the same registration pattern as the Feedback Engine's validatorRegistry:
 * generators register at import time, and duplicate registration throws.
 */

import type {
  Difficulty,
  GenerateProblemResult,
  GeneratorFn,
  GeneratorUnavailableError,
  Problem,
} from './types';

// ---------------------------------------------------------------------------
// Module-level registry
// ---------------------------------------------------------------------------

const registry = new Map<string, GeneratorFn>();

/**
 * Registers a problem generator for a specific module.
 *
 * @param moduleId The lab module identifier
 * @param generator The generator function
 * @throws Error if a generator for this module is already registered
 */
export function registerGenerator(moduleId: string, generator: GeneratorFn): void {
  if (registry.has(moduleId)) {
    throw new Error(
      `Generator for module "${moduleId}" is already registered. ` +
        `Duplicate registration is disallowed.`
    );
  }
  registry.set(moduleId, generator);
}

/**
 * Retrieves the registered generator for a module.
 *
 * @param moduleId The lab module identifier
 * @returns The generator function, or undefined if not registered
 */
export function getGenerator(moduleId: string): GeneratorFn | undefined {
  return registry.get(moduleId);
}

/**
 * Lists all module IDs that have a registered problem generator.
 *
 * @returns Sorted array of available module IDs
 */
export function listAvailableModules(): readonly string[] {
  return Array.from(registry.keys()).sort();
}

/**
 * Generates a practice problem for a given module, difficulty, and seed.
 * Returns a typed error if the module has no registered generator.
 *
 * @param moduleId The lab module identifier
 * @param difficulty Problem difficulty tier
 * @param seed Deterministic seed
 * @returns Discriminated result with the problem or a typed error
 */
export function generateProblem(
  moduleId: string,
  difficulty: Difficulty,
  seed: number
): GenerateProblemResult {
  const gen = registry.get(moduleId);
  if (!gen) {
    const error: GeneratorUnavailableError = {
      code: 'generator-unavailable',
      moduleId,
      message: `No practice-problem generator is registered for module "${moduleId}".`,
    };
    return { ok: false, error };
  }
  const problem = gen(difficulty, seed);
  return { ok: true, problem };
}

/**
 * Generates `count` DISTINCT problems (no duplicate statement texts)
 * in a deterministic order by incrementing the seed.
 *
 * @param moduleId The lab module identifier
 * @param difficulty Problem difficulty tier
 * @param seed Starting seed
 * @param count Number of distinct problems to generate
 * @returns Array of distinct problems, or a typed error
 */
export function generateSet(
  moduleId: string,
  difficulty: Difficulty,
  seed: number,
  count: number
): readonly Problem[] {
  const gen = registry.get(moduleId);
  if (!gen) {
    throw new Error(`No practice-problem generator is registered for module "${moduleId}".`);
  }

  const problems: Problem[] = [];
  const seenStatements = new Set<string>();
  let currentSeed = seed;
  let attempts = 0;
  const maxAttempts = count * 20; // Bounded search

  while (problems.length < count && attempts < maxAttempts) {
    const problem = gen(difficulty, currentSeed);
    if (!seenStatements.has(problem.statement.text)) {
      seenStatements.add(problem.statement.text);
      problems.push(problem);
    }
    currentSeed++;
    attempts++;
  }

  return problems;
}

/**
 * Clears all registered generators (used for test isolation).
 */
export function clearGeneratorRegistry(): void {
  registry.clear();
}
