/* eslint-disable no-console */
/**
 * @file generate-catalog-doc.ts
 * Generates docs/misconception-catalog.md from the authoritative misconception catalog
 * using the deterministic Markdown renderer in src/engine/feedback/misconceptions.ts.
 *
 * Executed via vite-node (ships with vitest, requiring zero external dependencies):
 *   npx vite-node scripts/generate-catalog-doc.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalogMarkdown } from '../src/engine/feedback/misconceptions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const targetFile = path.join(docsDir, 'misconception-catalog.md');

export function generateCatalogDoc(): string {
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const markdown = renderCatalogMarkdown();
  fs.writeFileSync(targetFile, markdown, 'utf8');
  return markdown;
}

// Execute when invoked directly
const isDirectlyExecuted =
  process.argv.some((arg) => arg.includes('generate-catalog-doc')) ||
  !process.env.VITEST;

if (isDirectlyExecuted) {
  generateCatalogDoc();
  console.log(`[generate-catalog-doc] Successfully generated ${path.relative(rootDir, targetFile)}`);
}
