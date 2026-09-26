import { expect, test, type Page } from '@playwright/test';

import { mockDaybook } from './fixtures/daybook';

test.use({ timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
test.skip(({ baseURL }) => !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL!).hostname), 'Task mutation tests use a local, isolated API only');

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(browserErrors.get(page)).toEqual([]));

const taskTitle = 'Design a to-do app (?)';
const taskPath = '/api/projects/website/tasks/design';
const initialNotes = '<p>A quieter place for everyday work.</p><ul><li><p>Keep the important things in view.</p></li><li><p>Make room for a little more focus.</p></li></ul>';

async function openTask(page: Page, title = taskTitle) {
  await page.goto('/app');
  await page.getByRole('region', { name: 'Monday', exact: true }).getByRole('button', { name: title, exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'task details', exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('textbox', { name: 'Task notes' })).toBeVisible();
  return detail;
}

test('shows a readable task sheet in both themes with useful notes and attachments', async ({ page }, testInfo) => {
  await mockDaybook(page, {
    taskOverrides: { design: { description: initialNotes } },
    attachments: { design: [{ name: 'Studio brief.pdf', size: 124800 }, { name: 'Reference notes.txt', size: 2460 }] },
  });
  if (testInfo.project.name === 'desktop-chromium') await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ['paper', 'graphite']) {
    const detail = await openTask(page);
    if (theme === 'graphite') {
      await detail.getByRole('button', { name: 'close', exact: true }).click();
      await page.getByRole('button', { name: 'toggle theme' }).click();
      await page.getByRole('region', { name: 'Monday', exact: true }).getByRole('button', { name: taskTitle, exact: true }).click();
    }
    await expect(detail.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Rename task' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Attach files' })).toBeVisible();
    await expect(detail.getByText('Studio brief.pdf', { exact: true })).toBeVisible();
    expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath(`task-detail-${theme}.png`), animations: 'disabled' });
    await detail.getByRole('button', { name: 'close', exact: true }).click();
  }
});

test('renames, cancels with Escape locally, and wraps a long title without overflow', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  const detail = await openTask(page);
  await detail.getByRole('button', { name: 'Rename task' }).click();
  const title = detail.getByRole('textbox', { name: 'Task title' });
  await title.fill('A draft that should not be saved');
  await title.press('Escape');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();
  expect(mutations.filter((item) => item.body?.title)).toHaveLength(0);

  const longTitle = 'Design a thoughtful task detail that stays readable with long titles, everyday notes, and the things worth keeping close';
  await detail.getByRole('button', { name: 'Rename task' }).click();
  await title.fill(longTitle);
  await title.press('Enter');
  await expect(detail.getByRole('button', { name: longTitle, exact: true })).toBeVisible();
  expect(mutations.filter((item) => item.body?.title)).toHaveLength(1);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(detail.getByRole('button', { name: 'close', exact: true })).toBeInViewport();
  }
});

test('does not resave untouched notes and flushes a draft when closing', async ({ page }) => {
  const { mutations } = await mockDaybook(page, { taskOverrides: { design: { description: initialNotes } } });
  let detail = await openTask(page);
  const notes = detail.getByRole('textbox', { name: 'Task notes' });
  await notes.focus();
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await expect(detail).toHaveCount(0);
  expect(mutations.filter((item) => item.body && 'description' in item.body)).toHaveLength(0);
  detail = await openTask(page);
  await detail.getByRole('textbox', { name: 'Task notes' }).fill('Keep this draft when I close the sheet.');
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await expect(detail).toHaveCount(0);
  expect(mutations.filter((item) => item.body?.description?.includes('Keep this draft'))).toHaveLength(1);
  detail = await openTask(page);
  await expect(detail.getByRole('textbox', { name: 'Task notes' })).toHaveText('Keep this draft when I close the sheet.');
});

