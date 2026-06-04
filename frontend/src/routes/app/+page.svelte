<script lang="ts">
	import type { Task } from '$lib/api';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import { parseInput } from '$lib/smart-input';
	import { relativeDate } from '$lib/utils';
	import { getDataStore } from '$lib/stores/data.svelte';
	import { touchDrag } from '$lib/touch-dnd';

	const store = getDataStore();
	let selectedTask = $state<Task | null>(null);
	let selectedProjectId = $state('');
	let addInputs = $state<Record<string, string>>({});
	let editingTaskId = $state<string | null>(null);
	let editingTaskValue = $state('');
	let dragTask = $state<Task | null>(null);
	let dropTargetId = $state<string | null>(null);

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

	async function addTaskFromInput(projectId: string, parsed: ReturnType<typeof parseInput>) {
		if (!parsed.title) return;
		const t = await store.addTask(projectId, { title: parsed.title });
		if (parsed.due_date) {
			await store.updateTask(projectId, t.id, { due_date: parsed.due_date } as any);
		}
		addInputs[projectId] = '';
		addInputs = { ...addInputs };
	}

	function openTask(task: Task) {
		selectedTask = task;
		selectedProjectId = task.project_id;
	}

	function startEditing(task: Task) {
		// Save previous inline edit before switching
		if (editingTaskId && editingTaskId !== task.id) {
			const prev = store.allTasks.find(t => t.id === editingTaskId);
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

	function onDragStart(task: Task) {
		dragTask = task;
	}

	function onDragEnd() {
		dragTask = null;
		dropTargetId = null;
	}

	function onDragOver(e: DragEvent, projectId: string) {
		e.preventDefault();
		if (dragTask && dragTask.project_id !== projectId) {
			dropTargetId = projectId;
		}
	}

	function onDragLeave(projectId: string) {
		if (dropTargetId === projectId) dropTargetId = null;
	}

	async function onDrop(e: DragEvent, toProjectId: string) {
		e.preventDefault();
		dropTargetId = null;
		if (!dragTask || dragTask.project_id === toProjectId) return;
		await store.moveTask(dragTask.project_id, dragTask.id, toProjectId);
		dragTask = null;
	}

	async function onTouchDrop(e: CustomEvent<{ taskId: string; fromProjectId: string; toProjectId: string }>) {
		const { taskId, fromProjectId, toProjectId } = e.detail;
		await store.moveTask(fromProjectId, taskId, toProjectId);
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
		<div class="w-5 h-5 border-2 border-text-muted/40 border-t-text-muted rounded-full animate-spin"></div>
	</div>
{:else}
<div class="max-w-6xl mx-auto px-6 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-lg font-semibold tracking-tight">overview</h1>
		<div class="flex items-center gap-0.5">
			<button type="button" onclick={() => store.undo()} disabled={!store.canUndo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Undo (⌘Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
			</button>
			<button type="button" onclick={() => store.redo()} disabled={!store.canRedo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Redo (⌘⇧Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>
			</button>
		</div>
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
								<div
									class="flex items-start gap-3 px-4 py-2 hover:bg-surface/30 transition-colors group cursor-grab active:cursor-grabbing"
									draggable="true"
									ondragstart={() => onDragStart(dt.task)}
									ondragend={onDragEnd}
									use:touchDrag={{ taskId: dt.task.id, projectId: dt.task.project_id }}
									ontouchdrop={(e) => onTouchDrop(e)}
								>
									<button
										type="button"
										onclick={() => toggleDone(dt.task)}
										class="w-4 h-4 mt-0.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success"
										style="border-color:{section.label === 'overdue' ? 'var(--color-danger)' : 'var(--color-border-strong)'}"
									></button>
									{#if editingTaskId === dt.task.id}
										<div class="flex-1">
											<SmartInput
												bind:value={editingTaskValue}
												placeholder={dt.task.title}
												onSubmit={(parsed) => saveInlineEdit(dt.task, parsed)}
												onBlurSubmit={false}
												class="inline-edit"
											/>
										</div>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span
											class="flex-1 text-sm cursor-text hover:text-text-secondary transition-colors"
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

	<div class="columns-1 md:columns-2 gap-4 space-y-4">
		{#each groups as grp}
			{@const children = childrenOf(grp.id)}
			{@const stats = projectStats(grp.id)}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<section
				class="border rounded-xl overflow-hidden break-inside-avoid transition-colors {dropTargetId === grp.id && children.length === 0 ? 'border-accent ring-2 ring-accent/20' : 'border-border'}"
				data-drop-project={children.length === 0 ? grp.id : undefined}
				ondragover={(e) => { if (children.length === 0) onDragOver(e, grp.id); }}
				ondragleave={() => { if (children.length === 0) onDragLeave(grp.id); }}
				ondrop={(e) => { if (children.length === 0) onDrop(e, grp.id); }}
			>
				<!-- Header -->
				<div class="px-4 py-3 bg-surface/30 flex items-center gap-3">
					<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
					<a href="/app/project/{grp.id}" class="text-sm font-medium hover:text-text-secondary transition-colors">{grp.title}</a>
				</div>

				{#if children.length === 0}
					<!-- Standalone project: show tasks -->
					{@render taskListWithAdd(store.tasksForProject(grp.id), taskRow, addRow, grp.id)}
				{:else}
					<!-- Group: show each project -->
					{#each children as child}
						{@const cStats = projectStats(child.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="border-t transition-colors {dropTargetId === child.id ? 'border-accent bg-accent/5' : 'border-border'}"
							data-drop-project={child.id}
							ondragover={(e) => onDragOver(e, child.id)}
							ondragleave={() => onDragLeave(child.id)}
							ondrop={(e) => onDrop(e, child.id)}
						>
							<div class="px-4 py-2 bg-surface/15 flex items-center gap-2.5 pl-6">
								<ColorPicker color={child.color || grp.color} icon={child.icon} onchange={(c, i) => updateProjectAppearance(child.id, c, i)} />
								<a href="/app/project/{child.id}" class="text-xs font-medium text-text-secondary hover:text-text transition-colors">{child.title}</a>
							</div>
							{@render taskListWithAdd(store.tasksForProject(child.id), taskRowIndented, addRowIndented, child.id)}
						</div>
					{/each}
				{/if}
			</section>
		{/each}
	</div>
</div>
{/if}

{#snippet taskListWithAdd(tasks: Task[], row: typeof taskRow, add: typeof addRow, projectId: string)}
	{@const pending = tasks.filter(t => !t.is_done)}
	{@const done = tasks.filter(t => t.is_done)}
	{#if pending.length > 0}
		<div class="divide-y divide-border/50">
			{#each pending as task (task.id)}
				{@render row(task)}
			{/each}
		</div>
	{/if}
	{@render add(projectId)}
	{#if done.length > 0}
		{@const visible = done.slice(-2)}
		{@const hidden = done.slice(0, -2)}
		{#if hidden.length > 0}
			<details class="border-t border-border/30">
				<summary class="px-4 py-1.5 text-[10px] text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors">+{hidden.length} completed</summary>
				<div class="divide-y divide-border/50">
					{#each hidden as task (task.id)}
						{@render row(task)}
					{/each}
				</div>
			</details>
		{/if}
		<div class="divide-y divide-border/50 {hidden.length === 0 ? 'border-t border-border/30' : ''}">
			{#each visible as task (task.id)}
				{@render row(task)}
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet taskRow(task: Task)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex items-start gap-3 px-4 py-2 hover:bg-surface/30 transition-colors group cursor-grab active:cursor-grabbing"
		draggable="true"
		ondragstart={() => onDragStart(task)}
		ondragend={onDragEnd}
		use:touchDrag={{ taskId: task.id, projectId: task.project_id }}
		ontouchdrop={(e) => onTouchDrop(e)}
	>
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 mt-0.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
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
					onBlurSubmit={false}
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex items-start gap-3 px-4 py-2 pl-6 hover:bg-surface/30 transition-colors group cursor-grab active:cursor-grabbing"
		draggable="true"
		ondragstart={() => onDragStart(task)}
		ondragend={onDragEnd}
		use:touchDrag={{ taskId: task.id, projectId: task.project_id }}
		ontouchdrop={(e) => onTouchDrop(e)}
	>
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 mt-0.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
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
					onBlurSubmit={false}
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
	{@const val = getInput(projectId)}
	<div class="flex items-center gap-3 px-4 py-1.5 border-t border-border/50">
		<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-50"></div>
		<SmartInput
			value={val}
			placeholder="new task..."
			onSubmit={(parsed) => addTaskFromInput(projectId, parsed)}
			class="inline-edit flex-1"
		/>
	</div>
{/snippet}

{#snippet addRowIndented(projectId: string)}
	{@const val = getInput(projectId)}
	<div class="flex items-center gap-3 px-4 py-1.5 pl-6 border-t border-border/30">
		<div class="w-4 h-4 rounded-full border-2 border-dashed border-border flex-shrink-0 opacity-50"></div>
		<SmartInput
			value={val}
			placeholder="new task..."
			onSubmit={(parsed) => addTaskFromInput(projectId, parsed)}
			class="inline-edit flex-1"
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
