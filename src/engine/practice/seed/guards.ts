/**
 * @file guards.ts
 * Hand-written runtime type guards for seed problem JSON payloads (Stage 12A).
 * Complies with strict TypeScript and avoids external runtime schema libraries.
 */

import type { MisconceptionTag } from '../../../types/feedback';
import type { ModuleId } from '../../../types/designProject';
import type { Difficulty, ProblemStep } from '../types';
import type { SeedFile, SeedProblem } from './types';

const VALID_MODULE_IDS: readonly ModuleId[] = [
  'number-systems',
  'boolean-tool',
  'kmap-solver',
  'circuit-simulator',
  'flipflop-simulator',
  'sequential-designer',
  'practice',
  'quiz',
  'prepost-test',
  'sus-survey',
  'teacher-dashboard',
  'alu',
  '8086-cpu',
  'interrupt-controller',
];

const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const VALID_MISCONCEPTION_TAGS: readonly MisconceptionTag[] = [
  'forgot-wraparound-grouping',
  'grouped-non-power-of-two',
  'group-not-rectangle',
  'group-not-maximal',
  'redundant-group',
  'missed-minterm',
  'covered-a-zero',
  'missed-dont-cares',
  'wrong-excitation-table',
  'confused-q-and-qnext',
  'ignored-lockout-state',
  'wrong-complement',
  'wrong-radix-weight',
  'demorgan-misapplied',
  'wrong-carry-propagation',
  'wrong-bit-order',
  'wrong-remainder-order',
  'wrong-overflow-rule',
  'wrong-law-applied',
  'algebra-sign-error',
  'other',
];

/** Type guard verifying if value is a non-null object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard for pedagogical difficulty tiers. */
export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (VALID_DIFFICULTIES as readonly string[]).includes(value);
}

/** Type guard for virtual laboratory module identifiers. */
export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (VALID_MODULE_IDS as readonly string[]).includes(value);
}

/** Type guard for cognitive misconception tags. */
export function isMisconceptionTag(value: unknown): value is MisconceptionTag {
  return typeof value === 'string' && (VALID_MISCONCEPTION_TAGS as readonly string[]).includes(value);
}

/** Type guard for individual problem steps. */
export function isProblemStep(value: unknown): value is ProblemStep {
  if (!isRecord(value)) return false;
  if (typeof value['key'] !== 'string' || value['key'].trim().length === 0) return false;
  if (typeof value['prompt'] !== 'string' || value['prompt'].trim().length === 0) return false;
  if (typeof value['kind'] !== 'string' || value['kind'].trim().length === 0) return false;
  if (value['expected'] === undefined) return false;
  if (value['context'] !== undefined && !isRecord(value['context'])) return false;
  return true;
}

/** Detailed validation result for an unverified seed problem candidate. */
export type SeedValidationResult =
  | { readonly ok: true; readonly problem: SeedProblem }
  | { readonly ok: false; readonly id: string; readonly reason: string };

/**
 * Validates an unknown object against the SeedProblem contract with descriptive reasons.
 */
export function validateSeedProblem(candidate: unknown): SeedValidationResult {
  if (!isRecord(candidate)) {
    return { ok: false, id: 'unknown', reason: 'Problem candidate is not a JSON object' };
  }

  const rawId = candidate['id'];
  const id = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId : 'unknown';

  if (id === 'unknown') return { ok: false, id, reason: 'Field "id" must be a non-empty string' };
  if (!isModuleId(candidate['moduleId'])) {
    return { ok: false, id, reason: `Invalid or missing "moduleId": ${String(candidate['moduleId'])}` };
  }
  if (!isDifficulty(candidate['difficulty'])) {
    return { ok: false, id, reason: `Invalid or missing "difficulty": ${String(candidate['difficulty'])}` };
  }
  if (typeof candidate['title'] !== 'string' || candidate['title'].trim().length === 0) {
    return { ok: false, id, reason: 'Field "title" must be a non-empty string' };
  }
  if (typeof candidate['statement'] !== 'string' || candidate['statement'].trim().length === 0) {
    return { ok: false, id, reason: 'Field "statement" must be a non-empty string' };
  }
  if (!isRecord(candidate['parameters'])) {
    return { ok: false, id, reason: 'Field "parameters" must be a JSON object' };
  }
  if (!Array.isArray(candidate['steps']) || candidate['steps'].length === 0) {
    return { ok: false, id, reason: 'Field "steps" must be a non-empty array' };
  }
  for (let idx = 0; idx < candidate['steps'].length; idx++) {
    if (!isProblemStep(candidate['steps'][idx])) {
      return { ok: false, id, reason: `Step at index ${idx} does not satisfy ProblemStep contract` };
    }
  }
  if (candidate['finalAnswer'] === undefined) {
    return { ok: false, id, reason: 'Field "finalAnswer" cannot be undefined' };
  }
  const rawExplanation = candidate['explanation'] ?? candidate['workedSolution'];
  if (!Array.isArray(rawExplanation) || rawExplanation.length !== candidate['steps'].length) {
    return {
      ok: false,
      id,
      reason: `Field "explanation" must be a string array matching steps count (${candidate['steps'].length})`,
    };
  }
  for (let idx = 0; idx < rawExplanation.length; idx++) {
    if (typeof rawExplanation[idx] !== 'string') {
      return { ok: false, id, reason: `Explanation at index ${idx} is not a string` };
    }
  }
  if (typeof candidate['learningObjective'] !== 'string' || candidate['learningObjective'].trim().length === 0) {
    return { ok: false, id, reason: 'Field "learningObjective" must be a non-empty string' };
  }
  const rawTags = candidate['tags'] ?? candidate['misconceptions'];
  if (!Array.isArray(rawTags)) {
    return { ok: false, id, reason: 'Field "tags" must be an array of MisconceptionTag' };
  }
  for (let idx = 0; idx < rawTags.length; idx++) {
    if (!isMisconceptionTag(rawTags[idx])) {
      return { ok: false, id, reason: `Tag "${String(rawTags[idx])}" at index ${idx} is not in catalog` };
    }
  }
  if (!isRecord(candidate['projectSeed'])) {
    return { ok: false, id, reason: 'Field "projectSeed" must be a JSON object' };
  }

  const problem: SeedProblem = {
    id: candidate['id'] as string,
    moduleId: candidate['moduleId'] as ModuleId,
    difficulty: candidate['difficulty'] as Difficulty,
    title: candidate['title'] as string,
    statement: candidate['statement'] as string,
    parameters: candidate['parameters'] as Record<string, unknown>,
    steps: candidate['steps'] as readonly ProblemStep[],
    finalAnswer: candidate['finalAnswer'],
    explanation: rawExplanation as readonly string[],
    learningObjective: candidate['learningObjective'] as string,
    tags: rawTags as readonly MisconceptionTag[],
    projectSeed: candidate['projectSeed'] as Record<string, unknown>,
  };


  return { ok: true, problem };
}

/** Type guard verifying if value matches SeedProblem. */
export function isSeedProblem(candidate: unknown): candidate is SeedProblem {
  return validateSeedProblem(candidate).ok;
}

/** Type guard verifying if value matches SeedFile structure. */
export function isSeedFile(candidate: unknown): candidate is SeedFile {
  if (!isRecord(candidate)) return false;
  if (!isModuleId(candidate['moduleId'])) return false;
  if (!Array.isArray(candidate['problems'])) return false;
  return candidate['problems'].every((p) => isSeedProblem(p));
}
