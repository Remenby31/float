<script lang="ts">
	import { getToastStore } from '$lib/stores/toast.svelte';

	const toast = getToastStore();
</script>

{#if toast.toasts.length > 0}
	<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" style="padding-bottom: env(safe-area-inset-bottom, 0px)">
		{#each toast.toasts as t (t.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="px-4 py-2.5 rounded-xl shadow-lg text-sm max-w-sm animate-toastIn cursor-pointer {t.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'}"
				onclick={() => toast.dismiss(t.id)}
			>
				{t.message}
			</div>
		{/each}
	</div>
{/if}

<style>
	.animate-toastIn {
		animation: toastIn 0.2s cubic-bezier(0, 0, 0.2, 1);
	}
	@keyframes toastIn {
		from { opacity: 0; transform: translateY(8px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>
