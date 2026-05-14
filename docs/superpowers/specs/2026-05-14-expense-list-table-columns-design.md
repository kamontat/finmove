# Expense List — Additional Table Columns

## Goal

Surface more decision-relevant data directly in the expense list table on `ExpenseList`, so the user does not have to open each expense to inspect owners, exchange rate, or THB-converted value. Today the table shows `Date | Account | Payee | Category | Amount | Tags`. After this change it shows nine columns and uses a strict finance format for currency cells.

## Table Layout

New column order:

```
Date | Account | Owners | Payee | Category | Amount | Rate | THB | Tags
```

Three new columns: `Owners`, `Rate`, `THB`. Existing columns are unchanged in content and position relative to each other; `Owners` slots between `Account` and `Payee`, and `Rate` / `THB` slot between `Amount` and `Tags`.

## Cell Formats

### Owners — smart unique-prefix initials

Compute a per-trip map from owner name to the shortest unique-prefix string across `trip.owners`:

- `[Alice, Bob, Carol]` → `{Alice: "A", Bob: "B", Carol: "C"}`
- `[Net, Nid]` → `{Net: "Ne", Nid: "Ni"}`
- `[Net, Nid, Nan]` → `{Net: "Ne", Nid: "Ni", Nan: "Na"}`
- `[Sam, Sam]` (identical names) → both fall back to the full name; the function does not invent disambiguation that does not exist in the source data.

Cell value: comma-joined initials in the order they appear on the expense, e.g. `Ne, Ni`. Blank cell when `expense.owners` is undefined or empty. Splits (percentage/amount/equal) are intentionally not shown in this column — too wide for a list overview.

The expense's `owners` field can be `string[]` or `ExpenseOwnerSplit[]`; both shapes resolve to owner ids by reading `.id` (for split objects) or the string directly. Unknown ids (no matching `trip.owners` entry) render as the raw id.

### Currency cells — finance format

Applies to any cell that displays a monetary amount alongside a currency code (Amount and THB columns in this feature).

Rules:

1. Numeric portion uses `Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` → thousand separator and exactly two decimals.
2. Within a column, numeric strings are right-aligned by padding the numeric portion with leading spaces to the max numeric width across all rows in that column.
3. Currency code is appended after a single space.

Example (Amount column, two rows):

```
1,000.00 THB
    5.00 CNY
```

### Amount column

Always renders `<right-aligned number> <expense.currency>`. The currency is always known (stored on the expense).

### Rate column

Plain 2-decimal number, no thousand separator (rates are small magnitudes), no currency suffix:

- THB expense → blank cell.
- Per-expense rate set (`expense.exchangeRate`) → `expense.exchangeRate.toFixed(2)`, e.g. `33.50`.
- Per-expense rate not set, trip fallback exists (`trip.settings.currencies[expense.currency].exchangeRate`) → trip rate, same format.
- Neither available → red `?`.

### THB column

Same finance format as Amount, currency suffix is always `THB`:

