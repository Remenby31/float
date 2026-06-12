import { setContext, getContext } from 'svelte';
import { api, type Project, type Task } from '$lib/api';
import { getToastStore } from '$lib/stores/toast.svelte';

const STORE_KEY = Symbol('data-store');

type UndoAction = { do: () => Promise<void>; undo: () => Promise<void> };

function createDataStore() {
	const toast = getToastStore();

	let projects = $state<Project[]>([]);
	let allTasks = $state<Task[]>([]);
	let initialized = $state(false);
	let recentlyAdded = $state<Set<string>>(new Set());
	let undoStack: UndoAction[] = [];
	let redoStack: UndoAction[] = [];

	async function init() {
		if (initialized) return;
		try {
			const [p, t] = await Promise.all([api.listProjects(), api.listAllTasks()]);
			projects = p;
			allTasks = t;
			initialized = true;
		} catch (e) {
			toast.error('Failed to load data');
			throw e;
		}
	}

	async function refreshProjects() {
		try { projects = await api.listProjects(); }
		catch { toast.error('Failed to refresh projects'); }
	}

	async function refreshTasks() {
		try { allTasks = await api.listAllTasks(); }
		catch { toast.error('Failed to refresh tasks'); }
	}

	async function refreshAll() {
		try {
			const [p, t] = await Promise.all([api.listProjects(), api.listAllTasks()]);
			projects = p;
			allTasks = t;
		} catch { toast.error('Failed to refresh data'); }
	}

	async function addProject(data: Parameters<typeof api.createProject>[0]) {
		try {
			const p = await api.createProject(data);
			projects = [...projects, p];
			return p;
		} catch (e) {
			toast.error('Failed to create project');
			throw e;
		}
	}

	async function updateProject(id: string, data: Partial<Pick<Project, 'title' | 'description' | 'color' | 'icon' | 'is_archived' | 'position'>>) {
		const prev = projects.find(p => p.id === id);
		if (prev) projects = projects.map(p => p.id === id ? { ...p, ...data } : p);
		try {
			const updated = await api.updateProject(id, data);
			projects = projects.map(p => p.id === id ? updated : p);
			return updated;
		} catch (e) {
			if (prev) projects = projects.map(p => p.id === id ? prev : p);
			toast.error('Failed to update project');
			throw e;
		}
	}

	async function reorderProjects(projectIds: string[]) {
		const prev = [...projects];
		projects = projects.map(p => {
			const idx = projectIds.indexOf(p.id);
			return idx >= 0 ? { ...p, position: idx } : p;
		}).sort((a, b) => a.position - b.position);
		try {
			await api.reorderProjects(projectIds);
		} catch {
			projects = prev;
			toast.error('Failed to reorder projects');
		}
	}

	async function deleteProject(id: string) {
		try {
			await api.deleteProject(id);
			projects = projects.filter(p => p.id !== id && p.parent_id !== id);
			allTasks = allTasks.filter(t => {
				const proj = projects.find(p => p.id === t.project_id);
				return proj !== undefined;
			});
		} catch {
			toast.error('Failed to delete project');
		}
	}

	async function addTask(projectId: string, data: Parameters<typeof api.createTask>[1]) {
		try {
			const t = await api.createTask(projectId, data);
			allTasks = [...allTasks, t];
			recentlyAdded = new Set([...recentlyAdded, t.id]);
			setTimeout(() => {
				recentlyAdded = new Set([...recentlyAdded].filter(id => id !== t.id));
			}, 300);
			return t;
		} catch (e) {
			toast.error('Failed to create task');
			throw e;
		}
	}

	function pushUndo(doFn: () => Promise<void>, undoFn: () => Promise<void>) {
		undoStack.push({ do: doFn, undo: undoFn });
		if (undoStack.length > 30) undoStack.shift();
		redoStack.length = 0;
	}

	async function undo() {
		const action = undoStack.pop();
		if (!action) return;
		try {
			await action.undo();
			redoStack.push(action);
		} catch {
			toast.error('Failed to undo');
		}
	}

	async function redo() {
		const action = redoStack.pop();
		if (!action) return;
		try {
			await action.do();
			undoStack.push(action);
		} catch {
			toast.error('Failed to redo');
		}
	}

	async function updateTask(projectId: string, id: string, data: Partial<Pick<Task, 'title' | 'description' | 'is_done' | 'due_date' | 'position'>>) {
		const prev = allTasks.find(t => t.id === id);
		if (prev) allTasks = allTasks.map(t => t.id === id ? { ...t, ...data } : t);
		try {
			const updated = await api.updateTask(projectId, id, data);
			allTasks = allTasks.map(t => t.id === id ? updated : t);
			if (prev && data.is_done !== undefined) {
				pushUndo(
					async () => { const r = await api.updateTask(projectId, id, { is_done: data.is_done }); allTasks = allTasks.map(t => t.id === id ? r : t); },
					async () => { const r = await api.updateTask(projectId, id, { is_done: prev.is_done }); allTasks = allTasks.map(t => t.id === id ? r : t); },
				);
			}
			return updated;
		} catch (e) {
			if (prev) allTasks = allTasks.map(t => t.id === id ? prev : t);
			toast.error('Failed to update task');
			throw e;
		}
	}

	async function moveTask(fromProjectId: string, taskId: string, toProjectId: string) {
		try {
			const updated = await api.moveTask(fromProjectId, taskId, toProjectId);
			allTasks = allTasks.map(t => t.id === taskId ? updated : t);
			pushUndo(
				async () => { const r = await api.moveTask(fromProjectId, taskId, toProjectId); allTasks = allTasks.map(t => t.id === taskId ? r : t); },
				async () => { const r = await api.moveTask(toProjectId, taskId, fromProjectId); allTasks = allTasks.map(t => t.id === taskId ? r : t); },
			);
			return updated;
		} catch (e) {
			toast.error('Failed to move task');
			throw e;
		}
	}

	async function deleteTask(projectId: string, id: string) {
		const deleted = allTasks.find(t => t.id === id);
		allTasks = allTasks.filter(t => t.id !== id);
		try {
			await api.deleteTask(projectId, id);
			if (deleted) {
				let restoredId = '';
				pushUndo(
					async () => { await api.deleteTask(projectId, restoredId); allTasks = allTasks.filter(t => t.id !== restoredId); },
					async () => {
						const restored = await api.createTask(projectId, { title: deleted.title, description: deleted.description || undefined });
						restoredId = restored.id;
						if (deleted.due_date) await api.updateTask(projectId, restored.id, { due_date: deleted.due_date });
						if (deleted.is_done) await api.updateTask(projectId, restored.id, { is_done: true });
						allTasks = await api.listAllTasks();
					},
				);
			}
		} catch {
			if (deleted) allTasks = [...allTasks, deleted];
			toast.error('Failed to delete task');
		}
	}

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
		reorderProjects,
		deleteProject,
		addTask,
		updateTask,
		moveTask,
		deleteTask,
		undo,
		redo,
		get canUndo() { return undoStack.length > 0; },
		get canRedo() { return redoStack.length > 0; },
		get recentlyAdded() { return recentlyAdded; },
		tasksForProject,
		reset,
	};
}

export type DataStore = ReturnType<typeof createDataStore>;

export function initDataStore(): DataStore {
	const store = createDataStore();
	setContext(STORE_KEY, store);
	return store;
}

export function getDataStore(): DataStore {
	return getContext<DataStore>(STORE_KEY);
}
