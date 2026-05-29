<script lang="ts">
	import { parseInput, getSuggestions, type Suggestion } from '$lib/smart-input';

	let {
		value = $bindable(''),
		placeholder = 'add a task... @demain @midi @lundi',
		projectNames = [],
		onSubmit,
		class: className = '',
	}: {
		value: string;
		placeholder?: string;
		projectNames?: string[];
		onSubmit?: (parsed: ReturnType<typeof parseInput>) => void;
		class?: string;
	} = $props();

	let suggestions = $state<Suggestion[]>([]);
	let selectedIdx = $state(0);
	let showSuggestions = $state(false);
	let inputEl: HTMLInputElement;
	let inline = $derived(className.includes('inline-edit'));

	// Parsed preview of current input
	let parsed = $derived(parseInput(value));
	let hasTags = $derived(!!parsed.due_date);

	function onInput() {
		const words = value.split(/\s/);
		const last = words[words.length - 1];
		if (last.startsWith('@') && last.length > 1) {
			suggestions = getSuggestions(last.slice(1), projectNames);
			selectedIdx = 0;
			showSuggestions = suggestions.length > 0;
		} else {
			showSuggestions = false;
		}
	}

	function applySuggestion(s: Suggestion) {
		const words = value.split(/\s/);
		words[words.length - 1] = `@${s.value}`;
		value = words.join(' ') + ' ';
		showSuggestions = false;
		inputEl?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (showSuggestions) {
			if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, suggestions.length - 1); }
			if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); }
			if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
				e.preventDefault();
				applySuggestion(suggestions[selectedIdx]);
				return;
			}
			if (e.key === 'Escape') { showSuggestions = false; return; }
		}
		if (e.key === 'Enter' && !showSuggestions && onSubmit) {
			e.preventDefault();
			const result = parseInput(value);
			if (result.title || result.weight || result.due_date) {
				onSubmit(result);
				value = '';
				showSuggestions = false;
			}
		}
	}

	function typeIcon(type: string) {
		if (type === 'date') return 'date';
		if (type === 'time') return 'time';
		return 'proj';
	}
</script>

<div class="relative {className}">
	<div class="relative">
		<input
			bind:this={inputEl}
			bind:value={value}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={() => { if (suggestions.length) showSuggestions = true; }}
			onblur={() => setTimeout(() => showSuggestions = false, 150)}
			{placeholder}
			autofocus={inline}
			class="{inline ? 'w-full bg-transparent border-none px-0 py-1 text-sm text-text placeholder:text-text-muted/30 focus:outline-none transition-all' : 'w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-text/8 focus:border-border-strong transition-all'} {hasTags && !inline ? 'pr-24' : ''}"
		/>

		<!-- Inline tag previews -->
		{#if hasTags && !inline}
			<div class="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1.5">
				{#if parsed.due_date}
					{@const d = new Date(parsed.due_date)}
					<span class="text-[10px] text-text-muted bg-surface border border-border rounded-md px-1.5 py-0.5">
						{d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}{d.getHours() || d.getMinutes() ? ` ${d.getHours()}h${d.getMinutes().toString().padStart(2, '0')}` : ''}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Suggestions dropdown -->
	{#if showSuggestions}
		<div class="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border rounded-xl shadow-lg overflow-hidden z-20">
			{#each suggestions as s, i}
				<button
					type="button"
					class="w-full px-3 py-2 text-left text-sm flex items-center gap-3 transition-colors {i === selectedIdx ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}"
					onmousedown={() => applySuggestion(s)}
				>
					<span class="text-[9px] uppercase tracking-wider text-text-muted w-8 text-right font-medium">{typeIcon(s.type)}</span>
					<span class="flex-1">{s.label}</span>
					{#if s.description}
						<span class="text-[11px] text-text-muted">{s.description}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
