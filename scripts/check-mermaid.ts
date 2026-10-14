/* eslint-disable no-console */
/**
 * @file check-mermaid.ts
 * Scans README.md and all docs/*.md for fenced mermaid blocks.
 * Validates that each block is non-empty and starts with a valid Mermaid diagram keyword.
 * Reports whether mermaid-cli (mmdc) is available in the environment.
 *
 * Executed via vite-node:
 *   npx vite-node scripts/check-mermaid.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const VALID_KEYWORDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'mindmap',
  'timeline',
  'zenuml',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
];

interface MermaidBlock {
  file: string;
  lineNumber: number;
  keyword: string;
  lineCount: number;
}

export function validateMermaidBlocks(): {
  totalBlocks: number;
  blocks: MermaidBlock[];
  errors: string[];
  cliInstalled: boolean;
} {
  const markdownFiles: string[] = [];
  const readme = path.join(rootDir, 'README.md');
  if (fs.existsSync(readme)) markdownFiles.push(readme);

  const docsDir = path.join(rootDir, 'docs');
  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) markdownFiles.push(path.join(docsDir, f));
  }

  const blocks: MermaidBlock[] = [];
  const errors: string[] = [];

  for (const filePath of markdownFiles) {
    const relFile = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let inBlock = false;
    let startLine = 0;
    let blockLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('```mermaid')) {
        inBlock = true;
        startLine = i + 1;
        blockLines = [];
      } else if (inBlock && line.startsWith('```')) {
        inBlock = false;
        if (blockLines.length === 0) {
          errors.push(`Empty mermaid block in ${relFile} at line ${startLine}`);
        } else {
          const firstNonEmpty = blockLines.find((l) => l.trim().length > 0) || '';
          const firstWord = firstNonEmpty.trim().split(/\s+/)[0];
          const isValid = VALID_KEYWORDS.some((kw) => firstWord.startsWith(kw));

          if (!isValid) {
            errors.push(
              `Unknown diagram type "${firstWord}" in ${relFile} at line ${startLine}`
            );
          } else {
            blocks.push({
              file: relFile,
              lineNumber: startLine,
              keyword: firstWord,
              lineCount: blockLines.length,
            });
          }
        }
      } else if (inBlock) {
        blockLines.push(lines[i]);
      }
    }
  }

  let cliInstalled = false;
  try {
    execSync('mmdc --version', { stdio: 'ignore' });
    cliInstalled = true;
  } catch {
    cliInstalled = false;
  }

  return { totalBlocks: blocks.length, blocks, errors, cliInstalled };
}

const isDirectlyExecuted =
  process.argv.some((arg) => arg.includes('check-mermaid')) ||
  !process.env.VITEST;

if (isDirectlyExecuted) {
  const result = validateMermaidBlocks();
  console.log(`[check-mermaid] Validated ${result.totalBlocks} Mermaid diagram blocks:`);
  for (const b of result.blocks) {
    console.log(`  - ${b.file}:${b.lineNumber} -> ${b.keyword} (${b.lineCount} lines)`);
  }

  if (result.errors.length > 0) {
    console.error(`[check-mermaid] Validation errors found:`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `[check-mermaid] mermaid-cli (mmdc) installed: ${result.cliInstalled ? 'YES' : 'NO (not required)'}`
  );
  console.log('[check-mermaid] All Mermaid blocks are valid.');
}
