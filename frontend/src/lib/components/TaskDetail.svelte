<script lang="ts">
	import { api, type Task, type Attachment, type Project } from '$lib/api';
	import DatePicker from './DatePicker.svelte';
	import NoteEditor from './NoteEditor.svelte';
	import { getDataStore } from '$lib/stores/data.svelte';

	let {
		task = $bindable<Task | null>(null),
		projectId = $bindable<string>(''),
		onUpdate,
		onDelete,
	}: {
		task: Task | null;
		projectId: string;
		onUpdate: (t: Task) => void;
		onDelete: (id: string) => void;
	} = $props();

	const store = getDataStore();

	// Lock body scroll when modal is open
	$effect(() => {
		if (task) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = '';
		return () => { document.body.style.overflow = ''; };
	});

	// Global Escape listener
	$effect(() => {
		if (!task) return;
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	let attachments = $state<Attachment[]>([]);
	let editingTitle = $state(false);
	let titleEditValue = $state('');
	let descriptionHtml = $state('');
	let uploading = $state(false);
	let confirmingDelete = $state(false);
	let showProjectPicker = $state(false);
	let fileInput = $state<HTMLInputElement>();

	// Available leaf projects (no children) for move
	let leafProjects = $derived(
		store.projects.filter(p => !store.projects.some(c => c.parent_id === p.id))
	);

	$effect(() => {
		if (task) {
			descriptionHtml = task.description || '';
			titleEditValue = task.title;
			editingTitle = false;
			confirmingDelete = false;
			showProjectPicker = false;
			loadAttachments();
		}
	});

	let currentProject = $derived(store.projects.find(p => p.id === projectId));

	async function loadAttachments() {
		if (!task) return;
		attachments = await api.listAttachments(projectId, task.id);
	}

	async function handleTitleBlur() {
		if (!task || !editingTitle) return;
		editingTitle = false;
		const newTitle = titleEditValue.trim();
		if (newTitle && newTitle !== task.title) {
			const updated = await store.updateTask(projectId, task.id, { title: newTitle });
			task = updated;
			onUpdate(updated);
		}
	}

	async function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLElement)?.blur();
		}
	}

	async function saveDescription(html?: string) {
		if (!task) return;
		const desc = html !== undefined ? html : descriptionHtml;
		const updated = await store.updateTask(projectId, task.id, { description: desc || null });
		task = updated;
		onUpdate(updated);
	}

	async function onDateChange(date: string | null) {
		if (!task) return;
		const updated = await store.updateTask(projectId, task.id, { due_date: date });
		task = updated;
		onUpdate(updated);
	}

	async function toggleDone() {
		if (!task) return;
		const updated = await store.updateTask(projectId, task.id, { is_done: !task.is_done });
		task = updated;
		onUpdate(updated);
	}

	async function moveToProject(newProjectId: string) {
		if (!task || newProjectId === projectId) return;
		await store.moveTask(projectId, task.id, newProjectId);
		projectId = newProjectId;
		showProjectPicker = false;
		store.refreshTasks();
	}

	async function handleUpload() {
		if (!task || !fileInput?.files?.length) return;
		uploading = true;
		for (const file of fileInput.files) {
			await api.uploadAttachment(projectId, task.id, file);
		}
		fileInput.value = '';
		await loadAttachments();
		uploading = false;
	}

	async function deleteAttachment(name: string) {
		if (!task) return;
		await api.deleteAttachment(projectId, task.id, name);
		attachments = attachments.filter(a => a.name !== name);
	}

	async function handleDelete() {
		if (!task) return;
		await store.deleteTask(projectId, task.id);
		onDelete(task.id);
		task = null;
	}

	function close() { task = null; }
</script>

