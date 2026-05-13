/**
 * Frontmatter YAML parser/serializer — pure data layer.
 *
 * Wraps `js-yaml` with a `ParseResult` discriminated union so callers don't
 * have to deal with thrown errors and don't accidentally treat a string or
 * array root as valid frontmatter. Frontmatter is, by convention, a YAML
 * mapping at the top level (`key: value`); anything else (a bare scalar,
 * a top-level sequence) is rejected with a readable message and the raw
 * input is preserved so the UI can fall back to a raw-text editor without
 * losing the user's data.
 *
 * Empty / whitespace-only input parses to `{}` rather than failing — that's
 * the natural representation of "this file has frontmatter delimiters but no
 * keys yet" and avoids forcing every consumer to special-case the empty case.
 */
import yaml from 'js-yaml';

export type ParseResult =
	| { ok: true; data: Record<string, unknown> }
	| { ok: false; error: string; raw: string };

/**
 * Plain-object check that rejects arrays, Dates, null and class instances.
 * We intentionally accept only POJOs since frontmatter is a key/value map;
 * exotic shapes coming back from `yaml.load` (e.g. !!set, !!omap) would
 * confuse the structured editor and round-trip badly.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false;
	if (Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === null || proto === Object.prototype;
}

export function parseFrontmatter(input: string): ParseResult {
	// Empty / whitespace-only is a valid "no keys yet" state.
	if (input.trim() === '') {
		return { ok: true, data: {} };
	}

	let parsed: unknown;
	try {
		parsed = yaml.load(input);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { ok: false, error: message, raw: input };
	}

	// `yaml.load` on input that's just comments or `---` may yield undefined
	// or null — treat both as an empty object so the structured editor opens
	// to a clean form rather than an error state.
	if (parsed === undefined || parsed === null) {
		return { ok: true, data: {} };
	}

	if (!isPlainObject(parsed)) {
		return {
			ok: false,
			error:
				'Frontmatter must be a YAML mapping (key: value pairs) at the top level.',
			raw: input
		};
	}

	return { ok: true, data: parsed };
}

export function serializeFrontmatter(data: Record<string, unknown>): string {
	// `lineWidth: -1` disables line wrapping so long values (URLs, sentences)
	// stay on a single line — wrapping in frontmatter is technically valid
	// but reads badly and breaks naive grep-based tools.
	//
	// `sortKeys: false` preserves insertion order so the user's mental model
	// of "key X is the second one I added" survives a round-trip.
	//
	// `forceQuotes: false` (default) lets js-yaml pick the cleanest
	// representation per value — we don't want every string wrapped in
	// double quotes, which is what `forceQuotes: true` would do.
	//
	// `noRefs: true` prevents YAML anchors/aliases from leaking out when
	// two object subtrees happen to be reference-equal — they'd round-trip
	// fine but look like cryptic `&a0` / `*a0` to the user.
	return yaml.dump(data, {
		lineWidth: -1,
		sortKeys: false,
		forceQuotes: false,
		noRefs: true
	});
}
