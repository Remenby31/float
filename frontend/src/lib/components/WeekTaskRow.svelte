<script lang="ts">
	import type { DatedTask } from '$lib/types';
	import type { Task } from '$lib/api';
	import SmartInput from './SmartInput.svelte';
	import { parseInput } from '$lib/smart-input';
	import { timeLabel, dayLabel } from '$lib/utils';

	let {
		dt,
		isOverdue = false,
		showDayLabel = false,
		editingTaskId = null,
		editingTaskValue = $bindable(''),
		onToggleDone,
		onStartEditing,
		onSaveEdit,
		onOpenTask,
		onDragStart,
		onDragEnd,
	}: {
		dt: DatedTask;
		isOverdue?: boolean;
		showDayLabel?: boolean;
		editingTaskId?: string | null;
		editingTaskValue?: string;
		onToggleDone: (task: Task) => void;
		onStartEditing: (task: Task) => void;
		onSaveEdit: (task: Task, parsed?: ReturnType<typeof parseInput>) => void;
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
	class="flex items-start gap-1.5 px-1 py-1 rounded-md mx-0.5 my-0.5 transition-colors group week-task cursor-grab active:cursor-grabbing"
	style="background-color:{dt.projectColor || '#525252'}15"
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
	{#if dt.projectIcon}<span class="text-[10px] flex-shrink-0 mt-0.5">{dt.projectIcon}</span>{/if}
	{#if editingTaskId === dt.task.id}
		<div class="flex-1 min-w-0">
			<SmartInput
				bind:value={editingTaskValue}
				placeholder={dt.task.title}
				onSubmit={(parsed) => onSaveEdit(dt.task, parsed)}
				onBlurSubmit={false}
				class="inline-edit"
			/>
		</div>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="flex-1 min-w-0 text-xs cursor-text hover:text-text-secondary transition-colors break-words"
			draggable="false"
			onclick={() => onStartEditing(dt.task)}
		>{dt.task.title}</span>
	{/if}
	{#if showDayLabel}
		<span class="text-[10px] text-text-muted flex-shrink-0">{dayLabel(dt.task.due_date!)}</span>
	{/if}
	<button
		type="button"
		onclick={() => onOpenTask(dt.task)}
		class="w-4 h-4 rounded flex items-center justify-center text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
		title="open"
	>
		<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
	</button>
</div>
