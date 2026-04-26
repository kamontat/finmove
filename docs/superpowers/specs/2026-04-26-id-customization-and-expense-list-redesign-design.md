# ID Customization & Expense List Redesign

## Overview

Four feature changes:

1. **Custom IDs in create forms.** Optional ID field for Owners and Accounts; optional `dirName` field for Trips. Auto-generated default shown as placeholder; user can override.
2. **Trip Overview shortcut fix.** `[e]` for Expenses collides with global `[e]` Exit. Rebind to `[p]`.
3. **New expense ID format.** Replace `exp-${Date.now()}` with `exp-YYYYMMDD-id<n>` where `n` is per-date highest+1.
4. **Expense list redesign.** Match the Owners/Accounts pattern — selectable list in main zone, `[a]` Add / `[x]` Remove menu, no more per-expense `Edit:` items in menu.

Plus a foundational refactor enabling (4):

5. **VerticalSelect refactor.** Extract `VerticalSelect` (atom) into a logic-only base; introduce `ListSelect` and `TableSelect` molecules that wrap it with different visuals.

## Section A — Custom IDs in Create Forms

### UX

Optional ID/dirName field added to each create form. If left blank, the auto-generated default is used. If filled, the user-provided value is used (after validation).

The placeholder shown in the form must reflect the live auto-generated default based on the current `name` field value (so the user sees what will be used if they leave it blank).

### Form field placement

- **OwnerCreate:** add `id` field after `name`
- **AccountCreate:** add `id` field after `name` (before `type`)
- **TripCreate:** add `dirName` field after `name` (before `startDate`)

All new fields: `type: "text"`, `required: false`.

### Dynamic placeholder support

The existing `TextFormField.placeholder` is `string | undefined`. Extend to support a function:

```ts
// src/tui/models/index.ts
export type TextFormField = FormFieldBase & {
  type: "text";
  defaultValue?: string;
  placeholder?: string | ((values: Record<string, string>) => string);
};
```

`Form.tsx` evaluates `placeholder` on each render, passing the current `values` map. The result is used wherever `field.placeholder` is currently consumed (preview text and `<TextInput placeholder=...>` prop).

### Validation

- **Owner ID, Account ID:** must match `^[a-z0-9-]+$` and be unique within the trip's existing IDs. On collision or invalid format, throw an `Error` from inside `onSubmit`. The `Form` organism already catches and displays it via the existing `error` state.
- **Trip dirName:** must match `^[a-z0-9-]+$` and not collide with an existing directory under `dataDir`. Currently `TripCreate.tsx` does its own collision check via `existsSync` — same logic, just operating on the user-supplied `dirName` when provided, else on the auto-generated value.

### Auto-generation defaults

- Owner ID: `uniqueSlug(name, trip.owners.map(o => o.id))`
- Account ID: `uniqueSlug(name, trip.accounts.map(a => a.id))`
- Trip dirName: `toDirName(name, startDate)`

These functions already exist; the placeholder simply calls them with the current form values.

### Editing IDs is still disallowed

ID is a create-time decision only. `OwnerEdit`, `AccountEdit` continue to show the read-only `ID:` label above the form. No corresponding "rename ID" feature.

## Section B — Trip Overview Shortcut Fix

In `src/tui/screens/TripOverview.tsx`, the menu item:

```ts
{ label: "Expenses", value: "expenses", key: "e" }
```

Collides with the global `[e]` Exit handler in `src/tui/hooks/useGlobalKeys.ts`. When focus is on `menu`, pressing `e` triggers both the menu callback and `goExit`.

