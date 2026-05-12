<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { bindCommandKeymap } from '$lib/commands/keymap';
	import { registerSeedCommands, SEED_KEYMAP } from '$lib/commands/seedCommands';

	let { children } = $props();

	// Root-level wiring for the command system. Runs once at app boot:
	// registers the seed commands in the registry and binds their global
	// shortcuts. The $effect cleanup unbinds tinykeys handlers when the
	// root unmounts (HMR / tear-down scenarios).
	$effect(() => {
		registerSeedCommands();
		return bindCommandKeymap(SEED_KEYMAP);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Markhub</title>
</svelte:head>

{@render children()}
