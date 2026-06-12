<script lang="ts">
	let {
		title,
		message,
		confirmLabel = 'confirm',
		confirmClass = 'bg-accent text-accent-fg',
		onConfirm,
		onCancel,
	}: {
		title: string;
		message: string;
		confirmLabel?: string;
		confirmClass?: string;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[2px]" onclick={onCancel}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="bg-bg border border-border rounded-xl p-5 w-full max-w-sm shadow-xl" onclick={(e) => e.stopPropagation()}>
		<h3 class="text-sm font-medium mb-2">{title}</h3>
		<p class="text-xs text-text-muted mb-4">{message}</p>
		<div class="flex gap-2 justify-end">
			<button type="button" onclick={onCancel} class="px-3 py-1.5 text-xs text-text-secondary hover:text-text rounded-lg hover:bg-surface transition-all">no</button>
			<button type="button" onclick={onConfirm} class="px-3 py-1.5 text-xs {confirmClass} rounded-lg hover:opacity-90 active:scale-[0.98] transition-all">{confirmLabel}</button>
		</div>
	</div>
</div>
