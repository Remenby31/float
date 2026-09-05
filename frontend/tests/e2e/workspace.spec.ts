import { expect, test, type Page } from '@playwright/test';

const email = process.env.FLOAT_TEST_EMAIL;
const password = process.env.FLOAT_TEST_PASSWORD;
const baseUrl = process.env.FLOAT_E2E_BASE_URL ?? '';
const isProd = /remenby\.fr/.test(baseUrl);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

// These flows create and delete data. They run only against a local, throwaway
// stack — never production — and only on the desktop project (keyboard-driven).
test.describe('workspace', () => {
  test.skip(!email || !password, 'FLOAT_TEST_EMAIL and FLOAT_TEST_PASSWORD are required');
  test.skip(isProd, 'destructive workspace flows run against the local stack only');

  test.beforeEach(({}, testInfo) => { // eslint-disable-line no-empty-pattern
    test.skip(testInfo.project.name !== 'desktop-chromium', 'workspace flows run on the desktop project only');
  });

  function uid() {
    return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function login(page: Page) {
    await page.goto('/login');
    await page.getByPlaceholder('email').fill(email!);
    await page.getByPlaceholder('password').fill(password!);
    await page.getByRole('button', { name: 'sign in' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('button', { name: 'search', exact: true })).toBeVisible();
  }

  // Create a task through the command palette (⌘K → create → pick project → submit).
  async function createTask(page: Page, displayTitle: string, projectName: string, opts: { today?: boolean } = {}) {
    const raw = opts.today ? `${displayTitle} @today` : displayTitle;
    await page.keyboard.press(`${mod}+k`);
    const search = page.getByRole('textbox', { name: 'search or create a task...' });
    await expect(search).toBeVisible();
    await search.fill(`${raw} `); // trailing space dismisses the @-token suggestion popup
    await page.keyboard.press('Enter'); // activate the "create" result
    const projectInput = page.getByRole('textbox', { name: 'project' });
    await expect(projectInput).toBeFocused();
    await projectInput.fill(projectName);
    await page.keyboard.press('Enter'); // pick the first matching project
    const taskInput = page.getByRole('textbox', { name: 'new task' });
    await expect(taskInput).toBeFocused();
    await expect(taskInput).toHaveValue(new RegExp(escapeRegExp(displayTitle)));
    await page.keyboard.press('Enter'); // submit
    await expect(page.getByRole('dialog', { name: 'command palette' })).toHaveCount(0);
  }

  function card(page: Page, groupTitle: string) {
    return page.locator('section.workspace-card').filter({ hasText: groupTitle });
  }

  test('week view shows dated, overdue and later tasks from the seed', async ({ page }) => {
    await login(page);
    await expect(page.getByText('this week')).toBeVisible();
    // Seeded dated tasks surface in the week grid.
    await expect(page.getByText('Acheter du pain', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Appeler le plombier', { exact: true }).first()).toBeVisible(); // overdue
    await expect(page.getByText('Configurer le CI', { exact: true }).first()).toBeVisible();
  });

  test('command palette finds seeded projects and tasks', async ({ page }) => {
    await login(page);
    await page.keyboard.press(`${mod}+k`);
    const search = page.getByRole('textbox', { name: 'search or create a task...' });
    await expect(search).toBeVisible();

    const palette = page.getByRole('dialog', { name: 'command palette' });
    await search.fill('rapport');
    await expect(palette.getByText('Finir le rapport trimestriel')).toBeVisible();

    await search.fill('Side');
    await expect(palette.getByText('Side Project')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'command palette' })).toHaveCount(0);
  });

  test('create a task via the command palette, then complete it', async ({ page }) => {
    await login(page);
    const title = `${uid()} ship it`;
    await createTask(page, title, 'Work', { today: true });

    const work = card(page, 'Work');
    const label = work.getByText(title, { exact: true });
    await expect(label).toBeVisible();

    const row = label.locator('..');
    await row.getByRole('button', { name: 'toggle done' }).click();
    await expect(work.getByText(title, { exact: true })).toHaveClass(/line-through/);
  });

  test('open a task detail, rename it, then delete it', async ({ page }) => {
    await login(page);
    const title = `${uid()} detail`;
    await createTask(page, title, 'Work');

    await card(page, 'Work').getByText(title, { exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'task details' });
    await expect(detail).toBeVisible();

    // rename via the header title
    await detail.getByRole('button', { name: title }).click();
    const renamed = `${title} renamed`;
    const titleInput = detail.getByRole('textbox').first();
    await titleInput.fill(renamed);
    await titleInput.press('Enter');
    await expect(detail.getByText(renamed)).toBeVisible();

    // delete
    await detail.getByRole('button', { name: 'delete' }).click();
    await detail.getByRole('button', { name: 'yes' }).click();
    await expect(page.getByRole('dialog', { name: 'task details' })).toHaveCount(0);
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
  });

  test('completed tasks are hidden after a reload, pending ones stay', async ({ page }) => {
    await login(page);
    const keep = `${uid()} keep`;
    const gone = `${uid()} finish`;
    await createTask(page, keep, 'Side Project');
    await createTask(page, gone, 'Side Project');

    const side = card(page, 'Side Project');
    const toggle = side.getByText(gone, { exact: true }).locator('..').getByRole('button', { name: 'toggle done' });
    // Wait for the is_done PUT to persist before reloading, otherwise the reload
    // can race the request and the task comes back as pending.
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'PUT' && /\/tasks\/[^/]+$/.test(response.url()) && response.ok()),
      toggle.click(),
    ]);
    await expect(side.getByText(gone, { exact: true })).toHaveClass(/line-through/); // still visible this session

    await page.reload();
    await expect(page.getByRole('button', { name: 'search', exact: true })).toBeVisible();
    await expect(card(page, 'Side Project').getByText(keep, { exact: true })).toBeVisible();
    await expect(page.getByText(gone, { exact: true })).toHaveCount(0); // completed → hidden on reload
  });

  test('create and delete a group from the workspace', async ({ page }) => {
    await login(page);
    const name = `${uid()}-grp`;

    await page.getByRole('button', { name: '+ new group' }).click();
    const input = page.getByPlaceholder('group name...');
    await input.fill(name);
    await input.press('Enter');

    const created = card(page, name);
    await expect(created).toBeVisible();

    await created.getByRole('button', { name: 'delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'delete' }).click();
    await expect(card(page, name)).toHaveCount(0);
  });

  test('theme toggle flips the document theme', async ({ page }) => {
    await login(page);
    const html = page.locator('html');
    const before = (await html.getAttribute('class')) ?? '';

    await page.getByRole('button', { name: 'toggle menu' }).click();
    const sidebar = page.getByRole('complementary', { name: 'workspace navigation' });
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('button', { name: 'toggle theme' }).click();

    await expect(async () => {
      const after = (await html.getAttribute('class')) ?? '';
      expect(after).not.toBe(before);
    }).toPass();
  });

  test('undo and redo controls are present', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('button', { name: /Undo/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Redo/ })).toBeVisible();
  });
});
