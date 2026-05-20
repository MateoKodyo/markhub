<script lang="ts">
	/**
	 * Switch — a small labelled toggle. Track + sliding knob, accent-filled
	 * when on. The whole row (track + label) is the click target.
	 */
	let {
		checked,
		label,
		onchange
	}: {
		checked: boolean;
		label: string;
		onchange: (next: boolean) => void;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	class="switch"
	onclick={() => onchange(!checked)}
>
	<span class="switch-track" class:is-on={checked}>
		<span class="switch-knob"></span>
	</span>
	<span class="switch-label">{label}</span>
</button>

<style>
	.switch {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 3px var(--space-2);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
		transition: color var(--duration-base) var(--easing-standard);
	}

	.switch:hover {
		color: var(--color-text-primary);
	}

	.switch:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	.switch-track {
		position: relative;
		flex-shrink: 0;
		width: 28px;
		height: 16px;
		border-radius: 999px;
		background: var(--color-surface-active);
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.switch-track.is-on {
		background: var(--color-accent);
	}

	.switch-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-text-primary);
		transition: transform var(--duration-base) var(--easing-standard);
	}

	.switch-track.is-on .switch-knob {
		transform: translateX(12px);
	}
</style>
