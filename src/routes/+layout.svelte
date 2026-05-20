<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { bindCommandKeymap } from '$lib/commands/keymap';
	import { registerAppCommands, APP_KEYMAP } from '$lib/commands/catalog';
	import { recentCommandsStore } from '$lib/commands/recent.svelte';
	import { recentFilesStore } from '$lib/stores/recentFiles.svelte';
	import { vaultTreeStore } from '$lib/stores/vaultTree.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children } = $props();

	// Root-level wiring for the command system. Runs once at app boot:
	// hydrates the MRU stores from localStorage, registers the catalog,
	// binds the global shortcuts. The $effect cleanup unbinds tinykeys
	// handlers on tear-down (HMR-friendly).
	$effect(() => {
		recentCommandsStore.hydrate();
		recentFilesStore.hydrate();
		registerAppCommands();
		return bindCommandKeymap(APP_KEYMAP);
	});

	// Keep the palette's file tree in sync with the active vault — re-scan
	// on every vault switch. Sidebar scans its own tree separately; both
	// surfaces walk the directory independently for now.
	$effect(() => {
		const id = vaultsStore.activeVaultId;
		// Read it so the effect re-runs when the active vault changes;
		// `refresh()` re-reads inside.
		void id;
		void vaultTreeStore.refresh();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Markus</title>
</svelte:head>

{@render children()}

<ToastContainer />
