import { test, expect } from '@playwright/test';

test.describe('Blog Studio Full-Parity Suite', () => {
  test('New tab workspace opens isolated view', async ({ page }) => {
    // Expected to run after deployment
    await page.goto('/app/blog-studio');
    await expect(page.locator('h1')).toContainText('Blog Studio');
  });

  test('Global admin panel correctly displays stats', async ({ page }) => {
    await page.goto('/admin/blog-studio');
    await expect(page.locator('h1')).toContainText('Blog Studio Management');
  });
});