- THB expense → number equals `expense.amount`, currency suffix `THB`.
- Non-THB with a resolvable rate → `convertToTHB(amount, currency, expenseRate, tripRate)` formatted with thousand-sep and 2 decimals, suffix `THB`.
- Non-THB with no resolvable rate → right-aligned red `?`, no currency suffix. (The "?" occupies the numeric slot only; this keeps the column's numeric right-edge stable.)

The right-alignment width is computed across all rendered values in the column, including the resolved-amount strings. The `?` rows contribute width `1` to the max-width calc.

## TableSelect Changes

`src/tui/components/molecules/TableSelect.tsx` is the only consumer of `TableSelect` (verified via `grep`), so a breaking signature change is safe.

New cell shape — no string union:

```ts
type Cell = { text: string; color?: string };

interface TableSelectProps {
  headers: string[];           // headers stay plain strings
  rows: Cell[][];
  onChange: (rowIndex: number) => void;
  onCancel?: () => void;
  isActive?: boolean;
}
```

Rendering:

- Column width: `Math.max(header.length, ...rows.map(r => r[i].text.length)) + 2`.
- Each row is a `<Box>` with one `<Text>` per cell. Cells with `color` set render `<Text color={color}>...</Text>`. Selected row applies `inverse` to every cell `<Text>` so the highlight covers the whole row.
- Cursor prefix (`>` / two spaces) stays as the row's first `<Text>`.

Existing call sites: only `ExpenseList.tsx` (two `TableSelect` instances). Both are migrated as part of this change.

## File Changes

### `src/core/services/owner/computeInitials.ts` (new)

Pure function — lives in core because it has zero UI dependency and is unit-testable in isolation.

```ts
export function computeInitials(names: string[]): Record<string, string>;
```

Algorithm: for each name, find the shortest prefix length `k` such that no other name in the list shares the same prefix of length `k`. Return `name → prefix`. If two names are identical strings, both map to the full name (no disambiguation possible). Empty input returns `{}`.

Added to `src/core/services/owner/index.ts` re-export.

### `src/core/services/owner/__tests__/computeInitials.test.ts` (new)

Cases:

- Empty input → `{}`.
- Single name → maps to first character.
- Two names, disambiguate at length 1 (`Alice`, `Bob`).
- Two names, disambiguate at length 2 (`Net`, `Nid`).
- Three names, mixed disambiguation lengths (`Alice`, `Aaron`, `Bob`) → `Al`, `Aa`, `B`.
- Identical names (`Sam`, `Sam`) → both `Sam`.
- One name is a prefix of another (`Sam`, `Sammy`) → `Sam` maps to `Sam` (full name, since `Sam` is a prefix of `Sammy`), `Sammy` maps to `Samm` (shortest prefix that distinguishes it from `Sam`).

### `src/tui/components/molecules/TableSelect.tsx`

Replace `rows: string[][]` with `rows: Cell[][]`. Update width calc to read `.text`. Replace the single-`<Text>`-per-row render with a row composed of multiple `<Text>` children (one per cell), each with its optional `color` and the row-level `inverse` flag.

### `src/tui/screens/ExpenseList.tsx`

- Compute `initialsMap = computeInitials(trip.owners.map(o => o.name))` once per render (cheap; runs only when trip changes).
- Build `rows: Cell[][]` for the new nine-column layout. Helper functions (inline or in a local helpers file — author's choice during implementation):
  - `formatOwnersCell(expense, trip, initialsMap): Cell` → `{ text: "Ne, Ni" }` or `{ text: "" }`.
  - `formatAmountCell(expense, maxNumWidth): Cell` → `{ text: "  100.00 USD" }`.
  - `resolveRate(expense, trip): number | null` → numeric rate or null.
  - `formatRateCell(expense, trip): Cell` → `{ text: "33.50" }` / `{ text: "" }` / `{ text: "?", color: "red" }`.
  - `formatThbCell(expense, trip, maxNumWidth): Cell` → `{ text: " 3,350.00 THB" }` / `{ text: "    ?", color: "red" }`.
- Numeric-width computation: build all numeric strings first, compute `max(...lengths)`, then left-pad each. Done independently per currency-cell column (Amount and THB each have their own max).
- Both render paths (default list and `selectMode === "duplicate"`) use the new headers/rows. Headers stay as `string[]` — no styling needed.

## Out of Scope

- Showing split type (percentage / amount / equal) in the Owners cell.
- Truncating long cells on narrow terminals. Terminal-width handling is a separate concern (no existing logic for it in this codebase).
- Coloring the Amount column for over-budget or non-base currencies.
- Changing `RemoveSelector`'s `detail` line — it stays `(date · amount currency)`.
- Adding the new columns anywhere else (e.g. CSV export, ExpenseForm preview).

## Testing

- Unit: `computeInitials` with the cases listed above.
- No new unit tests for `ExpenseList` (consistent with other screens in this codebase — screens are verified manually).
- Manual TUI verification:
  - List with mixed currencies and a trip-level fallback rate → numeric columns align right, currency codes line up.
  - Expense with no rate and currency not in `trip.settings.currencies` → red `?` in both Rate and THB.
  - Trip with owners whose names share first letters → initials disambiguate correctly.
  - Expense with no owners → blank Owners cell, table still renders.
  - Duplicate-select mode shows the same nine columns.
  - Existing keyboard navigation (↑↓, Enter, Tab, q/esc) still works on the wider table.
