<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type Project, type Task } from '$lib/api';

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

	// Step 2: picking a project for new task
	let creatingTask = $state('');
	let projectQuery = $state('');
	let projectIdx = $state(0);
	let projectInputEl: HTMLInputElement;

	$effect(() => {
		if (open && !loaded) {
			api.listAllTasks().then(t => { allTasks = t; loaded = true; });
		}
		if (open) {
			query = '';
			creatingTask = '';
			projectQuery = '';
			selectedIdx = 0;
			projectIdx = 0;
			setTimeout(() => inputEl?.focus(), 50);
		}
		if (!open) { loaded = false; }
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
		type: 'project' | 'task';
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
		for (const p of projects) {
			if (matches(p.title, q)) items.push({ type: 'project', id: p.id, title: p.title });
		}
		for (const t of allTasks) {
			if (matches(t.title, q) || (t.description && matches(t.description, q))) {
				const proj = projects.find(p => p.id === t.project_id);
				items.push({ type: 'task', id: t.id, title: t.title, projectId: t.project_id, projectName: proj?.title, isDone: t.is_done });
			}
		}
		return items.slice(0, 12);
	});

	let projectResults = $derived(results.filter(r => r.type === 'project'));
	let taskResults = $derived(results.filter(r => r.type === 'task'));

	// Leaf projects only (no children = can hold tasks)
	let leafProjects = $derived.by(() => {
		const parentIds = new Set(projects.filter(p => p.parent_id).map(p => p.parent_id));
		const q = projectQuery.trim().toLowerCase();
		return projects
			.filter(p => !parentIds.has(p.id))
			.filter(p => !q || matches(p.title, q));
	});

	function navigate(r: Result) {
		if (r.type === 'project') goto(`/app/project/${r.id}`);
		else goto(`/app/project/${r.projectId}`);
		open = false;
	}

	function startCreate() {
		if (!query.trim()) return;
		creatingTask = query.trim();
		projectQuery = '';
		projectIdx = 0;
		setTimeout(() => projectInputEl?.focus(), 50);
	}

	async function createInProject(projectId: string) {
		await api.createTask(projectId, { title: creatingTask });
		// Reload tasks
		allTasks = await api.listAllTasks();
		// Navigate to the project
		goto(`/app/project/${projectId}`);
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (creatingTask) { creatingTask = ''; setTimeout(() => inputEl?.focus(), 50); }
			else open = false;
			return;
		}
		if (creatingTask) {
			// Step 2: project selection
			if (e.key === 'ArrowDown') { e.preventDefault(); projectIdx = Math.min(projectIdx + 1, leafProjects.length - 1); }
			if (e.key === 'ArrowUp') { e.preventDefault(); projectIdx = Math.max(projectIdx - 1, 0); }
			if (e.key === 'Enter' && leafProjects[projectIdx]) { e.preventDefault(); createInProject(leafProjects[projectIdx].id); }
			return;
		}
		// Step 1: search
		if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, results.length - 1); }
		if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); }
		if (e.key === 'Enter') {
			e.preventDefault();
			if (results[selectedIdx]) navigate(results[selectedIdx]);
			else if (query.trim()) startCreate();
		}
	}

	function flatIndex(r: Result): number {
		return results.indexOf(r);
	}

	function parentName(p: Project): string | null {
		if (!p.parent_id) return null;
		return projects.find(pp => pp.id === p.parent_id)?.title || null;
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
				<!-- Step 2: Pick project -->
				<div class="px-4 py-3 border-b border-border">
					<div class="flex items-center gap-2 mb-2">
						<span class="text-[10px] uppercase tracking-wider text-text-muted">new task</span>
						<span class="text-sm text-text">{creatingTask}</span>
					</div>
					<div class="flex items-center gap-3">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						</svg>
						<input
							bind:this={projectInputEl}
							bind:value={projectQuery}
							placeholder="which project?"
							class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none"
						/>
						<kbd class="text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-0.5 font-mono">esc</kbd>
					</div>
				</div>

				<div class="max-h-[40vh] overflow-y-auto">
					{#each leafProjects as p, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="px-3 py-0.5" onclick={() => createInProject(p.id)}>
							<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {i === projectIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
								<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{p.color || '#525252'}"></span>
								<span class="text-sm truncate">{p.title}</span>
								{#if parentName(p)}
									<span class="text-[10px] text-text-muted ml-auto">{parentName(p)}</span>
								{/if}
							</div>
						</div>
					{/each}
					{#if leafProjects.length === 0}
						<div class="px-4 py-6 text-center">
							<p class="text-sm text-text-muted">no matching project</p>
						</div>
					{/if}
					<div class="h-1"></div>
				</div>

				<div class="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
					<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↑↓</kbd> select</span>
					<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">↵</kbd> create</span>
					<span><kbd class="font-mono bg-surface border border-border rounded px-1 py-0.5">esc</kbd> back</span>
				</div>

			{:else}
				<!-- Step 1: Search -->
				<div class="px-4 py-3 border-b border-border flex items-center gap-3">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
						<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
					</svg>
					<input
						bind:this={inputEl}
						bind:value={query}
						placeholder="search or create a task..."
						class="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none"
					/>
					<kbd class="text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-0.5 font-mono">esc</kbd>
				</div>

				<div class="max-h-[50vh] overflow-y-auto">
					{#if query.trim() && results.length === 0}
						<!-- No results — offer to create -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="px-3 py-1" onclick={startCreate}>
							<div class="flex items-center gap-2.5 px-2 py-3 rounded-lg cursor-pointer transition-colors bg-surface/50 hover:bg-surface text-text">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
									<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
								<span class="text-sm">create <strong>"{query.trim()}"</strong></span>
							</div>
						</div>
					{:else if results.length > 0}
						{#if projectResults.length > 0}
							<div class="px-3 pt-2 pb-1">
								<p class="text-[10px] uppercase tracking-wider text-text-muted font-medium px-1">projects</p>
							</div>
							{#each projectResults as r}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="px-3 py-0.5" onclick={() => navigate(r)}>
									<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
										<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{projects.find(p => p.id === r.id)?.color || '#525252'}"></span>
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
								<div class="px-3 py-0.5" onclick={() => navigate(r)}>
									<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors {flatIndex(r) === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}">
										<span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-text-muted"></span>
										<span class="text-sm truncate {r.isDone ? 'line-through opacity-40' : ''}">{r.title}</span>
										{#if r.projectName}
											<span class="text-[10px] text-text-muted ml-auto truncate max-w-[120px] flex-shrink-0">{r.projectName}</span>
										{/if}
									</div>
								</div>
							{/each}
						{/if}

						<!-- Also offer to create even when there are results -->
						{#if query.trim()}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="px-3 py-0.5 border-t border-border/50 mt-1 pt-1" onclick={startCreate}>
								<div class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-text-muted hover:bg-surface/50 hover:text-text-secondary transition-colors">
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
					<div class="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
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
