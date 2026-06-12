<script lang="ts">
	import type { Task } from '$lib/api';
	import TaskDetail from '$lib/components/TaskDetail.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import SmartInput from '$lib/components/SmartInput.svelte';
	import DeleteConfirmModal from '$lib/components/DeleteConfirmModal.svelte';
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
	let dragProjectId = $state<string | null>(null);
	let dropProjectTargetId = $state<string | null>(null);
	let dropDayDate = $state<string | null>(null);
	let editingProjectId = $state<string | null>(null);
	let editingProjectTitle = $state('');
	let addingProjectTo = $state<false | string | 'root'>(false);
	let newProjectTitle = $state('');
	let confirmDelete = $state<{ id: string; title: string } | null>(null);
	let confirmRecursiveIcon = $state<{ parentId: string; color: string | null; icon: string | null } | null>(null);
	let expandedOverrides = $state<Record<string, boolean>>({});

	let groups = $derived(store.projects.filter(p => !p.parent_id));
	let childrenOf = $derived((pid: string) => store.projects.filter(p => p.parent_id === pid));

	// Temporal view: group dated tasks by time bucket
	interface DatedTask {
		task: Task;
		projectName: string;
		projectColor: string | null;
		projectIcon: string | null;
		familyId: string;
		familyName: string;
		familyColor: string | null;
		familyIcon: string | null;
	}

	function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); return r; }

	interface WeekDay {
		date: Date;
		label: string;
		dayNum: number;
		tasks: DatedTask[];
		overdueTasks: DatedTask[];
		isToday: boolean;
	}

	let weekDays = $derived.by(() => {
		const now = startOfDay(new Date());
		const dow = now.getDay();
		const monday = new Date(now);
		monday.setDate(now.getDate() - ((dow + 6) % 7));

		const days: WeekDay[] = [];
		const dayNames = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
		for (let i = 0; i < 7; i++) {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			days.push({
				date: d,
				label: dayNames[i],
				dayNum: d.getDate(),
				tasks: [],
				overdueTasks: [],
				isToday: d.getTime() === now.getTime(),
			});
		}

		const laterTasks: DatedTask[] = [];
		const endOfWeek = new Date(monday);
		endOfWeek.setDate(monday.getDate() + 7);

		for (const t of store.allTasks) {
			if (t.is_done || !t.due_date) continue;
			const proj = store.projects.find(p => p.id === t.project_id);
			const parent = proj?.parent_id ? store.projects.find(p => p.id === proj.parent_id) : null;
			const family = parent || proj;
			const dt: DatedTask = {
				task: t,
				projectName: proj?.title || '',
				projectColor: proj?.color || parent?.color || null,
				projectIcon: proj?.icon || null,
				familyId: family?.id || t.project_id,
				familyName: family?.title || proj?.title || '',
				familyColor: family?.color || null,
				familyIcon: family?.icon || null,
			};
			const due = startOfDay(new Date(t.due_date));
			if (due < now) {
				const todayCard = days.find(d => d.isToday);
				if (todayCard) todayCard.overdueTasks.push(dt);
			} else if (due >= endOfWeek) {
				laterTasks.push(dt);
			} else {
				const day = days.find(d => d.date.getTime() === due.getTime());
				if (day) day.tasks.push(dt);
			}
		}

		return { days, later: laterTasks };
	});

	let hasDatedTasks = $derived(
		weekDays.days.some(d => d.tasks.length > 0 || d.overdueTasks.length > 0) ||
		weekDays.later.length > 0
	);

	function groupByFamily(items: DatedTask[]): { familyName: string; familyColor: string | null; familyIcon: string | null; tasks: DatedTask[] }[] {
		const map = new Map<string, DatedTask[]>();
		for (const dt of items) {
			const key = dt.familyId;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(dt);
		}
		return Array.from(map.values()).map(group => ({
			familyName: group[0].familyName,
			familyColor: group[0].familyColor,
			familyIcon: group[0].familyIcon,
			tasks: group,
		}));
	}

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
			await store.updateTask(projectId, t.id, { due_date: parsed.due_date });
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
		await store.updateProject(id, { color, icon });
		// If this is a parent group with children and we changed the icon, offer to apply recursively
		const children = childrenOf(id);
		if (children.length > 0 && icon) {
			confirmRecursiveIcon = { parentId: id, color, icon };
		}
	}

	async function applyIconRecursively() {
		if (!confirmRecursiveIcon) return;
		const { parentId, color, icon } = confirmRecursiveIcon;
		const children = childrenOf(parentId);
		for (const child of children) {
			await store.updateProject(child.id, { icon });
		}
		confirmRecursiveIcon = null;
	}

	function projectStats(pid: string) {
		const tasks = store.tasksForProject(pid);
		const done = tasks.filter(t => t.is_done).length;
		return { total: tasks.length, done };
	}

	function pendingCount(pid: string): number {
		return store.tasksForProject(pid).filter(t => !t.is_done).length;
	}

	function isChildExpanded(pid: string): boolean {
		if (pid in expandedOverrides) return expandedOverrides[pid];
		const tasks = store.tasksForProject(pid);
		return tasks.length === 0 || tasks.some(t => !t.is_done);
	}

	function toggleChildExpanded(pid: string) {
		expandedOverrides = { ...expandedOverrides, [pid]: !isChildExpanded(pid) };
	}

	function onDragStart(task: Task) {
		dragTask = task;
	}

	function onDragEnd() {
		dragTask = null;
		dropTargetId = null;
		dropDayDate = null;
	}

	function onDayDragOver(e: DragEvent, dateIso: string) {
		if (!dragTask) return;
		e.preventDefault();
		dropDayDate = dateIso;
	}

	function onDayDragLeave(dateIso: string) {
		if (dropDayDate === dateIso) dropDayDate = null;
	}

	async function onDayDrop(e: DragEvent, dateIso: string) {
		e.preventDefault();
		dropDayDate = null;
		if (!dragTask) return;
		const currentDue = dragTask.due_date ? new Date(dragTask.due_date) : null;
		const newDate = new Date(dateIso);
		if (currentDue) {
			newDate.setHours(currentDue.getHours(), currentDue.getMinutes(), 0, 0);
		}
		await store.updateTask(dragTask.project_id, dragTask.id, { due_date: newDate.toISOString() });
		dragTask = null;
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

	// Project reorder drag
	function onProjectDragStart(e: DragEvent, projectId: string) {
		dragProjectId = projectId;
		e.dataTransfer?.setData('text/plain', projectId);
	}

	function onProjectDragOver(e: DragEvent, targetId: string) {
		if (!dragProjectId || dragProjectId === targetId) return;
		e.preventDefault();
		dropProjectTargetId = targetId;
	}

	function onProjectDragLeave(targetId: string) {
		if (dropProjectTargetId === targetId) dropProjectTargetId = null;
	}

	async function onProjectDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		dropProjectTargetId = null;
		if (!dragProjectId || dragProjectId === targetId) { dragProjectId = null; return; }
		// Reorder: move dragProjectId before targetId
		const ids = groups.map(g => g.id);
		const fromIdx = ids.indexOf(dragProjectId);
		const toIdx = ids.indexOf(targetId);
		if (fromIdx < 0 || toIdx < 0) { dragProjectId = null; return; }
		ids.splice(fromIdx, 1);
		ids.splice(toIdx, 0, dragProjectId);
		dragProjectId = null;
		await store.reorderProjects(ids);
	}

	function onProjectDragEnd() {
		dragProjectId = null;
		dropProjectTargetId = null;
	}

	async function onTouchDrop(detail: { taskId: string; fromProjectId: string; toProjectId: string }) {
		await store.moveTask(detail.fromProjectId, detail.taskId, detail.toProjectId);
	}

	// Project management
	function startEditingProject(id: string, title: string) {
		editingProjectId = id;
		editingProjectTitle = title;
	}

	async function saveProjectTitle(id: string) {
		editingProjectId = null;
		if (editingProjectTitle.trim()) {
			await store.updateProject(id, { title: editingProjectTitle.trim() });
		}
	}

	async function addProject(parentId?: string) {
		if (!newProjectTitle.trim()) return;
		await store.addProject({ title: newProjectTitle.trim(), parent_id: parentId });
		newProjectTitle = '';
		addingProjectTo = false;
	}

	async function askDeleteProject(id: string) {
		const proj = store.projects.find(p => p.id === id);
		if (!proj) return;
		confirmDelete = { id, title: proj.title };
	}

	async function doDeleteProject(id: string) {
		confirmDelete = null;
		await store.deleteProject(id);
	}

	// Debounced auto-save for inline task editing
	let saveTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (editingTaskId && editingTaskValue) {
			clearTimeout(saveTimer);
			const taskId = editingTaskId;
			const val = editingTaskValue;
			saveTimer = setTimeout(() => {
				const task = store.allTasks.find(t => t.id === taskId);
				if (task && val.trim() && val.trim() !== task.title) {
					const parsed = parseInput(val);
					const updates: any = {};
					if (parsed.title && parsed.title !== task.title) updates.title = parsed.title;
					if (parsed.due_date) updates.due_date = parsed.due_date;
					if (Object.keys(updates).length > 0) {
						store.updateTask(task.project_id, taskId, updates);
					}
				}
			}, 500);
		}
		return () => clearTimeout(saveTimer);
	});

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
	<div class="mb-6 flex items-center justify-end">
		<div class="flex items-center gap-0.5">
			<button type="button" onclick={() => store.undo()} disabled={!store.canUndo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Undo (⌘Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
			</button>
			<button type="button" onclick={() => store.redo()} disabled={!store.canRedo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-15 disabled:pointer-events-none" title="Redo (⌘⇧Z)">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>
			</button>
		</div>
	</div>

	<!-- Week cards -->
	{#if hasDatedTasks}
		<div class="mb-8 flex gap-1.5 overflow-x-auto snap-x snap-mandatory pb-2 week-scroll">
			{#each weekDays.days as day}
				{@const allTasks = [...day.overdueTasks, ...day.tasks]}
				{@const hasContent = allTasks.length > 0}
				{@const dayIso = day.date.toISOString()}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex-shrink-0 snap-center rounded-xl overflow-hidden flex flex-col transition-all {hasContent ? 'w-[85vw] md:w-0 md:flex-1 md:aspect-[9/16] md:min-h-0' : 'w-[60px] md:w-[60px] md:flex-none md:aspect-[9/16] md:min-h-0'} {dropDayDate === dayIso ? 'border-2 border-accent ring-2 ring-accent/20 scale-[1.02]' : day.isToday ? 'border border-text/30 bg-surface/50' : hasContent ? 'border border-border bg-surface/20' : 'bg-surface/10'}"
					ondragover={(e) => onDayDragOver(e, dayIso)}
					ondragleave={() => onDayDragLeave(dayIso)}
					ondrop={(e) => onDayDrop(e, dayIso)}
				>
					<div class="px-1.5 py-1.5 {hasContent ? 'border-b border-border/50' : ''} flex items-baseline gap-1 {hasContent ? '' : 'flex-col items-center'}">
						<span class="text-[10px] font-semibold uppercase tracking-wider {day.isToday ? 'text-text' : 'text-text-muted'}">{day.label}</span>
						<span class="{hasContent ? 'text-base' : 'text-sm'} font-bold {day.isToday ? 'text-text' : 'text-text-secondary'}">{day.dayNum}</span>
					</div>
					{#if hasContent}
						<div class="flex-1 overflow-y-auto">
							{#each day.overdueTasks as dt}
								{@const tooltip = `${dt.projectName}${timeLabel(dt.task.due_date!) ? ' · ' + timeLabel(dt.task.due_date!) : ''} · overdue`}
								<div class="flex items-start gap-1.5 px-1 py-1 rounded-md mx-0.5 my-0.5 transition-colors group week-task" style="background-color:{dt.projectColor || '#525252'}15" title={tooltip}>
									<button type="button" onclick={() => toggleDone(dt.task)} class="w-3.5 h-3.5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success" style="border-color:var(--color-danger)"></button>
									{#if dt.projectIcon}<span class="text-[10px] flex-shrink-0 mt-0.5">{dt.projectIcon}</span>{/if}
									{#if editingTaskId === dt.task.id}
										<div class="flex-1 min-w-0">
											<SmartInput bind:value={editingTaskValue} placeholder={dt.task.title} onSubmit={(parsed) => saveInlineEdit(dt.task, parsed)} onBlurSubmit={false} class="inline-edit" />
										</div>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span class="flex-1 min-w-0 text-xs cursor-text hover:text-text-secondary transition-colors break-words" draggable="false" onclick={() => startEditing(dt.task)}>{dt.task.title}</span>
									{/if}
									<button type="button" onclick={() => openTask(dt.task)} class="w-4 h-4 rounded flex items-center justify-center text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" title="open">
										<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
									</button>
								</div>
							{/each}
							{#each day.tasks as dt}
								{@const tooltip = `${dt.projectName}${timeLabel(dt.task.due_date!) ? ' · ' + timeLabel(dt.task.due_date!) : ''}`}
								<div class="flex items-start gap-1.5 px-1 py-1 rounded-md mx-0.5 my-0.5 transition-colors group week-task" style="background-color:{dt.projectColor || '#525252'}15" title={tooltip}>
									<button type="button" onclick={() => toggleDone(dt.task)} class="w-3.5 h-3.5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success" style="border-color:var(--color-border-strong)"></button>
									{#if dt.projectIcon}<span class="text-[10px] flex-shrink-0 mt-0.5">{dt.projectIcon}</span>{/if}
									{#if editingTaskId === dt.task.id}
										<div class="flex-1 min-w-0">
											<SmartInput bind:value={editingTaskValue} placeholder={dt.task.title} onSubmit={(parsed) => saveInlineEdit(dt.task, parsed)} onBlurSubmit={false} class="inline-edit" />
										</div>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span class="flex-1 min-w-0 text-xs cursor-text hover:text-text-secondary transition-colors break-words" draggable="false" onclick={() => startEditing(dt.task)}>{dt.task.title}</span>
									{/if}
									<button type="button" onclick={() => openTask(dt.task)} class="w-4 h-4 rounded flex items-center justify-center text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" title="open">
										<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
			{#if weekDays.later.length > 0}
				<div class="flex-shrink-0 w-[85vw] md:w-0 md:flex-1 snap-center border border-border rounded-xl overflow-hidden flex flex-col md:aspect-[9/16] md:min-h-0 bg-surface/20">
					<div class="px-1.5 py-1.5 border-b border-border/50">
						<span class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">later</span>
					</div>
					<div class="flex-1 overflow-y-auto">
						{#each weekDays.later as dt}
							{@const tooltip = `${dt.projectName} · ${dayLabel(dt.task.due_date!)}${timeLabel(dt.task.due_date!) ? ' · ' + timeLabel(dt.task.due_date!) : ''}`}
							<div class="flex items-start gap-1.5 px-1 py-1 rounded-md mx-0.5 my-0.5 transition-colors group week-task" style="background-color:{dt.projectColor || '#525252'}15" title={tooltip}>
								<button type="button" onclick={() => toggleDone(dt.task)} class="w-3.5 h-3.5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success" style="border-color:var(--color-border-strong)"></button>
								{#if dt.projectIcon}<span class="text-[10px] flex-shrink-0 mt-0.5">{dt.projectIcon}</span>{/if}
								{#if editingTaskId === dt.task.id}
									<div class="flex-1 min-w-0">
										<SmartInput bind:value={editingTaskValue} placeholder={dt.task.title} onSubmit={(parsed) => saveInlineEdit(dt.task, parsed)} onBlurSubmit={false} class="inline-edit" />
									</div>
								{:else}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="flex-1 min-w-0 text-xs cursor-text hover:text-text-secondary transition-colors break-words" draggable="false" onclick={() => startEditing(dt.task)}>{dt.task.title}</span>
								{/if}
								<span class="text-[10px] text-text-muted flex-shrink-0">{dayLabel(dt.task.due_date!)}</span>
								<button type="button" onclick={() => openTask(dt.task)} class="w-4 h-4 rounded flex items-center justify-center text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" title="open">
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="columns-1 md:columns-2 gap-4 space-y-4" style="contain:layout style">
		{#each groups as grp}
			{@const children = childrenOf(grp.id)}
			{@const stats = projectStats(grp.id)}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<section
				class="border rounded-xl overflow-hidden transition-all break-inside-avoid {dropProjectTargetId === grp.id ? 'border-accent ring-2 ring-accent/20 scale-[1.01]' : dropTargetId === grp.id && children.length === 0 ? 'border-accent ring-2 ring-accent/20' : 'border-border'} {dragProjectId === grp.id ? 'opacity-40' : ''}"
				data-drop-project={children.length === 0 ? grp.id : undefined}
				ondragover={(e) => { if (dragProjectId) onProjectDragOver(e, grp.id); else if (children.length === 0) onDragOver(e, grp.id); }}
				ondragleave={() => { if (dragProjectId) onProjectDragLeave(grp.id); else if (children.length === 0) onDragLeave(grp.id); }}
				ondrop={(e) => { if (dragProjectId) onProjectDrop(e, grp.id); else if (children.length === 0) onDrop(e, grp.id); }}
			>
				<!-- Header (drag handle for project reorder) -->
				<div
					class="px-4 py-3 bg-surface/30 flex items-center gap-3 cursor-grab active:cursor-grabbing group/header"
					draggable="true"
					ondragstart={(e) => onProjectDragStart(e, grp.id)}
					ondragend={onProjectDragEnd}
					id="project-{grp.id}"
				>
					<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
					{#if editingProjectId === grp.id}
						<input
							bind:value={editingProjectTitle}
							autofocus
							class="flex-1 bg-transparent text-sm font-medium text-text focus:outline-none"
							onblur={() => saveProjectTitle(grp.id)}
							onkeydown={(e) => { if (e.key === 'Enter') saveProjectTitle(grp.id); if (e.key === 'Escape') editingProjectId = null; }}
						/>
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span class="flex-1 text-sm font-medium cursor-text hover:text-text-secondary transition-colors" ondblclick={() => startEditingProject(grp.id, grp.title)}>{grp.title}</span>
					{/if}
					<div class="flex items-center gap-0.5 md:opacity-0 md:group-hover/header:opacity-100 transition-opacity">
						<button type="button" onclick={() => { addingProjectTo = grp.id; newProjectTitle = ''; }} class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary rounded transition-colors" title="add sub-project">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
						<button type="button" onclick={() => askDeleteProject(grp.id)} class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-danger rounded transition-colors" title="delete">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				</div>

				{#if children.length === 0}
					<!-- Standalone project: show tasks -->
					{@render taskListWithAdd(store.tasksForProject(grp.id), grp.id)}
				{:else}
					<!-- Group: show each project -->
					{#each [...children].sort((a, b) => pendingCount(b.id) - pendingCount(a.id)) as child}
						{@const cStats = projectStats(child.id)}
						{@const expanded = isChildExpanded(child.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="border-t transition-colors {dropTargetId === child.id ? 'border-accent bg-accent/5' : 'border-border'}"
							data-drop-project={child.id}
							ondragover={(e) => onDragOver(e, child.id)}
							ondragleave={() => onDragLeave(child.id)}
							ondrop={(e) => onDrop(e, child.id)}
						>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="px-4 py-2 bg-surface/15 flex items-center gap-2.5 pl-6 group/child cursor-pointer select-none"
								id="project-{child.id}"
								onclick={(e) => {
									if (!(e.target as HTMLElement).closest('button, input')) {
										toggleChildExpanded(child.id);
									}
								}}
							>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-text-muted flex-shrink-0 transition-transform {expanded ? 'rotate-90' : ''}"><polyline points="9 6 15 12 9 18"/></svg>
								<ColorPicker color={child.color || grp.color} icon={child.icon} onchange={(c, i) => updateProjectAppearance(child.id, c, i)} />
								{#if editingProjectId === child.id}
									<input
										bind:value={editingProjectTitle}
										autofocus
										class="flex-1 bg-transparent text-xs font-medium text-text focus:outline-none"
										onblur={() => saveProjectTitle(child.id)}
										onkeydown={(e) => { if (e.key === 'Enter') saveProjectTitle(child.id); if (e.key === 'Escape') editingProjectId = null; }}
									/>
								{:else}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="flex-1 text-xs font-medium text-text-secondary hover:text-text cursor-text transition-colors" ondblclick={(e) => { e.stopPropagation(); startEditingProject(child.id, child.title); }}>{child.title}</span>
								{/if}
								{#if !expanded && cStats.total > 0}
									<span class="text-[10px] text-text-muted flex-shrink-0">{cStats.done}/{cStats.total} ✓</span>
								{/if}
								<button type="button" onclick={() => askDeleteProject(child.id)} class="w-4 h-4 flex items-center justify-center text-text-muted hover:text-danger rounded md:opacity-0 md:group-hover/child:opacity-100 transition-all" title="delete">
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</div>
							{#if expanded}
								{@render taskListWithAdd(store.tasksForProject(child.id), child.id, true)}
							{/if}
						</div>
					{/each}
						<!-- Inline add sub-project -->
						{#if addingProjectTo === grp.id}
							<div class="border-t border-border px-4 py-2 pl-6">
								<form onsubmit={(e) => { e.preventDefault(); addProject(grp.id); }}>
									<input
										bind:value={newProjectTitle}
										placeholder="project name..."
										autofocus
										class="w-full bg-transparent text-xs font-medium text-text placeholder:text-text-muted/50 focus:outline-none"
										onblur={() => { if (!newProjectTitle) addingProjectTo = false; }}
										onkeydown={(e) => { if (e.key === 'Escape') { addingProjectTo = false; newProjectTitle = ''; } }}
									/>
								</form>
							</div>
						{/if}
					{/if}
				</section>
			{/each}

			<!-- New group button -->
			{#if addingProjectTo === 'root'}
				<div class="border border-border rounded-xl overflow-hidden p-3">
					<form onsubmit={(e) => { e.preventDefault(); addProject(); }}>
						<input
							bind:value={newProjectTitle}
							placeholder="group name..."
							autofocus
							class="w-full bg-transparent text-sm font-medium text-text placeholder:text-text-muted/50 focus:outline-none"
							onblur={() => { if (!newProjectTitle) addingProjectTo = false; }}
							onkeydown={(e) => { if (e.key === 'Escape') { addingProjectTo = false; newProjectTitle = ''; } }}
						/>
					</form>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => { addingProjectTo = 'root'; newProjectTitle = ''; }}
					class="w-full border border-dashed border-border rounded-xl py-3 text-xs text-text-muted hover:text-text-secondary hover:border-border-strong transition-all break-inside-avoid"
				>+ new group</button>
			{/if}
		</div>
	</div>
{/if}

{#if confirmDelete}
	<DeleteConfirmModal
		title={confirmDelete.title}
		onConfirm={() => doDeleteProject(confirmDelete!.id)}
		onCancel={() => confirmDelete = null}
	/>
{/if}

{#if confirmRecursiveIcon}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[2px]" onclick={() => confirmRecursiveIcon = null}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-bg border border-border rounded-xl p-5 w-full max-w-sm shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-medium mb-2">apply to sub-projects?</h3>
			<p class="text-xs text-text-muted mb-4">apply {confirmRecursiveIcon.icon} to all sub-projects in this group?</p>
			<div class="flex gap-2 justify-end">
				<button type="button" onclick={() => confirmRecursiveIcon = null} class="px-3 py-1.5 text-xs text-text-secondary hover:text-text rounded-lg hover:bg-surface transition-all">no</button>
				<button type="button" onclick={applyIconRecursively} class="px-3 py-1.5 text-xs bg-accent text-accent-fg rounded-lg hover:opacity-90 active:scale-[0.98] transition-all">yes, apply</button>
			</div>
		</div>
	</div>
{/if}

{#snippet taskListWithAdd(tasks: Task[], projectId: string, indented?: boolean)}
	{@const pending = tasks.filter(t => !t.is_done)}
	{@const allDone = tasks.filter(t => t.is_done)}
	{@const todayMidnight = new Date(new Date().setHours(0, 0, 0, 0))}
	{@const done = allDone.filter(t => t.done_at && new Date(t.done_at) >= todayMidnight)}
	{@const olderDone = allDone.filter(t => !t.done_at || new Date(t.done_at) < todayMidnight)}
	{#if pending.length > 0}
		<div class="divide-y divide-border/50">
			{#each pending as task (task.id)}
				{@render taskRow(task, indented)}
			{/each}
		</div>
	{/if}
	{@render addRow(projectId, indented)}
	{#if done.length > 0 || olderDone.length > 0}
		{#if done.length > 0}
			<div class="divide-y divide-border/50 border-t border-border/30">
				{#each done as task (task.id)}
					{@render taskRow(task, indented)}
				{/each}
			</div>
		{/if}
		{#if olderDone.length > 0}
			<details class="{done.length === 0 ? 'border-t border-border/30' : ''}">
				<summary class="px-4 py-1.5 text-[10px] text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors">+{olderDone.length} completed</summary>
				<div class="divide-y divide-border/50">
					{#each olderDone as task (task.id)}
						{@render taskRow(task, indented)}
					{/each}
				</div>
			</details>
		{/if}
	{/if}
{/snippet}

{#snippet taskRow(task: Task, indented?: boolean)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex items-start gap-3 px-4 py-2 hover:bg-surface/30 transition-colors group cursor-grab active:cursor-grabbing {indented ? 'pl-6' : ''} {store.recentlyAdded.has(task.id) ? 'task-appear' : ''}"
		draggable="true"
		ondragstart={() => onDragStart(task)}
		ondragend={onDragEnd}
		use:touchDrag={{ taskId: task.id, projectId: task.project_id, onTouchDrop }}
	>
		<button
			type="button"
			onclick={() => toggleDone(task)}
			class="w-4 h-4 mt-0.5 relative touch-target rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all {task.is_done ? 'bg-success border-success' : 'hover:border-success hover:bg-success'}"
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
				draggable="false"
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

{#snippet addRow(projectId: string, indented?: boolean)}
	{@const val = getInput(projectId)}
	<div class="flex items-center gap-3 px-4 py-1.5 {indented ? 'pl-6 border-t border-border/30' : 'border-t border-border/50'}">
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


<svelte:head>
	<style>
		@keyframes checkPop {
			0% { transform: scale(1); }
			50% { transform: scale(1.3); }
			100% { transform: scale(1); }
		}
		button:active .check-pop { animation: checkPop 0.2s ease; }
	</style>
</svelte:head>

<style>
	.week-scroll {
		scrollbar-width: none;
	}
	.week-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
