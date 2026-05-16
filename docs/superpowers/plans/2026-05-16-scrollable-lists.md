# Scrollable Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every list and table screen auto-scroll so the cursor stays visible when row count exceeds the available main-box height. Add an `n/total` position indicator in the bottom-right when the list overflows. Table headers stay pinned.

**Architecture:** Extend `VerticalSelect` (the single atom under every list/table) with viewport measurement (`measureElement` + `useStdout`), a `scrollOffset` state, an auto-follow effect that keeps the cursor inside the visible window, and an absolute-positioned position indicator. `TableSelect` gets a minor flex tweak so its header pins above the windowed area. `ListSelect` works automatically with no code change.

**Tech Stack:** Bun, TypeScript, React, Ink (`useInput`, `useStdout`, `measureElement`, `DOMElement`).

**Spec:** `docs/superpowers/specs/2026-05-16-scrollable-lists-design.md`

---

## File Structure

- **Modify:** `src/tui/components/atoms/VerticalSelect.tsx` — add viewport measurement state, scroll offset state, auto-follow effect, render a windowed slice (using real row index as key), render absolute-positioned `n/total` indicator.
- **Modify:** `src/tui/components/molecules/TableSelect.tsx` — add `flexGrow={1}` to the outer column box; add `flexShrink={0}` to the header box.
- **No change:** `src/tui/components/molecules/ListSelect.tsx`, `src/tui/components/molecules/ScrollableMain.tsx`, `src/tui/layouts/Default.tsx`, all screens.

Tests: this project has no Ink rendering tests by convention; all verification is manual via `bun run start`. Steps that would normally be "write failing test → implement → pass" are replaced with manual verification steps using a known-large dataset.

---

## Task 1: Add viewport measurement + windowed rendering to `VerticalSelect`

**Files:**
- Modify: `src/tui/components/atoms/VerticalSelect.tsx`

This task is the entire feature for list-only screens (`ListSelect`-based). After Task 1, lists like `OwnerList`/`AccountList`/`CategoryList` will auto-scroll. Tables still need Task 2 to pin the header.

- [ ] **Step 1: Read the current file**

Read `src/tui/components/atoms/VerticalSelect.tsx` end-to-end so the rewrite preserves cursor logic, `onHighlight` ref trick, `safeCursor` clamping, and `useInput` gating.

- [ ] **Step 2: Replace the file contents**

Replace the entire contents of `src/tui/components/atoms/VerticalSelect.tsx` with:

```tsx
import {
	Box,
	type DOMElement,
	measureElement,
	Text,
	useInput,
	useStdout,
} from "ink";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface VerticalSelectProps {
	rowCount: number;
	renderRow: (index: number, selected: boolean) => ReactNode;
	onChange: (index: number) => void;
	onHighlight?: (index: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
}

export function VerticalSelect({
	rowCount,
	renderRow,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
}: VerticalSelectProps): JSX.Element {
	const [cursor, setCursor] = useState(0);

	// Clamp cursor if rowCount shrinks below current cursor (e.g., after delete).
	const safeCursor = cursor >= rowCount ? Math.max(0, rowCount - 1) : cursor;

	// Surface cursor to parents via a ref so callers don't have to memoize
	// onHighlight. The ref always points at the latest closure; the effect only
	// re-runs when cursor or rowCount actually changes.
	const onHighlightRef = useRef(onHighlight);
	useEffect(() => {
		onHighlightRef.current = onHighlight;
	});

	useEffect(() => {
		if (rowCount > 0) {
			onHighlightRef.current?.(safeCursor);
		}
	}, [safeCursor, rowCount]);

	useInput(
		(input, key) => {
			if (rowCount === 0) {
				if ((key.escape || input === "q") && onCancel) onCancel();
				return;
			}

			if (key.upArrow) {
				setCursor((c) => (c > 0 ? c - 1 : rowCount - 1));
			} else if (key.downArrow) {
				setCursor((c) => (c < rowCount - 1 ? c + 1 : 0));
			} else if (key.return) {
				if (cursor < rowCount) onChange(cursor);
			} else if ((key.escape || input === "q") && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	const outerRef = useRef<DOMElement>(null);
	const [viewportHeight, setViewportHeight] = useState(0);

	const { stdout } = useStdout();
	const termRows = stdout?.rows ?? 0;
	const termCols = stdout?.columns ?? 0;

	// biome-ignore lint/correctness/useExhaustiveDependencies: termRows/termCols re-trigger measurement on resize
	useEffect(() => {
		if (!outerRef.current) return;
		setViewportHeight(measureElement(outerRef.current).height);
	}, [termRows, termCols]);

	const visibleRows = Math.max(1, viewportHeight);

	const [scrollOffset, setScrollOffset] = useState(0);

	useEffect(() => {
		setScrollOffset((o) => {
			if (safeCursor < o) return safeCursor;
			if (safeCursor >= o + visibleRows) return safeCursor - visibleRows + 1;
			return Math.min(o, Math.max(0, rowCount - visibleRows));
		});
	}, [safeCursor, visibleRows, rowCount]);

	const start = scrollOffset;
	const end = Math.min(rowCount, start + visibleRows);
	const overflowing = rowCount > visibleRows;

	return (
		<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
			<Box flexDirection="column" flexShrink={0}>
				{Array.from({ length: end - start }, (_, i) => {
					const idx = start + i;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: idx is the stable row id
						<Box key={idx}>{renderRow(idx, isActive && idx === safeCursor)}</Box>
					);
				})}
			</Box>
			{overflowing && (
				<Box position="absolute" bottom={0} right={0}>
					<Text dimColor>
						{safeCursor + 1}/{rowCount}
					</Text>
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`

