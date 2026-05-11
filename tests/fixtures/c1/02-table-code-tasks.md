# Sprint snapshot

A rich-structure document to stress the markdown round-trip.

## Phase status

| Phase | Owner    | Status     | ETA     |
| ----- | -------- | ---------- | ------- |
| 0     | Matheo   | Done       | 2026-04 |
| 1     | Matheo   | Done       | 2026-04 |
| 2     | Claude   | Done       | 2026-04 |
| 3     | Claude   | Done       | 2026-05 |
| 4     | Claude   | Done       | 2026-05 |
| 5     | Both     | In review  | 2026-05 |

## Code samples

### TypeScript

```typescript
import { BlockNoteEditor } from '@blocknote/core';

export function makeEditor(root: HTMLElement, body: string) {
	const editor = BlockNoteEditor.create();
	editor.mount(root);
	editor.tryParseMarkdownToBlocks(body);
	return editor;
}
```

### Plain block (no language)

```
Just some plain pre-formatted text.
No syntax highlighting needed here.
Should round-trip as a code block.
```

## Open todos

- [x] Fix slash menu double-render
- [x] Atomic openFile + requestId guard
- [x] Bound app height + overlay scrollbars
- [x] Investigate BlockNote vanilla API
- [ ] Round-trip 3 fixture files
- [ ] Decide on migration go / no-go
- [ ] Migrate Editor.svelte
  - [x] Read existing wiring
  - [ ] Replace mount logic
  - [ ] Adapt frontmatter handling

## Reminder block

> Crepe's drag-handle was decorative — no ProseMirror handler attached.
> BlockNote's `SideMenu` plugin emits `{ block, position }` and owns
> the drag-and-drop transaction natively. **That's the win.**

## End

That's the rich fixture.
