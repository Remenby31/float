<script lang="ts">
	import { page } from '$app/state';
	import type { Task } from '$lib/api';
	import { relativeDate } from '$lib/utils';
	import type { ParsedTask } from '$lib/smart-input';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import { getDataStore } from '$lib/stores/data.svelte';
	import { onShortcut } from '$lib/keyboard';
	import { onMount, onDestroy } from 'svelte';

	const store = getDataStore();
	let input = $state('');
	let selectedTask = $state<Task | null>(null);
	let editingTaskId = $state<string | null>(null);
	let editingTaskValue = $state('');
	let unsubs: (() => void)[] = [];

	onMount(() => {
		unsubs.push(onShortcut('escape', () => { selectedTask = null; }));
	});
	onDestroy(() => { unsubs.forEach(u => u()); });

	let projectId = $derived(page.params.id);
	let project = $derived(store.projects.find(p => p.id === projectId) || null);
	let tasks = $derived(store.tasksForProject(projectId));
	let pendingTasks = $derived(tasks.filter(t => !t.is_done));
	let allDoneTasks = $derived(tasks.filter(t => t.is_done));
	// Only show recently completed tasks (today/yesterday); older ones go straight to collapsed
	let doneTasks = $derived.by(() => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		yesterday.setHours(0, 0, 0, 0);
		return allDoneTasks.filter(t => {
			if (!t.done_at) return true; // no timestamp = show
			return new Date(t.done_at) >= yesterday;
		});
	});
	let olderDoneTasks = $derived(allDoneTasks.filter(t => !doneTasks.includes(t)));
	let isFloating = $derived(pendingTasks.length === 0 && tasks.length > 0);

	async function addTask(parsed: ParsedTask) {
		if (!parsed.title || !project) return;
		const t = await store.addTask(project.id, { title: parsed.title });
		if (parsed.due_date) {
			await store.updateTask(project.id, t.id, { due_date: parsed.due_date } as any);
		}
		input = '';
	}

	// Live create: first non-@ keystroke creates task, then switches to inline edit
	let liveCreating = false;
	async function handleLiveInput(val: string) {
		if (liveCreating || !project || !val.trim() || val.startsWith('@')) return;
		liveCreating = true;
		try {
			const t = await store.addTask(project.id, { title: val.trim() });
			input = '';
			editingTaskId = t.id;
			editingTaskValue = val.trim();
		} finally {
			liveCreating = false;
		}
	}

	async function toggleDone(task: Task) {
		if (!project) return;
		await store.updateTask(project.id, task.id, { is_done: !task.is_done });
	}

	async function deleteTask(task: Task) {
		if (!project) return;
		await store.deleteTask(project.id, task.id);
	}

	import { parseInput } from '$lib/smart-input';

	function startEditing(task: Task) {
		// Save previous inline edit before switching
		if (editingTaskId && editingTaskId !== task.id) {
			const prev = tasks.find(t => t.id === editingTaskId);
			if (prev) saveInlineEdit(prev);
		}
		editingTaskId = task.id;
		editingTaskValue = task.title;
	}

	async function saveInlineEdit(task: Task, parsed?: ReturnType<typeof parseInput>) {
		if (editingTaskId === task.id) editingTaskId = null;
		if (!parsed) parsed = parseInput(editingTaskValue);
		const updates: any = {};
		if (parsed.title && parsed.title !== task.title) updates.title = parsed.title;
		if (parsed.due_date) updates.due_date = parsed.due_date;
		if (Object.keys(updates).length === 0) return;
		await store.updateTask(project!.id, task.id, updates);
	}

	// Debounced auto-save while editing inline
	let saveTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (editingTaskId && editingTaskValue) {
			clearTimeout(saveTimer);
			const taskId = editingTaskId;
			const val = editingTaskValue;
			saveTimer = setTimeout(() => {
				const task = tasks.find(t => t.id === taskId);
				if (task && val.trim() && val.trim() !== task.title) {
					const parsed = parseInput(val);
					const updates: any = {};
					if (parsed.title && parsed.title !== task.title) updates.title = parsed.title;
					if (parsed.due_date) updates.due_date = parsed.due_date;
					if (Object.keys(updates).length > 0) {
						store.updateTask(project!.id, taskId, updates);
					}
				}
			}, 500);
		}
		return () => clearTimeout(saveTimer);
	});

	function onTaskUpdate() {
		store.refreshTasks();
	}

	function onTaskDelete() {
		selectedTask = null;
		store.refreshTasks();
	}
</script>

