import { test, expect } from '@playwright/test';

test('time-of-day control is a keyboard-operable radio group', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  // Fewer blades keep software WebGL responsive in CI; the control logic is unchanged.
  await page.goto('/?q=low&blades=1000');

  const group = page.getByRole('radiogroup', { name: 'Time of day' });
  await expect(group).toBeVisible();

  const golden = page.getByRole('radio', { name: 'Golden' });
  const night = page.getByRole('radio', { name: 'Night' });
  const morning = page.getByRole('radio', { name: 'Morning' });

  await expect(golden).toHaveAttribute('aria-checked', 'true');
  await expect(golden).toHaveAttribute('tabindex', '0');
  await expect(morning).toHaveAttribute('tabindex', '-1');

  await golden.focus();
  await page.keyboard.press('ArrowRight');
  await expect(night).toHaveAttribute('aria-checked', 'true');
  await expect(night).toBeFocused();
  await expect(night).toHaveAttribute('tabindex', '0');
  await expect(page.locator('body')).toHaveAttribute('data-time', 'night');

  await page.keyboard.press('ArrowRight');
  await expect(morning).toHaveAttribute('aria-checked', 'true');

  await page.keyboard.press('Home');
  await expect(morning).toBeFocused();
  await page.keyboard.press('End');
  await expect(night).toBeFocused();

  await night.click();
  await expect(night).toHaveAttribute('aria-checked', 'true');
  await expect(night).toBeFocused();

  expect(errors).toEqual([]);
});
