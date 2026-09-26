import type { Page } from '@playwright/test';
import type { Attachment, Project, Task } from '../../../src/types/api';

interface DaybookOptions {
  empty?: boolean;
  theme?: 'light' | 'dark';
  taskOverrides?: Record<string, Partial<Task>>;
  attachments?: Record<string, Attachment[]>;
}

export async function mockDaybook(page: Page, options: DaybookOptions = {}) {
  const user = { id: 'brand-user', email: 'daybook@example.test', username: 'Alex' };
  const makeProject = (id: string, title: string, parent_id: string | null = null): Project => ({
    id, title, parent_id, user_id: user.id, color: null, icon: null, description: null, is_archived: false, position: 0,
  });
  let projects = options.empty ? [] : [makeProject('personal', 'Personal'), makeProject('work', 'Work'), makeProject('studio', 'Side projects'), makeProject('website', 'Website', 'studio'), makeProject('ideas', 'Someday / maybe', 'studio')];
  const makeTask = (id: string, title: string, project_id: string, due_date: string | null = null): Task => ({
    id, title, project_id, due_date, description: null, weight: 'medium', is_done: false, done_at: null, position: 0,
  });
  let tasks = options.empty ? [] : [
    makeTask('run', '5 km run', 'personal', '2026-09-20T22:00:00.000Z'),
    makeTask('read', 'Read 10 pages', 'personal', '2026-09-20T22:00:00.000Z'),
    makeTask('dog', 'Walk the dog', 'personal', '2026-09-20T22:00:00.000Z'),
    makeTask('groceries', 'Get groceries', 'personal', '2026-09-20T22:00:00.000Z'),
    makeTask('design', 'Design a to-do app (?)', 'website', '2026-09-20T22:00:00.000Z'),
    makeTask('brief', 'Send the studio brief', 'work', '2026-09-22T08:00:00.000Z'),
    makeTask('review', 'Review the first concepts', 'work'),
    makeTask('inbox', 'Clear a little space in the inbox', 'work'),
    makeTask('type', 'Find the right words', 'website'),
  ];
  tasks = tasks.map((task) => ({ ...task, ...options.taskOverrides?.[task.id] }));
  const attachments = structuredClone(options.attachments ?? {});
  const failures = new Map<string, number>();
  const mutations: { method: string; path: string; body: any }[] = [];
  let sequence = 0;

  await page.clock.setFixedTime(new Date('2026-09-21T07:41:00.000Z'));
  await page.addInitScript((theme) => {
    localStorage.setItem('float_token', 'daybook-isolated-test');
    localStorage.setItem('float_theme', theme);
  }, options.theme ?? 'light');
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const multipart = request.headers()['content-type']?.startsWith('multipart/form-data');
    const body = request.postData() ? multipart ? { filename: request.postData()?.match(/filename="([^"]+)"/)?.[1] } : request.postDataJSON() : null;
    if (method !== 'GET' && path !== '/api/auth/login') mutations.push({ method, path, body });
    const failureKey = `${method} ${path}`;
    if (failures.get(failureKey)) {
      failures.set(failureKey, failures.get(failureKey)! - 1);
      return route.fulfill({ status: 503, json: { error: 'Temporary test outage' } });
    }
    const attachmentPath = path.match(/^\/api\/projects\/[^/]+\/tasks\/([^/]+)\/attachments(?:\/([^/]+))?$/);
    if (attachmentPath) {
      const [, taskId, encodedName] = attachmentPath;
      const name = encodedName ? decodeURIComponent(encodedName) : undefined;
      if (method === 'GET' && !name) return route.fulfill({ json: attachments[taskId] ?? [] });
      if (method === 'GET' && name) return route.fulfill({ contentType: 'application/octet-stream', body: 'Mock attachment contents' });
      if (method === 'POST') {
        attachments[taskId] = [...(attachments[taskId] ?? []), { name: body.filename ?? 'uploaded.txt', size: 128 }];
        return route.fulfill({ status: 201, json: attachments[taskId] });
      }
      if (method === 'DELETE' && name) {
        attachments[taskId] = (attachments[taskId] ?? []).filter((file) => file.name !== name);
        return route.fulfill({ json: { deleted: true } });
      }
    }
    if (method === 'GET') {
      if (path === '/api/auth/me') return route.fulfill({ json: user });
      if (path === '/api/projects') return route.fulfill({ json: projects });
      if (path === '/api/tasks') return route.fulfill({ json: tasks });
      if (path === '/api/events') return route.fulfill({ status: 204 });
    }
    if (path === '/api/auth/login') return route.fulfill({ json: { token: 'daybook-isolated-test', user } });
    const taskPath = path.match(/^\/api\/projects\/([^/]+)\/tasks(?:\/([^/]+))?$/);
    if (taskPath) {
      if (method === 'POST') {
        const task = { ...makeTask(`new-${++sequence}`, body.title, taskPath[1], body.due_date ?? null), ...body };
        tasks.push(task);
        return route.fulfill({ status: 201, json: task });
      }
      if (method === 'PUT') {
        tasks = tasks.map((task) => task.id === taskPath[2] ? { ...task, ...body, project_id: body.new_project_id ?? task.project_id } : task);
        return route.fulfill({ json: tasks.find((task) => task.id === taskPath[2]) });
      }
      if (method === 'DELETE') {
        tasks = tasks.filter((task) => task.id !== taskPath[2]);
        return route.fulfill({ status: 204 });
      }
    }
    if (path === '/api/projects' && method === 'POST') {
      const project = { ...makeProject(`project-${++sequence}`, body.title, body.parent_id ?? null), ...body };
      projects.push(project);
      return route.fulfill({ status: 201, json: project });
    }
    const projectPath = path.match(/^\/api\/projects\/([^/]+)$/);
    if (projectPath && method === 'PUT') {
      projects = projects.map((project) => project.id === projectPath[1] ? { ...project, ...body } : project);
      return route.fulfill({ json: projects.find((project) => project.id === projectPath[1]) });
    }
    if (projectPath && method === 'DELETE') {
      projects = projects.filter((project) => project.id !== projectPath[1]);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected mock request: ${method} ${path}` } });
  });
  return {
    mutations,
    failNext: (method: string, path: string, count = 1) => failures.set(`${method} ${path}`, count),
  };
}
