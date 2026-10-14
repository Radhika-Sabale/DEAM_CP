/* eslint-disable no-console */
/**
 * @file check-catalog.ts
 * Verifies that docs/misconception-catalog.md exactly matches the current output
 * of renderCatalogMarkdown() from src/engine/feedback/misconceptions.ts.
 * Exits with status 1 if out of date, informing the developer to run 'npm run docs:catalog'.
 *
 * Executed via vite-node:
 *   npx vite-node scripts/check-catalog.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalogMarkdown } from '../src/engine/feedback/misconceptions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const catalogFile = path.join(rootDir, 'docs', 'misconception-catalog.md');

export function checkCatalogFreshness(): boolean {
  if (!fs.existsSync(catalogFile)) {
    console.error(`[docs:check] Error: ${catalogFile} does not exist. Run 'npm run docs:catalog' to generate.`);
    return false;
  }

  const existingContent = fs.readFileSync(catalogFile, 'utf8').replace(/\r\n/g, '\n').trim();
  const currentContent = renderCatalogMarkdown().replace(/\r\n/g, '\n').trim();

  if (existingContent !== currentContent) {
    console.error(`[docs:check] Error: docs/misconception-catalog.md is out of date with src/engine/feedback/misconceptions.ts.`);
    console.error(`[docs:check] Please run 'npm run docs:catalog' to regenerate the catalog documentation.`);
    return false;
  }

  console.log(`[docs:check] docs/misconception-catalog.md is up to date.`);
  return true;
}

const isDirectlyExecuted =
  process.argv.some((arg) => arg.includes('check-catalog')) ||
  !process.env.VITEST;

if (isDirectlyExecuted) {
  const isFresh = checkCatalogFreshness();
  if (!isFresh) {
    process.exit(1);
  }
}
