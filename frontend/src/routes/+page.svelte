<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		const token = localStorage.getItem('float_token');
		goto(token ? '/app' : '/login');
	});
</script>

<div class="min-h-screen bg-bg flex items-center justify-center">
	<p class="text-text-muted text-sm">loading...</p>
</div>
