<script lang="ts">
	let {
		value = $bindable<string | null>(null),
		onchange,
	}: {
		value: string | null;
		onchange?: (date: string | null) => void;
	} = $props();

	let open = $state(false);
	let textInput = $state('');
	let inputEl: HTMLInputElement;
	let timeValue = $state('');

	// Current displayed month for calendar
	let viewDate = $state(new Date());

	// Sync timeValue when value changes
	$effect(() => {
		if (value) {
			const d = new Date(value);
			const h = d.getHours();
			const m = d.getMinutes();
			timeValue = (h || m) ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}` : '';
		} else {
			timeValue = '';
		}
	});

	let displayValue = $derived.by(() => {
		if (!value) return '';
		const d = new Date(value);
		const datePart = relativeDate(value);
		const h = d.getHours();
		const m = d.getMinutes();
		if (h || m) return `${datePart} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
		return datePart;
	});

	function relativeDate(d: string) {
		const date = new Date(d);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const target = new Date(date);
		target.setHours(0, 0, 0, 0);
		const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		if (diff === 0) return 'today';
		if (diff === 1) return 'tomorrow';
		if (diff === -1) return 'yesterday';
		if (diff > 0 && diff < 7) return date.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
		return date.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase();
	}

	function applyTime(timeStr: string) {
		if (!value || !timeStr) return;
		const [h, m] = timeStr.split(':').map(Number);
		const d = new Date(value);
		d.setHours(h, m, 0, 0);
		value = d.toISOString();
		onchange?.(value);
	}

	function clearTime() {
		if (!value) return;
		const d = new Date(value);
		d.setHours(0, 0, 0, 0);
		timeValue = '';
		value = d.toISOString();
		onchange?.(value);
	}

	function setDate(d: Date | null) {
		value = d?.toISOString() || null;
		onchange?.(value);
		open = false;
		textInput = '';
	}

	function addDays(n: number): Date {
		const d = new Date();
		d.setDate(d.getDate() + n);
		d.setHours(9, 0, 0, 0);
		return d;
	}

	function nextMonday(): Date {
		const d = new Date();
		const day = d.getDay();
		const diff = day === 0 ? 1 : 8 - day;
		d.setDate(d.getDate() + diff);
		d.setHours(9, 0, 0, 0);
		return d;
	}

	function parseText(text: string): Date | null {
		const lower = text.trim().toLowerCase();
		if (!lower) return null;
		const map: Record<string, () => Date> = {
			'today': () => addDays(0),
			"aujourd'hui": () => addDays(0),
			'tomorrow': () => addDays(1),
			'demain': () => addDays(1),
			'monday': () => nextWeekday(1), 'lundi': () => nextWeekday(1),
			'tuesday': () => nextWeekday(2), 'mardi': () => nextWeekday(2),
			'wednesday': () => nextWeekday(3), 'mercredi': () => nextWeekday(3),
			'thursday': () => nextWeekday(4), 'jeudi': () => nextWeekday(4),
			'friday': () => nextWeekday(5), 'vendredi': () => nextWeekday(5),
			'saturday': () => nextWeekday(6), 'samedi': () => nextWeekday(6),
			'sunday': () => nextWeekday(0), 'dimanche': () => nextWeekday(0),
		};
		if (map[lower]) return map[lower]();
		// Try relative: "3d", "2j", "1w"
		const rel = lower.match(/^(\d+)\s*(d|j|w|s)$/);
		if (rel) {
			const n = parseInt(rel[1]);
			const unit = rel[2];
			if (unit === 'w' || unit === 's') return addDays(n * 7);
			return addDays(n);
		}
		// Try time only: "15h", "14h30", "3pm", "15:30"
		const timeMatch = lower.match(/^(\d{1,2})h(\d{2})?$/) || lower.match(/^(\d{1,2}):(\d{2})$/);
		if (timeMatch && value) {
			const d = new Date(value);
			d.setHours(parseInt(timeMatch[1]), timeMatch[2] ? parseInt(timeMatch[2]) : 0, 0, 0);
			return d;
		}
		const ampm = lower.match(/^(\d{1,2})(am|pm)$/i);
		if (ampm && value) {
			let h = parseInt(ampm[1]);
			if (ampm[2].toLowerCase() === 'pm' && h < 12) h += 12;
			if (ampm[2].toLowerCase() === 'am' && h === 12) h = 0;
			const d = new Date(value);
			d.setHours(h, 0, 0, 0);
			return d;
		}
		// Try parsing as date
		const parsed = new Date(text);
		if (!isNaN(parsed.getTime())) return parsed;
		return null;
	}

	function nextWeekday(day: number): Date {
		const d = new Date();
		const current = d.getDay();
		let diff = day - current;
		if (diff <= 0) diff += 7;
		d.setDate(d.getDate() + diff);
		d.setHours(9, 0, 0, 0);
		return d;
	}

	function handleTextSubmit() {
		const d = parseText(textInput);
		if (d) setDate(d);
	}

	// Calendar helpers
	let calendarDays = $derived.by(() => {
		const year = viewDate.getFullYear();
		const month = viewDate.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const days: (number | null)[] = [];
		// Pad start
		for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
		for (let i = 1; i <= daysInMonth; i++) days.push(i);
		return days;
	});

	let monthLabel = $derived(viewDate.toLocaleDateString('en', { month: 'long', year: 'numeric' }).toLowerCase());

	function isToday(day: number): boolean {
		const now = new Date();
		return day === now.getDate() && viewDate.getMonth() === now.getMonth() && viewDate.getFullYear() === now.getFullYear();
	}

	function isSelected(day: number): boolean {
		if (!value) return false;
		const sel = new Date(value);
		return day === sel.getDate() && viewDate.getMonth() === sel.getMonth() && viewDate.getFullYear() === sel.getFullYear();
	}

	function selectDay(day: number) {
		const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 9, 0, 0);
		setDate(d);
	}

	let triggerEl: HTMLButtonElement;
	let popoverStyle = $state('');

	let isMobile = $state(false);

	function checkMobile() {
		isMobile = window.innerWidth < 768;
	}

	function openPicker() {
		if (open) { open = false; textInput = ''; return; }
		checkMobile();
		if (!isMobile && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const goUp = spaceBelow < 350;
			popoverStyle = goUp
				? `position:fixed; bottom:${window.innerHeight - rect.top + 4}px; left:${rect.left}px;`
				: `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px;`;
		} else {
			popoverStyle = '';
		}
		open = true;
		setTimeout(() => inputEl?.focus(), 50);
	}

	function prevMonth() { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); }
	function nextMonth() { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); }
