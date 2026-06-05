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
	let isMobile = $state(false);
	let showAllEmojis = $state(false);

	const presetColors = [
		'#EF4444', '#F97316', '#EAB308', '#22C55E',
		'#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
		'#EC4899', '#F43F5E', '#78716C', '#525252',
		'#84CC16', '#14B8A6', '#0EA5E9', '#8B5CF6',
		'#F472B6', '#FB923C', '#FBBF24', '#34D399',
	];

	// Emoji categories with search keywords
	const emojiData: { emoji: string; tags: string }[] = [
		// frequent / general
		{ emoji: '🏠', tags: 'home house maison' }, { emoji: '💼', tags: 'work job travail' }, { emoji: '🎯', tags: 'target goal objectif' },
		{ emoji: '📦', tags: 'package box colis' }, { emoji: '🚀', tags: 'rocket launch fusée' }, { emoji: '💡', tags: 'idea light bulb idée' },
		{ emoji: '📚', tags: 'books study livres' }, { emoji: '🎨', tags: 'art paint peinture' }, { emoji: '🔧', tags: 'tool wrench outil' },
		{ emoji: '💰', tags: 'money cash argent' }, { emoji: '❤️', tags: 'heart love coeur' }, { emoji: '⭐', tags: 'star étoile' },
		// work
		{ emoji: '💻', tags: 'computer laptop ordinateur code dev' }, { emoji: '📊', tags: 'chart stats graphique' },
		{ emoji: '📈', tags: 'growth trending croissance' }, { emoji: '🗂️', tags: 'folder files dossier' },
		{ emoji: '📋', tags: 'clipboard list checklist' }, { emoji: '✏️', tags: 'pencil write crayon' },
		{ emoji: '🖊️', tags: 'pen write stylo' }, { emoji: '📎', tags: 'paperclip clip trombone' },
		{ emoji: '🗃️', tags: 'file cabinet archive' }, { emoji: '💵', tags: 'dollar money billet' },
		{ emoji: '🏢', tags: 'office building bureau' }, { emoji: '📧', tags: 'email mail' },
		{ emoji: '🤝', tags: 'handshake deal partner' }, { emoji: '📝', tags: 'memo note write' },
		{ emoji: '🗓️', tags: 'calendar date planning' }, { emoji: '⏰', tags: 'alarm clock time heure' },
		{ emoji: '📞', tags: 'phone call téléphone' }, { emoji: '💳', tags: 'card credit payment carte' },
		// life
		{ emoji: '🏋️', tags: 'gym fitness sport' }, { emoji: '🍽️', tags: 'food dinner eat repas' },
		{ emoji: '🛒', tags: 'shop cart courses' }, { emoji: '🧹', tags: 'clean broom ménage' },
		{ emoji: '🏥', tags: 'hospital health santé' }, { emoji: '💊', tags: 'medicine pill médicament' },
		{ emoji: '🚗', tags: 'car drive voiture' }, { emoji: '✈️', tags: 'plane travel avion voyage' },
		{ emoji: '🏖️', tags: 'beach vacation plage vacances' }, { emoji: '🎉', tags: 'party celebration fête' },
		{ emoji: '🎂', tags: 'birthday cake anniversaire' }, { emoji: '👶', tags: 'baby child enfant bébé' },
		{ emoji: '🐕', tags: 'dog pet chien animal' }, { emoji: '🐈', tags: 'cat pet chat animal' },
		{ emoji: '🌿', tags: 'plant garden plante jardin' }, { emoji: '🍕', tags: 'pizza food' },
		{ emoji: '🏃', tags: 'run jog course' }, { emoji: '🚴', tags: 'bike cycle vélo' },
		{ emoji: '🧘', tags: 'yoga meditation zen' }, { emoji: '💤', tags: 'sleep rest sommeil' },
		// creative / tech
		{ emoji: '🎵', tags: 'music song musique' }, { emoji: '🎮', tags: 'game gaming jeu' },
		{ emoji: '📱', tags: 'phone mobile téléphone' }, { emoji: '🧠', tags: 'brain think cerveau' },
		{ emoji: '🌱', tags: 'seed grow start graine' }, { emoji: '☕', tags: 'coffee café' },
		{ emoji: '📸', tags: 'camera photo' }, { emoji: '🎬', tags: 'film movie cinéma' },
		{ emoji: '🎤', tags: 'mic podcast micro' }, { emoji: '🖌️', tags: 'brush paint pinceau' },
		{ emoji: '✍️', tags: 'write author écrire' }, { emoji: '🎹', tags: 'piano keyboard music' },
		{ emoji: '🤖', tags: 'robot ai bot' }, { emoji: '🔬', tags: 'science research microscope' },
		{ emoji: '🌐', tags: 'web internet globe world' }, { emoji: '🛡️', tags: 'shield security defense' },
		{ emoji: '⚙️', tags: 'gear settings config' }, { emoji: '🔒', tags: 'lock secure verrou' },
		// symbols / status
		{ emoji: '✅', tags: 'check done valid' }, { emoji: '🔥', tags: 'fire hot urgent' },
		{ emoji: '⚡', tags: 'lightning fast speed' }, { emoji: '💎', tags: 'gem diamond premium' },
		{ emoji: '🏆', tags: 'trophy win award prix' }, { emoji: '🔔', tags: 'bell notification' },
		{ emoji: '💬', tags: 'chat message speech' }, { emoji: '📌', tags: 'pin pinned épingle' },
		{ emoji: '🔗', tags: 'link chain lien' }, { emoji: '🏷️', tags: 'tag label étiquette' },
		{ emoji: '⚠️', tags: 'warning alert attention' }, { emoji: '🚫', tags: 'no stop forbidden interdit' },
		{ emoji: '♻️', tags: 'recycle green environment' }, { emoji: '🎁', tags: 'gift present cadeau' },
		{ emoji: '🧩', tags: 'puzzle piece module' }, { emoji: '🗝️', tags: 'key access clé' },
		// flags / places
		{ emoji: '🇫🇷', tags: 'france french drapeau' }, { emoji: '🇺🇸', tags: 'usa america us' },
		{ emoji: '🇬🇧', tags: 'uk england britain' }, { emoji: '🇪🇺', tags: 'europe eu' },
		// people / hands
		{ emoji: '👨‍💻', tags: 'developer programmer coder dev' }, { emoji: '👩‍🔬', tags: 'scientist researcher' },
		{ emoji: '👥', tags: 'team people group équipe' }, { emoji: '🙌', tags: 'hands celebrate' },
		{ emoji: '👍', tags: 'thumbs up ok' }, { emoji: '💪', tags: 'strong muscle force' },
		// nature / weather
		{ emoji: '🌅', tags: 'sunrise morning matin' }, { emoji: '🌙', tags: 'moon night nuit' },
		{ emoji: '🌧️', tags: 'rain weather pluie' }, { emoji: '☀️', tags: 'sun sunny soleil' },
		{ emoji: '🌊', tags: 'wave ocean sea mer' }, { emoji: '🏔️', tags: 'mountain montagne' },
	];

	let filteredEmojis = $derived.by(() => {
		const q = emojiSearch.trim().toLowerCase();
		if (!q) {
			// Group into categories for display
			return [
				{ label: 'frequent', emojis: emojiData.slice(0, 12).map(e => e.emoji) },
				{ label: 'work', emojis: emojiData.slice(12, 30).map(e => e.emoji) },
				{ label: 'life', emojis: emojiData.slice(30, 50).map(e => e.emoji) },
				{ label: 'creative', emojis: emojiData.slice(50, 68).map(e => e.emoji) },
				{ label: 'symbols', emojis: emojiData.slice(68, 84).map(e => e.emoji) },
				{ label: 'more', emojis: emojiData.slice(84).map(e => e.emoji) },
			];
		}
		const matched = emojiData.filter(e => e.tags.includes(q));
		return matched.length > 0
			? [{ label: 'results', emojis: matched.map(e => e.emoji) }]
			: [{ label: 'no results', emojis: [] }];
	});

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
			if (spaceRight > 240) {
				popoverStyle = `position:fixed; top:${Math.min(rect.top - 4, window.innerHeight - 340)}px; left:${rect.right + 6}px;`;
			} else if (spaceBelow > 340) {
				popoverStyle = `position:fixed; top:${rect.bottom + 4}px; left:${Math.max(8, rect.left - 100)}px;`;
			} else {
				popoverStyle = `position:fixed; bottom:${window.innerHeight - rect.top + 4}px; left:${rect.left}px;`;
			}
		} else {
			popoverStyle = '';
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
	<div class="fixed inset-0 z-[55] {isMobile ? 'bg-black/50 backdrop-blur-[2px]' : ''}" onclick={() => open = false}></div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="{isMobile ? 'fixed inset-x-0 bottom-0 z-[60] w-full rounded-t-2xl picker-slideUp' : 'z-[60] w-56 rounded-xl picker-pop'} bg-elevated border border-border shadow-xl overflow-hidden"
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
				{#if color}
					<button type="button" onclick={() => pickColor('')} class="text-[10px] text-text-muted hover:text-text-secondary transition-colors">reset color</button>
				{/if}
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

		<!-- Custom emoji input -->
		{#if tab === 'icon'}
			<div class="px-2.5 pb-2 flex gap-1.5">
				<input
					type="text"
					placeholder="paste any emoji..."
					maxlength="4"
					class="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-text/8 transition-all"
					oninput={(e) => {
						const val = (e.target as HTMLInputElement).value.trim();
						if (val && /\p{Emoji}/u.test(val)) { pickIcon(val); }
					}}
				/>
				{#if icon}
					<button
						type="button"
						onclick={() => { icon = null; onchange?.(color, null); open = false; }}
						class="text-[10px] text-text-muted hover:text-danger px-2 py-1 transition-colors"
					>remove</button>
				{/if}
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
	.picker-slideUp { animation: slideUp 0.2s cubic-bezier(0, 0, 0.2, 1); }
	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
