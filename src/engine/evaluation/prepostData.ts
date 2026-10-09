/**
 * @file prepostData.ts
 * Parallel pre-test and post-test diagnostic item banks (Form A and Form B).
 *
 * Each form contains 20 multiple-choice items with balanced representation across
 * all 6 digital electronics lab modules:
 * - Number Systems (4 items)
 * - Boolean Algebra (3 items)
 * - K-Map Solver (4 items)
 * - Circuit Simulator (3 items)
 * - Flip-Flop Simulator (3 items)
 * - Sequential Designer (3 items)
 *
 * All distractors carry validated MisconceptionTags from the cognitive misconception catalog.
 */

import { FORM_A_ITEMS } from './prepostDataFormA';
import { FORM_B_ITEMS } from './prepostDataFormB';

export { FORM_A_ITEMS, FORM_B_ITEMS };
