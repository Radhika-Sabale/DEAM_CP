/**
 * @file index.ts
 * Public entrypoint for the Practice-Problem Generator and Quiz Engine (Stage 11A).
 *
 * Re-exports:
 * - Engine types (Problem, Difficulty, QuizQuestion, QuizResult)
 * - Seeded PRNG helpers
 * - Difficulty tier specifications and adaptive suggestion rule
 * - Generator registry and batch generation helpers
 * - Individual module generators (registered at import time)
 * - Quiz generator, question banks, answer normalization, and scoring engine
 */

export * from './types';
export * from './random';
export * from './difficulty';
export * from './generatorRegistry';
export * from './quizNormalize';
export * from './quizBank';
export * from './quiz';
export * from './seed/types';
export * from './seed/guards';
export * from './seed/loader';

// Import all generators to trigger module-level registration in generatorRegistry
import './generators/numberSystems';
import './generators/boolean';
import './generators/kmap';
import './generators/circuit';
import './generators/flipflop';
import './generators/sequential';
