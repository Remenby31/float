<script lang="ts">
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
	let emojiSearch = $state('');

	const presetColors = [
		'#EF4444', '#F97316', '#EAB308', '#22C55E',
		'#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
		'#EC4899', '#F43F5E', '#78716C', '#525252',
		'#84CC16', '#14B8A6', '#0EA5E9', '#8B5CF6',
		'#F472B6', '#FB923C', '#FBBF24', '#34D399',
	];

	// Emoji categories for browsing
	const emojiCategories: { label: string; emojis: string[] }[] = [
		{ label: 'frequent', emojis: ['🏠', '💼', '🎯', '📦', '🚀', '💡', '📚', '🎨', '🔧', '💰', '❤️', '⭐'] },
		{ label: 'work', emojis: ['💻', '📊', '📈', '🗂️', '📋', '✏️', '🖊️', '📎', '🗃️', '💵', '🏢', '📧'] },
		{ label: 'life', emojis: ['🏋️', '🍽️', '🛒', '🧹', '🏥', '💊', '🚗', '✈️', '🏖️', '🎉', '🎂', '👶'] },
		{ label: 'creative', emojis: ['🎵', '🎮', '📱', '🧠', '🌱', '☕', '📸', '🎬', '🎤', '🖌️', '✍️', '🎹'] },
		{ label: 'symbols', emojis: ['✅', '🔥', '⚡', '💎', '🎯', '🏆', '🔔', '💬', '📌', '🔗', '🏷️', '🗓️'] },
	];

	let filteredEmojis = $derived.by(() => {
		if (!emojiSearch.trim()) return emojiCategories;
		const q = emojiSearch.trim().toLowerCase();
		// Flatten all and filter (basic: just show all if search is short)
		const all = emojiCategories.flatMap(c => c.emojis);
		// For emoji search, we match by category label
		const matchedCats = emojiCategories.filter(c => c.label.includes(q));
		if (matchedCats.length > 0) return matchedCats;
		// Otherwise return all as one group
		return [{ label: 'all', emojis: [...new Set(all)] }];
	});

	function pickColor(c: string) {
		color = c;
		icon = null;
		onchange?.(c, null);
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
		if (triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const spaceRight = window.innerWidth - rect.right;
			const spaceBelow = window.innerHeight - rect.bottom;
			if (spaceRight > 240) {
				popoverStyle = `position:fixed; top:${Math.min(rect.top - 4, window.innerHeight - 340)}px; left:${rect.right + 6}px;`;
			} else if (spaceBelow > 340) {
				popoverStyle = `position:fixed; top:${rect.bottom + 4}px; left:${Math.max(8, rect.left - 100)}px;`;
			} else {
				popoverStyle = `position:fixed; bottom:${window.innerHeight - rect.top + 4}px; left:${rect.left}px;`;
			}
		}
		tab = icon ? 'icon' : 'color';
		customColor = color || '';
		emojiSearch = '';
		open = true;
	}
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[55]" onclick={() => open = false}></div>
	<div class="bg-elevated border border-border rounded-xl shadow-xl z-[60] w-56 overflow-hidden picker-pop" style={popoverStyle}>
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
			<div class="p-2.5 space-y-2.5">
				<!-- Presets -->
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
				<!-- Custom hex -->
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
			<div class="p-2.5 space-y-2">
				<!-- Search -->
				<input
					type="text"
					bind:value={emojiSearch}
					placeholder="search: work, life, creative..."
					class="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-text/8 transition-all"
				/>
				<!-- Emoji grid by category -->
				<div class="max-h-48 overflow-y-auto space-y-2">
					{#each filteredEmojis as cat}
						<div>
							<p class="text-[9px] uppercase tracking-wider text-text-muted mb-1">{cat.label}</p>
							<div class="grid grid-cols-6 gap-0.5">
								{#each cat.emojis as em}
									<button
										type="button"
										onclick={() => pickIcon(em)}
										class="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-surface {icon === em ? 'bg-surface ring-1 ring-border-strong' : ''}"
									>{em}</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Clear icon -->
		{#if icon}
			<div class="px-2.5 pb-2">
				<button
					type="button"
					onclick={() => { icon = null; onchange?.(color, null); open = false; }}
					class="w-full text-[10px] text-text-muted hover:text-text-secondary py-1 transition-colors"
				>remove icon</button>
			</div>
		{/if}
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
</style>
