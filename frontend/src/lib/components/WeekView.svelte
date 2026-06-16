<script lang="ts">
	import type { WeekData } from '$lib/types';
	import type { Task } from '$lib/api';
	import WeekTaskRow from './WeekTaskRow.svelte';
	import { getDataStore } from '$lib/stores/data.svelte';

	let {
		weekDays,
		hoveredTaskId = $bindable<string | null>(null),
		onToggleDone,
		onOpenTask,
	}: {
		weekDays: WeekData;
		hoveredTaskId: string | null;
		onToggleDone: (task: Task) => void;
		onOpenTask: (task: Task) => void;
	} = $props();

	const store = getDataStore();

	let dropDayDate = $state<string | null>(null);
	let dragTask = $state<Task | null>(null);

	function onDragStart(task: Task) {
		dragTask = task;
	}

	function onDragEnd() {
		dragTask = null;
		dropDayDate = null;
	}

	function onDayDragOver(e: DragEvent, dateIso: string) {
		if (!dragTask) return;
		e.preventDefault();
		dropDayDate = dateIso;
	}

	function onDayDragLeave(e: DragEvent, dateIso: string) {
		const card = e.currentTarget as HTMLElement;
		const related = e.relatedTarget as Node | null;
		if (related && card.contains(related)) return;
		if (dropDayDate === dateIso) dropDayDate = null;
	}

	async function onDayDrop(e: DragEvent, dateIso: string) {
		e.preventDefault();
		dropDayDate = null;
		if (!dragTask) return;
		const task = dragTask;
		dragTask = null;
		try {
			const currentDue = task.due_date ? new Date(task.due_date) : null;
			const newDate = new Date(dateIso);
			if (currentDue) {
				newDate.setHours(currentDue.getHours(), currentDue.getMinutes(), 0, 0);
			}
			await store.updateTask(task.project_id, task.id, { due_date: newDate.toISOString() });
		} catch {
			// store handles rollback
		}
	}
</script>

<div class="mb-8 flex gap-1.5 overflow-x-auto snap-x snap-mandatory pb-2 week-scroll">
	{#each weekDays.days as day}
		{@const allTasks = [...day.overdueTasks, ...day.tasks]}
		{@const hasContent = allTasks.length > 0}
		{@const dayIso = day.date.toISOString()}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex-shrink-0 snap-center rounded-xl overflow-hidden flex flex-col transition-all {hasContent ? 'w-[85vw] md:w-0 md:flex-1' : 'w-[60px] md:w-[60px] md:flex-none'} {dropDayDate === dayIso ? 'border border-accent bg-accent/5' : day.isToday ? 'border border-text/30 bg-surface/50' : hasContent ? 'border border-border bg-surface/20' : 'bg-surface/10'}"
			ondragover={(e) => onDayDragOver(e, dayIso)}
			ondragleave={(e) => onDayDragLeave(e, dayIso)}
			ondrop={(e) => onDayDrop(e, dayIso)}
		>
			<div class="px-1.5 py-1.5 {hasContent ? 'border-b border-border/50' : ''} flex items-baseline gap-1 {hasContent ? '' : 'flex-col items-center'}">
				<span class="text-[10px] font-semibold uppercase tracking-wider {day.isToday ? 'text-text' : 'text-text-muted'}">{day.label}</span>
				<span class="{hasContent ? 'text-base' : 'text-sm'} font-bold {day.isToday ? 'text-text' : 'text-text-secondary'}">{day.dayNum}</span>
			</div>
			{#if hasContent}
				<div class="flex-1 overflow-y-auto">
					{#each day.overdueTasks as dt}
						<WeekTaskRow {dt} isOverdue {onToggleDone} {onOpenTask} {onDragStart} {onDragEnd} bind:hoveredTaskId />
					{/each}
					{#each day.tasks as dt}
						<WeekTaskRow {dt} {onToggleDone} {onOpenTask} {onDragStart} {onDragEnd} bind:hoveredTaskId />
					{/each}
				</div>
			{/if}
		</div>
	{/each}
	{#if weekDays.later.length > 0}
		<div class="flex-shrink-0 w-[85vw] md:w-0 md:flex-1 snap-center border border-border rounded-xl overflow-hidden flex flex-col bg-surface/20">
			<div class="px-1.5 py-1.5 border-b border-border/50">
				<span class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">later</span>
			</div>
			<div class="flex-1 overflow-y-auto">
				{#each weekDays.later as dt}
					<WeekTaskRow {dt} showDayLabel {onToggleDone} {onOpenTask} {onDragStart} {onDragEnd} bind:hoveredTaskId />
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.week-scroll {
		scrollbar-width: none;
	}
	.week-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
