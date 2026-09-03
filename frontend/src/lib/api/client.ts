import type { Attachment, AuthResponse, Label, Project, Task, User } from '@/types/api';

const API_BASE = '/api';
const TOKEN_KEY = 'float_token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const authToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authToken.get();
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const raw = await response.text();
  const body = raw ? safeParseJson(raw) : undefined;

  if (response.status === 401) {
    authToken.clear();
    window.dispatchEvent(new Event('float:unauthorized'));
    throw new ApiError('unauthorized', 401);
  }
  if (!response.ok) {
    const message = isErrorBody(body) ? body.error : response.statusText || 'request failed';
    throw new ApiError(message, response.status);
  }

  return body as T;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isErrorBody(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

export type CreateProjectInput = {
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
};

export type UpdateProjectInput = Partial<
  Pick<Project, 'title' | 'description' | 'color' | 'icon' | 'is_archived' | 'position'>
>;

export type CreateTaskInput = {
  title: string;
  description?: string;
  due_date?: string;
  weight?: string;
};

export type UpdateTaskInput = Partial<
  Pick<Task, 'title' | 'description' | 'weight' | 'is_done' | 'due_date' | 'position'>
> & { new_project_id?: string };

export const api = {
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<User>('/auth/me'),

  listProjects: () => request<Project[]>('/projects'),
  createProject: (data: CreateProjectInput) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, data: UpdateProjectInput) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  reorderProjects: (projectIds: string[]) =>
    request<{ reordered: boolean }>('/projects/reorder', {
      method: 'PUT',
      body: JSON.stringify({ project_ids: projectIds }),
    }),

  listAllTasks: () => request<Task[]>('/tasks'),
  listTasks: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: CreateTaskInput) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (projectId: string, id: string, data: UpdateTaskInput) =>
    request<Task>(`/projects/${projectId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (projectId: string, id: string) =>
    request<{ deleted: boolean }>(`/projects/${projectId}/tasks/${id}`, { method: 'DELETE' }),
  moveTask: (projectId: string, id: string, newProjectId: string) =>
    request<Task>(`/projects/${projectId}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ new_project_id: newProjectId }),
    }),
  reorderTasks: (projectId: string, taskIds: string[]) =>
    request<{ reordered: boolean }>(`/projects/${projectId}/tasks/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ task_ids: taskIds }),
    }),

  listLabels: (projectId: string) => request<Label[]>(`/projects/${projectId}/labels`),
  createLabel: (projectId: string, data: { title: string; color?: string }) =>
    request<Label>(`/projects/${projectId}/labels`, { method: 'POST', body: JSON.stringify(data) }),

  listAttachments: (projectId: string, taskId: string) =>
    request<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`),
  uploadAttachment: (projectId: string, taskId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: form,
    });
  },
  deleteAttachment: (projectId: string, taskId: string, filename: string) =>
    request<{ deleted: boolean }>(
      `/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`,
      { method: 'DELETE' },
    ),
  downloadAttachment: async (projectId: string, taskId: string, filename: string) => {
    const token = authToken.get();
    const response = await fetch(
      `${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    );
    if (response.status === 401) {
      authToken.clear();
      window.dispatchEvent(new Event('float:unauthorized'));
      throw new ApiError('unauthorized', 401);
    }
    if (!response.ok) throw new ApiError(response.statusText || 'download failed', response.status);
    return response.blob();
  },
  attachmentUrl: (projectId: string, taskId: string, filename: string) =>
    `${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`,
};