Expected: clean exit, no errors.

- [ ] **Step 4: Lint**

Run: `bun run check`

Expected: clean exit (or only pre-existing warnings unrelated to this file).

- [ ] **Step 5: Manual smoke — list with overflow**

Pick or create a data dir containing a list known to exceed terminal height. The fastest path is an `OwnerList` or `AccountList` with many entries:

```bash
bun run start --data-dir ./data
```

Open a trip, then navigate to `Owners` (or any list-based screen — `Accounts`, `Categories`, `Currencies`, `Countries`, `Tags`). If none of those lists are long enough on real data, temporarily resize the terminal to 12 rows × 80 cols so even a short list overflows.

Verify:
- The cursor row is always visible. Pressing `↓` past the last visible row scrolls one row at a time.
- `n/total` appears in the bottom-right where `n` matches the highlighted row (1-indexed) and `total` is the row count.
- Pressing `↑` from the top wraps to the last row (existing behavior) and `scrollOffset` jumps to show the bottom of the list.
- `[tab]` to the menu — arrow keys no longer move the cursor; `n/total` stays.
- `[tab]` back — cursor and scroll resume.

- [ ] **Step 6: Manual smoke — list that fits**

In a normal-size terminal (e.g., 40+ rows), open a short list (`Owners` for a trip with 2–3 owners). Verify:
- No `n/total` indicator.
- Behavior is identical to before the change.

- [ ] **Step 7: Manual smoke — list that shrinks**

Open `Owners`, arm and confirm a delete (`[x]` twice) on the cursor row. Verify:
- Cursor stays on a valid row after the delete.
- `n/total` (if still overflowing) updates correctly.
- No empty space at the bottom while rows still exist above (this validates the `Math.min(o, Math.max(0, rowCount - visibleRows))` clamp).

- [ ] **Step 8: Commit**

