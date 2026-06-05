const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('float_token') : null;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string> || {}),
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
	if (res.status === 401) {
		localStorage.removeItem('float_token');
		window.location.href = '/login';
		throw new Error('unauthorized');
	}
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(body.error || res.statusText);
	}
	return res.json();
}

export const api = {
	// Auth
	register: (data: { email: string; username: string; password: string }) =>
		request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
	login: (data: { email: string; password: string }) =>
		request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
	me: () => request<User>('/auth/me'),

	// Projects
	listProjects: () => request<Project[]>('/projects'),
	createProject: (data: { title: string; description?: string; color?: string; parent_id?: string }) =>
		request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
	getProject: (id: string) => request<Project>(`/projects/${id}`),
	updateProject: (id: string, data: Partial<Project>) =>
		request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
	deleteProject: (id: string) =>
		request(`/projects/${id}`, { method: 'DELETE' }),

	// Tasks
	listAllTasks: () => request<Task[]>('/tasks'),
	listTasks: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks`),
	createTask: (projectId: string, data: { title: string; description?: string }) =>
		request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
	updateTask: (projectId: string, id: string, data: Partial<Task>) =>
		request<Task>(`/projects/${projectId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
	deleteTask: (projectId: string, id: string) =>
		request(`/projects/${projectId}/tasks/${id}`, { method: 'DELETE' }),
	moveTask: (projectId: string, id: string, newProjectId: string) =>
		request<Task>(`/projects/${projectId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ new_project_id: newProjectId }) }),
	reorderProjects: (projectIds: string[]) =>
		request(`/projects/reorder`, { method: 'PUT', body: JSON.stringify({ project_ids: projectIds }) }),
	reorderTasks: (projectId: string, taskIds: string[]) =>
		request(`/projects/${projectId}/tasks/reorder`, { method: 'PUT', body: JSON.stringify({ task_ids: taskIds }) }),

	// Labels
	listLabels: (projectId: string) => request<Label[]>(`/projects/${projectId}/labels`),
	createLabel: (projectId: string, data: { title: string; color?: string }) =>
		request<Label>(`/projects/${projectId}/labels`, { method: 'POST', body: JSON.stringify(data) }),

	// Attachments
	listAttachments: (projectId: string, taskId: string) =>
		request<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`),
	uploadAttachment: async (projectId: string, taskId: string, file: File) => {
		const token = typeof localStorage !== 'undefined' ? localStorage.getItem('float_token') : null;
		const form = new FormData();
		form.append('file', file);
		const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/attachments`, {
			method: 'POST',
			headers: token ? { 'Authorization': `Bearer ${token}` } : {},
			body: form,
		});
		if (!res.ok) throw new Error('upload failed');
		return res.json() as Promise<Attachment[]>;
	},
	deleteAttachment: (projectId: string, taskId: string, filename: string) =>
		request(`/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
	attachmentUrl: (projectId: string, taskId: string, filename: string) =>
		`/api/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`,
};

// Types
export interface User {
	id: string;
	email: string;
	username: string;
}

export interface Project {
	id: string;
	user_id: string;
	title: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	parent_id: string | null;
	is_archived: boolean;
	position: number;
}

export interface Task {
	id: string;
	project_id: string;
	title: string;
	description: string | null;
	position: number;
	is_done: boolean;
	done_at: string | null;
	due_date: string | null;
}

export interface Label {
	id: string;
	project_id: string;
	title: string;
	color: string;
}

export interface Attachment {
	name: string;
	size: number;
}
