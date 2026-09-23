import { expect, test } from '@playwright/test';

import type { Project, Task } from '../../src/types/api';

test.use({ timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
test.skip(({ baseURL }) => !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL!).hostname), 'mocked creation flows run locally only');

for (const scenario of [
  { mention: '', label: 'Sep 23', dueDate: '2026-09-22T22:00:00.000Z' },
  { mention: ' @demain', label: 'Sep 24', dueDate: '2026-09-23T22:00:00.000Z' },
  { mention: ' @demain @15h', label: 'Sep 24 15h00', dueDate: '2026-09-24T13:00:00.000Z' },
  { mention: ' @15h', label: 'Sep 23 15h00', dueDate: '2026-09-23T13:00:00.000Z' },
]) {
  test(`command palette previews and creates a dated task with "${scenario.mention}"`, async ({ page }) => {
    const user = { id: 'u1', email: 'test@example.com', username: 'Test' };
    const project: Project = {
      id: 'p1', user_id: user.id, title: 'Personal', description: null,
      color: '#6366f1', icon: null, parent_id: null, is_archived: false, position: 0,
    };
    const tasks: Task[] = [];
    const created: { title: string; due_date: string }[] = [];

    // Shortly after local midnight: the default must use the local day, not UTC.
    await page.clock.setFixedTime(new Date('2026-09-22T22:30:00.000Z'));
    await page.addInitScript(() => localStorage.setItem('float_token', 'test-token'));
    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        if (path === '/api/auth/me') return route.fulfill({ json: user });
        if (path === '/api/projects') return route.fulfill({ json: [project] });
        if (path === '/api/tasks') return route.fulfill({ json: tasks });
        if (path === '/api/events') return route.fulfill({ status: 204 });
      }
      if (request.method() === 'POST' && path === '/api/projects/p1/tasks') {
        const input = request.postDataJSON();
        created.push(input);
        const task: Task = {
          id: 't1', project_id: project.id, title: input.title, due_date: input.due_date,
          description: null, weight: 'medium', position: 0, is_done: false, done_at: null,
        };
        tasks.push(task);
        return route.fulfill({ status: 201, json: task });
      }
      return route.abort();
    });

    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'search', exact: true })).toBeVisible();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    const palette = page.getByRole('dialog', { name: 'command palette' });
    const search = palette.getByRole('textbox', { name: 'search or create a task...' });
    await expect(search).toBeFocused();
    await search.fill(`Prepare launch${scenario.mention} `);
    await search.press('Tab');

    const projectInput = palette.getByRole('textbox', { name: 'project', exact: true });
    await expect(projectInput).toBeFocused();
    await expect(palette.getByText(scenario.label, { exact: true })).toBeVisible();
    await projectInput.press('Tab');
    const title = palette.getByRole('textbox', { name: 'new task' });
    await expect(title).toBeFocused();
    await expect(title).toHaveValue(`Prepare launch${scenario.mention}`);
    expect(created).toHaveLength(0);

    await title.press('Enter');
    await expect(palette).toHaveCount(0);
    expect(created).toEqual([{ title: 'Prepare launch', due_date: scenario.dueDate }]);
    await expect(page.getByText('Prepare launch', { exact: true }).first()).toBeVisible();
  });
}
