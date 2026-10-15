/**
 * @file catalogData.ts
 * Authoritative taxonomy of student cognitive misconceptions, mental model flaws,
 * and three-tiered progressive hint templates across digital electronics domains.
 */

import { CORE_MISCONCEPTION_ENTRIES_1 } from './catalogDataCore';
import { CORE_MISCONCEPTION_ENTRIES_2 } from './catalogDataCore2';
import { ALU_MISCONCEPTION_ENTRIES } from './catalogDataAlu';
import { CPU8086_MISCONCEPTION_ENTRIES } from './catalogDataCpu8086';
import { INTERRUPT_MISCONCEPTION_ENTRIES } from './catalogDataInterrupts';
import type { MisconceptionCatalogEntry } from './types';

/**
 * Complete immutable list of domain misconception entries across Phase 1 and Phase 2.
 */
export const MISCONCEPTION_ENTRIES: readonly MisconceptionCatalogEntry[] = [
  ...CORE_MISCONCEPTION_ENTRIES_1,
  ...CORE_MISCONCEPTION_ENTRIES_2,
  ...ALU_MISCONCEPTION_ENTRIES,
  ...CPU8086_MISCONCEPTION_ENTRIES,
  ...INTERRUPT_MISCONCEPTION_ENTRIES,
];

