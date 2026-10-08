/**
 * @file misconceptions.ts
 * Query functions, markdown catalog generation, and accessor helpers for
 * student cognitive misconceptions across all digital electronics modules.
 */

import type { MisconceptionTag, MisconceptionEntry } from '../../types/feedback';
import { MISCONCEPTION_ENTRIES } from './catalogData';
import type { MisconceptionCatalogEntry } from './types';

/**
 * Map of misconception entries indexed by tag for O(1) lookups.
 */
const CATALOG_BY_TAG: ReadonlyMap<MisconceptionTag, MisconceptionCatalogEntry> =
  new Map(MISCONCEPTION_ENTRIES.map((entry) => [entry.tag, entry]));

/**
 * Retrieves a detailed misconception entry by its tag.
 *
 * @param tag The misconception tag to retrieve
 * @throws Error if tag is unknown
 */
export function getMisconception(tag: MisconceptionTag): MisconceptionCatalogEntry {
  const entry = CATALOG_BY_TAG.get(tag);
  if (!entry) {
    throw new Error(`Unknown misconception tag: "${tag}"`);
  }
  return entry;
}

/**
 * Lists all catalog entries, optionally filtered by originating lab module ID.
 *
 * @param moduleId Optional lab module identifier to filter entries
 */
export function listMisconceptions(
  moduleId?: string
): readonly MisconceptionCatalogEntry[] {
  if (!moduleId) {
    return MISCONCEPTION_ENTRIES;
  }
  return MISCONCEPTION_ENTRIES.filter((entry) =>
    entry.affectedModules.includes(moduleId)
  );
}

/**
 * Converts a MisconceptionCatalogEntry into the Stage 1 MisconceptionEntry shape.
 *
 * @param entry The catalog entry to adapt
 */
export function toStage1Entry(entry: MisconceptionCatalogEntry): MisconceptionEntry {
  return {
    tag: entry.tag,
    title: entry.title,
    description: entry.description,
    affectedModules: entry.affectedModules,
    example: entry.example,
  };
}

/**
 * Renders the full misconception catalog as structured Markdown documentation.
 * Suitable for generating `docs/misconception-catalog.md`.
 */
export function renderCatalogMarkdown(): string {
  const lines: string[] = [
    '# Digital Electronics Virtual Lab: Misconception Catalog',
    '',
    'This catalog details the student cognitive misconceptions diagnosed by the deterministic feedback engine.',
    '',
  ];

  for (const entry of MISCONCEPTION_ENTRIES) {
    lines.push(`## ${entry.title}`);
    lines.push('');
    lines.push(`- **Tag**: \`${entry.tag}\``);
    lines.push(`- **Affected Modules**: ${entry.affectedModules.map((m) => `\`${m}\``).join(', ')}`);
    lines.push(`- **Example**: ${entry.example}`);
    lines.push('');
    lines.push('### Cognitive Description');
    lines.push(entry.description);
    lines.push('');
    lines.push('### Hint Templates');
    const sampleCtx = { expected: '<EXPECTED_VALUE>', got: '<STUDENT_VALUE>' };
    lines.push(`1. **Level 1 (Nudge)**: ${entry.hints.level1(sampleCtx)}`);
    lines.push(`2. **Level 2 (Pointed)**: ${entry.hints.level2(sampleCtx)}`);
    lines.push(`3. **Level 3 (Worked)**: ${entry.hints.level3(sampleCtx)}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export { MISCONCEPTION_ENTRIES };
