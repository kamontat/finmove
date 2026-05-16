# Expense List Sort — UI Refresh Design

**Date:** 2026-05-16
**Status:** Approved — ready for implementation plan
**Type:** UI refinement (no behavior changes outside layout + menu order)

## Problem

The current `/trips/expenses/sort` screen renders the picker indented below the slot list. The user wants the picker rendered to the **right** of the slot list, anchored to the selected slot's row, with a vertical `|` separator between columns. The screen retains the auto-save semantics already in place — no submit button, no draft mode.

Separately, the `ExpenseList` menu currently shows `[s] Sort` as the first item. The user wants the menu reordered to put Add first: `[a] Add  [s] Sort  [d] Duplicate  [x] Delete`.

## Goals

- Refactor the sort screen's render so the picker appears to the right of the slot list, anchored at the selected slot row, with a `|` separator extending through every rendered row.
- Drop `VerticalSelect` for the slot list — the two-column rendering doesn't fit `VerticalSelect`'s single-column model. Replace with a custom `↑↓` handler and direct row rendering.
- Reorder `ExpenseList`'s menu to `[a] Add  [s] Sort  [d] Duplicate  [x] Delete`.

## Non-Goals

- Changing save semantics (still auto-save).
- Reintroducing `[s] Apply` on the sort screen.
- Touching the core `sortExpenses` service, `useExpenseListSort` state shape, or `buildSortedHeaders`.
- Changing `SORT_HINTS` or `SORT_PICKER_HINTS` content.
- Reusing `Form.tsx` or extending `FormFieldConfig`.

## Architecture

### Layout

The screen renders one `<Box flexDirection="row">` containing two child columns.

**Left column** — fixed width, 5 slot rows plus filler rows when picker overflows past slot 5. Each row contains the slot label (or empty filler) followed by a uniform-width pad and a trailing ` |` separator.

**Right column** — rendered only when `picker !== null`. Anchored to slot row N via `marginTop = N`. Contains the picker options, each prefixed with `> ` if cursor is on it or `  ` otherwise.

The total number of rows rendered in the left column is:

```ts
const totalRows = picker
  ? Math.max(SLOT_COUNT, picker.slotIndex + picker.options.length)
  : SLOT_COUNT;
```

This ensures the `|` separator is present on every row that has picker content alongside, including overflow rows past slot 5.

### Visual examples

**Initial state** (no picker):

```
> 1. Date      ↓
  2. <not set>
  3. <not set>
  4. <not set>
  5. <not set>
```

(No `|` separator yet — picker is closed; left column renders solo.)

**Picker open for slot 1:**

```
  1. Date      ↓ | > <not set>
  2. <not set>   |   Date      ↓
  3. <not set>   |   THB       ↓
  4. <not set>   |   Account   ↑
  5. <not set>   |   Owner     ↑
                 |   Category  ↑
```

**Picker open for slot 3:**

```
  1. Date      ↓ |
  2. <not set>   |
  3. <not set>   | > <not set>
  4. <not set>   |   Date      ↓
  5. <not set>   |   THB       ↓
                 |   Account   ↑
                 |   Owner     ↑
                 |   Category  ↑
```

When the picker is open, the `>` cursor on the left disappears — focus is conceptually on the right column. The slot cursor index is still tracked internally so we know which slot the picker belongs to, but it's not rendered.

### Left-column width

The slot label has variable width (`"1. Date      ↓"` vs `"5. <not set>"`). To make the `|` separator vertically aligned, pad each rendered slot row to a uniform width.

The width is calculated once per render:

```ts
const leftWidth = Math.max(
  ...Array.from({ length: SLOT_COUNT }, (_, i) => {
    const slot = slots[i];
    const text = slot
      ? `${i + 1}. ${COLUMN_LABEL[slot.key]}  ${dirArrow(slot.dir)}`
      : `${i + 1}. <not set>`;
    return text.length;
  }),
);
```

Each row's text is `padEnd(text, leftWidth)`, then prefixed with `"> "` or `"  "` (the cursor gutter), then suffixed with ` |`.

Filler rows (when picker extends past slot 5) render as `"  " + " ".repeat(leftWidth) + " |"` — empty slot area with `|` separator.

### Interaction model

| Key | Where | Effect |
|---|---|---|
| `↑↓` | List mode (picker null) | Move slot cursor (no wrap or wrap — match existing `VerticalSelect` behavior which wraps; preserve that) |
| `Enter` | List mode | Open picker for highlighted slot. Cursor conceptually moves to picker (left `>` disappears, right `>` appears at first picker option). `focus = "input"`. |
| `Space` | List mode | Toggle direction of highlighted slot. No-op when slot is `null`. Commits to context immediately. |
| `↑↓` | Picker mode | Move picker cursor (with wrap). |
| `Space` | Picker mode | Toggle direction of highlighted column option. Local to picker state — commits only on Enter. |
| `Enter` | Picker mode | Commit choice to slot, close picker, `focus = "main"`. |
| `q`/`esc` | Picker mode | Close picker without committing local direction toggles. `focus = "main"`. |
| `q`/`esc` | List mode | Handled by `useGlobalKeys` → `goBack()`. |
| `e` | Anywhere not "input" | Exit (global). |

