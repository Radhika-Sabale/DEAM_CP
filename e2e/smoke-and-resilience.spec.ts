import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

test.describe('Smoke, Resilience & Accessibility Checks', () => {
  test('offline mode works with zero external network requests', async ({ page, context }) => {
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.host !== 'localhost:4173' && url.host !== '127.0.0.1:4173') {
        externalRequests.push(url.href);
      }
    });

    await page.goto('/#/kmap');
    await clearStorage(page);
    await page.reload();

    const cell0 = page.getByRole('gridcell', { name: /minterm 0,/i });
    await expect(cell0).toBeVisible();

    // After the initial load has hydrated, go completely offline
    await context.setOffline(true);

    // Grid interaction and solver must operate fully client-side
    await cell0.focus();
    await cell0.press('1');

    const solveBtn = page.getByRole('button', { name: /Solve Map/i });
    await expect(solveBtn).toBeVisible();
    await solveBtn.click();

    await expect(page.getByRole('region', { name: /K-Map Groups Legend/i })).toBeVisible();

    // Verify no fonts, CDNs, analytics, or external origins were requested
    expect(externalRequests).toEqual([]);

    await context.setOffline(false);
  });

  test('dark theme toggle persists across reload and maintains accessible UI', async ({ page }) => {
    await page.goto('/#/kmap');
    await clearStorage(page);
    await page.reload();

    const themeBtn = page.getByRole('button', { name: /Theme:/i });
    await expect(themeBtn).toBeVisible();

    // Cycle until dark theme is active
    let isDark = (await page.locator('html').getAttribute('class'))?.includes('dark') ?? false;
    while (!isDark) {
      await themeBtn.click();
      isDark = (await page.locator('html').getAttribute('class'))?.includes('dark') ?? false;
    }

    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload and assert theme preference persists in storage
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('mobile viewport has no horizontal page scroll and stepper is reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/boolean');

    // Assert stepper is reachable on mobile
    const stepper = page.getByRole('navigation', { name: /Design synthesis pipeline stages/i });
    await expect(stepper).toBeVisible();


    // Assert document does not scroll horizontally
    const booleanOverflow = await page.evaluate(() => {
      const root = document.scrollingElement;
      return root ? root.scrollWidth > root.clientWidth : false;
    });
    expect(booleanOverflow).toBe(false);

    // Navigate to K-Map module
    await page.goto('/#/kmap');
    const kmapGrid = page.getByRole('grid');
    await expect(kmapGrid).toBeVisible();

    const kmapOverflow = await page.evaluate(() => {
      const root = document.scrollingElement;
      return root ? root.scrollWidth > root.clientWidth : false;
    });
    expect(kmapOverflow).toBe(false);
  });

  test('gracefully degrades when localStorage is blocked with warning banner', async ({
    page,
    context,
  }) => {
    // Intercept localStorage to simulate storage-blocked browser mode
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
    });

    await page.goto('/#/kmap');

    // Assert storage restriction warning banner appears
    await expect(
      page.getByText(/Storage is disabled or blocked/i)
    ).toBeVisible();

    // Verify in-memory interactivity continues to work
    const cell0 = page.getByRole('gridcell', { name: /minterm 0,/i });
    await expect(cell0).toBeVisible();
    await cell0.click();
  });
});