**Fix:** change `key: "e"` to `key: "p"`. The menu hint label can stay "Expenses" (the leading letter is no longer the shortcut hint, but that's already the case for "Settings" → `[s]`).

**Audit:** no other screen uses `key: "e"`, `key: "q"`, `key: "?"`, or `key: "esc"` (verified by grep during implementation).

## Section C — Expense ID Format

### Format

`exp-YYYYMMDD-id<n>`

- `YYYYMMDD` = expense date with hyphens stripped (the stored format is `YYYY-MM-DD`)
- `n` = per-date counter, computed as max existing `n` for that date + 1, starting at `0` when no expenses exist for that date

### New service

File: `src/core/services/expense/nextExpenseId.ts`

```ts
import type { Trip } from "../../models";

export function nextExpenseId(trip: Trip, date: string): string {
  const datePart = date.replaceAll("-", "");
  const prefix = `exp-${datePart}-id`;
  const max = trip.expenses
    .map((e) => e.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number.parseInt(id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((acc, n) => Math.max(acc, n), -1);
  return `${prefix}${max + 1}`;
}
```

Re-exported from `src/core/services/expense/index.ts`.

### ID immutability on edit

When editing an expense, the ID is preserved even if the date is changed. This matches the existing rule for Owners and Accounts ("changing ID would break references"). An `exp-20260426-id0` whose date is moved to 2026-04-27 keeps its original ID.

### ExpenseForm change

In `src/tui/screens/ExpenseForm.tsx` line 140, replace:

```ts
const id = existingExpense?.id ?? `exp-${Date.now()}`;
```

with:

```ts
const id = existingExpense?.id ?? nextExpenseId(trip, values["date"] ?? today());
```

### Tests

New file: `src/core/services/expense/__tests__/nextExpenseId.test.ts`

Cases:
- Empty list returns `id0` for any date
- Sequential adds on same date → `id0`, `id1`, `id2`
- Different date resets counter → `id0`
- Deletion gap: `id0`, `id1`, `id2` exist, delete `id1`, next returns `id3` (highest+1, not count)
- Legacy IDs from old format (e.g. `exp-1234567890`) are ignored
- Date-format edge: confirms `2026-04-26` → `20260426`

## Section D — VerticalSelect / ListSelect / TableSelect Refactor

### New shape

`VerticalSelect` (atom, `src/tui/components/atoms/VerticalSelect.tsx`) becomes logic-only:

```ts
interface VerticalSelectProps {
  rowCount: number;
  renderRow: (index: number, selected: boolean) => ReactNode;
  onChange: (index: number) => void;
  onHighlight?: (index: number) => void;
  onCancel?: () => void;
  isActive?: boolean;
}
```

Owns: cursor state, keyboard handling (`↑↓`, `Enter`, `Esc`, `q`). On cursor change, fires `onHighlight(newIndex)`. On Enter, fires `onChange(cursorIndex)`. Renders rows in a `<Box flexDirection="column">` by calling `renderRow(i, i === cursor && isActive)` for each row. No knowledge of options, labels, or columns.

### ListSelect (NEW molecule)

File: `src/tui/components/molecules/ListSelect.tsx`

Preserves the existing `VerticalSelect` public shape so call sites change only the import name:

```ts
interface ListSelectProps {
  options: VerticalOption[];
  onChange: (value: string) => void;
  onHighlight?: (value: string) => void;
  onCancel?: () => void;
  isActive?: boolean;
  color?: string;
}
```

Renders each row as the existing `> label  (detail)` look — single `<Text inverse={selected}>` line, dimColor for detail. The optional `color` prop (used by `RemoveSelector` for the red list) is applied to each row's `<Text>` element here in `ListSelect`, since `VerticalSelect` itself is now visual-agnostic. Internally:

```tsx
<VerticalSelect
  rowCount={options.length}
  renderRow={(i, selected) => /* label+detail Text with color prop applied */}
  onChange={(i) => onChange(options[i].value)}
  onHighlight={(i) => onHighlight?.(options[i].value)}
  onCancel={onCancel}
  isActive={isActive}
/>
```

### TableSelect (NEW molecule)

File: `src/tui/components/molecules/TableSelect.tsx`

```ts
interface TableSelectProps {
  headers: string[];
  rows: string[][];
  onChange: (rowIndex: number) => void;
  onCancel?: () => void;
  isActive?: boolean;
}
```

Computes column widths the same way as the existing `DataTable` organism (max of header length / cell length + 2). Renders:

1. A non-selectable header row (bold) above the `VerticalSelect`
2. `<VerticalSelect>` with `rowCount = rows.length`, where each `renderRow` returns a single `<Text inverse={selected}>` containing all cells joined with column-padded widths

Single-line per row is required so Ink's `inverse` styling applies cleanly across the whole row.

### Migration of existing call sites (rename only)

Switch import from `VerticalSelect` to `ListSelect`:

- `src/tui/screens/OwnerList.tsx`
- `src/tui/screens/AccountList.tsx`
- `src/tui/screens/TripList.tsx` (two usages — list mode and duplicate mode)
- `src/tui/components/molecules/RemoveSelector.tsx`

No other logic changes in these files.

### DataTable organism kept

`src/tui/components/organisms/DataTable.tsx` is still used by `TripDashboard` for non-selectable display tables. It stays as-is. `TableSelect` is for selectable tables only — different purpose.

## Section E — ExpenseList Redesign

### Mode parity with OwnerList/AccountList

- **`list` mode** (default): `TableSelect` in main zone with the columns below. Menu shows `[a] Add` / `[x] Remove` (Remove only when expenses exist).
- **`select-for-remove` mode**: red border, uses existing `RemoveSelector` molecule (which uses `ListSelect` internally — won't be tabular here). Selecting a row removes the expense, stays in remove mode; empty list returns to list.
- **Selecting a row in list mode**: navigates to `/trips/expenses/form` with `expenseId` (existing ExpenseForm handles edit).

### Columns (TableSelect headers + rows)

Headers: `Date`, `Account`, `Payee`, `Category`, `Amount`, `Tags`

For each expense:
- `Date`: `e.date` as-is (`YYYY-MM-DD`)
- `Account`: resolved name from `trip.accounts.find(a => a.id === e.accountId)?.name ?? e.accountId`
- `Payee`: `e.payee`
- `Category`: `e.category`
- `Amount`: `${e.amount} ${e.currency}` (e.g. `1500 THB`)
- `Tags`: `e.tags.length > 0 ? String(e.tags.length) : ""`

The `#` column from the old `DataTable` is dropped (cursor + selection makes it redundant).

### RemoveSelector for expenses

Reuse `RemoveSelector` molecule (1D `ListSelect`). For each expense option:
- `label`: `e.payee`
- `value`: `e.id`
- `detail`: `(e.date · e.amount e.currency)`

This matches the Owners/Accounts remove UX.

### Files changed

- **`src/tui/screens/ExpenseList.tsx`** — full rewrite. Structure mirrors `AccountList.tsx`: read `selectMode` route prop, set focus on mount, set menu/hints/border based on mode, render `TableSelect` or `RemoveSelector` accordingly.
- **`src/tui/states/navigation/`** (typed-route-params definitions): add `selectMode?: "remove"` to `/trips/expenses` route props, mirroring `/trips/owners` and `/trips/accounts`.

### Menu items removed

The current `ExpenseList` menu builds per-expense `Edit: <payee>` items. These are removed — selection in main zone replaces them.

## Build Sequence

Order matters for clean intermediate states:

1. Refactor `VerticalSelect` to logic-only; introduce `ListSelect` molecule preserving the old API. Migrate all call sites to import `ListSelect`. (Section D — keeps everything green.)
2. Add `TableSelect` molecule. (Section D — no consumers yet.)
3. Add `nextExpenseId` service + tests; wire into `ExpenseForm`. (Section C — backwards compatible since old IDs still work for edits.)
4. Rebind `[e]` → `[p]` in `TripOverview`. (Section B — one-line change.)
5. Extend `TextFormField.placeholder` to support a function; update `Form.tsx` to evaluate it. (Section A foundation.)
6. Add ID/dirName fields to `OwnerCreate`, `AccountCreate`, `TripCreate` with dynamic placeholder + validation. (Section A.)
7. Rewrite `ExpenseList` to use `TableSelect` + `selectMode` pattern; add `selectMode` to `/trips/expenses` typed route props. (Section E — depends on Section D step 2.)

## Testing

- New service test for `nextExpenseId` (Section C above).
- Existing test suites for `VerticalSelect` callers (OwnerList, AccountList, TripList) should continue to pass after the rename to `ListSelect` — no behavior changes.
- Manual TUI verification:
  - Create a trip with custom dirName; verify directory is created with that name. Repeat with blank dirName; verify auto-generated default is used.
  - Same for owner and account custom IDs.
  - On Trip Overview, press `[e]` → exits the program. Press `[p]` → navigates to Expenses. (Confirms the fix.)
  - Add 3 expenses on the same date; verify IDs `id0`, `id1`, `id2`. Delete `id1`; add another → `id3`. Add an expense on a different date → `id0`.
  - On Expenses screen, verify `TableSelect` columns render aligned, cursor highlights row, Enter navigates to edit, `[x]` enters remove mode with red border, Esc exits remove mode, deleting last expense returns to list.
