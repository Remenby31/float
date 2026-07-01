<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, type Project, type Task } from '$lib/api';
	import { getDataStore } from '$lib/stores/data.svelte';
	import { parseInput, getSuggestions, type Suggestion } from '$lib/smart-input';
	import { tick } from 'svelte';

	let {
		open = $bindable(false),
	}: {
		open: boolean;
	} = $props();

	const store = getDataStore();

	let query = $state('');
	let selectedIdx = $state(0);
	let inputEl = $state<HTMLInputElement>();

	// @ suggestions
	let atSuggestions = $state<Suggestion[]>([]);
	let atSelectedIdx = $state(0);
	let showAtSuggestions = $state(false);
	let atSource = $state<'search' | 'create'>('search');

	function updateAtSuggestions(text: string, source: 'search' | 'create') {
		const words = text.split(/\s/);
		const last = words[words.length - 1];
		if (last.startsWith('@') && last.length > 1) {
			atSource = source;
			atSuggestions = getSuggestions(last.slice(1), []);
			atSelectedIdx = 0;
			showAtSuggestions = atSuggestions.length > 0;
		} else {
			showAtSuggestions = false;
		}
	}

	function onQueryInput() {
		updateAtSuggestions(query, 'search');
	}

	function onCreateTaskInput() {
		updateAtSuggestions(creatingTask, 'create');
	}

	function applyAtSuggestion(s: Suggestion) {
		const text = atSource === 'create' ? creatingTask : query;
		const words = text.split(/\s/);
		words[words.length - 1] = `@${s.value}`;
		if (atSource === 'create') {
			creatingTask = words.join(' ') + ' ';
		} else {
			query = words.join(' ') + ' ';
		}
		showAtSuggestions = false;
		setTimeout(() => (atSource === 'create' ? createTaskInputEl : inputEl)?.focus(), 0);
	}

	// Step 2: picking a project for new task
	let creatingTask = $state('');
	let projectQuery = $state('');
	let projectIdx = $state(0);
	let selectedProjectId = $state<string | null>(null);
	let projectPickerOpen = $state(false);
	let createTaskInputEl = $state<HTMLInputElement>();
	let projectInputEl = $state<HTMLInputElement>();

	$effect(() => {
		if (open) {
			query = '';
			creatingTask = '';
			projectQuery = '';
			selectedProjectId = null;
			projectPickerOpen = false;
			selectedIdx = 0;
			projectIdx = 0;
			showAtSuggestions = false;
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	function matches(text: string, q: string): boolean {
		const lower = text.toLowerCase();
		const ql = q.toLowerCase();
		if (lower.includes(ql)) return true;
		let j = 0;
		for (let i = 0; i < lower.length && j < ql.length; i++) {
			if (lower[i] === ql[j]) j++;
		}
		return j === ql.length;
	}

	interface Result {
		type: 'project' | 'task' | 'create';
		id: string;
		title: string;
		projectId?: string;
		projectName?: string;
		isDone?: boolean;
	}

	let results = $derived.by(() => {
		const q = query.trim();
		if (!q) return [];
		const items: Result[] = [];
		for (const p of store.projects) {
			if (matches(p.title, q)) items.push({ type: 'project', id: p.id, title: p.title });
		}
		for (const t of store.allTasks) {
			if (matches(t.title, q) || (t.description && matches(t.description, q))) {
				const proj = store.projects.find(p => p.id === t.project_id);
				items.push({ type: 'task', id: t.id, title: t.title, projectId: t.project_id, projectName: proj?.title, isDone: t.is_done });
			}
		}
		const searchResults = items.slice(0, 12);
		// Add "create" as a navigable item
		const createItem: Result = { type: 'create', id: '__create__', title: q };
		// If no project matches, put create first (prioritize it)
		if (items.filter(r => r.type === 'project').length === 0) {
			return [createItem, ...searchResults];
		}
		return [...searchResults, createItem];
	});

	let projectResults = $derived(results.filter(r => r.type === 'project'));
	let taskResults = $derived(results.filter(r => r.type === 'task'));

	// Leaf projects only (no children = can hold tasks)
	let leafProjects = $derived.by(() => {
		const parentIds = new Set(store.projects.filter(p => p.parent_id).map(p => p.parent_id));
		const q = projectQuery.trim().toLowerCase();
		return store.projects
			.filter(p => !parentIds.has(p.id))
			.filter(p => !q || matches(p.title, q));
	});

	let selectedProject = $derived(
		selectedProjectId ? store.projects.find(p => p.id === selectedProjectId) : null
	);

	let visibleLeafProjects = $derived(
		projectQuery.trim() ? leafProjects.slice(0, 12) : leafProjects.slice(0, 7)
	);

	function activate(r: Result) {
		if (r.type === 'create') {
			startCreate();
			return;
		}
		const pid = r.type === 'project' ? r.id : r.projectId;
		open = false;
		if (page.url.pathname !== '/app') goto('/app');
		setTimeout(() => document.getElementById(`project-${pid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
	}

	function startCreate() {
		if (!query.trim()) return;
		creatingTask = query.trim();
		projectQuery = '';
		selectedProjectId = null;
		projectPickerOpen = true;
		projectIdx = 0;
		setTimeout(() => projectInputEl?.focus(), 50);
	}

	function onProjectInput() {
		projectIdx = 0;
		projectPickerOpen = true;
	}

	async function selectProject(projectId: string) {
		selectedProjectId = projectId;
		projectQuery = '';
		projectPickerOpen = false;
		await tick();
		const nextProjectIdx = leafProjects.findIndex(p => p.id === projectId);
		projectIdx = Math.max(nextProjectIdx, 0);
		createTaskInputEl?.focus();
	}

	function openProjectPicker() {
		projectPickerOpen = true;
		setTimeout(() => projectInputEl?.focus(), 0);
	}

	async function submitCreatedTask() {
		const title = creatingTask.trim();
		if (!title) {
			createTaskInputEl?.focus();
			return;
		}
		if (!selectedProjectId) {
			projectInputEl?.focus();
			return;
		}
		const parsed = parseInput(creatingTask);
		const projectId = selectedProjectId;
		await store.addTask(projectId, { title: parsed.title || title, due_date: parsed.due_date });
		open = false;
		if (page.url.pathname !== '/app') goto('/app');
		setTimeout(() => document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showAtSuggestions) { showAtSuggestions = false; return; }
			if (creatingTask && projectPickerOpen && selectedProjectId) {
				projectPickerOpen = false;
				projectQuery = '';
				setTimeout(() => createTaskInputEl?.focus(), 0);
			}
			else if (creatingTask) { creatingTask = ''; setTimeout(() => inputEl?.focus(), 50); }
			else open = false;
			return;
		}
		// @ suggestions take priority
		if (showAtSuggestions) {
			if (e.key === 'ArrowDown') { e.preventDefault(); atSelectedIdx = Math.min(atSelectedIdx + 1, atSuggestions.length - 1); return; }
			if (e.key === 'ArrowUp') { e.preventDefault(); atSelectedIdx = Math.max(atSelectedIdx - 1, 0); return; }
			if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applyAtSuggestion(atSuggestions[atSelectedIdx]); return; }
		}
		if (creatingTask) {
			const target = e.target;
			const isTaskInput = target === createTaskInputEl;
			const isProjectInput = target === projectInputEl;
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				projectPickerOpen = true;
				projectIdx = Math.min(projectIdx + 1, Math.max(visibleLeafProjects.length - 1, 0));
				if (!isProjectInput) projectInputEl?.focus();
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				projectPickerOpen = true;
				projectIdx = Math.max(projectIdx - 1, 0);
				if (!isProjectInput) projectInputEl?.focus();
				return;
			}
			if (isProjectInput && (e.key === 'Tab' || e.key === 'Enter') && visibleLeafProjects[projectIdx]) {
				e.preventDefault();
				selectProject(visibleLeafProjects[projectIdx].id);
				return;
			}
			if (isTaskInput && e.key === 'Enter') {
				e.preventDefault();
				if (!selectedProjectId) {
					openProjectPicker();
					return;
				}
				submitCreatedTask();
				return;
			}
			if (isTaskInput && e.key === 'Tab' && !e.shiftKey && !selectedProjectId) {
				e.preventDefault();
				openProjectPicker();
				return;
			}
			return;
		}
		// Step 1: search
		if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, results.length - 1); }
		if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); }
		if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			if (results[selectedIdx]) activate(results[selectedIdx]);
			else if (query.trim()) startCreate();
		}
	}

	function flatIndex(r: Result): number {
		return results.indexOf(r);
	}

	function parentName(p: Project): string | null {
		if (!p.parent_id) return null;
		return store.projects.find(pp => pp.id === p.parent_id)?.title || null;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-[60] backdrop-blur-[3px] animate-fadeIn" onclick={() => open = false}></div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 pointer-events-none" onkeydown={onKeydown}>
		<div class="bg-bg border border-border rounded-2xl shadow-2xl w-full max-w-xl pointer-events-auto animate-modalIn overflow-hidden">

				{#if creatingTask}
					{@const parsedPreview = parseInput(creatingTask)}
					<div class="px-4 pt-4 pb-3 border-b border-border/70">
						<div class="flex items-center gap-2">
							<input
								bind:this={createTaskInputEl}
								bind:value={creatingTask}
								oninput={onCreateTaskInput}
								placeholder="new task..."
								class="flex-1 min-w-0 bg-transparent text-[15px] leading-6 text-text placeholder:text-text-muted/60 focus:outline-none"
							/>
							{#if parsedPreview.due_date}
								{@const d = new Date(parsedPreview.due_date)}
								<span class="text-[10px] text-text-muted bg-surface border border-border rounded-md px-1.5 py-0.5 flex-shrink-0">
									{d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}{d.getHours() || d.getMinutes() ? ` ${d.getHours()}h${d.getMinutes().toString().padStart(2, '0')}` : ''}
								</span>
							{/if}
						</div>

						{#if showAtSuggestions && atSource === 'create'}
							<div class="mt-2 -mx-1 overflow-hidden rounded-lg border border-border bg-elevated shadow-sm">
								{#each atSuggestions as s, i}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="px-3 py-2 text-sm flex items-center gap-3 cursor-pointer transition-colors {i === atSelectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}"
										onmousedown={() => applyAtSuggestion(s)}
									>
										<span class="text-[9px] uppercase tracking-wider text-text-muted w-8 text-right font-medium">{s.type === 'date' ? 'date' : s.type === 'time' ? 'time' : 'proj'}</span>
										<span class="flex-1">{s.label}</span>
										{#if s.description}
											<span class="text-[11px] text-text-muted">{s.description}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<div class="mt-3 flex items-center gap-2">
							<button
								type="button"
								onclick={openProjectPicker}
								class="min-w-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface transition-colors"
							>
								{#if selectedProject}
									<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{selectedProject.color || '#525252'}"></span>
									<span class="truncate max-w-[220px]">{selectedProject.title}</span>
								{:else}
									<span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-text-muted"></span>
									<span>project</span>
								{/if}
							</button>
						</div>
					</div>

					{#if projectPickerOpen || !selectedProjectId}
						<div class="border-b border-border/70">
							<div class="px-4 py-2">
								<input
									bind:this={projectInputEl}
									bind:value={projectQuery}
									oninput={onProjectInput}
									placeholder={selectedProject ? 'change project...' : 'project...'}
									class="w-full bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none"
								/>
							</div>

							<div class="max-h-[34vh] overflow-y-auto pb-1">
								{#each visibleLeafProjects as p, i}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div class="px-3 py-0.5" onclick={() => selectProject(p.id)}>
										<div class="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors {i === projectIdx ? 'bg-surface text-text' : selectedProjectId === p.id ? 'text-text bg-surface/60' : 'text-text-secondary hover:bg-surface/50'}">
											<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{p.color || '#525252'}"></span>
											<span class="text-sm truncate">{p.title}</span>
											<div class="ml-auto flex items-center gap-2 min-w-0">
												{#if parentName(p)}
													<span class="text-[10px] text-text-muted truncate max-w-[110px]">{parentName(p)}</span>
												{/if}
												{#if selectedProjectId === p.id}
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="text-text flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
												{/if}
											</div>
										</div>
									</div>
								{/each}
								{#if visibleLeafProjects.length === 0}
									<div class="px-4 py-5 text-center">
										<p class="text-sm text-text-muted">no match</p>
									</div>
								{/if}
							</div>
						</div>
					{/if}

				{:else}
				<!-- Step 1: Search -->
				<div class="px-4 py-3 border-b border-border flex items-center gap-3">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
						<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
					</svg>
					<input
						bind:this={inputEl}
						bind:value={query}
						oninput={onQueryInput}
						placeholder="search or create a task..."
						class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none"
					/>
					<kbd class="hidden md:inline text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-0.5 font-mono">esc</kbd>
				</div>

				{#if showAtSuggestions}
					<div class="border-b border-border">
						{#each atSuggestions as s, i}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="px-4 py-2 text-sm flex items-center gap-3 cursor-pointer transition-colors {i === atSelectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}"
								onmousedown={() => applyAtSuggestion(s)}
							>
								<span class="text-[9px] uppercase tracking-wider text-text-muted w-8 text-right font-medium">{s.type === 'date' ? 'date' : s.type === 'time' ? 'time' : 'proj'}</span>
								<span class="flex-1">{s.label}</span>
								{#if s.description}
									<span class="text-[11px] text-text-muted">{s.description}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<div class="max-h-[50vh] overflow-y-auto">
					{#if query.trim() && results.length > 0}
						{@const createFirst = results[0]?.type === 'create'}
						{#if createFirst}
							<!-- Create is first (no project match) -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="px-3 py-1" onclick={startCreate}>
								<div class="flex items-center gap-2.5 px-2 py-2.5 rounded-lg cursor-pointer transition-colors {0 === selectedIdx ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface/50 hover:text-text-secondary'}">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="flex-shrink-0">
										<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
									</svg>
									<span class="text-sm">create <strong>"{query.trim()}"</strong></span>
								</div>
							</div>
						{/if}

						{#if projectResults.length > 0}
							<div class="px-3 pt-2 pb-1">
								<p class="text-[10px] uppercase tracking-wider text-text-muted font-medium px-1">projects</p>
							</div>
							{#each projectResults as r}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="px-3 py-0.5" onclick={() => activate(r)}>
									<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
										<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{store.projects.find(p => p.id === r.id)?.color || '#525252'}"></span>
										<span class="text-sm truncate">{r.title}</span>
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ml-auto text-text-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
									</div>
								</div>
							{/each}
						{/if}

						{#if taskResults.length > 0}
							<div class="px-3 pt-2 pb-1">
								<p class="text-[10px] uppercase tracking-wider text-text-muted font-medium px-1">tasks</p>
							</div>
							{#each taskResults as r}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="px-3 py-0.5" onclick={() => activate(r)}>
									<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
										<span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-text-muted"></span>
										<span class="text-sm truncate {r.isDone ? 'line-through opacity-50' : ''}">{r.title}</span>
										{#if r.projectName}
											<span class="text-[10px] text-text-muted ml-auto truncate max-w-[120px] flex-shrink-0">{r.projectName}</span>
										{/if}
									</div>
								</div>
							{/each}
						{/if}

						{#if !createFirst}
							<!-- Create is last (projects matched) -->
							{@const createIdx = results.findIndex(r => r.type === 'create')}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="px-3 py-0.5 border-t border-border/50 mt-1 pt-1" onclick={startCreate}>
								<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {createIdx === selectedIdx ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface/50 hover:text-text-secondary'}">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="flex-shrink-0">
										<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
									</svg>
									<span class="text-[13px]">create "{query.trim()}"</span>
								</div>
							</div>
						{/if}

						<div class="h-1"></div>
					{:else if !query.trim()}
						<div class="px-4 py-8 text-center">
							<p class="text-xs text-text-muted">type to search or create</p>
						</div>
					{/if}
				</div>

				{#if results.length > 0}
					<div class="hidden md:flex px-4 py-2 border-t border-border items-center gap-4 text-[10px] text-text-muted">
						<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
						<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↵</kbd> open</span>
					</div>
				{/if}
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
