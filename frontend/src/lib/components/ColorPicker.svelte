<script lang="ts">
	import { onMount } from 'svelte';

	let {
		color = $bindable<string | null>(null),
		icon = $bindable<string | null>(null),
		onchange,
	}: {
		color: string | null;
		icon: string | null;
		onchange?: (color: string | null, icon: string | null) => void;
	} = $props();

	let open = $state(false);
	let tab = $state<'color' | 'icon'>('color');
	let triggerEl: HTMLButtonElement;
	let popoverStyle = $state('');
	let customColor = $state('');
	let isMobile = $state(false);
	let pickerContainer: HTMLDivElement;

	// Portal action: moves element to document.body to escape CSS columns/contain clipping
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	const presetColors = [
		'#EF4444', '#F97316', '#EAB308', '#22C55E',
		'#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
		'#EC4899', '#F43F5E', '#78716C', '#525252',
		'#84CC16', '#14B8A6', '#0EA5E9', '#8B5CF6',
		'#F472B6', '#FB923C', '#FBBF24', '#34D399',
	];

	function pickColor(c: string) {
		color = c || null;
		icon = null;
		onchange?.(c || null, null);
		open = false;
	}

	function pickIcon(i: string) {
		icon = i;
		onchange?.(color, i);
		open = false;
	}

	function applyCustomColor() {
		let c = customColor.trim();
		if (!c.startsWith('#')) c = '#' + c;
		if (/^#[0-9a-fA-F]{3,8}$/.test(c)) {
			pickColor(c);
		}
	}

	function openPicker(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		if (open) { open = false; return; }
		isMobile = window.innerWidth < 768;
		if (!isMobile && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const spaceRight = window.innerWidth - rect.right;
			const spaceBelow = window.innerHeight - rect.bottom;
			if (spaceRight > 360) {
				popoverStyle = `position:fixed; top:${Math.min(rect.top - 4, window.innerHeight - 420)}px; left:${rect.right + 6}px;`;
			} else if (spaceBelow > 420) {
				popoverStyle = `position:fixed; top:${rect.bottom + 4}px; left:${Math.max(8, rect.left - 160)}px;`;
			} else {
				popoverStyle = `position:fixed; bottom:${window.innerHeight - rect.top + 4}px; left:${rect.left}px;`;
			}
		} else {
			popoverStyle = '';
		}
		tab = icon ? 'icon' : 'color';
		customColor = color || '';
		open = true;
	}

	// Mount emoji picker when tab switches to icon
	$effect(() => {
		if (open && tab === 'icon' && pickerContainer) {
			// Dynamically import to avoid SSR issues
			import('emoji-picker-element').then(({ default: Picker }) => {
				if (!pickerContainer || pickerContainer.querySelector('emoji-picker')) return;
				const picker = document.createElement('emoji-picker') as any;
				picker.setAttribute('class', 'light');
				pickerContainer.appendChild(picker);
				picker.addEventListener('emoji-click', (e: any) => {
					pickIcon(e.detail.unicode);
				});
				// Apply theme
				const isDark = !document.documentElement.classList.contains('light');
				if (isDark) picker.removeAttribute('class');
			});
		}
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<button
	bind:this={triggerEl}
	type="button"
	onclick={openPicker}
	class="flex-shrink-0 transition-transform hover:scale-125 cursor-pointer"
>
	{#if icon}
		<span class="text-sm leading-none">{icon}</span>
	{:else}
		<span class="w-2.5 h-2.5 rounded-full block" style="background:{color || '#525252'}"></span>
	{/if}
</button>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div use:portal>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[55] {isMobile ? 'bg-black/50 backdrop-blur-[2px]' : ''}" onclick={() => open = false}></div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="{isMobile ? 'fixed inset-x-0 bottom-0 z-[60] w-full rounded-t-2xl picker-slideUp' : 'z-[60] rounded-xl picker-pop'} bg-elevated border border-border shadow-xl overflow-hidden"
		style="{isMobile ? 'padding-bottom: env(safe-area-inset-bottom, 0px)' : popoverStyle}"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Tabs -->
		<div class="flex border-b border-border">
			<button
				type="button"
				onclick={() => tab = 'color'}
				class="flex-1 py-1.5 text-[11px] text-center transition-colors {tab === 'color' ? 'text-text border-b-2 border-text' : 'text-text-muted hover:text-text-secondary'}"
			>color</button>
			<button
				type="button"
				onclick={() => tab = 'icon'}
				class="flex-1 py-1.5 text-[11px] text-center transition-colors {tab === 'icon' ? 'text-text border-b-2 border-text' : 'text-text-muted hover:text-text-secondary'}"
			>icon</button>
		</div>

		{#if tab === 'color'}
			<div class="p-2.5 space-y-2.5 w-56">
				<div class="grid grid-cols-5 gap-1.5">
					{#each presetColors as c}
						<button
							type="button"
							onclick={() => pickColor(c)}
							class="w-7 h-7 rounded-lg transition-all hover:scale-110 {!icon && color === c ? 'ring-2 ring-offset-1 ring-offset-bg ring-text/30' : ''}"
							style="background:{c}"
						></button>
					{/each}
				</div>
				{#if color}
					<button type="button" onclick={() => pickColor('')} class="text-[10px] text-text-muted hover:text-text-secondary transition-colors">reset color</button>
				{/if}
				<div class="flex gap-1.5">
					<div class="flex-1 flex items-center bg-surface border border-border rounded-lg overflow-hidden">
						<span class="text-[10px] text-text-muted pl-2">#</span>
						<input
							type="text"
							bind:value={customColor}
							placeholder="hex"
							maxlength="7"
							class="flex-1 bg-transparent text-xs text-text px-1 py-1 focus:outline-none w-0"
							onkeydown={(e) => { if (e.key === 'Enter') applyCustomColor(); }}
						/>
					</div>
					{#if customColor}
						<div class="w-7 h-7 rounded-lg border border-border" style="background:{customColor.startsWith('#') ? customColor : '#' + customColor}"></div>
					{/if}
				</div>
			</div>
		{:else}
			<div bind:this={pickerContainer} class="emoji-container"></div>
			{#if icon}
				<div class="px-2.5 pb-2">
					<button
						type="button"
						onclick={() => { icon = null; onchange?.(color, null); open = false; }}
						class="w-full text-[10px] text-text-muted hover:text-danger py-1 transition-colors"
					>remove icon</button>
				</div>
			{/if}
		{/if}
	</div>
	</div>
{/if}

<style>
	.picker-pop {
		animation: popIn 0.12s cubic-bezier(0, 0, 0.2, 1);
	}
	@keyframes popIn {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}
	.picker-slideUp { animation: slideUp 0.2s cubic-bezier(0, 0, 0.2, 1); }
	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	/* Style the emoji picker to match our theme */
	.emoji-container :global(emoji-picker) {
		--border-color: var(--color-border);
		--background: var(--color-elevated);
		--input-border-color: var(--color-border);
		--input-font-color: var(--color-text);
		--input-placeholder-color: var(--color-text-muted);
		--category-font-color: var(--color-text-muted);
		--button-hover-background: var(--color-surface);
		--button-active-background: var(--color-tertiary);
		--indicator-color: var(--color-text);
		--outline-color: var(--color-border-strong);
		--num-columns: 8;
		--emoji-size: 1.2rem;
		--emoji-padding: 0.3rem;
		width: 100%;
		min-width: 280px;
		border: none;
		height: 300px;
	}
</style>
