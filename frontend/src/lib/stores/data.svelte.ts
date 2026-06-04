import { api, type Project, type Task } from '$lib/api';

let projects = $state<Project[]>([]);
let allTasks = $state<Task[]>([]);
let initialized = $state(false);

type UndoAction = () => Promise<void>;
let undoStack: UndoAction[] = [];

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

	function pushUndo(action: UndoAction) {
		undoStack.push(action);
		if (undoStack.length > 30) undoStack.shift();
	}

	async function undo() {
		const action = undoStack.pop();
		if (action) await action();
	}

	async function updateTask(projectId: string, id: string, data: Partial<Task>) {
		const prev = allTasks.find(t => t.id === id);
		const updated = await api.updateTask(projectId, id, data);
		allTasks = allTasks.map(t => t.id === id ? updated : t);
		if (prev && data.is_done !== undefined) {
			pushUndo(async () => {
				const reverted = await api.updateTask(projectId, id, { is_done: prev.is_done });
				allTasks = allTasks.map(t => t.id === id ? reverted : t);
			});
		}
		return updated;
	}

	async function moveTask(fromProjectId: string, taskId: string, toProjectId: string) {
		const updated = await api.moveTask(fromProjectId, taskId, toProjectId);
		allTasks = allTasks.map(t => t.id === taskId ? updated : t);
		pushUndo(async () => {
			const reverted = await api.moveTask(toProjectId, taskId, fromProjectId);
			allTasks = allTasks.map(t => t.id === taskId ? reverted : t);
		});
		return updated;
	}

	async function deleteTask(projectId: string, id: string) {
		const deleted = allTasks.find(t => t.id === id);
		await api.deleteTask(projectId, id);
		allTasks = allTasks.filter(t => t.id !== id);
		if (deleted) {
			pushUndo(async () => {
				const restored = await api.createTask(projectId, { title: deleted.title, description: deleted.description || undefined });
				if (deleted.due_date) await api.updateTask(projectId, restored.id, { due_date: deleted.due_date } as any);
				if (deleted.is_done) await api.updateTask(projectId, restored.id, { is_done: true });
				allTasks = await api.listAllTasks();
			});
		}
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
		moveTask,
		deleteTask,
		undo,
		get canUndo() { return undoStack.length > 0; },
		tasksForProject,
		reset,
	};
}
