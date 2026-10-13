import { test, expect } from '@playwright/test';
import { clearStorage, enterExpression, downloadAndRead } from './helpers';

test.describe('Pipeline: Boolean to K-Map to Circuit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.goto('/');
  });

  test('walks through Boolean analysis, K-Map simplification, and circuit verification', async ({
    page,
  }) => {
    // 1. Enter 5-variable Boolean expression in Boolean module
    await enterExpression(page, "A'B + C(D xor E)");

    // Assert 5-variable truth table (32 rows, m0 through m31)
    const truthTableHeading = page.getByRole('heading', { name: /Truth Table & Canonical SOP\/POS/i });
    await expect(truthTableHeading).toBeVisible();
    await expect(page.getByText('Canonical SOP (Σm)')).toBeVisible();
    await expect(page.getByText('m31')).toBeVisible();

    // Switch to Simplify tab and verify algebraic law in playground
    const simplifyTab = page.getByRole('tab', { name: 'Simplify' });
    await expect(simplifyTab).toBeVisible();
    await simplifyTab.click();

    const lawSelect = page.getByLabel(/Select Boolean Law/i);
    await expect(lawSelect).toBeVisible();
    await lawSelect.selectOption('distributive');
    await page.getByRole('button', { name: /Verify Law/i }).click();
    await expect(page.getByRole('status').getByText(/Distributive Law/i)).toBeVisible();

    const applySimplifiedBtn = page.getByRole('button', { name: /Apply Simplified Expression to Project/i });
    await expect(applySimplifiedBtn).toBeVisible();
    await applySimplifiedBtn.click();

    // 2. Enter 4-variable four-corner function in Expression & Truth Table tab
    const exprTab = page.getByRole('tab', { name: /Expression & Truth Table/i });
    await exprTab.click();
    await enterExpression(page, "A'B'C'D' + A'B'CD' + AB'C'D' + AB'CD'");
    await expect(
      page.getByText(/Carried over to K-Map: Variables \(A, B, C, D\) and Truth Table \(16 rows\)/i)
    ).toBeVisible();

    // Click "Send to next module" (K-Map)
    const sendToKMapBtn = page.getByRole('button', { name: /Send to Karnaugh Map Minimizer/i }).first();
    await expect(sendToKMapBtn).toBeVisible();
    await sendToKMapBtn.click();

    // Assert URL hash is #/kmap
    await expect(page).toHaveURL(/#\/kmap/);

    // Assert PipelineStepper marks Boolean complete and K-Map current
    const stepper = page.getByRole('navigation', { name: /Design synthesis pipeline stages/i });
    await expect(stepper).toBeVisible();
    await expect(stepper.getByText(/Boolean Expression Analysis/i)).toBeVisible();
    await expect(stepper.getByText(/\(Completed\)/i)).toBeVisible();

    const kmapStepBtn = stepper.getByRole('button', { name: /Karnaugh Map Minimizer/i });
    await expect(kmapStepBtn).toHaveAttribute('aria-current', 'step');
    await expect(kmapStepBtn).toContainText('(Current)');

    // Assert four corners prefilled (minterms 0, 2, 8, 10 have value 1)
    await expect(page.getByRole('gridcell', { name: /minterm 0, value 1/i })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /minterm 2, value 1/i })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /minterm 8, value 1/i })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /minterm 10, value 1/i })).toBeVisible();

    // 3. Solve K-Map
    const solveBtn = page.getByRole('button', { name: /Solve Map/i });
    await expect(solveBtn).toBeVisible();
    await solveBtn.click();

    // Assert Minimal SOP is B'D'
    const minimalSopCard = page.getByText("B'D'");
    await expect(minimalSopCard.first()).toBeVisible();

    // Assert Group Legend contains one group of 4 cells
    const groupLegend = page.getByRole('region', { name: /K-Map Groups Legend/i });
    await expect(groupLegend).toBeVisible();
    await expect(groupLegend.getByText(/0, 2, 8, 10/)).toBeVisible();

    // Send to Circuit module
    const sendToCircuitBtn = page.getByRole('button', {
      name: /Send to Digital Circuit Schematic Simulator/i,
    }).first();
    await expect(sendToCircuitBtn).toBeVisible();
    await sendToCircuitBtn.click();
    await expect(page).toHaveURL(/#\/circuit/);

    // Auto-generate circuit
    const generateBtn = page.getByRole('button', { name: /Generate circuit/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Diagnostics report no errors
    const diagTab = page.getByRole('tab', { name: /Diagnostics/i });
    await expect(diagTab).toBeVisible();
    await diagTab.click();
    await expect(page.getByText(/0 errors/i)).toBeVisible();

    // Switch to Truth Table compare view and verify matches across all 16 rows
    const compareTab = page.getByRole('tab', { name: /Truth Table/i });
    await expect(compareTab).toBeVisible();
    await compareTab.click();
    await expect(
      page.getByText(/Complete Match! Circuit output matches target specification/i)
    ).toBeVisible();

    // 4. Break circuit by disconnecting an input pin wire in Netlist Editor
    const listTab = page.getByRole('tab', { name: /List & Table Editor/i });
    await expect(listTab).toBeVisible();
    await listTab.click();

    const pinSelect = page.getByLabel(/input pin \d+ driver source/i).first();
    await expect(pinSelect).toBeVisible();
    await pinSelect.selectOption('none');

    // Switch to Diagnostics tab and assert unconnected / floating input diagnostic
    await diagTab.click();
    await expect(page.getByText(/floating-input|floating/i).first()).toBeVisible();

    // 5. Reload page and assert persistence
    // Wait for debounced autosave to flush circuit to localStorage
    await page.waitForFunction(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('delab:v1:projects:') && localStorage.getItem(key)?.includes('g_not_1')) {
          return true;
        }
      }
      return false;
    });

    await page.reload();
    await expect(page).toHaveURL(/#\/circuit/);
    const diagTab2 = page.getByRole('tab', { name: /Diagnostics/i });
    await diagTab2.click();
    await expect(page.getByText(/floating-input|floating/i).first()).toBeVisible();
    await expect(stepper.getByRole('button', { name: /Digital Circuit Schematic Simulator/i })).toHaveAttribute('aria-current', 'step');

    // 6. Export project JSON, clear context, and re-import
    const { content: exportedJson } = await downloadAndRead(page, async () => {
      const projectMenuBtn = page.getByRole('button', { name: /Project Menu/i });
      await projectMenuBtn.click();
      const exportItem = page.getByRole('menuitem', { name: /Export JSON/i });
      await exportItem.click();
    });

    expect(exportedJson).toContain('schemaVersion');
    expect(exportedJson).toContain('g_not_1');

    // Reset storage and reload clean
    await clearStorage(page);
    await page.goto('/');

    // Import exported JSON
    const projectMenuBtn2 = page.getByRole('button', { name: /Project Menu/i });
    await projectMenuBtn2.click();
    const importItem = page.getByRole('menuitem', { name: /Import JSON\.\.\./i });
    await importItem.click();

    const importTextarea = page.getByLabel(/Paste DesignProject JSON content:/i);
    await expect(importTextarea).toBeVisible();
    await importTextarea.fill(exportedJson);

    const validateImportBtn = page.getByRole('button', { name: /Validate & Import/i });
    await validateImportBtn.click();
    await expect(page.getByRole('heading', { name: /Import Project JSON/i })).toBeHidden();

    // Verify imported state
    await page.goto('/#/circuit');
    const diagTab3 = page.getByRole('tab', { name: /Diagnostics/i });
    await diagTab3.click();
    await expect(page.getByText(/floating-input|floating/i).first()).toBeVisible();
  });

  test('displays warning banner and continues in memory when localStorage is blocked', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('Access denied: localStorage is blocked');
        },
      });
    });

    await page.goto('/');

    const alertBanner = page.getByRole('alert');
    await expect(alertBanner).toBeVisible();
    await expect(alertBanner).toContainText(/Storage is disabled or blocked/i);

    // App functions in memory
    await enterExpression(page, 'A + B');
    await expect(page.getByText('Canonical SOP (Σm)')).toBeVisible();
  });

  test('smoke check: mobile viewport has no horizontal overflow and stepper is accessible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/boolean');

    // Confirm no horizontal scrolling on the root element
    const hasHorizontalOverflow = await page.evaluate(() => {
      const doc = document.scrollingElement;
      if (!doc) return false;
      return doc.scrollWidth > doc.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify pipeline stepper is reachable
    const stepper = page.getByRole('navigation', { name: /Design synthesis pipeline stages/i });
    await expect(stepper).toBeVisible();

    await page.goto('/#/kmap');
    await expect(page.getByRole('navigation', { name: /Design synthesis pipeline stages/i })).toBeVisible();
  });
});
