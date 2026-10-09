/**
 * @file difficulty.ts
 * Difficulty tier definitions, descriptive tables, and adaptive difficulty suggestion (Stage 11A).
 *
 * Each module has a documented per-level specification describing what "easy", "medium",
 * and "hard" mean in concrete pedagogical terms. The adaptive suggestion helper uses a
 * simple rule-based policy documented in TSDoc.
 */

import type { Difficulty } from './types';

// ---------------------------------------------------------------------------
// Ordered difficulty levels
// ---------------------------------------------------------------------------

/** All difficulty levels in ascending order. */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'medium', 'hard'];

// ---------------------------------------------------------------------------
// Per-module difficulty specification table
// ---------------------------------------------------------------------------

/**
 * Describes what a difficulty level means for a specific module.
 */
export interface DifficultySpec {
  /** Module identifier */
  readonly moduleId: string;
  /** What "easy" means for this module */
  readonly easy: string;
  /** What "medium" means for this module */
  readonly medium: string;
  /** What "hard" means for this module */
  readonly hard: string;
}

/**
 * Documented difficulty definitions for every Phase 1 module.
 *
 * - **Number Systems**: easy = 8-bit unsigned decimal-to-binary/hex conversion;
 *   medium = two's complement, BCD addition with correction;
 *   hard = signed overflow detection, fractions, or mixed-radix.
 *
 * - **Boolean**: easy = 2-3 variable simplification with one law;
 *   medium = 3-4 variables, multi-step simplification;
 *   hard = 4 variables with De Morgan + absorption + NAND-only conversion.
 *
 * - **K-Map**: easy = 3 variables, no don't-cares;
 *   medium = 4 variables with don't-cares;
 *   hard = 4-5 variables with wrap-around groups, cyclic core, or don't-cares that affect optimality.
 *
 * - **Circuit**: easy = count gates in a 2-3 gate circuit from a given expression;
 *   medium = determine NAND-only gate count;
 *   hard = diagnose a faulty gate (one inverted gate type) by comparing truth tables.
 *
 * - **Flip-Flop**: easy = fill characteristic table for a given type;
 *   medium = determine Q-next for a sequence of clock pulses;
 *   hard = fill excitation table or identify invalid input combinations.
 *
 * - **Sequential**: easy = mod-4 up counter with D flip-flops;
 *   medium = mod-5 or mod-10 counter with JK flip-flops;
 *   hard = arbitrary sequence with unused states and lockout analysis.
 */
export const DIFFICULTY_TABLE: readonly DifficultySpec[] = [
  {
    moduleId: 'number-systems',
    easy: '8-bit unsigned decimal ↔ binary/octal/hex conversion with division steps',
    medium: "Two's complement encoding/decoding, BCD addition with correction",
    hard: 'Signed overflow detection, binary addition with all flags',
  },
  {
    moduleId: 'boolean-tool',
    easy: '2-3 variable simplification with one law application',
    medium: '3-4 variable multi-step simplification, canonical SOP/POS from truth table',
    hard: '4 variable De Morgan + absorption, NAND-only conversion',
  },
  {
    moduleId: 'kmap-solver',
    easy: '3 variables, no don\'t-cares, basic grouping',
    medium: '4 variables with don\'t-cares',
    hard: '4-5 variables with wrap-around, cyclic core, or critical don\'t-cares',
  },
  {
    moduleId: 'circuit-simulator',
    easy: 'Count gates in a 2-3 gate circuit from a Boolean expression',
    medium: 'Determine NAND-only gate count for a given expression',
    hard: 'Diagnose a faulty gate by comparing truth tables',
  },
  {
    moduleId: 'flipflop-simulator',
    easy: 'Fill characteristic table for a given flip-flop type',
    medium: 'Determine Q-next for a sequence of clock pulses',
    hard: 'Fill complete excitation table, identify invalid inputs',
  },
  {
    moduleId: 'sequential-designer',
    easy: 'Mod-4 up counter with D flip-flops (state table + excitation + equations)',
    medium: 'Mod-5 or mod-10 counter with JK flip-flops, input equations',
    hard: 'Arbitrary sequence with unused states, lockout analysis',
  },
];

/**
 * Returns a human-readable label for a difficulty level.
 *
 * @param d Difficulty tier
 * @returns Capitalised label string (e.g. "Easy", "Medium", "Hard")
 */
export function difficultyLabel(d: Difficulty): string {
  switch (d) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
  }
}

/**
 * Returns the numeric index (0=easy, 1=medium, 2=hard) for a difficulty.
 *
 * @param d Difficulty tier
 * @returns 0, 1, or 2
 */
export function difficultyIndex(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

// ---------------------------------------------------------------------------
// Adaptive difficulty suggestion
// ---------------------------------------------------------------------------

/** Input for the adaptive suggestion: recent practice results in chronological order. */
export interface RecentResult {
  /** Whether the student answered correctly */
  readonly correct: boolean;
  /** Whether the student used any hints (specifically level-3 worked hints) */
  readonly usedLevel3Hint: boolean;
  /** Whether the answer was unassisted (no hints at all) */
  readonly unassisted: boolean;
}

/**
 * Suggests the next difficulty level based on recent practice performance.
 *
 * **Documented adaptive rules:**
 * 1. If the last 2 results are both correct AND unassisted → move UP one level.
 * 2. If the last 2 results are both incorrect, OR any result used a level-3 hint twice
 *    in the window → move DOWN one level.
 * 3. Otherwise → stay at the current level.
 *
 * The result is clamped to [easy, hard].
 *
 * @param current Current difficulty level
 * @param recentResults Last N results in chronological order (newest last)
 * @returns Suggested next difficulty level
 */
export function suggestNextDifficulty(
  current: Difficulty,
  recentResults: readonly RecentResult[]
): Difficulty {
  const idx = difficultyIndex(current);

  // Need at least 2 results to make a suggestion
  if (recentResults.length < 2) return current;

  const last2 = recentResults.slice(-2);
  const r1 = last2[0]!;
  const r2 = last2[1]!;

  // Rule 1: two consecutive unassisted correct → up
  if (r1.correct && r1.unassisted && r2.correct && r2.unassisted) {
    const nextIdx = Math.min(idx + 1, DIFFICULTY_ORDER.length - 1);
    return DIFFICULTY_ORDER[nextIdx]!;
  }

  // Rule 2a: two consecutive failures → down
  if (!r1.correct && !r2.correct) {
    const nextIdx = Math.max(idx - 1, 0);
    return DIFFICULTY_ORDER[nextIdx]!;
  }

  // Rule 2b: level-3 hint used twice in recent window → down
  const level3Count = recentResults.filter((r) => r.usedLevel3Hint).length;
  if (level3Count >= 2) {
    const nextIdx = Math.max(idx - 1, 0);
    return DIFFICULTY_ORDER[nextIdx]!;
  }

  // Rule 3: stay
  return current;
}
