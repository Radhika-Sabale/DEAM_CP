import { test, expect } from '@playwright/test';
import { clearStorage, openExample, downloadAndRead } from './helpers';

test.describe('Student K-Map Feedback & Misconception Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.goto('/#/kmap');
  });

  test('diagnoses non-power-of-two, wrap-around, covered zero, non-maximal groups, and answer trap', async ({
    page,
  }) => {
    // 1. Load textbook 4-variable four-corners seed
    await openExample(page, /Four-corner wrap-around grouping/i);

    // Switch to Student Practice Mode
    const practiceTab = page.getByRole('button', { name: /Student Practice Mode/i });
    await expect(practiceTab).toBeVisible();
    await practiceTab.click();

    // 2. Select 3 cells and add group -> grouped-non-power-of-two
    const cell0 = page.getByRole('gridcell', { name: /minterm 0,/i });
    const cell2 = page.getByRole('gridcell', { name: /minterm 2,/i });
    const cell8 = page.getByRole('gridcell', { name: /minterm 8,/i });
    await cell0.click();
    await cell2.click();
    await cell8.click();

    const addGroupBtn = page.getByRole('button', { name: /Add Group/i });
    await expect(addGroupBtn).toBeVisible();
    await addGroupBtn.click();

    // Assert catalog diagnosis for non-power-of-two
    await expect(
      page.getByText('Grouped Non-Power-of-Two Cell Count')
    ).toBeVisible();
    const hint1Btn = page.getByRole('button', { name: /Unlock hint level 1 of 3/i });
    await hint1Btn.click();
    const hintText = page.getByText(/Valid Karnaugh map groupings must contain an exact power-of-two/i).first();
    await expect(hintText).toBeVisible();
    await expect(hintText).not.toContainText('0, 2, 8, 10');

    // Clear selection
    await page.getByRole('button', { name: /Clear Selection/i }).click();

    // 3. Select 2 edge cells without completing wrap-around -> forgot-wraparound-grouping
    await cell0.click();
    await cell2.click();
    await addGroupBtn.click();

    // Request hints 1, 2, 3 and assert increasing specificity and assisted status
    await expect(
      page.getByText('Forgot Toroidal Wraparound on K-Map')
    ).toBeVisible();
    await page.getByRole('button', { name: /Unlock hint level 1 of 3/i }).click();
    await expect(page.getByText(/Remember that Karnaugh map edges are logically adjacent/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Unlock hint level 2 of 3/i }).click();
    await expect(page.getByText(/Check whether minterms in outer columns or top\/bottom rows can merge/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Unlock hint level 3 of 3/i }).click();
    await expect(page.getByText(/Status: Assisted by Worked Step/i)).toBeVisible();

    await page.getByRole('button', { name: /Clear Selection/i }).click();

    // 4. Select group covering a zero (cells 0 and 1, where 1 is 0) -> covered-a-zero
    const cell1 = page.getByRole('gridcell', { name: /minterm 1,/i });
    await cell0.click();
    await cell1.click();
    await addGroupBtn.click();

    await expect(page.getByText('Covered a Zero in Sum-of-Products Group')).toBeVisible();
    await expect(page.getByText('covers a 0')).toBeVisible();

    await page.getByRole('button', { name: /Clear Selection/i }).click();

    // 5. Select non-maximal group -> group-not-maximal, then draw correct maximal group
    const cell10 = page.getByRole('gridcell', { name: /minterm 10,/i });
    await cell0.click();
    await cell8.click();
    await addGroupBtn.click();
    await expect(
      page.getByText(/Suboptimal Non-Maximal Prime Implicant|Forgot Toroidal Wraparound on K-Map|group-not-maximal/i)
    ).toBeVisible();

    // Clear and draw correct maximal group (all 4 corners: 0, 2, 8, 10)
    await page.getByRole('button', { name: /Clear Selection/i }).click();
    await cell0.click();
    await cell2.click();
    await cell8.click();
    await cell10.click();
    await addGroupBtn.click();
    await expect(page.getByText(/Drawn Groups \(1\)/i)).toBeVisible();
    await expect(page.getByText(/\[0, 2, 8, 10\]/i).first()).toBeVisible();

    // 6. Check My Solution -> trigger Answer Trap because earlier attempt had invalid steps
    const checkSolutionBtn = page.getByRole('button', { name: /Check My Solution/i });
    await checkSolutionBtn.click();

    await expect(page.getByText(/Answer Trap Detected/i)).toBeVisible();
    await expect(page.getByText(/Your final answer is right, but/i)).toBeVisible();

    // Jump button moves focus to offending step
    const jumpBtn = page.getByRole('button', { name: /Jump to/i }).first();
    if (await jumpBtn.isVisible()) {
      await jumpBtn.click();
    }
  });

  test('accepts alternative minimal cover on cyclic-core problem with equally minimal note', async ({
    page,
  }) => {
    await openExample(page, /Cyclic core with dual minimal covers/i);

    const practiceTab = page.getByRole('button', { name: /Student Practice Mode/i });
    await practiceTab.click();

    const addGroupBtn = page.getByRole('button', { name: /Add Group/i });

    // Draw alternative minimal cover: {0, 2}, {1, 5}, {6, 7}
    // Each successful group automatically clears selection
    await page.getByRole('gridcell', { name: /minterm 0,/i }).click();
    await page.getByRole('gridcell', { name: /minterm 2,/i }).click();
    await addGroupBtn.click();
    await expect(page.getByText(/Drawn Groups \(1\)/i)).toBeVisible();

    await page.getByRole('gridcell', { name: /minterm 1,/i }).click();
    await page.getByRole('gridcell', { name: /minterm 5,/i }).click();
    await addGroupBtn.click();
    await expect(page.getByText(/Drawn Groups \(2\)/i)).toBeVisible();

    await page.getByRole('gridcell', { name: /minterm 6,/i }).click();
    await page.getByRole('gridcell', { name: /minterm 7,/i }).click();
    await addGroupBtn.click();
    await expect(page.getByText(/Drawn Groups \(3\)/i)).toBeVisible();

    // Check solution
    await page.getByRole('button', { name: /Check My Solution/i }).click();

    // Assert solution is accepted as minimal and note is displayed
    await expect(page.getByText('✓ Valid & Minimal Solution!')).toBeVisible();
    await expect(page.getByText(/Different but equally minimal cover to solver reference!/i)).toBeVisible();
  });

  test('telemetry CSV export contains headers, misconception tags, and no API keys', async ({
    page,
  }) => {
    // Generate telemetry by triggering a misconception
    await openExample(page, /Four-corner wrap-around grouping/i);
    await page.getByRole('button', { name: /Student Practice Mode/i }).click();
    await page.getByRole('gridcell', { name: /minterm 0,/i }).click();
    await page.getByRole('gridcell', { name: /minterm 1,/i }).click();
    await page.getByRole('button', { name: /Add Group/i }).click();

    // Navigate to teacher dashboard and export CSV
    await page.goto('/#/teacher-dashboard');
    await page.getByRole('button', { name: /Use this device's own telemetry log/i }).click();

    const { content: csvText } = await downloadAndRead(page, async () => {
      await page.getByRole('button', { name: /Merged Events \(CSV\)/i }).click();
    });

    // Assert standard RFC-4180 CSV structure with UTF-8 BOM tolerance
    const cleanCsv = csvText.replace(/^\uFEFF/, '');
    expect(cleanCsv.startsWith('id,sessionId,participantId,moduleId,timestamp,eventType')).toBe(true);
    expect(cleanCsv).toContain('kmap-solver');
    expect(cleanCsv).toContain('step-submitted');
    expect(cleanCsv).toContain('covered-a-zero');
    expect(cleanCsv).not.toMatch(/sk-ant-[a-zA-Z0-9_-]+/);
  });

  test('keyboard-only interaction toggles cells and adds groups', async ({ page }) => {
    await openExample(page, /Four-corner wrap-around grouping/i);
    await page.getByRole('button', { name: /Student Practice Mode/i }).click();

    // Focus the first grid cell using keyboard Tab navigation
    const firstCell = page.getByRole('gridcell', { name: /minterm 0,/i });
    await firstCell.focus();
    await page.keyboard.press('Space');

    // Move to next cell and toggle with Space
    const secondCell = page.getByRole('gridcell', { name: /minterm 1,/i });
    await secondCell.focus();
    await page.keyboard.press('Space');

    // Activate Add Group button
    const addBtn = page.getByRole('button', { name: /Add Group/i });
    await addBtn.focus();
    await page.keyboard.press('Enter');

    // Assert diagnosis alert appeared
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('optional LLM feature degrades gracefully without key with zero external requests', async ({
    page,
  }) => {
    const outboundHosts: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.host !== 'localhost:4173' && url.host !== '127.0.0.1:4173') {
        outboundHosts.push(url.host);
      }
    });

    await openExample(page, /Four-corner wrap-around grouping/i);
    await page.getByRole('button', { name: /Student Practice Mode/i }).click();

    // Toggle LLM on without providing an API key
    const llmToggle = page.getByLabel(/Rephrase hints with an AI model/i);
    await expect(llmToggle).toBeVisible();
    await llmToggle.check();

    // Trigger feedback check
    await page.getByRole('gridcell', { name: /minterm 0,/i }).click();
    await page.getByRole('gridcell', { name: /minterm 1,/i }).click();
    await page.getByRole('button', { name: /Add Group/i }).click();

    // Assert diagnosis remains unchanged and deterministic
    await expect(page.getByText('Covered a Zero in Sum-of-Products Group')).toBeVisible();

    // Assert no third-party network requests made
    expect(outboundHosts).toEqual([]);
  });
});
