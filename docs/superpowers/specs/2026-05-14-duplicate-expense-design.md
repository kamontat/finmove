# Duplicate Expense

## Goal

Let the user duplicate an existing expense from the expense list. The duplicate opens as a pre-filled new expense form so the user can adjust fields (most commonly the amount) before saving. The flow mirrors the existing "Duplicate Trip" feature on `/trips`.

## UX Flow

1. On `ExpenseList`, the menu gains a `[d] Duplicate` item, rendered only when the trip has at least one expense (same condition as `[x] Remove`).
2. Pressing `[d]` navigates to `/trips/expenses` with `selectMode: "duplicate"`.
3. In duplicate-select mode the screen shows:
   - A header line `Select an expense to duplicate:`
   - The existing expense table (same headers/rows as the default view), navigable with ↑↓.
   - Hints: `↑↓ Navigate`, `Enter Duplicate`, `q/esc Back to list`, `e Exit`.
   - No destructive border color (this differs from remove mode, which uses red).
4. Pressing Enter on a row navigates to `/trips/expenses/form` with a new `duplicateFromId` route prop set to that row's expense id.
5. The form opens pre-filled from the source expense with the following rules:
   - **Copied** (defaultValue from source): account, date, payee, category, currency, exchangeRate, owners, description, tags.
   - **Not copied**: id (regenerated on submit via `nextExpenseId`), amount (no defaultValue — user must enter it).
6. The screen title suffix shows `Duplicate of: <payee>` so the user can distinguish a duplicate from a fresh new or an edit.
7. The user edits whatever they need and presses `[s]` to submit. `addExpense` is called with the new id; the source expense is left untouched.

## Code Changes

### `tui/models/index.ts`

Extend route props:

- `/trips/expenses`: `selectMode?: "remove" | "duplicate"` (currently only `"remove"`).
- `/trips/expenses/form`: add optional `duplicateFromId?: string` alongside the existing `tripDirPath` and `expenseId`.

### `tui/constants/hints.ts`

Add a new hint set mirroring `SELECT_REMOVE_HINTS`:

```ts
export const SELECT_DUPLICATE_HINTS: HelpHint[] = [
  { key: "↑↓", label: "Navigate" },
  { key: "Enter", label: "Duplicate" },
  { key: "q/esc", label: "Back to list" },
  { key: "e", label: "Exit" },
];
```

### `tui/screens/ExpenseList.tsx`

- Add a `[d] Duplicate` entry to the menu, gated by `hasExpenses`, alongside Add/Remove. Handler: `goTo("/trips/expenses", { props: { tripDirPath, selectMode: "duplicate" } })`.
- Add a `selectMode === "duplicate"` branch in the layout effect: `setBorderColor(null)` (default, matching TripList's duplicate branch), `setMenu([], () => {})`, `setHints(SELECT_DUPLICATE_HINTS)`.
- Add a rendering branch for `selectMode === "duplicate"`:
  - If `trip.expenses.length === 0`, show `<Text dimColor>No expenses.</Text>` (matches the remove branch behavior).
  - Otherwise render a header `Select an expense to duplicate:` and the same `TableSelect` (same headers/rows) with `isActive` and an `onChange` that calls `goTo("/trips/expenses/form", { props: { tripDirPath: trip.dirPath, duplicateFromId: expense.id } })`.

### `tui/screens/ExpenseForm.tsx`

- Read `duplicateFromId` from `useRouteProps("/trips/expenses/form")`.
- Resolve `const duplicateSource = trip?.expenses.find(e => e.id === duplicateFromId)`.
- Distinct modes for the form:
  - **edit**: `existingExpense` is set.
  - **duplicate**: `duplicateSource` is set and `existingExpense` is not.
  - **new**: neither is set.
- Form buffer `formId`:
  - Edit: `expense-edit-${expenseId}` (unchanged).
  - Duplicate: `expense-duplicate-${duplicateFromId}` (new).
  - New: `expense-new` (unchanged).
- Extend the existing owners/tags pre-seed effect so it also seeds from `duplicateSource` when in duplicate mode. The buffer-empty guard (`buffer.values["owners"] === undefined`) stays so user edits are preserved across re-renders.
- Field `defaultValue` rules — replace the current `existingExpense ? { defaultValue: existingExpense.X } : {}` pattern with logic that falls back to `duplicateSource` for the copied fields, with these exceptions:
  - `amount`: only sets `defaultValue` when `existingExpense` is set. In duplicate mode the field is empty.
  - `currency`: defaults to `existingExpense?.currency ?? duplicateSource?.currency ?? "THB"` (currency already has a hardcoded fallback).
  - `date`: defaults to `existingExpense?.date ?? duplicateSource?.date ?? today()` (per design decision: same date as source).
  - All other copied fields (account, payee, category, exchangeRate, description) follow the same `existingExpense ?? duplicateSource` pattern.
- Title suffix: when `duplicateSource && !existingExpense`, call `setTitleSuffix(\`Duplicate of: ${duplicateSource.payee}\`)`. Otherwise the title suffix is not set by ExpenseForm (current behavior). Add a `useEffect` for this so it is set/cleared correctly on mount/unmount.
- Submit handler stays as-is: `if (existingExpense) updateExpense else addExpense`. Duplicate mode falls into the `addExpense` branch and `nextExpenseId` produces a fresh id from the chosen date.

## Out of Scope

- "Duplicate N times" / bulk duplicate.
- Press-`[d]`-while-row-is-highlighted shortcut on the default list view. Duplicate is only reachable through the menu → select-mode flow.
- Cross-trip duplication.

## Testing

No changes to core services — `addExpense` and `nextExpenseId` already do the right thing for a brand-new expense, which is what a duplicate effectively is. Existing service tests cover those paths.

Verification is manual TUI testing:

- Duplicate an expense; confirm the form is pre-filled with all source fields except amount, the title shows `Duplicate of: <payee>`, and submitting creates a new row in the list while the source row is unchanged.
- Duplicate when there are no expenses: the `[d]` menu entry is not rendered.
- Cancel out of the duplicate flow (`q`/`esc`) at the select step and at the form step — no expense should be created.
- Duplicate an expense that has owners and tags — confirm both pre-seed correctly and can be edited via their sub-pages before submit.
