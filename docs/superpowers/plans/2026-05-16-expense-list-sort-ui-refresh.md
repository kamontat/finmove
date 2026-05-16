# Expense List Sort UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sort screen to render the picker to the right of the slot list (anchored to the selected slot's row with a `|` separator), drop `VerticalSelect` in favor of a custom row-render loop, and reorder the `ExpenseList` menu so Add is first.

**Architecture:** One `<Box flexDirection="row">` in `ExpenseListSort`. Left column renders `max(SLOT_COUNT, picker.slotIndex + picker.options.length)` rows of uniform width plus `|` separator. Right column renders the picker only when open, with `marginTop={picker.slotIndex}` anchoring its first row to the selected slot. Slot navigation handled by a screen-level `useInput` keyed on `picker === null`. No core or state changes.

**Tech Stack:** Bun runtime, TypeScript, React + Ink TUI. Biome for lint/format. `bun:test`.

**Reference spec:** `docs/superpowers/specs/2026-05-16-expense-list-sort-ui-refresh-design.md`

---

## File Map

- **Modify** `src/tui/screens/ExpenseList.tsx` — swap order of `Sort` and `Add` in the menu options array. No handler changes.
- **Modify** `src/tui/screens/ExpenseListSort.tsx` — full rewrite of the render block and slot navigation. Drop `VerticalSelect` import; replace with custom `↑↓` handler in the view-mode `useInput`. Drop `renderSlotRow` and `renderPicker` helpers; inline a two-column layout. Picker state/keys/encoding logic unchanged.

## Verification commands (used throughout)

- Type check: `bun run check:type`
- Lint: `bun run check`
- Tests: `bun test`
- App (manual smoke): `bun run start --data-dir ./data`

Run `check:type`, `check`, and `bun test` after every task. If `bun run check` reports formatting differences, run `bun run fix` and re-check before committing.

---

