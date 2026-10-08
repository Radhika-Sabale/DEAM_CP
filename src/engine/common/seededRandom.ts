/**
 * @file seededRandom.ts
 * Deterministic Pseudo-Random Number Generator (PRNG) for property-based tests
 * and randomized simulations.
 *
 * Implements a high-quality 32-bit Mulberry32 generator.
 */

/**
 * Creates a deterministic PRNG function returning pseudo-random floating-point
 * numbers in the half-open interval [0, 1).
 *
 * @param seed Initial integer seed (defaults to 123456789)
 * @returns PRNG function returning numbers in [0, 1)
 */
export function createPrng(seed = 123456789): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a random integer in the inclusive range [min, max].
 *
 * @param prng PRNG function returning [0, 1)
 * @param min Minimum integer (inclusive)
 * @param max Maximum integer (inclusive)
 * @returns Random integer in [min, max]
 */
export function prngInt(prng: () => number, min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return low + Math.floor(prng() * (high - low + 1));
}

/**
 * Picks a random element from a non-empty array.
 *
 * @param prng PRNG function
 * @param array Array of items
 * @returns Randomly selected element, or undefined if empty
 */
export function prngChoice<T>(prng: () => number, array: readonly T[]): T | undefined {
  if (array.length === 0) return undefined;
  const idx = Math.floor(prng() * array.length);
  return array[idx];
}

/**
 * Returns a new array with elements shuffled using Fisher-Yates algorithm.
 *
 * @param prng PRNG function
 * @param array Source array to shuffle
 * @returns New shuffled array
 */
export function prngShuffle<T>(prng: () => number, array: readonly T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = copy[i];
    const itemJ = copy[j];
    if (tmp !== undefined && itemJ !== undefined) {
      copy[i] = itemJ;
      copy[j] = tmp;
    }
  }
  return copy;
}