test('retains notes after a failed autosave and retries without losing text', async ({ page }) => {
  const { mutations, failNext } = await mockDaybook(page);
  const detail = await openTask(page);
  failNext('PUT', taskPath);
  const notes = detail.getByRole('textbox', { name: 'Task notes' });
  await notes.fill('An important thought worth keeping.');
  await expect(detail.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await expect(notes).toHaveText('An important thought worth keeping.');
  await detail.getByRole('button', { name: 'Retry save' }).click();
  await expect(detail.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(mutations.filter((item) => item.body?.description?.includes('An important thought'))).toHaveLength(2);
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await expect(detail).toHaveCount(0);
});

test('formats notes from the visible toolbar and saves the rich document', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  const detail = await openTask(page);
  const toolbar = detail.getByRole('toolbar', { name: 'Text formatting' });
  await toolbar.getByRole('button', { name: 'bold', exact: true }).click();
  const notes = detail.getByRole('textbox', { name: 'Task notes' });
  await notes.pressSequentially('Worth remembering');
  await expect(notes.locator('strong')).toHaveText('Worth remembering');
  await notes.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await expect(detail.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(mutations.some((item) => item.body?.description?.includes('<strong>Worth remembering</strong>'))).toBe(true);
  await notes.focus();
  await page.keyboard.press('Tab');
  await expect(detail.getByRole('button', { name: 'Attach files' })).toBeFocused();
});

test('searches project destinations and closes the picker before the task sheet', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  const detail = await openTask(page);
  await detail.getByRole('button', { name: 'Move task to project' }).click();
  let picker = page.getByRole('dialog', { name: 'Move task', exact: true });
  const search = picker.getByLabel('Search projects');
  await expect(search).toBeFocused();
  await search.fill('not a project');
  await expect(picker.getByText(/no .*project|no .*match/i)).toBeVisible();
  await search.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Move task to project' }).click();
  picker = page.getByRole('dialog', { name: 'Move task', exact: true });
  await picker.getByLabel('Search projects').fill('Work');
  await picker.getByRole('button', { name: 'Work', exact: true }).click();
  await expect(picker).toHaveCount(0);
  expect(mutations.find((item) => item.body?.new_project_id)?.body).toEqual({ new_project_id: 'work' });
  await detail.getByRole('textbox', { name: 'Task notes' }).fill('Now part of Work.');
  await expect(detail.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(mutations.find((item) => item.body?.description?.includes('Now part of Work.'))?.path).toBe('/api/projects/work/tasks/design');
});

test('uploads, downloads and confirms attachment removal', async ({ page }) => {
  const { mutations } = await mockDaybook(page, { attachments: { design: [{ name: 'Studio brief.pdf', size: 124800 }] } });
  const detail = await openTask(page);
  const download = page.waitForEvent('download');
  await detail.getByRole('button', { name: /Studio brief\.pdf/ }).first().click();
  expect((await download).suggestedFilename()).toBe('Studio brief.pdf');
  await detail.locator('input[type="file"]').setInputFiles({ name: 'Ideas.txt', mimeType: 'text/plain', buffer: Buffer.from('A little room to think.') });
  await expect(detail.getByText('Ideas.txt', { exact: true })).toBeVisible();
  const remove = detail.getByRole('button', { name: /(?:remove|delete).*Ideas\.txt/i });
  await remove.click();
  await expect(detail.getByRole('button', { name: 'Keep attachment' })).toBeVisible();
  await detail.getByRole('button', { name: 'Keep attachment' }).click();
  expect(mutations.filter((item) => item.method === 'DELETE')).toHaveLength(0);
  await remove.click();
  await detail.getByRole('button', { name: 'Remove attachment', exact: true }).click();
  await expect(detail.getByText('Ideas.txt', { exact: true })).toHaveCount(0);
  expect(mutations.filter((item) => item.method === 'DELETE')).toHaveLength(1);
});

test('confirms task deletion and leaves the task intact when cancelled', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  const detail = await openTask(page);
  await detail.getByRole('button', { name: 'Delete task', exact: true }).click();
  await expect(detail.getByRole('button', { name: 'Keep task' })).toBeVisible();
  await detail.getByRole('button', { name: 'Keep task' }).click();
  expect(mutations.filter((item) => item.method === 'DELETE')).toHaveLength(0);
  await detail.getByRole('button', { name: 'Delete task', exact: true }).click();
  await detail.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(detail).toHaveCount(0);
  expect(mutations.filter((item) => item.method === 'DELETE')).toEqual([{ method: 'DELETE', path: taskPath, body: null }]);
});

test('serializes note saves so a slow response cannot replace a newer draft', async ({ page }) => {
  const { mutations } = await mockDaybook(page);
  let release: () => void = () => {};
  let firstSaveStarted = false;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**${taskPath}`, async (route) => {
    if (route.request().method() === 'PUT' && route.request().postDataJSON()?.description && !firstSaveStarted) {
      firstSaveStarted = true;
      await held;
    }
    await route.fallback();
  });
  try {
    const detail = await openTask(page);
    const notes = detail.getByRole('textbox', { name: 'Task notes' });
    await notes.fill('The first thought.');
    await expect.poll(() => firstSaveStarted).toBe(true);
    await notes.fill('The second thought must win.');
    release();
    await expect(detail.getByText('All changes saved', { exact: true })).toBeVisible();
    await expect(notes).toHaveText('The second thought must win.');
    const savedNotes = mutations.filter((item) => item.body?.description);
    expect(savedNotes).toHaveLength(2);
    expect(savedNotes.at(-1)?.body.description).toContain('The second thought must win.');
  } finally {
    release();
  }
});

test('keeps a failed rename editable and never silently applies a blank title', async ({ page }) => {
  const { mutations, failNext } = await mockDaybook(page);
  const detail = await openTask(page);
  failNext('PUT', taskPath);
  await detail.getByRole('button', { name: 'Rename task' }).click();
  const title = detail.getByRole('textbox', { name: 'Task title' });
  await title.fill('A title worth keeping');
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(taskPath) && response.status() === 503),
    title.press('Enter'),
  ]);
  await expect(title).toBeVisible();
  await expect(title).toHaveValue('A title worth keeping');
  await expect(detail.getByRole('button', { name: 'Save title' })).toBeEnabled();
  await title.fill('   ');
  await title.press('Enter');
  await expect(title).toBeVisible();
  expect(mutations.filter((item) => item.body && 'title' in item.body)).toHaveLength(1);
  await title.fill('A title worth keeping');
  await detail.getByRole('button', { name: 'Save title' }).click();
  await expect(detail.getByRole('button', { name: 'A title worth keeping', exact: true })).toBeVisible();
});

test('a failed attachment removal keeps the file and lets the user retry', async ({ page }) => {
  const { failNext } = await mockDaybook(page, { attachments: { design: [{ name: 'Notes.txt', size: 4096 }] } });
  const detail = await openTask(page);
  failNext('DELETE', `${taskPath}/attachments/Notes.txt`);
  await detail.getByRole('button', { name: /(?:remove|delete).*Notes\.txt/i }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/attachments/Notes.txt') && response.status() === 503),
    detail.getByRole('button', { name: 'Remove attachment', exact: true }).click(),
  ]);
  await expect(detail.getByText('Notes.txt', { exact: true }).first()).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Remove attachment', exact: true })).toBeEnabled();
  await detail.getByRole('button', { name: 'Remove attachment', exact: true }).click();
  await expect(detail.getByText('Notes.txt', { exact: true })).toHaveCount(0);
});

test('date changes report errors, keep focus in the picker and can be retried', async ({ page }) => {
  const { mutations, failNext } = await mockDaybook(page);
  const detail = await openTask(page);
  await detail.locator('.detail-property').first().getByRole('button').click();
  const picker = page.getByRole('dialog', { name: 'Choose a date' });
  await expect(picker).toBeVisible();
  const buttons = picker.getByRole('button');
  await buttons.last().focus();
  await page.keyboard.press('Tab');
  expect(await picker.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  failNext('PUT', taskPath);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(taskPath) && response.status() === 503),
    picker.getByRole('button', { name: 'tomorrow', exact: true }).click(),
  ]);
  await expect(picker.getByRole('alert')).toBeVisible();
  await picker.getByRole('button', { name: 'tomorrow', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(detail).toBeVisible();
  expect(mutations.filter((item) => item.body && 'due_date' in item.body)).toHaveLength(2);
  await expect(detail.locator('.detail-property').first().getByRole('button')).toBeFocused();
});

test('failed close keeps notes until they are saved successfully', async ({ page }) => {
  const { failNext } = await mockDaybook(page);
  const detail = await openTask(page);
  failNext('PUT', taskPath, 3);
  const notes = detail.getByRole('textbox', { name: 'Task notes' });
  await notes.fill('Please keep this draft through a connection failure.');
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Keep editing' })).toBeVisible();
  await expect(notes).toHaveText('Please keep this draft through a connection failure.');
  await detail.getByRole('button', { name: 'Keep editing' }).click();
  failNext('PUT', taskPath, 0);
  await detail.getByRole('button', { name: 'Retry save' }).click();
  await expect(detail.getByText('All changes saved', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'close', exact: true }).click();
  await expect(detail).toHaveCount(0);
});
