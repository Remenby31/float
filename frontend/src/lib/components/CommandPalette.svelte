<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type Project, type Task } from '$lib/api';
	import { onMount } from 'svelte';

	let {
		open = $bindable(false),
		projects = [],
	}: {
		open: boolean;
		projects: Project[];
	} = $props();

	let query = $state('');
	let allTasks = $state<Task[]>([]);
	let selectedIdx = $state(0);
	let inputEl: HTMLInputElement;
	let loaded = $state(false);

	// Load all tasks when opened
	$effect(() => {
		if (open && !loaded) {
			api.listAllTasks().then(t => { allTasks = t; loaded = true; });
		}
		if (open) {
			query = '';
			selectedIdx = 0;
			setTimeout(() => inputEl?.focus(), 50);
		}
		if (!open) { loaded = false; }
	});

	// Fuzzy match
	function matches(text: string, q: string): boolean {
		const lower = text.toLowerCase();
		const ql = q.toLowerCase();
		// Simple substring + word start matching
		if (lower.includes(ql)) return true;
		// Each char appears in order
		let j = 0;
		for (let i = 0; i < lower.length && j < ql.length; i++) {
			if (lower[i] === ql[j]) j++;
		}
		return j === ql.length;
	}

	interface Result {
		type: 'project' | 'task';
		id: number;
		title: string;
		projectId?: number;
		projectName?: string;
		isDone?: boolean;
	}

	let results = $derived.by(() => {
		const q = query.trim();
		const items: Result[] = [];

		// Always show projects first
		for (const p of projects) {
			if (!q || matches(p.title, q)) {
				items.push({ type: 'project', id: p.id, title: p.title });
			}
		}

		// Then tasks
		for (const t of allTasks) {
			if (!q || matches(t.title, q) || (t.description && matches(t.description, q))) {
				const proj = projects.find(p => p.id === t.project_id);
				items.push({
					type: 'task',
					id: t.id,
					title: t.title,
					projectId: t.project_id,
					projectName: proj?.title,
					isDone: t.is_done,
				});
			}
		}

		return items.slice(0, 15);
	});

	// Group results
	let projectResults = $derived(results.filter(r => r.type === 'project'));
	let taskResults = $derived(results.filter(r => r.type === 'task'));

	function navigate(r: Result) {
		if (r.type === 'project') {
			goto(`/app/project/${r.id}`);
		} else {
			goto(`/app/project/${r.projectId}`);
		}
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, results.length - 1); }
		if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); }
		if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); navigate(results[selectedIdx]); }
		if (e.key === 'Escape') { open = false; }
	}



	// Global index for flat list navigation
	function flatIndex(r: Result): number {
		return results.indexOf(r);
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-[60] backdrop-blur-[3px] animate-fadeIn" onclick={() => open = false}></div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 pointer-events-none"
		onkeydown={onKeydown}
	>
		<div class="bg-bg border border-border rounded-2xl shadow-2xl w-full max-w-xl pointer-events-auto animate-modalIn overflow-hidden">
			<!-- Search input -->
			<div class="px-4 py-3 border-b border-border flex items-center gap-3">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
					<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					placeholder="search tasks, projects..."
					class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none"
				/>
				<kbd class="text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-0.5 font-mono">esc</kbd>
			</div>

			<!-- Results -->
			<div class="max-h-[50vh] overflow-y-auto">
				{#if results.length === 0}
					<div class="px-4 py-8 text-center">
						<p class="text-sm text-text-muted">no results</p>
					</div>
				{:else}
					<!-- Projects -->
					{#if projectResults.length > 0}
						<div class="px-3 pt-2 pb-1">
							<p class="text-[10px] uppercase tracking-wider text-text-muted font-medium px-1">projects</p>
						</div>
						{#each projectResults as r}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="px-3 py-0.5"
								onclick={() => navigate(r)}
							>
								<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
									<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{projects.find(p => p.id === r.id)?.color || '#525252'}"></span>
									<span class="text-sm truncate">{r.title}</span>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ml-auto text-text-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
								</div>
							</div>
						{/each}
					{/if}

					<!-- Tasks -->
					{#if taskResults.length > 0}
						<div class="px-3 pt-2 pb-1">
							<p class="text-[10px] uppercase tracking-wider text-text-muted font-medium px-1">tasks</p>
						</div>
						{#each taskResults as r}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="px-3 py-0.5"
								onclick={() => navigate(r)}
							>
								<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
									<span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-text-muted"></span>
									<span class="text-sm truncate {r.isDone ? 'line-through opacity-40' : ''}">{r.title}</span>
									{#if r.projectName}
										<span class="text-[10px] text-text-muted ml-auto truncate max-w-[100px] flex-shrink-0">{r.projectName}</span>
									{/if}
								</div>
							</div>
						{/each}
					{/if}

					<div class="h-2"></div>
				{/if}
			</div>

			<!-- Footer hint -->
			{#if results.length > 0}
				<div class="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
					<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
					<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↵</kbd> open</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.animate-fadeIn { animation: fadeIn 0.1s ease; }
	.animate-modalIn { animation: modalIn 0.15s cubic-bezier(0, 0, 0.2, 1); }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modalIn {
		from { opacity: 0; transform: translateY(-4px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>
