import type { Page, Download } from '@playwright/test';
import { expect } from '@playwright/test';
import type { LogEvent } from '../src/types/logging';

/**
 * Clears browser localStorage and sessionStorage to isolate test runs.
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Storage might be blocked in specific test scenarios
    }
  });
}

/**
 * Enters a Boolean algebraic expression into the Boolean module expression input.
 */
export async function enterExpression(page: Page, expr: string): Promise<void> {
  const input = page.getByLabel('Boolean Expression');
  await expect(input).toBeVisible();
  await input.fill(expr);
}

/**
 * Opens a curated seed example from the accessible Project Menu modal.
 */
export async function openExample(
  page: Page,
  exampleTitlePattern: string | RegExp
): Promise<void> {
  const projectMenuBtn = page.getByRole('button', { name: /Project Menu/i });
  await expect(projectMenuBtn).toBeVisible();
  await projectMenuBtn.click();

  const openExampleItem = page.getByRole('menuitem', { name: /Open Example\.\.\./i });
  await expect(openExampleItem).toBeVisible();
  await openExampleItem.click();

  const problemBtn = page.getByRole('button', { name: exampleTitlePattern });
  await expect(problemBtn).toBeVisible();
  await problemBtn.click();

  const discardBtn = page.getByRole('button', { name: /Discard and Open Example/i });
  try {
    if (await discardBtn.isVisible({ timeout: 500 })) {
      await discardBtn.click();
    }
  } catch {
    // Unsaved changes modal was not triggered
  }

  await expect(page.getByRole('dialog', { name: /Open Curated Example/i })).not.toBeVisible();
}

/**
 * Reads and parses the persistent telemetry event log from localStorage.
 */
export async function readLogEvents(page: Page): Promise<readonly LogEvent[]> {
  const rawLog = await page.evaluate(() => {
    try {
      return window.localStorage.getItem('delab:v1:event_log');
    } catch {
      return null;
    }
  });

  if (!rawLog) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawLog);
    if (Array.isArray(parsed)) {
      return parsed as readonly LogEvent[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Executes a trigger action that initiates a file download and returns the UTF-8 text content.
 */
export async function downloadAndRead(
  page: Page,
  triggerAction: () => Promise<void>
): Promise<{ readonly filename: string; readonly content: string }> {
  const downloadPromise = page.waitForEvent('download');
  await triggerAction();
  const download: Download = await downloadPromise;
  const stream = await download.createReadStream();

  if (!stream) {
    throw new Error(`Failed to create read stream for download ${download.suggestedFilename()}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const content = Buffer.concat(chunks).toString('utf-8');
  return {
    filename: download.suggestedFilename(),
    content,
  };
}
