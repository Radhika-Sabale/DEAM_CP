/**
 * @file random.ts
 * Seeded PRNG helpers for the practice-problem generators (Stage 11A).
 *
 * Re-exports the core Mulberry32 PRNG from engine/common and adds
 * practice-specific convenience functions (weightedPick, intInRange alias).
 *
 * All functions are pure and deterministic given the same seed.
 */

import { createPrng, prngChoice, prngInt, prngShuffle } from '../common';

export { createPrng, prngChoice, prngInt, prngShuffle };

/**
 * Picks an element from `array` using the PRNG.
 * Throws if the array is empty (practice generators must never call with empty arrays).
 *
 * @param prng PRNG function returning [0, 1)
 * @param array Non-empty array
 * @returns Selected element
 */
export function pick<T>(prng: () => number, array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('[pick] Cannot pick from an empty array.');
  }
  return array[Math.floor(prng() * array.length)] as T;
}

/**
 * Alias for prngShuffle: returns a new shuffled copy of the array.
 *
 * @param prng PRNG function
 * @param array Source array
 * @returns New shuffled array
 */
export function shuffle<T>(prng: () => number, array: readonly T[]): T[] {
  return prngShuffle(prng, array);
}

/**
 * Generates a random integer in the inclusive range [min, max].
 * Alias for prngInt for readability in generators.
 *
 * @param prng PRNG function returning [0, 1)
 * @param min Minimum (inclusive)
 * @param max Maximum (inclusive)
 * @returns Random integer
 */
export function intInRange(prng: () => number, min: number, max: number): number {
  return prngInt(prng, min, max);
}

/**
 * Picks an element from a weighted list.
 * Each entry has a `weight` (positive number) and a `value`.
 * Selection is proportional to weight.
 *
 * @param prng PRNG function
 * @param items Weighted items array (must be non-empty)
 * @returns The selected value
 */
export function weightedPick<T>(
  prng: () => number,
  items: readonly { readonly weight: number; readonly value: T }[]
): T {
  if (items.length === 0) {
    throw new Error('[weightedPick] Cannot pick from an empty weighted list.');
  }
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = prng() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  // Fallback to last item (floating-point edge)
  return items[items.length - 1]!.value;
}