### Task 1: Reorder `ExpenseList` menu

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx` (the `setMenu` call around line 194)

- [ ] **Step 1: Swap menu entry order**

In `src/tui/screens/ExpenseList.tsx`, locate the `setMenu([...], handler)` call inside the existing `useEffect` that registers the menu. The current array starts:

```ts
setMenu(
    [
        { label: "Sort", value: "sort", key: "s" },
        { label: "Add", value: "add", key: "a" },
        ...(hasExpenses
            ? [
                    /* Duplicate and Delete entries */
                ]
            : []),
    ],
```

Change the first two entries so `Add` comes before `Sort`:

```ts
setMenu(
    [
        { label: "Add", value: "add", key: "a" },
        { label: "Sort", value: "sort", key: "s" },
        ...(hasExpenses
            ? [
                    /* Duplicate and Delete entries — unchanged */
                ]
            : []),
    ],
```

No other code changes — the handler `(value) => { ... }` already dispatches both `"sort"` and `"add"` correctly.

- [ ] **Step 2: Verify**

Run:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass.

- [ ] **Step 3: Manual smoke**

Run `bun run start --data-dir ./data`. Open a trip with expenses.

Verify the menu reads in this order, left to right: `[a] Add  [s] Sort  [d] Duplicate  [x] Delete`. When the trip has no expenses, only `[a] Add  [s] Sort` should appear.

Quit with `[e]`.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "$(cat <<'EOF'
feat(tui): reorder expense list menu — Add before Sort

[a] Add now precedes [s] Sort in the menu bar so the primary action
sits first. Handler dispatch unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Two-column sort screen render

**Files:**
- Modify: `src/tui/screens/ExpenseListSort.tsx` (full rewrite of render block + slot-nav `useInput`)

- [ ] **Step 1: Replace the file body below `initialPickerCursor`**

Open `src/tui/screens/ExpenseListSort.tsx`. The top of the file — imports, `COLUMN_ORDER`, `COLUMN_LABEL`, `DEFAULT_DIR`, `dirArrow`, `PickerOption`, `PickerState`, `buildPickerOptions`, `initialPickerCursor` — stays exactly as-is.

Replace the entire `export function ExpenseListSort` and everything below it with:

```tsx
export function ExpenseListSort(): JSX.Element {
	const { trip } = useData();
	const { slots, setSlots } = useExpenseListSort();
	const { focus, setFocus } = useFocus();
	const { setTitle, clearTitle, setHints, setColor } = useLayout();
	const { setMenu } = useMenu();

	const [slotCursor, setSlotCursor] = useState(0);
	const [picker, setPicker] = useState<PickerState | null>(null);

	useEffect(() => {
		setTitle(tripTitle(trip, "Expenses", "Sort by"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		setMenu([], () => {});
		setHints(picker ? SORT_PICKER_HINTS : SORT_HINTS);
	}, [setColor, setMenu, setHints, picker]);

	function openPicker(slotIndex: number) {
		const options = buildPickerOptions(slots, slotIndex);
		const cursor = initialPickerCursor(options, slots[slotIndex] ?? null);
		setPicker({ slotIndex, options, cursor });
		setFocus("input");
	}

	function closePicker() {
		setPicker(null);
		setFocus("main");
	}

	function commitPicker() {
		if (!picker) return;
		const choice = picker.options[picker.cursor];
		if (!choice) {
			closePicker();
			return;
		}
		const next: Slot[] = [...slots];
		next[picker.slotIndex] =
			choice.kind === "unset" ? null : { key: choice.key, dir: choice.dir };
		setSlots(next);
		closePicker();
	}

	function togglePickerDir() {
		if (!picker) return;
		const opt = picker.options[picker.cursor];
		if (!opt || opt.kind !== "column") return;
		const newOptions = [...picker.options];
		newOptions[picker.cursor] = {
			kind: "column",
			key: opt.key,
			dir: opt.dir === "asc" ? "desc" : "asc",
		};
		setPicker({ ...picker, options: newOptions });
	}

	function toggleSlotDir() {
		const slot = slots[slotCursor];
		if (!slot) return;
		const next: Slot[] = [...slots];
		next[slotCursor] = {
			key: slot.key,
			dir: slot.dir === "asc" ? "desc" : "asc",
		};
		setSlots(next);
	}

	// View-mode input: ↑↓ navigate slots, Enter opens picker, Space toggles dir.
	useInput(
		(input, key) => {
			if (key.upArrow) {
				setSlotCursor((c) => (c > 0 ? c - 1 : SLOT_COUNT - 1));
			} else if (key.downArrow) {
				setSlotCursor((c) => (c < SLOT_COUNT - 1 ? c + 1 : 0));
			} else if (key.return) {
				openPicker(slotCursor);
			} else if (input === " ") {
				toggleSlotDir();
			}
		},
		{ isActive: focus === "main" && picker === null },
	);

	// Picker-mode input: ↑↓ navigate options, Space toggles local dir,
	// Enter commits, q/esc cancels.
	useInput(
		(input, key) => {
			if (!picker) return;
			if (input === " ") {
				togglePickerDir();
			} else if (key.upArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor > 0 ? picker.cursor - 1 : picker.options.length - 1,
				});
			} else if (key.downArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor < picker.options.length - 1 ? picker.cursor + 1 : 0,
				});
			} else if (key.return) {
				commitPicker();
			} else if (key.escape || input === "q") {
				closePicker();
			}
		},
		{ isActive: focus === "input" && picker !== null },
	);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	// Compute uniform width for slot labels so the `|` separator aligns.
	const slotLabels = Array.from({ length: SLOT_COUNT }, (_, i) => {
		const slot = slots[i];
		return slot
			? `${i + 1}. ${COLUMN_LABEL[slot.key]}  ${dirArrow(slot.dir)}`
			: `${i + 1}. <not set>`;
	});
	const leftWidth = Math.max(...slotLabels.map((l) => l.length));

	// Total rows = max of slot count and picker bottom (slotIndex + options.length).
	const totalRows = picker
		? Math.max(SLOT_COUNT, picker.slotIndex + picker.options.length)
		: SLOT_COUNT;

	function renderLeftRow(i: number): JSX.Element {
		const slot = i < SLOT_COUNT ? slots[i] : undefined;
		const isSlotRow = i < SLOT_COUNT;
		const showCursor = picker === null && i === slotCursor;
		const label = isSlotRow ? (slotLabels[i] ?? "") : "";
		const padded = label.padEnd(leftWidth);
		const dim = isSlotRow && slot === null;
		const showSeparator = picker !== null;
		const trailing = showSeparator ? " |" : "";
		return (
			<Text
				// biome-ignore lint/suspicious/noArrayIndexKey: index is stable here
				key={i}
				{...(dim ? { dimColor: true } : {})}
				inverse={showCursor}
			>
				{showCursor ? "> " : "  "}
				{padded}
				{trailing}
			</Text>
		);
	}

	function renderPickerColumn(): JSX.Element | null {
		if (!picker) return null;
		return (
			<Box flexDirection="column" marginLeft={1} marginTop={picker.slotIndex}>
				{picker.options.map((opt, idx) => {
					const selected = idx === picker.cursor;
					const text =
						opt.kind === "unset"
							? "<not set>"
							: `${COLUMN_LABEL[opt.key]}  ${dirArrow(opt.dir)}`;
					return (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: index is stable here
							key={idx}
							inverse={selected}
							{...(opt.kind === "unset" ? { dimColor: true } : {})}
						>
							{selected ? "> " : "  "}
							{text}
						</Text>
					);
				})}
			</Box>
		);
	}

	return (
		<Box flexDirection="row">
			<Box flexDirection="column">
				{Array.from({ length: totalRows }, (_, i) => renderLeftRow(i))}
			</Box>
			{renderPickerColumn()}
		</Box>
	);
}
```

Notes on the rewrite:
- The top-of-file helpers (imports, `COLUMN_ORDER`, `COLUMN_LABEL`, `DEFAULT_DIR`, `dirArrow`, `PickerOption`, `PickerState`, `buildPickerOptions`, `initialPickerCursor`) are unchanged. Only the function body is rewritten.
- `VerticalSelect` is no longer used — the import should be deleted in Step 2 below.
- The two old helpers `renderSlotRow` and `renderPicker` are replaced by `renderLeftRow` and `renderPickerColumn` with the new layout semantics.

- [ ] **Step 2: Remove the now-unused `VerticalSelect` import**

In the imports at the top of `src/tui/screens/ExpenseListSort.tsx`, delete this line:

```ts
import { VerticalSelect } from "../components/atoms/VerticalSelect";
```

If Biome's organize-imports flags any other unused imports after the rewrite, let `bun run fix` handle them.

- [ ] **Step 3: Verify**

Run:
```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. If `bun run check` complains:
- Formatting differences in `ExpenseListSort.tsx` → run `bun run fix`.
- Unused-import warnings → ensure `VerticalSelect` import is removed.
- Any other lint errors → read and address before proceeding.

