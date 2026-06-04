<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/api';
	import { getTheme } from '$lib/theme.svelte';
	import { setupKeyboard, onShortcut } from '$lib/keyboard';
	import { getDataStore } from '$lib/stores/data.svelte';
	import { startSync } from '$lib/stores/sync';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { onDestroy } from 'svelte';

	let { children } = $props();
	const store = getDataStore();
	let cmdOpen = $state(false);
	let profileOpen = $state(false);
	let unsubs: (() => void)[] = [];
	let username = $state('');
	let initials = $state('');
	let newTitle = $state('');
	let adding = $state<false | string | 'root'>(false);
	let collapsed = $state<Set<string>>(new Set());
	const theme = getTheme();

	let sidebarOpen = $state(false);

	// Lock body scroll when any overlay is open
	$effect(() => {
		const locked = sidebarOpen || cmdOpen || !!confirmDelete;
		document.body.style.overflow = locked ? 'hidden' : '';
		return () => { document.body.style.overflow = ''; };
	});

	let parentProjects = $derived(store.projects.filter(p => !p.parent_id));
	let childrenOf = $derived((parentId: string) => store.projects.filter(p => p.parent_id === parentId));

	onDestroy(() => { unsubs.forEach(u => u()); });

	onMount(async () => {
		theme.init();
		setupKeyboard();
		unsubs.push(onShortcut('cmd+k', () => { cmdOpen = !cmdOpen; }));
		unsubs.push(onShortcut('cmd+z', () => { store.undo(); }));
		try {
			const user = await api.me();
			username = user.username;
			initials = user.username.slice(0, 1).toUpperCase();
			await store.init();
			unsubs.push(startSync(store));
		} catch {
			goto('/login');
		}
	});

	async function addProject() {
		if (!newTitle.trim()) return;
		const parentId = (adding !== false && adding !== 'root') ? adding : undefined;
		const p = await store.addProject({ title: newTitle.trim(), parent_id: parentId });
		newTitle = '';
		adding = false;
		if (parentId) collapsed.delete(parentId);
		goto(`/app/project/${p.id}`);
	}

	let confirmDelete = $state<{ id: string; title: string; hasTasks: boolean } | null>(null);

	async function askDeleteProject(id: string) {
		const proj = store.projects.find(p => p.id === id);
		if (!proj) return;
		try {
			const tasks = store.allTasks.filter(t => t.project_id === id);
			const children = store.projects.filter(p => p.parent_id === id);
			const childTasks = store.allTasks.filter(t => children.some(c => c.id === t.project_id));
			const total = tasks.length + childTasks.length;
			if (total > 0 || children.length > 0) {
				confirmDelete = { id, title: proj.title, hasTasks: total > 0 };
				return;
			}
		} catch {}
		await doDeleteProject(id);
	}

	async function doDeleteProject(id: string) {
		confirmDelete = null;
		await store.deleteProject(id);
		if (page.url.pathname === `/app/project/${id}`) goto('/app');
	}

	function toggleCollapse(id: string) {
		if (collapsed.has(id)) collapsed.delete(id);
		else collapsed.add(id);
		collapsed = new Set(collapsed);
	}

	function startAdding(target: 'root' | string) {
		adding = target;
		newTitle = '';
	}

	async function updateProjectAppearance(id: string, color: string | null, icon: string | null) {
		await store.updateProject(id, { color, icon } as any);
	}

	let isSubPage = $derived(page.url.pathname.startsWith('/app/project/'));
	let currentProject = $derived(
		isSubPage ? store.projects.find(p => page.url.pathname === `/app/project/${p.id}`) : null
	);

	function logout() {
		localStorage.removeItem('float_token');
		store.reset();
		goto('/login');
	}
</script>

