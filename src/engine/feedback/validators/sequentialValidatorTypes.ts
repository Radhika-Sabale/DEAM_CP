/**
 * @file sequentialValidatorTypes.ts
 * Context interfaces and parsing utilities for sequential step validators.
 */

import type { LogicValue } from '../../../types/ast';
import type { SequentialSpec } from '../../../types/sequential';

/** Context payload for sequential domain step validation. */
export interface SequentialValidationContext {
  readonly spec?: SequentialSpec;
  readonly code?: number;
  readonly input?: LogicValue | number;
  readonly field?: 'next' | 'output';
  readonly functionName?: string;
  readonly unusedRedirects?: Record<number, number>;
  readonly sequential?: SequentialValidationContext;
}

/** Utility to normalize numbers, strings, and LogicValues into consistent representation. */
export function parseCodeOrValue(val: unknown): number | LogicValue | string {
  if (typeof val === 'number') return val;
  if (val === '0' || val === 0) return 0;
  if (val === '1' || val === 1) return 1;
  if (val === 'X' || val === 'x') return 'X';
  if (typeof val === 'string') {
    const parsed = parseInt(val.replace(/\D/g, ''), 10);
    return isNaN(parsed) ? val : parsed;
  }
  return 'X';
}
