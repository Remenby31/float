<script lang="ts">
	import { page } from '$app/state';
	import { api, type Task, type Project } from '$lib/api';
	import type { ParsedTask } from '$lib/smart-input';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import { onShortcut } from '$lib/keyboard';
	import { onMount, onDestroy } from 'svelte';

	let project = $state<Project | null>(null);
	let tasks = $state<Task[]>([]);
	let input = $state('');
	let loading = $state(true);
	let selectedTask = $state<Task | null>(null);
	let unsubs: (() => void)[] = [];

	onMount(() => {
		unsubs.push(
			onShortcut('escape', () => { selectedTask = null; }),
		);
	});

	onDestroy(() => { unsubs.forEach(u => u()); });

	$effect(() => {
		const id = page.params.id;
		if (id) load(id);
	});

	async function load(id: string) {
		loading = true;
		project = await api.getProject(id);
		tasks = await api.listTasks(id);
		loading = false;
	}

	async function addTask(parsed: ParsedTask) {
		if (!parsed.title || !project) return;
		const t = await api.createTask(project.id, {
			title: parsed.title,
		});
		// Set due_date if parsed
		if (parsed.due_date) {
			const updated = await api.updateTask(project.id, t.id, { due_date: parsed.due_date } as any);
			tasks = [...tasks, updated];
		} else {
			tasks = [...tasks, t];
		}
	}

	async function toggleDone(task: Task) {
		if (!project) return;
		const updated = await api.updateTask(project.id, task.id, { is_done: !task.is_done });
		tasks = tasks.map(t => t.id === task.id ? updated : t);
	}

	async function deleteTask(task: Task) {
		if (!project) return;
		await api.deleteTask(project.id, task.id);
		tasks = tasks.filter(t => t.id !== task.id);
	}



	function relativeDate(d: string | null) {
		if (!d) return '';
		const date = new Date(d);
		const now = new Date();
		const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		if (diff === 0) return 'today';
		if (diff === 1) return 'tomorrow';
		if (diff === -1) return 'yesterday';
		if (diff > 0 && diff < 7) return date.toLocaleDateString('en', { weekday: 'short' });
		return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
	}

	function onTaskUpdate(updated: Task) {
		tasks = tasks.map(t => t.id === updated.id ? updated : t);
	}

	function onTaskDelete(id: string) {
		tasks = tasks.filter(t => t.id !== id);
		selectedTask = null;
	}

	let pendingTasks = $derived(tasks.filter(t => !t.is_done));
	let doneTasks = $derived(tasks.filter(t => t.is_done));
	let isFloating = $derived(pendingTasks.length === 0 && tasks.length > 0);
</script>

{#if loading}
	<div class="flex items-center justify-center h-full">
		<div class="w-5 h-5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin"></div>
	</div>
{:else if project}
<div class="max-w-3xl mx-auto px-6 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h2 class="text-lg font-semibold tracking-tight">{project.title}</h2>
			{#if isFloating}
				<p class="text-sm text-success mt-0.5 floating-text">you're floating</p>
			{:else if pendingTasks.length > 0}
				<p class="text-xs text-text-muted mt-0.5">{pendingTasks.length} remaining</p>
			{/if}
		</div>
	</div>

	<!-- Smart Input -->
	<SmartInput
		bind:value={input}
		placeholder="add a task... @demain @15h"
		onSubmit={addTask}
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
				<p class="text-text-muted/50 text-xs mt-1">add your first task above</p>
			</div>
		{:else}
			<div class="space-y-0.5">
				{#each pendingTasks as task, i (task.id)}
					<div
						class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface/50 transition-all group task-row"
						style="animation-delay: {i * 30}ms"
					>
						<button
							type="button"
							onclick={() => toggleDone(task)}
							class="check-btn w-[18px] h-[18px] rounded-full border-2 border-border-strong flex-shrink-0 transition-all flex items-center justify-center"
						>
							<svg class="check-icon w-2.5 h-2.5 opacity-0 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="2,6 5,9 10,3"/>
							</svg>
						</button>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span class="flex-1 text-sm cursor-pointer hover:text-text-secondary transition-colors" onclick={() => selectedTask = task}>{task.title}</span>
						{#if task.due_date}
							<span class="text-[11px] text-text-muted">{relativeDate(task.due_date)}</span>
						{/if}
						<div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button type="button" onclick={() => deleteTask(task)} class="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface transition-colors">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if doneTasks.length > 0}
			<details class="mt-6">
				<summary class="text-xs text-text-muted cursor-pointer hover:text-text-secondary px-3 py-1 select-none">
					{doneTasks.length} completed
				</summary>
				<div class="mt-1 space-y-0.5">
					{#each doneTasks as task (task.id)}
						<div class="flex items-center gap-3 px-3 py-2 rounded-xl opacity-40 hover:opacity-60 transition-opacity group">
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
	/* Task row stagger entrance */
	.task-row {
		animation: fadeSlideIn 0.2s ease both;
	}
	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Checkbox hover check preview */
	.check-btn:hover .check-icon { opacity: 0.4; }
	.check-btn:hover { background: var(--color-success); border-color: var(--color-success) !important; }
	.check-btn:hover .check-icon { opacity: 1; stroke: white; }

	/* Floating sphere */
	.floating-sphere {
		width: 32px;
		height: 32px;
		background: var(--color-text);
		border-radius: 50%;
		opacity: 0.15;
		animation: floatBreathe 3s ease-in-out infinite;
	}
	@keyframes floatBreathe {
		0%, 100% { transform: translateY(0); opacity: 0.15; }
		50% { transform: translateY(-6px); opacity: 0.25; }
	}

	/* Floating text */
	.floating-text {
		animation: fadeIn 0.5s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.animate-spin { animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