<div class="min-h-screen bg-bg flex flex-col md:flex-row">
	<!-- Mobile top bar -->
	<header class="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-bg sticky top-0 z-30" style="padding-top: calc(0.75rem + env(safe-area-inset-top, 0px))">
		{#if isSubPage}
			<button type="button" onclick={() => history.back()} class="w-10 h-10 flex items-center justify-center -ml-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-all">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
		{:else}
			<button type="button" onclick={() => sidebarOpen = true} class="w-10 h-10 flex items-center justify-center -ml-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-all">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
			</button>
		{/if}
		<span class="text-sm font-semibold tracking-tight">{currentProject?.title || 'float'}</span>
		{#if isSubPage}
			<button type="button" onclick={() => sidebarOpen = true} class="w-10 h-10 flex items-center justify-center -mr-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-all">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
			</button>
		{:else}
			<button type="button" onclick={() => cmdOpen = true} class="w-10 h-10 flex items-center justify-center -mr-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-all">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			</button>
		{/if}
	</header>

	<!-- Mobile overlay -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-[2px] animate-fadeIn" onclick={() => sidebarOpen = false}></div>
	{/if}

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<aside
		class="fixed inset-y-0 left-0 z-50 w-64 border-r border-border flex flex-col select-none bg-bg transform transition-transform duration-200 ease-out md:w-56 md:transform-none {sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}"
		style="padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px)"
		onclick={(e) => { if ((e.target as HTMLElement).closest('a')) sidebarOpen = false; }}
	>
		<!-- Nav history + undo -->
		<div class="flex items-center gap-1 px-2 pt-3 pb-1">
			<button type="button" onclick={() => history.back()} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all" title="Back">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<button type="button" onclick={() => history.forward()} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all" title="Forward">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
			</button>
			<button type="button" onclick={() => store.undo()} disabled={!store.canUndo} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all disabled:opacity-20 disabled:pointer-events-none ml-auto" title="Undo (⌘Z)">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
			</button>
		</div>

		<nav class="flex-1 p-2 pt-1 space-y-0.5 overflow-y-auto">
			<!-- Overview + Search -->
			<a
				href="/app"
				class="flex items-center gap-2 px-2.5 py-2.5 md:py-1.5 rounded-lg text-sm transition-all {page.url.pathname === '/app' ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50 hover:text-text'}"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				overview
			</a>
			<button
				type="button"
				onclick={() => cmdOpen = true}
				class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface/50 hover:text-text transition-all w-full"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				<span class="flex-1 text-left">search</span>
				<kbd class="hidden md:inline text-[9px] text-text-muted bg-surface border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>
			</button>

			<div class="h-1"></div>
			{#each parentProjects as grp}
				{@const children = childrenOf(grp.id)}
				{@const hasChildren = children.length > 0}
				{@const isCollapsed = collapsed.has(grp.id)}

				<!-- Group header -->
				<div class="group relative mt-3 first:mt-0">
					<div class="flex items-center">
						{#if hasChildren}
							<!-- Group: show as label, not clickable as project -->
							<div class="flex-1 flex items-center gap-2 px-2 py-1">
								<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
								<span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted truncate">{grp.title}</span>
							</div>
						{:else}
							<!-- Standalone project (no children = project, not group) -->
							{@const active = page.url.pathname === `/app/project/${grp.id}`}
							<a
								href="/app/project/{grp.id}"
								class="flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-[13px] transition-all {active ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface/50 hover:text-text-secondary'}"
							>
								<ColorPicker color={grp.color} icon={grp.icon} onchange={(c, i) => updateProjectAppearance(grp.id, c, i)} />
								<span class="truncate">{grp.title}</span>
							</a>
						{/if}
						<div class="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								type="button"
								onclick={() => startAdding(grp.id)}
								class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary rounded transition-colors"
								title="add project"
							>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
							</button>
							<button
								type="button"
								onclick={() => askDeleteProject(grp.id)}
								class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-danger rounded transition-colors"
								title="delete"
							>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						</div>
					</div>
				</div>

				<!-- Projects in group -->
				{#if !isCollapsed}
					{#each children as child}
						{@const childActive = page.url.pathname === `/app/project/${child.id}`}
						<div class="group relative pl-4">
							<div class="absolute left-[9px] top-0 bottom-0 w-px bg-border"></div>
							<div class="flex items-center">
								<a
									href="/app/project/{child.id}"
									class="flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-[13px] transition-all {childActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface/50 hover:text-text-secondary'}"
								>
									<ColorPicker color={child.color || grp.color} icon={child.icon} onchange={(c, i) => updateProjectAppearance(child.id, c, i)} />
									<span class="truncate">{child.title}</span>
								</a>
								<button
									type="button"
									onclick={() => askDeleteProject(child.id)}
									class="w-5 h-5 hidden md:flex items-center justify-center text-text-muted hover:text-danger rounded opacity-0 group-hover:opacity-100 transition-opacity"
									title="delete"
								>
									<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</div>
						</div>
					{/each}

					<!-- Inline add project in group -->
					{#if adding === grp.id}
						<div class="pl-4">
							<form onsubmit={(e) => { e.preventDefault(); addProject(); }} class="px-1 pt-0.5">
								<input
									bind:value={newTitle}
									placeholder="project name"
									autofocus
									class="w-full bg-surface border border-border rounded-lg px-2 py-1 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-text/10 focus:border-border-strong transition-all"
									onblur={() => { if (!newTitle) adding = false; }}
									onkeydown={(e) => { if (e.key === 'Escape') { adding = false; newTitle = ''; } }}
								/>
							</form>
						</div>
					{/if}
				{/if}
			{/each}

			<!-- Add new group -->
			{#if adding === 'root'}
				<form onsubmit={(e) => { e.preventDefault(); addProject(); }} class="px-1 pt-1">
					<input
						bind:value={newTitle}
						placeholder="group name"
						autofocus
						class="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-text/10 focus:border-border-strong transition-all"
						onblur={() => { if (!newTitle) adding = false; }}
						onkeydown={(e) => { if (e.key === 'Escape') { adding = false; newTitle = ''; } }}
					/>
				</form>
			{:else if adding === false}
				<button
					type="button"
					onclick={() => startAdding('root')}
					class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-surface/50 transition-all w-full"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					new group
				</button>
			{/if}
		</nav>

		<!-- Footer -->
		<div class="p-2 border-t border-border flex items-center justify-between">
			<button
				type="button"
				onclick={() => { if (profileOpen) { logout(); } else { profileOpen = true; } }}
				class="flex items-center gap-2 min-w-0 group"
			>
				<div class="w-7 h-7 rounded-full bg-accent text-accent-fg flex items-center justify-center text-[11px] font-semibold transition-transform group-hover:scale-110 flex-shrink-0">{initials}</div>
				<div class="overflow-hidden min-w-0">
					{#if profileOpen}
						<span class="text-xs text-danger slide-swap block truncate">sign out</span>
					{:else}
						<span class="text-xs text-text-muted group-hover:text-text-secondary transition-colors slide-swap block truncate">{username}</span>
					{/if}
				</div>
			</button>

			<!-- Theme toggle -->
			<button
				type="button"
				onclick={() => theme.toggle()}
				class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all flex-shrink-0 theme-btn"
			>
				{#if theme.current === 'dark'}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
					</svg>
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				{/if}
			</button>
		</div>
	</aside>

<style>
	.slide-swap {
		animation: slideSwap 0.2s cubic-bezier(0.2, 0, 0, 1);
	}
	@keyframes slideSwap {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.theme-btn:active svg {
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		transform: rotate(180deg);
	}
	.animate-fadeIn { animation: fadeIn 0.15s ease; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>

	<main class="flex-1 min-h-screen overflow-y-auto md:ml-56">
		{@render children()}
	</main>
</div>

<!-- Delete confirmation modal -->
{#if confirmDelete}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[2px]" onclick={() => confirmDelete = null}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-bg border border-border rounded-xl p-5 w-full max-w-sm shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-medium mb-2">delete "{confirmDelete.title}"?</h3>
			<p class="text-xs text-text-muted mb-4">
				{#if confirmDelete.hasTasks}
					this contains tasks that will be permanently deleted.
				{:else}
					this will be permanently deleted.
				{/if}
			</p>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					onclick={() => confirmDelete = null}
					class="px-3 py-1.5 text-xs text-text-secondary hover:text-text rounded-lg hover:bg-surface transition-all"
				>cancel</button>
				<button
					type="button"
					onclick={() => doDeleteProject(confirmDelete!.id)}
					class="px-3 py-1.5 text-xs bg-danger text-white rounded-lg hover:opacity-90 active:scale-[0.98] transition-all"
				>delete</button>
			</div>
		</div>
	</div>
{/if}

<CommandPalette bind:open={cmdOpen} />
