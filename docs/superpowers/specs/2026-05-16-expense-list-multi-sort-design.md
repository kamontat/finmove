# Expense List Multi-Level Sort — Design

**Date:** 2026-05-16
**Status:** Approved — ready for implementation plan
**Type:** New feature (TUI screen + core service + session state)

## Problem

`src/tui/screens/ExpenseList.tsx` renders `trip.expenses` in YAML insertion order. There is no way to sort the list. Users want to sort by date, THB amount, account, owner, or category — and combine multiple keys so that, for example, expenses on the same date are then ordered by account.

## Goals

- Add a multi-level sort to the expense list, up to 5 levels.
- Sort state is **session-scoped**: persists across navigation within a run, resets when the app restarts. No disk writes.
- Sort is configured on a dedicated screen at `/trips/expenses/sort`, reached via a new `[s] Sort` menu entry on the expense list.
- The sort screen uses a **fixed 5-slot** model — one row per sort priority (1–5). Each slot is either a column with a direction or `<not set>`. Slots are independent: unset slots in the middle are simply skipped when sorting.
- Sort algorithm lives in `src/core/services/expense/sortExpenses.ts` — pure, unit-testable, no UI dependencies.
- Sortable columns: **Date, THB, Account, Owner, Category**. (Amount, Rate, Payee, #Tags are not sortable.)
- Default sort: slot 1 = `Date ↓` (newest first), slots 2–5 = `<not set>`.
- The sorted column(s) get an arrow indicator in the table header; with 2+ active sorts, each also shows a subscript priority digit by *position among set slots* (so holes don't appear in the numbering).

## Non-Goals

- Persisting sort to disk (per-trip or global). Not needed yet — revisit if users request it.
- Sorting by Amount (original currency), Rate, Payee, or #Tags.
- Filtering or searching.
- Per-column color/styling beyond the arrow indicator.
- Letting the same column appear in two slots.
- Auto-shifting slots when one is cleared. Holes are allowed and skipped at sort time.
- Reordering by swap. Slot priority comes from slot index; to reorder, edit the slots.
- Touching `ExpenseDuplicateSelect.tsx` beyond a signature update on `buildExpenseListRows`.

## Architecture

### Session state (`src/tui/states/expenseListSort.tsx`)

New provider, same pattern as `useFocus`, `useMenu`, `useLayout`.

```ts
export type SortKey = "date" | "thb" | "account" | "owner" | "category";
export type SortDir = "asc" | "desc";
export type Slot = { key: SortKey; dir: SortDir } | null;

export const SLOT_COUNT = 5;

export const DEFAULT_SLOTS: Slot[] = [
  { key: "date", dir: "desc" },
  null,
  null,
  null,
  null,
];

interface ExpenseListSortContext {
  slots: Slot[];          // length always === SLOT_COUNT
  setSlots: (next: Slot[]) => void;
}
```

Exposed hook: `useExpenseListSort()`. Provider mounted in `App.tsx` alongside the other state providers (inside `FormBufferProvider`, outside `NavigationProvider`).

Helper exports for downstream consumers:

```ts
export function activeSlots(slots: Slot[]): { key: SortKey; dir: SortDir }[] {
  return slots.filter((s): s is { key: SortKey; dir: SortDir } => s !== null);
}
```

### Sort service (`src/core/services/expense/sortExpenses.ts`)

```ts
type SortLevel = { key: SortKey; dir: SortDir };

export function sortExpenses(
  expenses: Expense[],
  trip: Trip,
  levels: SortLevel[],
): Expense[]
```

The service accepts a *compacted* `SortLevel[]` (nulls already filtered out). The screen layer is responsible for calling `activeSlots(slots)` before invoking `sortExpenses`. This keeps core untyped on the slot shape and easy to test.

Behavior:

- Returns a new array; does not mutate input.
- Empty `levels` → returns a shallow copy preserving insertion order.
- Builds one comparator per level; first non-zero result wins.
- Final tiebreak: original insertion index (stable sort).
- Per-key extractors:
  - **date** → string `YYYY-MM-DD` lex compare.
  - **thb** → number using the same conversion rule as `buildExpenseListRows`:
    - `currency === "THB"` → `amount`.
    - else → `convertToTHB(amount, currency, exchangeRate, tripRate)` when a rate exists.
    - else → `null` (missing rate). `null` always sorts **last** regardless of direction (treated as +∞).
  - **account** → account name (case-insensitive) from `trip.accounts.find(a => a.id === e.accountId)?.name`; falls back to `e.accountId` if account is missing.
  - **owner** → tuple `[ownersCount, firstOwnerInitialsLowercased]`.
    - `ownersCount` = `e.owners.length`.
    - `firstOwnerInitialsLowercased` = initials of the first listed owner (computed via `computeInitials(trip.owners.map(o => o.name))`), lowercased. Falls back to lowercased owner name, then owner id. Empty string when `owners` is empty.
    - Both tuple elements respect direction.
  - **category** → case-insensitive string compare on `e.category`.

Exported from `src/core/services/expense/index.ts`.

### Tests (`src/core/services/expense/__tests__/sortExpenses.test.ts`)

Coverage:

- Each key, each direction → expected order on a small fixture.
- Stable tiebreak: equal-key rows preserve original index.
- Multi-level chain (Date desc, then Account asc).
- THB sort with mixed currencies including a row with missing rate — verify missing row goes last in both directions.
- Owner sort: rows with 0, 1, and 2 owners; verify tuple ordering.
- Owner sort with two rows sharing owner count, different first owners → secondary tiebreak.
- Empty `levels` → returns insertion order copy.
- Empty `expenses` → returns empty array.

### Sort screen (`src/tui/screens/ExpenseListSort.tsx`)

Replaces main box at `/trips/expenses/sort`. **No menu** is registered. All keys are handled directly by the screen and surfaced via the hint bar.

**View mode** (default, `focus === "main"`):

```
Trips / Bali 2026 / Expenses / Sort by

  1. Date     ↓
> 2. <not set>
  3. <not set>
  4. <not set>
  5. <not set>
```

- Exactly 5 rows, one per slot index. Set slots render as `N. Column   arrow`; unset render as `N. <not set>` (dim color).
- Cursor (`>`) starts on slot 1 when the screen mounts.

**Keys (view mode)**:

| Key            | Behavior |
|----------------|----------|
| `↑` / `↓`      | Move cursor across the 5 slots (no wrap). |
| `Enter`        | Open the inline picker for the highlighted slot. |
| `Space`        | Toggle direction of the highlighted slot. No-op on `<not set>` rows. |
| `s`            | Apply (sort is already committed to context on every edit — `[s]` simply `goBack()`s). |
| `q` / `esc`    | Cancel — revert `slots` to the value captured on mount, then `goBack()`. |
| `e`            | Exit (global, unchanged). |

**Hints** (new constant `SORT_HINTS` in `src/tui/constants/hints.ts`):

```
[↑↓] Navigate  [Enter] Edit  [Space] Direction  [s] Apply  [q/esc] Cancel  [e] Exit
```

Title: `tripTitle(trip, "Expenses", "Sort by")`.

**Inline picker** (sub-mode, `focus === "input"`):

Pressing `Enter` on a slot opens an overlay listing:

1. `<not set>` (always first)
2. The slot's *current* column, if set (so the user can see the current value and Space-toggle its direction without changing column)
3. Every other sortable column **not already in another slot**, each shown with its default direction

Per-column default direction:

| Column   | Default direction |
|----------|-------------------|
| Date     | desc (newest first) |
| THB      | desc (highest first) |
| Account  | asc (A→Z) |
| Owner    | asc (fewest first) |
| Category | asc (A→Z) |

**Picker layout example** (editing slot 2 while slot 1 = Date ↓):

```
  1. Date     ↓
  2. ┌─────────────────────┐
     │ > <not set>         │
     │   THB        ↓      │
     │   Account    ↑      │
     │   Owner      ↑      │
     │   Category   ↑      │
     └─────────────────────┘
  3. <not set>
  ...
```

(Date is hidden — already in slot 1.)

**Initial cursor position** in the picker:
- If the slot is `<not set>` → cursor on `<not set>`.
- If the slot has a column → cursor on that column's row.

**Picker keys**:

| Key            | Behavior |
|----------------|----------|
| `↑` / `↓`      | Move cursor across picker rows. |
| `Space`        | Toggle direction of the highlighted column option. No-op on `<not set>`. The toggled direction is stored locally in picker state — it commits only on Enter. |
| `Enter`        | Commit: write the chosen option into the slot via `setSlots(...)`, then exit picker (focus back to "main"). Picking `<not set>` sets the slot to `null`. |
| `esc`          | Cancel picker, revert any in-picker direction toggles, return to view mode without touching the slot. |
| `q`            | Same as `esc`. |

Picker hints:

```
[↑↓] Navigate  [Space] Direction  [Enter] Confirm  [esc] Cancel
```

**State captured on mount** (for cancel-revert):

```ts
const initialSlotsRef = useRef(slots);
// on q/esc in view mode:
setSlots(initialSlotsRef.current);
goBack();
```

### `ExpenseList.tsx` changes

1. Read sort context:
   ```ts
   const { slots } = useExpenseListSort();
   const levels = activeSlots(slots);
   ```

2. Apply sort before building rows. `buildExpenseListRows` is updated to take a pre-sorted expense list:

   ```ts
   // current:
   export function buildExpenseListRows(trip: Trip): TableCell[][]
   // new:
   export function buildExpenseListRows(trip: Trip, expenses: Expense[]): TableCell[][]
   ```

   Body switches from iterating `trip.expenses` to iterating the passed `expenses` array.

3. In the screen:
   ```ts
   const sortedExpenses = sortExpenses(trip.expenses, trip, levels);
   const rows = buildExpenseListRows(trip, sortedExpenses);
   const headers = buildSortedHeaders(EXPENSE_LIST_HEADERS, levels);
   ```

4. **Bug fix for index → expense lookups.** Today the code does `trip.expenses[rowIndex]` in three places:
   - `onChange` row open (line 226 in current source)
   - Duplicate menu `mainAction.onConfirm` (line 168)
   - Delete menu `mainAction.onConfirm` (line 183)

   Once rows are sorted, `rowIndex` references position in the *sorted* array. All three lookups switch to `sortedExpenses[rowIndex]`.

5. New menu entry:
   ```ts
   { label: "Sort", value: "sort", key: "s" }
   ```
   Visible regardless of whether `trip.expenses` is empty. Handler:
   ```ts
   if (value === "sort") {
     goTo("/trips/expenses/sort", { props: { tripDirPath } });
   }
   ```

6. **Stale-closure risk.** `mainAction.onConfirm` callbacks close over `sortedExpenses[i]`. To keep them current when the user changes sort and returns to the list, add `levels` (or `slots`) to the menu effect's dependency array so the effect re-runs and the closures rebind to the latest `sortedExpenses`. Equivalent option: memoize `sortedExpenses` with `useMemo` and include it in the dep array — either approach is acceptable in implementation.

### Header indicator helper (`buildSortedHeaders`)

Lives at the top of `ExpenseList.tsx` (same scope as `EXPENSE_LIST_HEADERS`):

```ts
const SORT_KEY_TO_HEADER: Record<SortKey, string> = {
  date: "Date",
  thb: "THB",
  account: "Account",
  owner: "Owner",
  category: "Category",
};

const PRIORITY_SUBSCRIPTS = ["₁", "₂", "₃", "₄", "₅"] as const;

export function buildSortedHeaders(
  headers: string[],
  levels: { key: SortKey; dir: SortDir }[],
): string[] {
  if (levels.length === 0) return headers;
  return headers.map((h) => {
    const idx = levels.findIndex((l) => SORT_KEY_TO_HEADER[l.key] === h);
    if (idx === -1) return h;
    const arrow = levels[idx]!.dir === "desc" ? "↓" : "↑";
    const subscript = levels.length > 1 ? (PRIORITY_SUBSCRIPTS[idx] ?? "") : "";
    return `${h}${arrow}${subscript}`;
  });
}
```

- Subscripts use *position in `levels`*, i.e. position among the *set* slots — so holes don't show up in the numbering. (Slots `[Date, null, Account]` → `Date↓₁ Account↑₂`.)
- Single active sort drops the subscript: `Date↓`.

### Router

`src/tui/router.ts` adds one new entry next to the other expense routes:

```ts
"/trips/expenses/sort": {
  component: ExpenseListSort,
},
```

`defaultFocus` defaults to `"main"`, which is correct.

### Provider wiring

`src/tui/App.tsx` wraps the existing tree with `ExpenseListSortProvider`. Placement:

```tsx
<FormBufferProvider>
  <ExpenseListSortProvider>
    <NavigationProvider initial={initial} routes={routes}>
      ...
    </NavigationProvider>
  </ExpenseListSortProvider>
</FormBufferProvider>
```

## Files

**Created:**
- `src/tui/states/expenseListSort.tsx`
- `src/tui/screens/ExpenseListSort.tsx`
- `src/core/services/expense/sortExpenses.ts`
- `src/core/services/expense/__tests__/sortExpenses.test.ts`

**Modified:**
- `src/tui/screens/ExpenseList.tsx` — read slots/levels, sorted rows, header indicator helper, new `[s] Sort` menu entry, fix three `rowIndex` lookups to use `sortedExpenses`, refactor `buildExpenseListRows` signature to `(trip, expenses)`, add `levels`/`slots` to menu effect deps.
- `src/tui/screens/ExpenseDuplicateSelect.tsx` — call `buildExpenseListRows(trip, trip.expenses)` to match the new signature; no behavior change.
- `src/tui/router.ts` — register `/trips/expenses/sort`.
- `src/tui/App.tsx` — wrap with `ExpenseListSortProvider`.
- `src/core/services/expense/index.ts` — export `sortExpenses` and types.
- `src/tui/constants/hints.ts` — add `SORT_HINTS`.

## Behavior Invariants to Preserve

- ExpenseList renders identically when default slots are active and the trip's existing insertion order is already date-descending — same row contents, only the header changes (`Date` → `Date↓`).
- Empty trip ("No expenses yet.") still renders; menu still shows `[a] Add`. New `[s] Sort` is also visible in this state.
- `[a] Add`, `[d] Duplicate`, `[x] Delete` on `ExpenseList` and their armed-row confirm semantics unchanged.
- Selecting an expense row still opens the expense form for that expense — but `expenseId` resolves through the sorted view, never the raw array.
- `clearByPrefix("expense-")` on mount unchanged.
- Form buffer clearing, focus defaults, layout title/hint/menu registration patterns unchanged.
- `ExpenseDuplicateSelect` renders identically.

## Verification

- `bun run check:type`
- `bun run check`
- `bun test src/core/services/expense/__tests__/sortExpenses.test.ts`
- `bun test`
- Manual smoke:
  - Open expense list → default sort is `Date ↓` (newest at top); header shows `Date↓` (no subscript, single active sort).
  - Press `[s]` → sort screen opens with the 5 slots visible, slot 1 = `Date ↓`, slots 2–5 = `<not set>`, cursor on slot 1.
  - `[Enter]` on slot 1 → picker opens with cursor on `Date ↓`; `<not set>` is option 1.
  - In picker, `[Space]` toggles direction of highlighted column (visible immediately); `[Enter]` commits, `[esc]` reverts.
  - Pick `<not set>` and confirm → slot 1 becomes `<not set>`; list now shows all 5 slots unset.
  - Set slot 1 = `Account ↑`, slot 3 = `Owner ↑` (slot 2 left `<not set>`) → expense list reflects effective chain `[Account, Owner]`; header shows `Account↑₁ Owner↑₂` (subscripts skip the hole).
  - `[Space]` on slot 1 in view mode → toggles direction in place.
  - `[q]`/`[esc]` in view mode → reverts to the slot state captured when the screen opened.
  - `[s]` in view mode → keeps the current slots and returns to the expense list.
  - Picker only shows columns not in other slots (plus the slot's own current column and `<not set>`).
  - THB sort with a row missing exchange rate → that row sinks to the bottom both asc and desc.
  - Edit/duplicate/delete an expense from a sorted view → the correct expense is operated on (verifies index lookup fix).

## Risk

Low–medium.

- **Stale closures in `ExpenseList` menu (medium).** The `mainAction.onConfirm` callbacks close over `sortedExpenses[i]`. The menu effect must re-run when `slots` (or `levels`) changes so the closures rebind. Missing this dep would silently operate on stale order.
- **`<not set>` semantics (low).** Holes-are-skipped is straightforward but worth double-checking in the comparator chain (empty `levels` → insertion order is the documented behavior).
- **Direction toggle scope (low).** `Space` in view mode mutates `slots` immediately (committed to context). `Space` in picker mode mutates picker-local state and commits only on `Enter`. Two distinct mutation paths — the screen needs to keep them separate to make `esc` in picker mode truly non-destructive.
- **No persistence (intentional).** Quitting drops sort state — clearly stated in design; can be added later by persisting `slots` into `settings.yaml` if requested.
