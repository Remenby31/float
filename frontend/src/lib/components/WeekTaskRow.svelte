<script lang="ts">
	import type { DatedTask } from '$lib/types';
	import type { Task } from '$lib/api';
	import { timeLabel, dayLabel } from '$lib/utils';

	let {
		dt,
		isOverdue = false,
		showDayLabel = false,
		hoveredTaskId = $bindable<string | null>(null),
		onToggleDone,
		onOpenTask,
		onDragStart,
		onDragEnd,
	}: {
		dt: DatedTask;
		isOverdue?: boolean;
		showDayLabel?: boolean;
		hoveredTaskId?: string | null;
		onToggleDone: (task: Task) => void;
		onOpenTask: (task: Task) => void;
		onDragStart: (task: Task) => void;
		onDragEnd: () => void;
	} = $props();

	let tooltip = $derived(
		`${dt.projectName}${timeLabel(dt.task.due_date!) ? ' · ' + timeLabel(dt.task.due_date!) : ''}${isOverdue ? ' · overdue' : ''}${showDayLabel ? ' · ' + dayLabel(dt.task.due_date!) : ''}`
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	role="listitem"
	class="flex items-start gap-1.5 px-1 py-1 rounded-md mx-0.5 my-0.5 transition-colors group week-task cursor-pointer {hoveredTaskId === dt.task.id ? 'ring-1 ring-accent/40' : ''}"
	style="background-color:{dt.projectColor || '#525252'}15"
	onmouseenter={() => hoveredTaskId = dt.task.id}
	onmouseleave={() => { if (hoveredTaskId === dt.task.id) hoveredTaskId = null; }}
	onclick={(e) => {
		if ((e.target as HTMLElement).closest('button')) return;
		onOpenTask(dt.task);
	}}
	title={tooltip}
	draggable="true"
	ondragstart={() => onDragStart(dt.task)}
	ondragend={onDragEnd}
>
	<button
		type="button"
		onclick={() => onToggleDone(dt.task)}
		class="w-3.5 h-3.5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:border-success hover:bg-success"
		style="border-color:{isOverdue ? 'var(--color-danger)' : 'var(--color-border-strong)'}"
		aria-label="toggle done"
	></button>
	{#if dt.projectIcon}
		<span class="text-[10px] flex-shrink-0 mt-0.5">{dt.projectIcon}</span>
	{:else}
		<span class="w-2 h-2 rounded-full flex-shrink-0 mt-1" style="background:{dt.projectColor || '#525252'}"></span>
	{/if}
	<span
		class="flex-1 min-w-0 text-xs transition-colors break-words hover:text-text-secondary"
	>{dt.task.title}</span>
	{#if showDayLabel}
		<span class="text-[10px] text-text-muted flex-shrink-0">{dayLabel(dt.task.due_date!)}</span>
	{/if}
</div>
