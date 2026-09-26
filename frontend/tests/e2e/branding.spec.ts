import { expect, test } from '@playwright/test';
import { mockDaybook } from './fixtures/daybook';

test.use({ timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
test.skip(({ baseURL }) => !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL!).hostname), 'Isolated branding tests only run locally');

test('daybook is responsive, keeps all days, and uses the same two themes', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockDaybook(page);
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your week.' })).toBeVisible();
  await expect(page.locator('.week-day')).toHaveCount(7);
  const monday = page.getByRole('region', { name: 'Monday', exact: true });
  await monday.getByRole('button', { name: 'toggle done' }).first().click();
  await expect(monday.getByRole('button', { name: '5 km run' })).toHaveClass(/task-done/);

  for (const theme of ['paper', 'graphite']) {
    if (theme === 'graphite') await page.getByRole('button', { name: 'toggle theme' }).click();
    await expect(page.locator('html')).toHaveCSS('background-color', theme === 'paper' ? 'rgb(239, 238, 234)' : 'rgb(41, 41, 39)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme === 'paper' ? '#efeeea' : '#292927');
    const checkbox = monday.locator('.task-checkbox').first();
    const bounds = await checkbox.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`workspace-${theme}.png`), fullPage: true });
  }

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 768) {
      await page.getByRole('button', { name: /^Projects \d/ }).click();
      await expect(page.getByRole('region', { name: 'Projects', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Weekly agenda' })).toBeHidden();
      await page.getByRole('button', { name: /^Week 07/ }).click();
    } else {
      await expect(page.getByRole('region', { name: 'Projects', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Weekly agenda' })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('adding from a day keeps that date and supports touch submission', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  await page.goto('/app');
  const tuesday = page.getByRole('region', { name: 'Tuesday', exact: true });
  await expect(tuesday.getByRole('button', { name: 'Tuesday 22' })).toHaveAttribute('aria-expanded', 'true');
  await tuesday.getByRole('button', { name: 'Add a new task…' }).click();
  const palette = page.getByRole('dialog', { name: 'command palette' });
  await palette.getByRole('textbox', { name: 'search or create a task...' }).fill('A Tuesday thought');
  await palette.getByRole('button', { name: 'create “A Tuesday thought”' }).click();
  await palette.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(palette.getByText('Sep 22', { exact: true })).toBeVisible();
  await palette.getByRole('button', { name: 'Add task' }).click();
  await expect(palette).toHaveCount(0);
  expect(mutations.find((item) => item.method === 'POST')?.body).toEqual({ title: 'A Tuesday thought', due_date: '2026-09-21T22:00:00.000Z' });
  await expect(page.getByRole('region', { name: 'Projects', exact: true }).getByRole('button', { name: 'A Tuesday thought' })).toBeVisible();
});

test('details, notes, date and appearance controls use the new sheets', async ({ page }, testInfo) => {
  await mockDaybook(page);
  await page.goto('/app');
  await page.getByRole('region', { name: 'Monday', exact: true }).getByRole('button', { name: 'Read 10 pages' }).click();
  const detail = page.getByRole('dialog', { name: 'task details' });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('textbox', { name: 'Task notes' })).toBeVisible();
  await detail.getByRole('button', { name: 'Read 10 pages' }).click();
  await detail.getByRole('textbox', { name: 'Task title' }).fill('Read a few good pages');
  await detail.getByRole('textbox', { name: 'Task title' }).press('Enter');
  await expect(detail.getByRole('button', { name: 'Read a few good pages' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('task-details.png') });
  await detail.locator('.task-property').first().getByRole('button').click();
  await expect(page.getByRole('textbox', { name: 'Type a date' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  if (testInfo.project.name === 'mobile-chromium') await page.getByRole('button', { name: /^Projects \d/ }).click();
  await page.getByRole('button', { name: 'change project appearance' }).first().click();
  await expect(page.getByRole('textbox', { name: 'Custom color' })).toBeVisible();
  await page.getByRole('button', { name: 'color #F45B24' }).click();
  await expect(page.getByRole('textbox', { name: 'Custom color' })).toHaveCount(0);
});

test('empty workspace exposes all days and can create its first group', async ({ page }, testInfo) => {
  await mockDaybook(page, { empty: true });
  await page.goto('/app');
  await expect(page.locator('.week-day')).toHaveCount(7);
  await expect(page.getByText('A little room to breathe.')).toBeVisible();
  if (testInfo.project.name === 'mobile-chromium') await page.getByRole('button', { name: /^Projects \d/ }).click();
  await expect(page.getByRole('heading', { name: 'Room for a fresh start.' })).toBeVisible();
  await page.getByRole('button', { name: '+ new group' }).click();
  await page.getByPlaceholder('group name...').fill('A fresh start');
  await page.getByPlaceholder('group name...').press('Enter');
  await expect(page.getByRole('button', { name: 'A fresh start', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'delete', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'cancel' }).click();
  await expect(page.getByRole('button', { name: 'A fresh start', exact: true })).toBeVisible();
});

test('brand kit, theme tokens, vector downloads, and login are available without auth', async ({ page, request }, testInfo) => {
  await page.goto('/brand');
  await expect(page.getByRole('heading', { name: 'MAKE ROOM.' })).toBeVisible();
  const response = await request.get('/brand/tokens.json');
  const tokens = await response.json();
  for (const [theme, values] of Object.entries(tokens.themes) as [string, Record<string, string>][]) {
    await page.evaluate((theme) => document.documentElement.classList.toggle('light', theme === 'paper'), theme);
    for (const [key, value] of Object.entries(values)) {
      expect(await page.evaluate((key) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${key}`).trim(), key)).toBe(value);
    }
  }
  for (const asset of ['wordmark-ink.svg', 'wordmark-paper.svg', 'mark.svg', 'palette.svg', 'social-card.png', 'float-daybook-kit.zip']) {
    expect((await request.get(`/brand/${asset}`)).ok()).toBe(true);
  }
  await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.screenshot({ path: testInfo.outputPath('brand-kit.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'email', exact: true }).fill('hello@example.test');
  await page.getByLabel('password', { exact: true }).fill('not-a-real-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByRole('textbox', { name: 'password', exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keyboard focus returns to the task and reduced motion is respected', async ({ page }) => {
  await mockDaybook(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  const trigger = page.getByRole('region', { name: 'Monday', exact: true }).getByRole('button', { name: 'Read 10 pages' });
  await trigger.click();
  const detail = page.getByRole('dialog', { name: 'task details' });
  const close = detail.getByRole('button', { name: 'close', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(detail.getByRole('button', { name: 'attach file (drop or click)' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await detail.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('mobile project actions stay reachable and a task can be added inline', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/app');
  await page.getByRole('button', { name: /^Projects \d/ }).click();
  const personal = page.locator('section.workspace-card').filter({ has: page.getByRole('button', { name: 'Personal', exact: true }) });
  await personal.getByRole('button', { name: 'Add a task…' }).click();
  await personal.getByPlaceholder('new task...').fill('A small first step');
  await personal.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(personal.getByRole('button', { name: 'A small first step' })).toBeVisible();
  expect(mutations.filter((item) => item.method === 'POST')).toHaveLength(1);
  await personal.getByRole('button', { name: 'A small first step' }).click();
  const detail = page.getByRole('dialog', { name: 'task details' });
  await detail.getByRole('button', { name: 'toggle done' }).click();
  await expect(detail.getByRole('button', { name: 'toggle done' })).toHaveAttribute('aria-pressed', 'true');
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await page.getByRole('button', { name: 'account' }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(personal.getByRole('button', { name: 'A small first step' })).not.toHaveClass(/task-done/);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(personal.getByRole('button', { name: 'A small first step' })).toHaveClass(/task-done/);
});