- [ ] **Step 4: Manual smoke**

Run `bun run start --data-dir ./data`. Open a trip with expenses. Press `[s]`.

Walk through each:

1. **Initial render** — 5 slot rows, slot 1 = `Date  ↓`, slots 2–5 = `<not set>` (dim). Cursor `>` on slot 1. No picker, no `|` separator yet.
2. **↑↓ navigation** — moves cursor between slots. Wraps from 5 → 1 and 1 → 5.
3. **Space on set slot** — `Date ↓` → `Date ↑` and back. Immediate commit (no picker opens).
4. **Space on `<not set>` slot** — no-op.
5. **Enter on slot 1** — picker opens to the right of the slot list, first option aligned with slot 1's row (top). `|` separator appears on all 5 slot rows and any picker overflow rows. Left `>` cursor disappears; right `>` cursor on first picker option (the slot's current column).
6. **Picker `↑↓`** — moves picker cursor; wraps top↔bottom.
7. **Picker Space** — flips direction of highlighted column option locally (visible, not yet committed).
8. **Picker Enter** — slot updates to chosen column+direction; picker closes; left `>` cursor returns to slot 1.
9. **Enter on slot 3** — picker opens anchored at slot 3's row. Slot 1's column is hidden from the picker (now in another slot).
10. **Picker extends past slot 5** — set slot 1 to `Date`, slot 2 to `THB`, then `Enter` on slot 5. Picker shows `<not set>`, slot 5's column if any, then remaining (`Account`, `Owner`, `Category`). When the picker's bottom row goes past slot row 5, the `|` separator extends down through those overflow rows. The left column should be blank below slot 5 (no slot label) but the separator should still render.
11. **Picker q/esc** — picker closes without committing local direction toggles.
12. **List q/esc** — returns to expense list. Sort state preserved.

Verify the expense list menu now reads `[a] Add  [s] Sort  [d] Duplicate  [x] Delete` (from Task 1).

Quit with `[e]`.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/ExpenseListSort.tsx
git commit -m "$(cat <<'EOF'
feat(tui): two-column sort screen with right-anchored picker

Render the picker to the right of the slot list, anchored to the
selected slot's row via marginTop. A vertical `|` separator extends
through every rendered row, including overflow when the picker is
taller than the slot list. Drop VerticalSelect — the interleaved
two-column layout needs a custom row loop and a screen-level useInput
for slot ↑↓/Enter/Space.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

After completing both tasks, confirm against `docs/superpowers/specs/2026-05-16-expense-list-sort-ui-refresh-design.md`:

- [ ] `ExpenseList` menu order: `Add`, `Sort`, then `Duplicate` + `Delete` when expenses exist.
- [ ] Sort screen renders `<Box flexDirection="row">` with two columns.
- [ ] Left column renders `max(SLOT_COUNT, picker.slotIndex + picker.options.length)` rows.
- [ ] Left column rows padded to uniform `leftWidth`, then ` |` suffix WHEN picker is open.
- [ ] Cursor `>` rendered on left column only when `picker === null`.
- [ ] Right column rendered only when `picker !== null`; uses `marginTop={picker.slotIndex}`.
- [ ] Right column shows `<not set>` first, then slot's current column (if set), then unused columns.
- [ ] `Space` in view mode toggles direction of highlighted slot (immediate commit). No-op on null slot.
- [ ] `Space` in picker mode toggles direction of highlighted column option locally; commits on Enter.
- [ ] `↑↓` wraps in both view mode and picker mode.
- [ ] `Enter` in view mode opens picker; in picker mode commits.
- [ ] `q`/`esc` in picker mode closes without committing; in view mode goes back via `useGlobalKeys` (no extra revert behavior in the screen).
- [ ] `VerticalSelect` import removed from `ExpenseListSort.tsx`.
- [ ] `bun run check:type`, `bun run check`, `bun test` all green.
- [ ] All 12 manual smoke checks under Task 2 Step 4 pass.

If anything fails, fix it before declaring done.
