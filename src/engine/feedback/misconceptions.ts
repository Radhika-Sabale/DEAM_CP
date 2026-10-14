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
 * Verified counts of validators and question distractors emitting each misconception tag.
 */
export const MISCONCEPTION_EMISSION_COUNTS: Readonly<
  Record<MisconceptionTag, { readonly validators: number; readonly distractors: number }>
> = {
  'forgot-wraparound-grouping': { validators: 1, distractors: 10 },
  'grouped-non-power-of-two': { validators: 3, distractors: 22 },
  'group-not-rectangle': { validators: 3, distractors: 1 },
  'group-not-maximal': { validators: 5, distractors: 3 },
  'redundant-group': { validators: 7, distractors: 1 },
  'missed-minterm': { validators: 2, distractors: 0 },
  'covered-a-zero': { validators: 3, distractors: 2 },
  'missed-dont-cares': { validators: 2, distractors: 10 },
  'wrong-excitation-table': { validators: 1, distractors: 14 },
  'confused-q-and-qnext': { validators: 4, distractors: 23 },
  'ignored-lockout-state': { validators: 1, distractors: 8 },
  'wrong-complement': { validators: 3, distractors: 14 },
  'wrong-radix-weight': { validators: 2, distractors: 12 },
  'demorgan-misapplied': { validators: 1, distractors: 11 },
  'wrong-carry-propagation': { validators: 1, distractors: 3 },
  'wrong-bit-order': { validators: 2, distractors: 1 },
  'wrong-remainder-order': { validators: 1, distractors: 1 },
  'wrong-overflow-rule': { validators: 1, distractors: 8 },
  'wrong-law-applied': { validators: 1, distractors: 27 },
  'algebra-sign-error': { validators: 2, distractors: 0 },
  'other': { validators: 15, distractors: 130 },
};

/**
 * Renders the full misconception catalog as structured Markdown documentation.
 * Suitable for generating `docs/misconception-catalog.md`.
 */
export function renderCatalogMarkdown(): string {
  const lines: string[] = [
    '# Digital Electronics Virtual Lab: Misconception Catalog',
    '',
    'This catalog details the student cognitive misconceptions diagnosed by the deterministic feedback engine across all laboratory modules. Each entry defines the underlying flawed mental model, the affected modules, an illustrative concrete example, and three progressive hint levels (Nudge, Pointed, and Worked Step).',
    '',
    '## Table of Contents',
    '',
  ];

  for (const entry of MISCONCEPTION_ENTRIES) {
    const slug = entry.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    lines.push(`- [${entry.title} (\`${entry.tag}\`)](#${slug})`);
  }

  lines.push('');
  lines.push('## Summary Table');
  lines.push('');
  lines.push('| Tag | Affected Modules | Emitting Validators | Emitting Distractors | Total Sources |');
  lines.push('| :--- | :--- | :---: | :---: | :---: |');

  for (const entry of MISCONCEPTION_ENTRIES) {
    const counts = MISCONCEPTION_EMISSION_COUNTS[entry.tag] ?? { validators: 0, distractors: 0 };
    const total = counts.validators + counts.distractors;
    lines.push(
      `| \`${entry.tag}\` | ${entry.affectedModules.map((m) => `\`${m}\``).join(', ')} | ${counts.validators} | ${counts.distractors} | ${total} |`
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Cognitive Misconception Details');
  lines.push('');

  for (const entry of MISCONCEPTION_ENTRIES) {
    lines.push(`### ${entry.title}`);
    lines.push('');
    lines.push(`- **Tag**: \`${entry.tag}\``);
    lines.push(`- **Affected Modules**: ${entry.affectedModules.map((m) => `\`${m}\``).join(', ')}`);
    lines.push(`- **Concrete Example**: ${entry.example}`);
    lines.push('');
    lines.push('#### Cognitive Description (Underlying Mental Model)');
    lines.push(entry.description);
    lines.push('');
    lines.push('#### Three-Tiered Progressive Hint Templates');
    const sampleCtx = { expected: '<EXPECTED_VALUE>', got: '<STUDENT_VALUE>' };
    lines.push(`1. **Level 1 (Nudge)**: ${entry.hints.level1(sampleCtx)}`);
    lines.push(`2. **Level 2 (Pointed)**: ${entry.hints.level2(sampleCtx)}`);
    lines.push(`3. **Level 3 (Worked Step)**: ${entry.hints.level3(sampleCtx)}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export { MISCONCEPTION_ENTRIES };