{#if task}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-40 backdrop-blur-[3px] animate-fadeIn" onclick={close}></div>

	<div class="fixed inset-0 z-50 flex items-end md:items-stretch justify-center md:py-10 md:px-4 pointer-events-none">
		<div class="bg-bg border-t md:border border-border rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-4xl max-h-[92vh] md:h-full flex flex-col pointer-events-auto animate-modalIn" style="padding-bottom: env(safe-area-inset-bottom, 0px)">

			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0 gap-3">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<button
						type="button"
						onclick={toggleDone}
						class="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:scale-110"
						style="border-color: {task.is_done ? 'var(--color-success)' : 'var(--color-border-strong)'}; background: {task.is_done ? 'var(--color-success)' : 'transparent'}"
						aria-label="toggle done"
					>
						{#if task.is_done}
							<svg class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
						{/if}
					</button>
					{#if editingTitle}
						<input
							bind:value={titleEditValue}
							autofocus
							class="flex-1 bg-transparent text-lg font-medium text-text focus:outline-none leading-snug min-w-0"
							onblur={handleTitleBlur}
							onkeydown={handleTitleKeydown}
						/>
					{:else}
						<button
							type="button"
							class="text-lg font-medium cursor-text hover:text-text-secondary transition-colors leading-snug text-left {task.is_done ? 'line-through text-text-muted' : ''}"
							onclick={() => { editingTitle = true; titleEditValue = task?.title || ''; }}
						>{task.title}</button>
					{/if}
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					{#if confirmingDelete}
						<span class="text-xs text-danger mr-1">delete?</span>
						<button type="button" onclick={handleDelete} class="px-2 py-1 text-xs bg-danger text-white rounded-lg hover:opacity-90 transition-all">yes</button>
						<button type="button" onclick={() => confirmingDelete = false} class="px-2 py-1 text-xs text-text-muted hover:text-text-secondary transition-all">no</button>
					{:else}
						<button type="button" onclick={() => confirmingDelete = true} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface transition-all" title="delete">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
						</button>
					{/if}
					<button type="button" onclick={close} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all" aria-label="close">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
				<!-- Metadata row -->
				<div class="flex items-center gap-4 flex-wrap">
					<div class="flex items-center gap-3">
						<p class="text-[10px] uppercase tracking-wider text-text-muted w-10">due</p>
						<DatePicker value={task.due_date} onchange={onDateChange} />
					</div>
					<div class="flex items-center gap-3">
						<p class="text-[10px] uppercase tracking-wider text-text-muted w-10">in</p>
						<div class="relative">
							<button
								type="button"
								onclick={() => showProjectPicker = !showProjectPicker}
								class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border text-text-secondary hover:text-text hover:bg-surface/50 transition-all"
							>
								{#if currentProject?.icon}<span class="text-[11px]">{currentProject.icon}</span>{/if}
								<span>{currentProject?.title || 'unknown'}</span>
								<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ml-0.5"><polyline points="6 9 12 15 18 9"/></svg>
							</button>
							{#if showProjectPicker}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="fixed inset-0 z-10" onclick={() => showProjectPicker = false}></div>
								<div class="absolute top-full left-0 mt-1 bg-elevated border border-border rounded-xl shadow-lg overflow-hidden z-20 w-48 max-h-48 overflow-y-auto">
									{#each leafProjects as p}
										<button
											type="button"
											onclick={() => moveToProject(p.id)}
											class="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors {p.id === projectId ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}"
										>
											{#if p.icon}<span class="text-[11px]">{p.icon}</span>{:else}<span class="w-2 h-2 rounded-full" style="background:{p.color || '#525252'}"></span>{/if}
											<span class="truncate">{p.title}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Notes -->
				<div class="flex-1 flex flex-col relative min-h-0">
					<NoteEditor
						content={descriptionHtml}
						placeholder="write something..."
						onSave={(html) => { descriptionHtml = html; saveDescription(html); }}
					/>
					<div class="absolute bottom-2 right-2 flex items-center gap-1">
						<input
							bind:this={fileInput}
							type="file"
							multiple
							class="hidden"
							onchange={handleUpload}
						/>
						<button
							type="button"
							onclick={() => fileInput?.click()}
							disabled={uploading}
							class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/60 hover:text-text-muted hover:bg-surface/80 transition-all"
							title="attach file (drop or click)"
						>
							{#if uploading}
								<span class="w-3 h-3 border-2 border-text-muted/40 border-t-text-muted rounded-full animate-spin"></span>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- Attached files -->
				{#if attachments.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each attachments as att}
							<a
								href={api.attachmentUrl(projectId, task.id, att.name)}
								target="_blank"
								download
								class="group flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:border-border-strong transition-all"
							>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
								<span class="truncate max-w-[120px]">{att.name}</span>
								<button
									type="button"
									onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteAttachment(att.name); }}
									class="w-4 h-4 flex items-center justify-center text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
									aria-label="delete"
								>
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@media (max-width: 767px) {
		.animate-modalIn { animation: modalInMobile 0.2s cubic-bezier(0, 0, 0.2, 1); }
		@keyframes modalInMobile {
			from { opacity: 0; transform: translateY(100px); }
			to { opacity: 1; transform: translateY(0); }
		}
	}
</style>