```bash
git add src/tui/components/atoms/VerticalSelect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): window VerticalSelect rendering to keep cursor visible

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pin the header in `TableSelect`

**Files:**
- Modify: `src/tui/components/molecules/TableSelect.tsx`

After Task 1, `TableSelect` already scrolls its rows, but the header is part of a shrink-to-content column. We need the wrapper to claim full height so the windowed `VerticalSelect` has bounded space below the header, and the header itself must not shrink.

- [ ] **Step 1: Add `flexGrow={1}` to the outer column box**

In `src/tui/components/molecules/TableSelect.tsx`, find:

```tsx
return (
	<Box flexDirection="column">
		<Box>
			<Text bold>
				{"  "}
				{headers.map((h, i) => padCell(h, i)).join("")}
			</Text>
		</Box>
```

Replace with:

```tsx
return (
	<Box flexDirection="column" flexGrow={1}>
		<Box flexShrink={0}>
			<Text bold>
				{"  "}
				{headers.map((h, i) => padCell(h, i)).join("")}
			</Text>
		</Box>
```

(Only two attribute additions: `flexGrow={1}` on the outer box, `flexShrink={0}` on the header box. Nothing else changes.)

- [ ] **Step 2: Type check**

Run: `bun run check:type`

Expected: clean exit.

- [ ] **Step 3: Lint**

Run: `bun run check`

Expected: clean exit.

- [ ] **Step 4: Manual smoke — trip list overflow**

Create or use a `./data` directory with enough trips (≥ terminal-rows trips) that the trip list overflows. If real data is too short, resize the terminal to ~12 rows.

```bash
bun run start --data-dir ./data
```

Verify:
- Header row (`Name  Start  End  Days  Status`) stays fixed at the top of the main box while data rows scroll under it.
- Cursor row is always visible; pressing `↓` past the visible bottom scrolls.
- `n/total` shows in the bottom-right.
- Column alignment doesn't jitter as the window moves (this confirms `colWidths` is still computed across all rows, not the slice).

- [ ] **Step 5: Manual smoke — expense list overflow**

Open a trip with > 30 expenses (or resize the terminal small):

Verify:
- All `ExpenseList` columns (`Account Date Payee Category Amount Rate THB Owner #Tags`) header row stays pinned.
- Arm a delete: `[x]` twice on a row. Scroll the cursor away from the armed row. Confirm the armed hint in the main-box footer still shows.
- Cancel arming (`[esc]` or wait for re-press), then re-arm a different row to verify behavior remains stable.

- [ ] **Step 6: Manual smoke — trip duplicate / trip delete tables**

These were recently converted to tables. Navigate `Trips → [d]` (duplicate select) and `Trips → [x]` (delete). With an overflowing list:

Verify:
- Header pinned.
- Cursor visible.
- `n/total` correct.

- [ ] **Step 7: Manual smoke — table that fits**

In a normal terminal with a short trip list (1–2 trips):

Verify:
- No `n/total` indicator.
- Header rendered normally.
- Behavior identical to before.

- [ ] **Step 8: Manual smoke — terminal resize**

Open an overflowing list. While the cursor is near the bottom of the list, resize the terminal vertically smaller. Verify:
- Cursor stays visible (the auto-follow effect re-clamps).
- `n/total` updates.
- Header stays pinned.

Resize back to a tall terminal where the entire list fits. Verify:
- `n/total` disappears.
- All rows render.

- [ ] **Step 9: Commit**

```bash
git add src/tui/components/molecules/TableSelect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): pin TableSelect header above windowed rows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

**Spec coverage:**
- Architecture > Updated atom `VerticalSelect` → Task 1 Step 2 (full rewrite covers viewport measurement, `scrollOffset`, auto-follow effect, windowed slice with real-index keys, absolute-positioned `n/total` indicator, `Math.max(1, viewportHeight)` guard, `useStdout` resize trigger).
- Architecture > Updated molecule `TableSelect` → Task 2 Step 1 (`flexGrow={1}` outer, `flexShrink={0}` header).
- Architecture > `ListSelect` not touched → no task needed (works through `VerticalSelect`).
- Architecture > `ScrollableMain` / `Default.tsx` not touched → no task needed.
- Edge cases — empty list, first-render, resize, row count shrinks, armed row out of view, `isActive=false`, single-line assumption → all hit by manual smoke steps (Task 1 Step 5–7, Task 2 Step 4–8).
- Non-goals → no tasks added for them (no scroll keys, no PageUp/Down, no scrollbar, no multi-line handling, no `ScrollableMain` changes).

**Placeholder scan:** no TBD/TODO/"implement later"/"add appropriate handling". Code blocks are complete; commands include expected output where applicable.

**Type consistency:** `VerticalSelectProps`, `safeCursor`, `cursor`, `scrollOffset`, `viewportHeight`, `outerRef`, `visibleRows`, `start`, `end`, `overflowing` are introduced once in Task 1 Step 2 and referenced consistently. No mismatch between tasks. `TableSelect`'s prop signature is unchanged across tasks. Imports added in Task 1 (`DOMElement`, `measureElement`, `useStdout`, `Text`) match Ink's exported names (verified against existing usage in `ScrollableMain.tsx`).
