/**
 * @file validatorRegistry.ts
 * Typed registry mapping step submission kinds to deterministic domain validators.
 *
 * ARCHITECTURAL NOTE:
 * The module-level `registry` Map defined below is the sole module-level state in the
 * feedback engine. It is populated at import time via explicit registrations.
 * Future lab modules (e.g. K-map groupValidator, sequential verifyStep) register their
 * validators here without requiring modifications to the core feedback evaluation engine.
 */

import type { StepSubmissionKind } from '../../types/feedback';
import type { ValidatorFn } from './types';

/**
 * Module-level registry mapping submission kinds to validator functions.
 */
const registry = new Map<string, ValidatorFn>();

/**
 * Registers a validator function for a specific step submission kind.
 *
 * @param kind The step submission kind discriminator
 * @param validator The validator implementation function
 * @throws Error if a validator for this kind has already been registered
 */
export function registerValidator(
  kind: StepSubmissionKind | string,
  validator: ValidatorFn
): void {
  if (registry.has(kind)) {
    throw new Error(
      `Validator for step kind "${kind}" is already registered. Duplicate registration is disallowed.`
    );
  }
  registry.set(kind, validator);
}

/**
 * Retrieves the registered validator for a given step submission kind.
 *
 * @param kind The step submission kind discriminator string
 * @returns The validator function, or undefined if not registered
 */
export function getValidator(kind: string): ValidatorFn | undefined {
  return registry.get(kind);
}

/**
 * Unregisters a validator by kind (used primarily for test isolation).
 *
 * @param kind The step submission kind to remove
 */
export function unregisterValidator(kind: string): boolean {
  return registry.delete(kind);
}

/**
 * Clears all registered validators (used for test teardown).
 */
export function clearValidatorRegistry(): void {
  registry.clear();
}

/**
 * Returns all currently registered step kinds.
 */
export function getRegisteredStepKinds(): readonly string[] {
  return Array.from(registry.keys());
}
