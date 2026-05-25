<script lang="ts">
	let {
		value = $bindable<string | null>(null),
		onchange,
	}: {
		value: string | null;
		onchange?: (color: string) => void;
	} = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement;
	let popoverStyle = $state('');

	const colors = [
		'#EF4444', '#F97316', '#EAB308', '#22C55E',
		'#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
		'#EC4899', '#F43F5E', '#737373', '#525252',
	];

	function pick(c: string) {
		value = c;
		onchange?.(c);
		open = false;
	}

	function openPicker() {
		if (open) { open = false; return; }
		if (triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const spaceRight = window.innerWidth - rect.right;
			popoverStyle = spaceRight > 160
				? `position:fixed; top:${rect.top - 4}px; left:${rect.right + 6}px;`
				: `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px;`;
		}
		open = true;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<button
	bind:this={triggerEl}
	type="button"
	onclick={(e) => { e.stopPropagation(); e.preventDefault(); openPicker(); }}
	class="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform hover:scale-150 cursor-pointer"
	style="background:{value || '#525252'}"
	title="change color"
></button>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[55]" onclick={() => open = false}></div>
	<div class="bg-elevated border border-border rounded-xl shadow-xl z-[60] p-2 color-picker" style={popoverStyle}>
		<div class="grid grid-cols-4 gap-1.5">
			{#each colors as c}
				<button
					type="button"
					onclick={() => pick(c)}
					class="w-6 h-6 rounded-full transition-all hover:scale-110 {value === c ? 'ring-2 ring-offset-1 ring-offset-bg ring-text/30' : ''}"
					style="background:{c}"
				></button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.color-picker {
		animation: popIn 0.12s cubic-bezier(0, 0, 0.2, 1);
	}
	@keyframes popIn {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
