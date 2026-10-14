/**
 * @file docs.test.ts
 * Automated verification test ensuring:
 * 1. docs/misconception-catalog.md matches renderCatalogMarkdown() output identically.
 * 2. Every module ID registered in MODULE_REGISTRY appears in docs/user-guide.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderCatalogMarkdown } from './engine/feedback/misconceptions';
import { MODULE_REGISTRY } from './modules/registry';

describe('Documentation Freshness and Coverage', () => {
  const rootDir = path.resolve(__dirname, '..');
  const catalogPath = path.join(rootDir, 'docs', 'misconception-catalog.md');
  const userGuidePath = path.join(rootDir, 'docs', 'user-guide.md');

  it('asserts that docs/misconception-catalog.md matches the generator current output', () => {
    expect(fs.existsSync(catalogPath)).toBe(true);

    const fileContent = fs
      .readFileSync(catalogPath, 'utf8')
      .replace(/\r\n/g, '\n')
      .trim();

    const expectedContent = renderCatalogMarkdown()
      .replace(/\r\n/g, '\n')
      .trim();

    expect(fileContent).toBe(expectedContent);
  });

  it('asserts that every module id in the registry appears in the user guide', () => {
    expect(fs.existsSync(userGuidePath)).toBe(true);

    const userGuideContent = fs.readFileSync(userGuidePath, 'utf8');

    for (const moduleEntry of MODULE_REGISTRY) {
      const moduleId = moduleEntry.id;
      const containsId = userGuideContent.includes(moduleId);
      expect(
        containsId,
        `Expected docs/user-guide.md to contain module id "${moduleId}" from MODULE_REGISTRY`
      ).toBe(true);
    }
  });
});
