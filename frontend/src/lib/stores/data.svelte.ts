import { api, type Project, type Task } from '$lib/api';

let projects = $state<Project[]>([]);
let allTasks = $state<Task[]>([]);
let initialized = $state(false);

export function getDataStore() {
	async function init() {
		if (initialized) return;
		const [p, t] = await Promise.all([api.listProjects(), api.listAllTasks()]);
		projects = p;
		allTasks = t;
		initialized = true;
	}

	async function refreshProjects() {
		projects = await api.listProjects();
	}

	async function refreshTasks() {
		allTasks = await api.listAllTasks();
	}

	async function refreshAll() {
		const [p, t] = await Promise.all([api.listProjects(), api.listAllTasks()]);
		projects = p;
		allTasks = t;
	}

	// Project mutations (optimistic + refresh)
	async function addProject(data: Parameters<typeof api.createProject>[0]) {
		const p = await api.createProject(data);
		projects = [...projects, p];
		return p;
	}

	async function updateProject(id: string, data: Partial<Project>) {
		const updated = await api.updateProject(id, data);
		projects = projects.map(p => p.id === id ? updated : p);
		return updated;
	}

	async function deleteProject(id: string) {
		await api.deleteProject(id);
		projects = projects.filter(p => p.id !== id && p.parent_id !== id);
	}

	// Task mutations
	async function addTask(projectId: string, data: Parameters<typeof api.createTask>[1]) {
		const t = await api.createTask(projectId, data);
		allTasks = [...allTasks, t];
		return t;
	}

	async function updateTask(projectId: string, id: string, data: Partial<Task>) {
		const updated = await api.updateTask(projectId, id, data);
		allTasks = allTasks.map(t => t.id === id ? updated : t);
		return updated;
	}

	async function deleteTask(projectId: string, id: string) {
		await api.deleteTask(projectId, id);
		allTasks = allTasks.filter(t => t.id !== id);
	}

	// Derived helpers
	function tasksForProject(projectId: string): Task[] {
		return allTasks.filter(t => t.project_id === projectId);
	}

	function reset() {
		projects = [];
		allTasks = [];
		initialized = false;
	}

	return {
		get projects() { return projects; },
		get allTasks() { return allTasks; },
		get initialized() { return initialized; },
		init,
		refreshProjects,
		refreshTasks,
		refreshAll,
		addProject,
		updateProject,
		deleteProject,
		addTask,
		updateTask,
		deleteTask,
		tasksForProject,
		reset,
	};
}
