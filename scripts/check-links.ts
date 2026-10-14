/* eslint-disable no-console */
/**
 * @file check-links.ts
 * Standalone link and reference checker (zero third-party dependencies).
 * Scans README.md and all docs/*.md files to verify that every relative link,
 * file:/// link, and referenced filesystem path exists.
 *
 * Executed via vite-node:
 *   npx vite-node scripts/check-links.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface BrokenLink {
  sourceFile: string;
  linkText: string;
  target: string;
  reason: string;
}

export function checkAllLinks(): { totalChecked: number; broken: BrokenLink[] } {
  const markdownFiles: string[] = [];

  const readmePath = path.join(rootDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    markdownFiles.push(readmePath);
  }

  const docsDir = path.join(rootDir, 'docs');
  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      markdownFiles.push(path.join(docsDir, f));
    }
  }

  let totalChecked = 0;
  const broken: BrokenLink[] = [];

  // Match Markdown links: [text](target)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relSource = path.relative(rootDir, filePath);
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const rawTarget = match[2].trim();

      // Skip web URLs and mailto
      if (
        rawTarget.startsWith('http://') ||
        rawTarget.startsWith('https://') ||
        rawTarget.startsWith('mailto:')
      ) {
        continue;
      }

      // Skip in-page section anchors
      if (rawTarget.startsWith('#')) {
        continue;
      }

      totalChecked++;

      // Handle file:/// absolute links
      if (rawTarget.startsWith('file:///')) {
        const urlStr = rawTarget.split('#')[0];
        try {
          const parsedPath = fileURLToPath(urlStr);
          if (!fs.existsSync(parsedPath)) {
            broken.push({
              sourceFile: relSource,
              linkText,
              target: rawTarget,
              reason: `Path does not exist: ${parsedPath}`,
            });
          }
        } catch (err: unknown) {
          broken.push({
            sourceFile: relSource,
            linkText,
            target: rawTarget,
            reason: `Invalid file URL: ${(err as Error).message}`,
          });
        }
        continue;
      }

      // Handle relative file links
      const cleanTarget = rawTarget.split('#')[0].split('?')[0];
      if (!cleanTarget) {
        continue;
      }

      const dir = path.dirname(filePath);
      const resolvedTarget = path.resolve(dir, cleanTarget);

      if (!fs.existsSync(resolvedTarget)) {
        broken.push({
          sourceFile: relSource,
          linkText,
          target: rawTarget,
          reason: `Relative file does not exist: ${path.relative(rootDir, resolvedTarget)}`,
        });
      }
    }
  }

  return { totalChecked, broken };
}

const isDirectlyExecuted =
  process.argv.some((arg) => arg.includes('check-links')) ||
  !process.env.VITEST;

if (isDirectlyExecuted) {
  console.log('[check-links] Scanning markdown links in README.md and docs/*.md...');
  const result = checkAllLinks();
  console.log(`[check-links] Checked ${result.totalChecked} local links and file references.`);

  if (result.broken.length > 0) {
    console.error(`[check-links] Found ${result.broken.length} broken links:`);
    for (const b of result.broken) {
      console.error(`  - In ${b.sourceFile}: [${b.linkText}](${b.target}) -> ${b.reason}`);
    }
    process.exit(1);
  } else {
    console.log('[check-links] All links and file references are valid!');
    process.exit(0);
  }
}
