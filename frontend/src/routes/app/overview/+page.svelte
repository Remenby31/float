<script lang="ts">
	import type { Task } from '$lib/api';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { relativeDate } from '$lib/utils';
	import { getDataStore } from '$lib/stores/data.svelte';

	const store = getDataStore();
	let selectedTask = $state<Task | null>(null);
	let selectedProjectId = $state('');
	let addInputs = $state<Record<string, string>>({});

	let groups = $derived(store.projects.filter(p => !p.parent_id));
	let childrenOf = $derived((pid: string) => store.projects.filter(p => p.parent_id === pid));

	async function toggleDone(task: Task) {
		await store.updateTask(task.project_id, task.id, { is_done: !task.is_done });
	}

	async function addTask(projectId: string, title: string) {
		if (!title.trim()) return;
		await store.addTask(projectId, { title: title.trim() });
		addInputs[projectId] = '';
		addInputs = { ...addInputs };
	}

	function openTask(task: Task) {
		selectedTask = task;
		selectedProjectId = task.project_id;
	}

	function onTaskUpdate() { store.refreshTasks(); }
	function onTaskDelete() { selectedTask = null; store.refreshTasks(); }

	async function updateProjectAppearance(id: string, color: string | null, icon: string | null) {
		await store.updateProject(id, { color, icon } as any);
	}

	function projectStats(pid: string) {
		const tasks = store.tasksForProject(pid);
		const done = tasks.filter(t => t.is_done).length;
		return { total: tasks.length, done };
	}

	function getInput(pid: string): string {
		return addInputs[pid] || '';
	}

	function setInput(pid: string, val: string) {
		addInputs[pid] = val;
		addInputs = { ...addInputs };
	}
</script>

{#if !store.initialized}
	<div class="flex items-center justify-center h-full">
		<div class="w-5 h-5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin"></div>
	</div>
{:else}
<div class="max-w-6xl mx-auto px-6 py-8">
	<div class="mb-6">
		<h1 class="text-lg font-semibold tracking-tight">overview</h1>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
		{#each groups as grp}
			{@const children = childrenOf(grp.id)}
			{@const stats = projectStats(grp.id)}

			<section class="border border-border rounded-xl overflow-hidden">
				<!-- Header -->
				<div class="px-4 py-3 bg-surface/30 flex items-center gap-3">
					<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
					<a href="/app/project/{grp.id}" class="text-sm font-medium hover:text-text-secondary transition-colors">{grp.title}</a>
					{#if stats.total > 0}
						<span class="text-[10px] text-text-muted ml-auto">{stats.done}/{stats.total}</span>
					{/if}
				</div>

				{#if children.length === 0}
					<!-- Standalone project: show tasks -->
					{#if (store.tasksForProject(grp.id)).length > 0}
						<div class="divide-y divide-border/50">
							{#each (store.tasksForProject(grp.id)) as task (task.id)}
								{@render taskRow(task)}
							{/each}
						</div>
					{/if}
					{@render addRow(grp.id)}
				{:else}
					<!-- Group: show each project -->
					{#each children as child}
						{@const cStats = projectStats(child.id)}
						<div class="border-t border-border">
							<div class="px-4 py-2 bg-surface/15 flex items-center gap-2.5 pl-6">
								<ColorPicker color={child.color || grp.color} icon={child.icon} onchange={(c, i) => updateProjectAppearance(child.id, c, i)} />
								<a href="/app/project/{child.id}" class="text-xs font-medium text-text-secondary hover:text-text transition-colors">{child.title}</a>
								{#if cStats.total > 0}
									<span class="text-[10px] text-text-muted ml-auto">{cStats.done}/{cStats.total}</span>
								{/if}
							</div>
							{#if (store.tasksForProject(child.id)).length > 0}
								<div class="divide-y divide-border/50">
									{#each (store.tasksForProject(child.id)) as task (task.id)}
										{@render taskRowIndented(task)}
									{/each}
								</div>
							{/if}
							{@render addRowIndented(child.id)}
						</div>
					{/each}
				{/if}
			</section>
		{/each}
	</div>
</div>
{/if}

{#snippet taskRow(task: Task)}
	<div class="flex items-center gap-3 px-4 py-2 hover:bg-surface/30 transition-colors group">
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
			style={task.is_done ? '' : 'border-color:var(--color-border-strong)'}
		>
			{#if task.is_done}
				<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
			{/if}
		</button>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="flex-1 text-sm cursor-pointer transition-colors {task.is_done ? 'line-through text-text-muted' : 'hover:text-text-secondary'}"
			onclick={() => openTask(task)}
		>{task.title}</span>
		{#if task.due_date}
			<span class="text-[10px] text-text-muted w-12 text-right flex-shrink-0">{relativeDate(task.due_date)}</span>
		{/if}
	</div>
{/snippet}

{#snippet taskRowIndented(task: Task)}
	<div class="flex items-center gap-3 px-4 py-2 pl-6 hover:bg-surface/30 transition-colors group">
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
			style={task.is_done ? '' : 'border-color:var(--color-border-strong)'}
		>
			{#if task.is_done}
				<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
			{/if}
		</button>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="flex-1 text-sm cursor-pointer transition-colors {task.is_done ? 'line-through text-text-muted' : 'hover:text-text-secondary'}"
			onclick={() => openTask(task)}
		>{task.title}</span>
		{#if task.due_date}
			<span class="text-[10px] text-text-muted w-12 text-right flex-shrink-0">{relativeDate(task.due_date)}</span>
		{/if}
	</div>
{/snippet}

{#snippet addRow(projectId: string)}
	<div class="flex items-center gap-3 px-4 py-1.5 border-t border-border/50">
		<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-30"></div>
		<input
			type="text"
			value={getInput(projectId)}
			oninput={(e) => setInput(projectId, (e.target as HTMLInputElement).value)}
			placeholder="new task..."
			class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/40 focus:outline-none py-1"
			onkeydown={(e) => { if (e.key === 'Enter') addTask(projectId, getInput(projectId)); }}
		/>
	</div>
{/snippet}

{#snippet addRowIndented(projectId: string)}
	<div class="flex items-center gap-3 px-4 py-1.5 pl-6 border-t border-border/30">
		<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-30"></div>
		<input
			type="text"
			value={getInput(projectId)}
			oninput={(e) => setInput(projectId, (e.target as HTMLInputElement).value)}
			placeholder="new task..."
			class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/40 focus:outline-none py-1"
			onkeydown={(e) => { if (e.key === 'Enter') addTask(projectId, getInput(projectId)); }}
		/>
	</div>
{/snippet}

{#if selectedProjectId}
	<TaskDetail
		bind:task={selectedTask}
		projectId={selectedProjectId}
		onUpdate={onTaskUpdate}
		onDelete={onTaskDelete}
	/>
{/if}

<style>
	.animate-spin { animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
