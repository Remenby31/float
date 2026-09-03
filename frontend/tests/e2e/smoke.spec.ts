import { expect, test } from '@playwright/test';

const email = process.env.FLOAT_TEST_EMAIL;
const password = process.env.FLOAT_TEST_PASSWORD;

test.skip(!email || !password, 'FLOAT_TEST_EMAIL and FLOAT_TEST_PASSWORD are required');

test('login and keyboard-first task draft stay non-destructive', async ({ page }) => {
  const createdRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/projects\/[^/]+\/tasks$/.test(request.url())) {
      createdRequests.push(request.url());
    }
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'email' }).fill(email!);
  await page.getByRole('textbox', { name: /password/ }).fill(password!);
  await page.getByRole('button', { name: 'sign in' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: 'search', exact: true })).toBeVisible();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const search = page.getByRole('textbox', { name: 'search or create a task...' });
  await search.fill('Playwright draft @dem');
  await page.keyboard.press('Tab');
  await expect(search).toHaveValue('Playwright draft @demain ');

  await page.keyboard.press('Tab');
  const projectInput = page.getByRole('textbox', { name: 'project' });
  await expect(projectInput).toBeFocused();
  await expect(page.getByRole('button', { name: /^create/i })).toHaveCount(0);

  await page.keyboard.press('Tab');
  const taskInput = page.getByRole('textbox', { name: 'new task' });
  await expect(taskInput).toBeFocused();
  await taskInput.pressSequentially(' continued');
  await expect(taskInput).toHaveValue(/continued$/);

  await page.keyboard.press('Escape');
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'command palette' })).toHaveCount(0);
  expect(createdRequests).toHaveLength(0);
});

test('workspace remains usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'email' }).fill(email!);
  await page.getByRole('textbox', { name: /password/ }).fill(password!);
  await page.getByRole('button', { name: 'sign in' }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('button', { name: 'toggle menu' }).click();
  const sidebar = page.getByRole('complementary', { name: 'workspace navigation' });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /search/ })).toBeVisible();
});
