<script lang="ts">
	import { api, type Task, type Attachment } from '$lib/api';
	import SmartInput from './SmartInput.svelte';
	import DatePicker from './DatePicker.svelte';
	import type { ParsedTask } from '$lib/smart-input';

	let {
		task = $bindable<Task | null>(null),
		projectId,
		onUpdate,
		onDelete,
	}: {
		task: Task | null;
		projectId: string;
		onUpdate: (t: Task) => void;
		onDelete: (id: string) => void;
	} = $props();

	// Lock body scroll when modal is open
	$effect(() => {
		if (task) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = '';
		return () => { document.body.style.overflow = ''; };
	});

	let attachments = $state<Attachment[]>([]);
	let editingTitle = $state(false);
	let titleEditValue = $state('');
	let descriptionText = $state('');
	let uploading = $state(false);
	let fileInput: HTMLInputElement;

	$effect(() => {
		if (task) {
			descriptionText = task.description || '';
			titleEditValue = task.title;
			editingTitle = false;
			loadAttachments();
		}
	});

	async function loadAttachments() {
		if (!task) return;
		attachments = await api.listAttachments(projectId, task.id);
	}

	async function handleTitleSubmit(parsed: ParsedTask) {
		if (!task) return;
		const updates: any = {};
		if (parsed.title) updates.title = parsed.title;
		if (parsed.due_date) updates.due_date = parsed.due_date;
		if (Object.keys(updates).length === 0) return;
		const updated = await api.updateTask(projectId, task.id, updates);
		task = updated;
		onUpdate(updated);
		editingTitle = false;
	}

	async function saveDescription() {
		if (!task) return;
		const updated = await api.updateTask(projectId, task.id, { description: descriptionText || null } as any);
		task = updated;
		onUpdate(updated);
	}

	async function onDateChange(date: string | null) {
		if (!task) return;
		const updated = await api.updateTask(projectId, task.id, { due_date: date } as any);
		task = updated;
		onUpdate(updated);
	}

	async function toggleDone() {
		if (!task) return;
		const updated = await api.updateTask(projectId, task.id, { is_done: !task.is_done });
		task = updated;
		onUpdate(updated);
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

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function fileIcon(name: string) {
		if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)) return 'img';
		if (/\.(pdf)$/i.test(name)) return 'pdf';
		return 'file';
	}

	async function handleDelete() {
		if (!task) return;
		await api.deleteTask(projectId, task.id);
		onDelete(task.id);
		task = null;
	}

	function close() { task = null; }



</script>

{#if task}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-40 backdrop-blur-[3px] animate-fadeIn" onclick={close}></div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end md:items-center justify-center md:px-4 pointer-events-none"
		onkeydown={(e) => { if (e.key === 'Escape') close(); }}
	>
		<div class="bg-bg border-t md:border border-border rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-3xl max-h-[92vh] md:max-h-[85vh] flex flex-col pointer-events-auto animate-modalIn" style="padding-bottom: env(safe-area-inset-bottom, 0px)">

			<!-- Header with title -->
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
						<div class="flex-1 min-w-0">
							<SmartInput
								bind:value={titleEditValue}
								placeholder="task title... @demain @midi @lundi"
								onSubmit={handleTitleSubmit}
							/>
						</div>
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<h3
							class="text-lg font-medium cursor-text hover:text-text-secondary transition-colors leading-snug truncate {task.is_done ? 'line-through text-text-muted' : ''}"
							onclick={() => { editingTitle = true; titleEditValue = task?.title || ''; }}
						>{task.title}</h3>
					{/if}
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<button type="button" onclick={handleDelete} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface transition-all" title="delete">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
					</button>
					<button type="button" onclick={close} class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-all" aria-label="close">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
				<!-- Due date -->
				<div class="flex items-center gap-3">
					<p class="text-[10px] uppercase tracking-wider text-text-muted w-10">due</p>
					<DatePicker value={task.due_date} onchange={onDateChange} />
				</div>

				<!-- Notes -->
				<div class="flex-1 flex flex-col relative min-h-0">
					<textarea
						bind:value={descriptionText}
						onblur={saveDescription}
						placeholder="write something..."
						class="w-full flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/40 focus:outline-none resize-none leading-relaxed min-h-[200px]"
					></textarea>
					<!-- Attach button -->
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
						class="absolute bottom-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-text-muted hover:bg-surface/80 transition-all"
						title="attach file"
					>
						{#if uploading}
							<span class="w-3 h-3 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin"></span>
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
						{/if}
					</button>
				</div>

				<!-- Attached files (compact) -->
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
	.animate-fadeIn { animation: fadeIn 0.15s ease; }
	.animate-modalIn { animation: modalIn 0.2s cubic-bezier(0, 0, 0.2, 1); }
	.animate-spin { animation: spin 0.6s linear infinite; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modalIn {
		from { opacity: 0; transform: translateY(100px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@media (min-width: 768px) {
		@keyframes modalIn {
			from { opacity: 0; transform: translateY(8px) scale(0.98); }
			to { opacity: 1; transform: translateY(0) scale(1); }
		}
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