</script>

<div>
	<!-- Trigger -->
	<button
		bind:this={triggerEl}
		type="button"
		onclick={openPicker}
		class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border {value ? 'bg-surface border-border-strong text-text' : 'border-border text-text-muted hover:text-text-secondary hover:bg-surface/50'}"
	>
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
		</svg>
		{#if value}
			<span>{displayValue}</span>
		{:else}
			<span>set date</span>
		{/if}
	</button>

	<!-- Popover -->
	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-[55] {isMobile ? 'bg-black/50 backdrop-blur-[2px]' : ''}" onclick={() => open = false}></div>

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="{isMobile ? 'fixed inset-x-0 bottom-0 z-[60] w-full rounded-t-2xl animate-slideUp' : 'z-[60] w-64 rounded-xl animate-popIn'} bg-elevated border border-border shadow-xl overflow-hidden"
			style="{isMobile ? 'padding-bottom: env(safe-area-inset-bottom, 0px)' : popoverStyle}"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Quick shortcuts -->
			<div class="p-2 flex flex-wrap gap-1.5 border-b border-border">
				<button type="button" onclick={() => setDate(addDays(0))} class="px-2.5 py-1 rounded-lg text-xs bg-surface hover:bg-tertiary text-text-secondary hover:text-text transition-colors">today</button>
				<button type="button" onclick={() => setDate(addDays(1))} class="px-2.5 py-1 rounded-lg text-xs bg-surface hover:bg-tertiary text-text-secondary hover:text-text transition-colors">tomorrow</button>
				<button type="button" onclick={() => setDate(nextMonday())} class="px-2.5 py-1 rounded-lg text-xs bg-surface hover:bg-tertiary text-text-secondary hover:text-text transition-colors">monday</button>
				<button type="button" onclick={() => setDate(addDays(7))} class="px-2.5 py-1 rounded-lg text-xs bg-surface hover:bg-tertiary text-text-secondary hover:text-text transition-colors">next week</button>
				{#if value}
					<button type="button" onclick={() => setDate(null)} class="px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-danger transition-colors">clear</button>
				{/if}
			</div>

			<!-- Text input -->
			<div class="p-2 border-b border-border">
				<input
					bind:this={inputEl}
					bind:value={textInput}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit(); } if (e.key === 'Escape') open = false; }}
					placeholder="fri, 3d, jun 15, 15h, 3pm..."
					class="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-text/8 focus:border-border-strong transition-all"
				/>
			</div>

			<!-- Time (only if date is set) -->
			{#if value}
				<div class="px-2 py-1.5 border-b border-border flex items-center gap-2">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-text-muted flex-shrink-0">
						<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
					</svg>
					<div class="flex gap-1">
						{#each ['09:00', '12:00', '14:00', '17:00'] as t}
							<button
								type="button"
								onclick={() => { timeValue = t; applyTime(t); }}
								class="px-1.5 py-0.5 rounded text-[10px] transition-colors {timeValue === t ? 'bg-accent text-accent-fg' : 'bg-surface text-text-muted hover:text-text-secondary'}"
							>{t.replace(':00', 'h')}</button>
						{/each}
					</div>
					<input
						type="time"
						bind:value={timeValue}
						onchange={() => applyTime(timeValue)}
						class="bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-text focus:outline-none w-[70px] ml-auto color-scheme-dark"
						style="color-scheme: {typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'}"
					/>
					{#if timeValue}
						<button type="button" onclick={clearTime} class="text-[9px] text-text-muted hover:text-danger transition-colors">x</button>
					{/if}
				</div>
			{/if}

			<!-- Mini calendar -->
			<div class="p-2">
				<div class="flex items-center justify-between mb-2 px-1">
					<button type="button" onclick={prevMonth} class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors rounded">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
					</button>
					<span class="text-[11px] text-text-secondary font-medium">{monthLabel}</span>
					<button type="button" onclick={nextMonth} class="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors rounded">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>
					</button>
				</div>
				<!-- Day headers -->
				<div class="grid grid-cols-7 gap-0 mb-1">
					{#each ['m', 't', 'w', 't', 'f', 's', 's'] as d}
						<div class="text-[9px] text-text-muted text-center py-0.5">{d}</div>
					{/each}
				</div>
				<!-- Days -->
				<div class="grid grid-cols-7 gap-0">
					{#each calendarDays as day}
						{#if day}
							<button
								type="button"
								onclick={() => selectDay(day)}
								class="w-full aspect-square flex items-center justify-center text-[11px] rounded-md transition-all {isSelected(day) ? 'bg-accent text-accent-fg font-medium' : isToday(day) ? 'text-text font-medium ring-1 ring-border-strong' : 'text-text-secondary hover:bg-surface hover:text-text'}"
							>{day}</button>
						{:else}
							<div></div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.animate-popIn { animation: popIn 0.12s cubic-bezier(0, 0, 0.2, 1); }
	@keyframes popIn {
		from { opacity: 0; transform: translateY(-4px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
	.animate-slideUp { animation: slideUp 0.2s cubic-bezier(0, 0, 0.2, 1); }
	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