This matches the current implementation's key behavior — only the rendering changes.

### `VerticalSelect` removal

The current screen renders `<VerticalSelect>` for the slot list with `onChange`, `onHighlight`, `isActive`. With the two-column layout, the slot list rows are interleaved with right-column rows (via the row-count loop), so `VerticalSelect`'s single-column rendering doesn't fit.

Replace with:
- A `slotCursor` `useState` initialized to 0.
- A list-mode `useInput` (gated `focus === "main" && picker === null`) handling `↑↓` (wrap), `Enter` (call `openPicker(slotCursor)`), `Space` (call `toggleSlotDir`).

Picker-mode `useInput` stays as-is.

### `ExpenseList` menu order

Update `src/tui/screens/ExpenseList.tsx` so the menu options array order becomes:

```ts
setMenu(
    [
        { label: "Add", value: "add", key: "a" },
        { label: "Sort", value: "sort", key: "s" },
        ...(hasExpenses
            ? [
                    /* Duplicate, Delete entries as before */
                ]
            : []),
    ],
```

The dispatch handler is unchanged — only the array order differs.

## Files

**Modified:**
- `src/tui/screens/ExpenseListSort.tsx` — rewrite the render block for two-column layout; drop `VerticalSelect`; add `slotCursor` state and list-mode `useInput`. No changes to picker state, key handlers' semantics, or the encode/decode of slots.
- `src/tui/screens/ExpenseList.tsx` — swap order of `Sort` and `Add` menu entries.

**No changes:**
- `src/core/services/expense/sortExpenses.ts` and tests
- `src/tui/states/expenseListSort.tsx`
- `src/tui/router.ts`, `src/tui/App.tsx`, `src/tui/models/index.ts`
- `src/tui/constants/hints.ts` (`SORT_HINTS` and `SORT_PICKER_HINTS` already match auto-save semantics)
- `src/core/services/expense/index.ts`

## Behavior Invariants to Preserve

- Default sort `Date ↓` still active on first entry.
- Auto-save: every Space-in-view, Enter-in-picker writes to context immediately.
- `q`/`esc` from sort screen returns to expense list with whatever sort the user has built (no revert).
- Picker contents rule unchanged: `<not set>` first, then current slot's column (if set, preserving direction), then columns not in any other slot.
- `ExpenseList` header indicator still appends arrow + subscript correctly.
- All three `rowIndex → sortedExpenses[i]` lookups in `ExpenseList` unchanged.
- Empty expense list still shows "No expenses yet." and the menu still includes `[s] Sort` (and now `[a] Add` first).

## Verification

- `bun run check:type`
- `bun run check`
- `bun test`
- Manual smoke:
  - Open expense list → menu reads `[a] Add  [s] Sort  [d] Duplicate  [x] Delete` (last two only when expenses exist).
  - Press `[s]` → sort screen opens. 5 slot rows, slot 1 = `Date ↓`, cursor `>` on slot 1.
  - Press `↑↓` → cursor moves between slots; no picker visible.
  - Press `Space` on slot 1 → slot becomes `Date ↑`. Left cursor still on slot 1.
  - Press `Enter` on slot 1 → picker opens to the RIGHT, anchored at slot 1's row. `|` separator runs down all rows. Left `>` is gone; right `>` is on first picker option (slot 1's current column, `Date ↑`).
  - Navigate picker with `↑↓` → picker cursor moves.
  - Press `Space` on a column option → option's direction flips locally (visible immediately but not committed).
  - Press `Enter` → slot 1 updates to that column + direction. Picker closes. Left cursor returns to slot 1.
  - Press `Enter` on slot 3 → picker opens, anchored at slot 3's row. Slot 1's column is excluded from the picker.
  - Press `q` or `esc` in picker → picker closes without commit. Slot 3 unchanged.
  - Press `q` in list mode → returns to expense list. Sort applied.
  - Pick a column whose default extends the picker past slot 5: `|` separator still renders on overflow rows.

## Risk

Low.

- Pure rendering refactor — no new state, no new core logic, no behavior changes.
- Custom `↑↓` handler replaces `VerticalSelect`; needs to match existing wrap behavior (already specified above).
- The `marginTop` anchor + uniform-width padding pattern is standard Ink layout — no novel techniques.
