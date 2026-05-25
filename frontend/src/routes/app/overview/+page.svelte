<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Project, type Task } from '$lib/api';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import type { ParsedTask } from '$lib/smart-input';

	let projects = $state<Project[]>([]);
	let tasksByProject = $state<Record<string, Task[]>>({});
	let loading = $state(true);
	let selectedTask = $state<Task | null>(null);
	let selectedProjectId = $state('');
	let addingTo = $state<string | null>(null);
	let addInput = $state('');

	// Derived: groups and projects
	let parentProjects = $derived(projects.filter(p => !p.parent_id));
	let childrenOf = $derived((pid: string) => projects.filter(p => p.parent_id === pid));

	onMount(async () => {
		const [projs, allTasks] = await Promise.all([
			api.listProjects(),
			api.listAllTasks(),
		]);
		projects = projs;
		// Group tasks by project
		const grouped: Record<string, Task[]> = {};
		for (const t of allTasks) {
			if (!grouped[t.project_id]) grouped[t.project_id] = [];
			grouped[t.project_id].push(t);
		}
		tasksByProject = grouped;
		loading = false;
	});

	async function toggleDone(task: Task) {
		const updated = await api.updateTask(task.project_id, task.id, { is_done: !task.is_done });
		tasksByProject[task.project_id] = (tasksByProject[task.project_id] || []).map(t => t.id === task.id ? updated : t);
		tasksByProject = { ...tasksByProject };
	}

	async function addTask(projectId: string, parsed: ParsedTask) {
		if (!parsed.title) return;
		const t = await api.createTask(projectId, { title: parsed.title });
		if (parsed.due_date) {
			const updated = await api.updateTask(projectId, t.id, { due_date: parsed.due_date } as any);
			tasksByProject[projectId] = [...(tasksByProject[projectId] || []), updated];
		} else {
			tasksByProject[projectId] = [...(tasksByProject[projectId] || []), t];
		}
		tasksByProject = { ...tasksByProject };
		addInput = '';
		addingTo = null;
	}

	function openTask(task: Task) {
		selectedTask = task;
		selectedProjectId = task.project_id;
	}

	function onTaskUpdate(updated: Task) {
		tasksByProject[updated.project_id] = (tasksByProject[updated.project_id] || []).map(t => t.id === updated.id ? updated : t);
		tasksByProject = { ...tasksByProject };
	}

	function onTaskDelete(id: string) {
		for (const pid of Object.keys(tasksByProject)) {
			tasksByProject[pid] = tasksByProject[pid].filter(t => t.id !== id);
		}
		tasksByProject = { ...tasksByProject };
		selectedTask = null;
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

	function projectStats(pid: string) {
		const tasks = tasksByProject[pid] || [];
		const done = tasks.filter(t => t.is_done).length;
		return { total: tasks.length, done, pending: tasks.length - done };
	}
</script>

{#if loading}
	<div class="flex items-center justify-center h-full">
		<div class="w-5 h-5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin"></div>
	</div>
{:else}
<div class="max-w-6xl mx-auto px-6 py-8">
	<div class="mb-6">
		<h1 class="text-lg font-semibold tracking-tight">overview</h1>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
		{#each parentProjects as parent}
			{@const children = childrenOf(parent.id)}
			{@const allProjectIds = [parent.id, ...children.map(c => c.id)]}
			{@const stats = projectStats(parent.id)}

			<!-- Project section -->
			<section class="border border-border rounded-xl overflow-hidden">
				<!-- Project header -->
				<div class="px-4 py-3 bg-surface/30 flex items-center gap-3">
					{#if parent.icon}
						<span class="text-sm">{parent.icon}</span>
					{:else}
						<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{parent.color || '#525252'}"></span>
					{/if}
					<a href="/app/project/{parent.id}" class="text-sm font-medium hover:text-text-secondary transition-colors">{parent.title}</a>
					{#if stats.total > 0}
						<span class="text-[10px] text-text-muted ml-auto">{stats.done}/{stats.total}</span>
					{/if}
				</div>

				{#if children.length === 0}
					<!-- Standalone project (no children): show tasks -->
					{#if (tasksByProject[parent.id] || []).length > 0}
						<div class="divide-y divide-border/50">
							{#each (tasksByProject[parent.id] || []) as task (task.id)}
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
							{/each}
						</div>
					{/if}
					<div class="flex items-center gap-3 px-4 py-1.5 border-t border-border/50">
						<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-30"></div>
						<input
							type="text"
							bind:value={addInput}
							placeholder="new task..."
							class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/40 focus:outline-none py-1"
							onkeydown={(e) => { if (e.key === 'Enter' && addInput.trim()) { addTask(parent.id, { title: addInput.trim() }); } }}
						/>
					</div>
				{:else}
					<!-- Group: show each project with its tasks -->
					{#each children as child}
						<div class="border-t border-border">
							<div class="px-4 py-2 bg-surface/15 flex items-center gap-2.5 pl-6">
								{#if child.icon}
								<span class="text-xs">{child.icon}</span>
							{:else}
								<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{child.color || parent.color || '#525252'}"></span>
							{/if}
								<a href="/app/project/{child.id}" class="text-xs font-medium text-text-secondary hover:text-text transition-colors">{child.title}</a>
								{#if projectStats(child.id).total > 0}
									<span class="text-[10px] text-text-muted ml-auto">{projectStats(child.id).done}/{projectStats(child.id).total}</span>
								{/if}
							</div>
							{#if (tasksByProject[child.id] || []).length > 0}
								<div class="divide-y divide-border/50">
									{#each (tasksByProject[child.id] || []) as task (task.id)}
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
									{/each}
								</div>
							{/if}
							<!-- Inline add -->
							<div class="flex items-center gap-3 px-4 py-1.5 pl-6 border-t border-border/30">
								<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-30"></div>
								<input
									type="text"
									bind:value={addInput}
									placeholder="new task..."
									class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/40 focus:outline-none py-1"
									onkeydown={(e) => { if (e.key === 'Enter' && addInput.trim()) { addTask(child.id, { title: addInput.trim() }); } }}
								/>
							</div>
						</div>
					{/each}
				{/if}
			</section>
		{/each}
	</div>
</div>
{/if}

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
