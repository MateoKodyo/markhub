<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { bindCommandKeymap } from '$lib/commands/keymap';
	import { registerAppCommands, APP_KEYMAP } from '$lib/commands/catalog';
	import { recentCommandsStore } from '$lib/commands/recent.svelte';

	let { children } = $props();

	// Root-level wiring for the command system. Runs once at app boot:
	// hydrates the recent-commands MRU from localStorage, registers the
	// catalog in the registry, binds the global shortcuts. The $effect
	// cleanup unbinds tinykeys handlers on tear-down (HMR-friendly).
	$effect(() => {
		recentCommandsStore.hydrate();
		registerAppCommands();
		return bindCommandKeymap(APP_KEYMAP);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Markhub</title>
</svelte:head>

{@render children()}
