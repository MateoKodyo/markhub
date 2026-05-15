// Pure path utilities — POSIX-style ('/' separator) to match relative paths
// returned by the Rust scan_vault. NOT a full path library — only what the UI needs.

export function joinPath(...parts: string[]): string {
	return parts
		.filter((p) => p.length > 0)
		.map((p, i) =>
			i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+/, '').replace(/\/+$/, '')
		)
		.filter((p) => p.length > 0)
		.join('/');
}

export function getParentPath(path: string): string {
	const i = path.lastIndexOf('/');
	return i >= 0 ? path.substring(0, i) : '';
}

export function getFileName(path: string): string {
	const i = path.lastIndexOf('/');
	return i >= 0 ? path.substring(i + 1) : path;
}

export function getFileNameWithoutExt(path: string): string {
	const name = getFileName(path);
	const i = name.lastIndexOf('.');
	// Use `> 0` so dotfiles like ".env" keep their full name.
	return i > 0 ? name.substring(0, i) : name;
}
