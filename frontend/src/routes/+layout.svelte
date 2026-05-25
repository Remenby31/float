<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { getTheme } from '$lib/theme.svelte';

	let { children } = $props();
	const theme = getTheme();

	onMount(() => {
		theme.init();
	});
</script>

{@render children()}