{#if !store.initialized}
	<div class="flex items-center justify-center h-full">
		<div class="w-5 h-5 border-2 border-text-muted/40 border-t-text-muted rounded-full animate-spin"></div>
	</div>
{:else if project}
<div class="max-w-3xl mx-auto px-6 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h2 class="text-lg font-semibold tracking-tight">{project.title}</h2>
			{#if isFloating}
				<p class="text-sm text-success mt-0.5 floating-text">you're floating</p>
			{:else if pendingTasks.length > 0}
				<p class="text-xs text-text-muted mt-0.5">{pendingTasks.length} remaining</p>
			{/if}
		</div>
		<div class="flex items-center gap-0.5">
			<button type="button" onclick={() => store.undo()} disabled={!store.canUndo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Undo (⌘Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
			</button>
			<button type="button" onclick={() => store.redo()} disabled={!store.canRedo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Redo (⌘⇧Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>
			</button>
		</div>
	</div>

	<SmartInput
		bind:value={input}
		placeholder="add a task... @demain @15h"
		onSubmit={addTask}
		onLiveInput={handleLiveInput}
		class="mb-6"
	/>

	{#if isFloating}
		<div class="text-center py-16">
			<div class="floating-sphere mx-auto mb-4"></div>
			<p class="text-text-secondary text-sm italic">all clear</p>
		</div>
	{:else if pendingTasks.length === 0 && tasks.length === 0}
		<div class="text-center py-16">
			<p class="text-text-muted text-sm">empty bucket</p>
			<p class="text-text-muted/70 text-xs mt-1">add your first task above</p>
		</div>
	{:else}
		<div class="space-y-0.5">
			{#each pendingTasks as task, i (task.id)}
				<div
					class="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-surface/50 transition-all group task-row"
					style="animation-delay: {i * 30}ms"
				>
					<button
						type="button"
						onclick={() => toggleDone(task)}
						class="check-btn w-[18px] h-[18px] mt-0.5 rounded-full border-2 border-border-strong flex-shrink-0 transition-all flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
					>
						<svg class="check-icon w-2.5 h-2.5 opacity-0 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="2,6 5,9 10,3"/>
						</svg>
					</button>
					{#if editingTaskId === task.id}
						<div class="flex-1">
							<SmartInput
								bind:value={editingTaskValue}
								placeholder={task.title}
								onSubmit={(parsed) => saveInlineEdit(task, parsed)}
								onBlurSubmit={false}
								class="inline-edit"
							/>
						</div>
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span class="flex-1 text-sm cursor-text hover:text-text-secondary transition-colors" onclick={() => startEditing(task)}>{task.title}</span>
					{/if}
					{#if task.description}
						<svg class="w-3.5 h-3.5 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
					{/if}
					{#if task.due_date}
						<span class="text-xs md:text-[11px] text-text-muted">{relativeDate(task.due_date)}</span>
					{/if}
					<div class="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
						<button type="button" onclick={() => selectedTask = task} class="w-6 h-6 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-colors" title="open detail">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
						</button>
						<button type="button" onclick={() => deleteTask(task)} class="w-6 h-6 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-md flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface transition-colors">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if doneTasks.length > 0 || olderDoneTasks.length > 0}
		{#each doneTasks as task (task.id)}
			<div class="flex items-center gap-3 px-3 py-2 rounded-xl opacity-50 hover:opacity-70 transition-opacity group">
				<button
					type="button"
					onclick={() => toggleDone(task)}
					class="w-[18px] h-[18px] rounded-full bg-success flex-shrink-0 flex items-center justify-center"
				>
					<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="2,6 5,9 10,3"/>
					</svg>
				</button>
				<span class="flex-1 text-sm line-through">{task.title}</span>
			</div>
		{/each}
		{#if olderDoneTasks.length > 0}
		<details class="mt-2">
			<summary class="text-xs text-text-muted cursor-pointer hover:text-text-secondary px-3 py-1 select-none">
				{olderDoneTasks.length} completed
			</summary>
			<div class="mt-1 space-y-0.5">
				{#each olderDoneTasks as task (task.id)}
					<div class="flex items-center gap-3 px-3 py-2 rounded-xl opacity-50 hover:opacity-70 transition-opacity group">
						<button
							type="button"
							onclick={() => toggleDone(task)}
							class="w-[18px] h-[18px] rounded-full bg-success flex-shrink-0 flex items-center justify-center"
						>
							<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="2,6 5,9 10,3"/>
							</svg>
						</button>
						<span class="flex-1 text-sm line-through">{task.title}</span>
					</div>
				{/each}
			</div>
		</details>
	{/if}
	{/if}
</div>
{/if}

{#if project}
	<TaskDetail
		bind:task={selectedTask}
		projectId={project.id}
		onUpdate={onTaskUpdate}
		onDelete={onTaskDelete}
	/>
{/if}

<style>
	.task-row { animation: fadeSlideIn 0.2s ease both; }
	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.check-btn:hover .check-icon { opacity: 0.4; }
	.check-btn:hover { background: var(--color-success); border-color: var(--color-success) !important; }
	.check-btn:hover .check-icon { opacity: 1; stroke: white; }
	.floating-sphere {
		width: 32px; height: 32px; background: var(--color-text);
		border-radius: 50%; opacity: 0.15;
		animation: floatBreathe 3s ease-in-out infinite;
	}
	@keyframes floatBreathe {
		0%, 100% { transform: translateY(0); opacity: 0.15; }
		50% { transform: translateY(-6px); opacity: 0.25; }
	}
	.floating-text { animation: fadeIn 0.5s ease; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	.animate-spin { animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
