<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);
	let showPassword = $state(false);
	let shake = $state(false);
	let emailInput: HTMLInputElement;

	onMount(() => { emailInput?.focus(); });

	async function handleLogin() {
		if (!email || !password) {
			error = 'all fields required';
			triggerShake();
			return;
		}
		error = '';
		submitting = true;
		try {
			const res = await api.login({ email, password });
			localStorage.setItem('float_token', res.token);
			goto('/app');
		} catch (e) {
			error = e instanceof Error ? e.message : 'login failed';
			triggerShake();
		}
		submitting = false;
	}

	function triggerShake() {
		shake = true;
		setTimeout(() => shake = false, 500);
	}
</script>

<div class="min-h-screen bg-bg flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="flex items-center gap-3 mb-8">
			<div class="relative w-10 h-10">
				<div class="w-6 h-6 bg-text rounded-full absolute top-1 left-2 opacity-90"></div>
				<div class="w-4 h-1 bg-text/10 rounded-full absolute bottom-1 left-3"></div>
			</div>
			<span class="text-2xl font-semibold tracking-tight text-text">float</span>
		</div>

		<form
			onsubmit={(e) => { e.preventDefault(); handleLogin(); }}
			class="space-y-3 {shake ? 'animate-shake' : ''}"
		>
			{#if error}
				<p class="text-danger text-xs px-1">{error}</p>
			{/if}
			<input
				bind:this={emailInput}
				type="email"
				bind:value={email}
				placeholder="email"
				autocomplete="email"
				class="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-text/10 focus:border-border-strong transition-all"
			/>
			<div class="relative">
				<input
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					placeholder="password"
					autocomplete="current-password"
					class="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-text/10 focus:border-border-strong transition-all pr-10"
				/>
				<button
					type="button"
					onclick={() => showPassword = !showPassword}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary text-xs"
				>{showPassword ? 'hide' : 'show'}</button>
			</div>
			<button
				type="submit"
				disabled={submitting}
				class="w-full bg-accent text-accent-fg font-medium text-sm rounded-lg py-2.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
			>
				{#if submitting}
					<span class="inline-block w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin"></span>
				{:else}
					sign in
				{/if}
			</button>
		</form>

	</div>
</div>

<style>
	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-6px); }
		40% { transform: translateX(6px); }
		60% { transform: translateX(-4px); }
		80% { transform: translateX(4px); }
	}
	:global(.animate-shake) { animation: shake 0.4s ease-in-out; }
	:global(.animate-spin) { animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
