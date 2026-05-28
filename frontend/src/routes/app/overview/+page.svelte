<script lang="ts">
	import type { Task } from '$lib/api';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import { parseInput } from '$lib/smart-input';
	import { relativeDate } from '$lib/utils';
	import { getDataStore } from '$lib/stores/data.svelte';

	const store = getDataStore();
	let selectedTask = $state<Task | null>(null);
	let selectedProjectId = $state('');
	let addInputs = $state<Record<string, string>>({});
	let editingTaskId = $state<string | null>(null);
	let editingTaskValue = $state('');

	let groups = $derived(store.projects.filter(p => !p.parent_id));
	let childrenOf = $derived((pid: string) => store.projects.filter(p => p.parent_id === pid));

	// Temporal view: group dated tasks by time bucket
	interface DatedTask { task: Task; projectName: string; projectColor: string | null; projectIcon: string | null; }

	function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r; }

	let datedTasks = $derived.by(() => {
		const now = startOfDay(new Date());
		const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
		const endOfWeek = new Date(now); endOfWeek.setDate(endOfWeek.getDate() + (7 - now.getDay()));

		const overdue: DatedTask[] = [];
		const today: DatedTask[] = [];
		const tomorrowList: DatedTask[] = [];
		const thisWeek: DatedTask[] = [];
		const later: DatedTask[] = [];

		for (const t of store.allTasks) {
			if (t.is_done || !t.due_date) continue;
			const proj = store.projects.find(p => p.id === t.project_id);
			const parent = proj?.parent_id ? store.projects.find(p => p.id === proj.parent_id) : null;
			const dt: DatedTask = {
				task: t,
				projectName: proj?.title || '',
				projectColor: proj?.color || parent?.color || null,
				projectIcon: proj?.icon || null,
			};
			const due = startOfDay(new Date(t.due_date));
			if (due < now) overdue.push(dt);
			else if (due.getTime() === now.getTime()) today.push(dt);
			else if (due.getTime() === tomorrow.getTime()) tomorrowList.push(dt);
			else if (due <= endOfWeek) thisWeek.push(dt);
			else later.push(dt);
		}

		return { overdue, today, tomorrow: tomorrowList, thisWeek, later };
	});

	let hasDatedTasks = $derived(
		datedTasks.overdue.length + datedTasks.today.length + datedTasks.tomorrow.length +
		datedTasks.thisWeek.length + datedTasks.later.length > 0
	);

	function dayLabel(d: string): string {
		const date = new Date(d);
		return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function timeLabel(d: string): string {
		const date = new Date(d);
		const h = date.getHours();
		const m = date.getMinutes();
		if (!h && !m) return '';
		return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
	}

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

	function startEditing(task: Task) {
		editingTaskId = task.id;
		editingTaskValue = task.title;
	}

	async function saveInlineEdit(task: Task, parsed?: ReturnType<typeof parseInput>) {
		editingTaskId = null;
		if (!parsed) parsed = parseInput(editingTaskValue);
		const updates: any = {};
		if (parsed.title && parsed.title !== task.title) updates.title = parsed.title;
		if (parsed.due_date) updates.due_date = parsed.due_date;
		if (Object.keys(updates).length === 0) return;
		await store.updateTask(task.project_id, task.id, updates);
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

	<!-- Temporal view -->
	{#if hasDatedTasks}
		<div class="mb-8 border border-border rounded-xl overflow-hidden">
			{#each [
				{ label: 'overdue', items: datedTasks.overdue, accent: 'var(--color-danger)', open: true },
				{ label: 'today', items: datedTasks.today, accent: 'var(--color-text)', open: true },
				{ label: 'tomorrow', items: datedTasks.tomorrow, accent: null, open: true },
				{ label: 'this week', items: datedTasks.thisWeek, accent: null, open: false },
				{ label: 'later', items: datedTasks.later, accent: null, open: false },
			] as section}
				{#if section.items.length > 0}
					<details open={section.open} class="group/section border-b border-border/50 last:border-b-0">
						<summary class="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-surface/30 transition-colors">
							{#if section.accent}
								<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{section.accent}"></span>
							{/if}
							<span class="text-xs font-semibold uppercase tracking-wider {section.label === 'overdue' ? 'text-danger' : 'text-text-muted'}">{section.label}</span>
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ml-auto text-text-muted transition-transform group-open/section:rotate-90 flex-shrink-0"><polyline points="9 6 15 12 9 18"/></svg>
						</summary>
						<div class="divide-y divide-border/30">
							{#each section.items as dt}
								<div class="flex items-center gap-3 px-4 py-2 hover:bg-surface/30 transition-colors group">
									<button
										type="button"
										onclick={() => toggleDone(dt.task)}
										class="w-4 h-4 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success"
										style="border-color:{section.label === 'overdue' ? 'var(--color-danger)' : 'var(--color-border-strong)'}"
									></button>
									{#if editingTaskId === dt.task.id}
										<div class="flex-1">
											<SmartInput
												bind:value={editingTaskValue}
												placeholder={dt.task.title}
												onSubmit={(parsed) => saveInlineEdit(dt.task, parsed)}
												class="inline-edit"
											/>
										</div>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span
											class="flex-1 text-sm cursor-text hover:text-text-secondary transition-colors truncate"
											onclick={() => startEditing(dt.task)}
										>{dt.task.title}</span>
									{/if}
									{#if dt.task.description}
										<svg class="w-3 h-3 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
									{/if}
									{#if timeLabel(dt.task.due_date!)}
										<span class="text-xs md:text-[10px] text-text-muted flex-shrink-0">{timeLabel(dt.task.due_date!)}</span>
									{/if}
									{#if section.label !== 'today' && section.label !== 'overdue' && section.label !== 'tomorrow'}
										<span class="text-xs md:text-[10px] text-text-muted flex-shrink-0 w-16 text-right">{dayLabel(dt.task.due_date!)}</span>
									{/if}
									<button type="button" onclick={() => openTask(dt.task)} class="w-5 h-5 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all md:opacity-0 md:group-hover:opacity-100 flex-shrink-0" title="open detail">
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
									</button>
									<span class="flex items-center gap-1 flex-shrink-0 ml-1">
										{#if dt.projectIcon}
											<span class="text-[11px]">{dt.projectIcon}</span>
										{:else}
											<span class="w-1.5 h-1.5 rounded-full" style="background:{dt.projectColor || '#525252'}"></span>
										{/if}
										<span class="text-xs md:text-[10px] text-text-muted max-w-[80px] truncate">{dt.projectName}</span>
									</span>
								</div>
							{/each}
						</div>
					</details>
				{/if}
			{/each}
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
		{#each groups as grp}
			{@const children = childrenOf(grp.id)}
			{@const stats = projectStats(grp.id)}

			<section class="border border-border rounded-xl overflow-hidden">
				<!-- Header -->
				<div class="px-4 py-3 bg-surface/30 flex items-center gap-3">
					<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
					<a href="/app/project/{grp.id}" class="text-sm font-medium hover:text-text-secondary transition-colors">{grp.title}</a>
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
			class="w-4 h-4 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
			style={task.is_done ? '' : 'border-color:var(--color-border-strong)'}
		>
			{#if task.is_done}
				<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
			{/if}
		</button>
		{#if editingTaskId === task.id}
			<div class="flex-1">
				<SmartInput
					bind:value={editingTaskValue}
					placeholder={task.title}
					onSubmit={(parsed) => saveInlineEdit(task, parsed)}
					class="inline-edit"
				/>
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="flex-1 text-sm cursor-text transition-colors {task.is_done ? 'line-through text-text-muted' : 'hover:text-text-secondary'}"
				onclick={() => startEditing(task)}
			>{task.title}</span>
		{/if}
		{#if task.description}
			<svg class="w-3 h-3 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
		{/if}
		{#if task.due_date}
			<span class="text-[10px] text-text-muted w-12 text-right flex-shrink-0">{relativeDate(task.due_date)}</span>
		{/if}
		<button type="button" onclick={() => openTask(task)} class="w-5 h-5 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all md:opacity-0 md:group-hover:opacity-100 flex-shrink-0" title="open detail">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
		</button>
	</div>
{/snippet}

{#snippet taskRowIndented(task: Task)}
	<div class="flex items-center gap-3 px-4 py-2 pl-6 hover:bg-surface/30 transition-colors group">
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
			style={task.is_done ? '' : 'border-color:var(--color-border-strong)'}
		>
			{#if task.is_done}
				<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
			{/if}
		</button>
		{#if editingTaskId === task.id}
			<div class="flex-1">
				<SmartInput
					bind:value={editingTaskValue}
					placeholder={task.title}
					onSubmit={(parsed) => saveInlineEdit(task, parsed)}
					class="inline-edit"
				/>
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="flex-1 text-sm cursor-text transition-colors {task.is_done ? 'line-through text-text-muted' : 'hover:text-text-secondary'}"
				onclick={() => startEditing(task)}
			>{task.title}</span>
		{/if}
		{#if task.description}
			<svg class="w-3 h-3 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
		{/if}
		{#if task.due_date}
			<span class="text-[10px] text-text-muted w-12 text-right flex-shrink-0">{relativeDate(task.due_date)}</span>
		{/if}
		<button type="button" onclick={() => openTask(task)} class="w-5 h-5 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all md:opacity-0 md:group-hover:opacity-100 flex-shrink-0" title="open detail">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
		</button>
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
