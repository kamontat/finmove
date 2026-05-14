# Spend Per Account on Trip Dashboard

## Summary

Add a per-account spend breakdown to the trip dashboard. For each account that paid for at least one successfully-converted expense, show the account name, type (Credit/Debit), expense count, total in THB, and a proportional bar. Re-layout the dashboard's block grid to use `flexWrap` so blocks reflow naturally as the terminal narrows.

## Goals

- Surface where the spend goes by funding source, complementing the existing per-currency, per-category, and per-owner views.
- Keep derivation in `core/` (pure, testable); UI stays presentational.
- Let the dashboard reflow without explicit breakpoint math, using Ink's flexbox.

## Non-goals

- No drill-down from the new block.
- No new UI primitives.
- No snapshot/Ink tests — testing stays on the core derivation, matching existing convention.
- No changes to how orphan-account expenses are handled (they remain warned about and excluded from balances; the new block excludes them too).

## Data model

### `TripStatus`

Add a `byAccount` field to the existing `TripStatus` in `src/core/services/trip/getTripStatus.ts`:

```ts
export interface TripStatus {
  // ... existing fields unchanged
  byAccount: {
    accountId: string;
    name: string;
    type: AccountType;
    totalThb: number;
    expenseCount: number;
  }[];
  // ... existing fields unchanged
}
```

- Sorted by `totalThb` descending, then by `name` ascending for stable ordering when amounts tie.
- Includes only accounts referenced by at least one expense whose THB conversion succeeded.
- Excludes:
  - Accounts with zero spend (including configured accounts that have no expenses).
  - Expenses whose `accountId` does not match any known account (already counted as orphans elsewhere via the existing `orphanAccounts` warning).
  - Expenses missing a usable THB rate (already counted as `missingRateCount` warning).

### `getTripStatus` derivation

Inside the existing expense loop, when an expense's THB amount is successfully computed AND the referenced account exists in `trip.accounts`:

1. Increment `totalThb` for that `accountId` in a `Map<string, number>`.
2. Increment `expenseCount` for that `accountId` in a `Map<string, number>`.

After the loop, build the `byAccount` array by iterating the totals map, looking up the matching `Account` in `trip.accounts` for `name` and `type`, and sorting as described above. Amounts are rounded with the existing `round2` helper.

## UI

### `AccountsBlock` component

Lives in `src/tui/components/organisms/TripDashboard.tsx` next to the other block functions. Fixed `width={38}` to match `SpendBlock` and `OwnersBlock`.

Layout per row:

```
Accounts
────────
HSBC Credit  (Cr)  ×12  ฿24,500.00 ████
Bangkok Bank (Db)   ×8  ฿18,200.00 ███
Cash         (Db)   ×3  ฿   450.00 █
```

Field widths inside the 38-char block:

- Name: `padEnd(12)`. Names longer than 12 chars are truncated to 11 chars + `…`.
- Type abbreviation in parens: `(Cr)` for `AccountType.Credit`, `(Db)` for `AccountType.Debit`. 4 chars total.
- Count: `×N` right-aligned in a 4-char column (e.g. `  ×8`, ` ×12`).
- Amount: `formatThb()` output right-aligned to 10 chars (same helper currently used).
- Bar: width 6, cells = `max(1, round((totalThb / max) * 6))`. Color `magenta` so it does not collide visually with the cyan bars used by `CategoriesBlock`.
- Single-space gaps between columns.

If `status.byAccount` is empty, render `—` (dim) like `CategoriesBlock` does for empty top categories.

### Dashboard layout

Replace the two hardcoded rows at the bottom of `TripDashboard` with a single `flexWrap` container. Final source order = visual order (left-to-right, top-to-bottom):

```tsx
<Box flexDirection="row" flexWrap="wrap" gap={2}>
  <SpendBlock status={status} />
  {hasOwners && <OwnersBlock status={status} />}
  <CategoriesBlock status={status} />
  {hasAccountSpend && <AccountsBlock status={status} />}
  <CountsBlock status={status} />
</Box>
```

- `hasOwners` is the existing condition (`status.ownerBalances.length > 0`).
- `hasAccountSpend` is `status.byAccount.length > 0`.
- `CategoriesBlock` and `CountsBlock` currently render without an explicit width. They will be given `width={38}` so all five blocks contribute consistent column widths to the wrap.

Wrapping behavior with uniform `width=38` + `gap=2`:

- ≥ 158 cols → 4 columns (5th block wraps to row 2)
- 118–157 cols → 3 columns
- 78–117 cols → 2 columns
- < 78 cols → 1 column

This produces 4 → 3 → 2 → 1 stepping rather than strictly 4 → 2 → 1. Accepted as a deliberate trade-off for keeping the layout declarative (no terminal-width math in the dashboard).

`StatusHeader`, `ProgressBar`, and `WarningList` are unchanged. The flex grid only replaces the two existing `flexDirection="row"` rows.

## Tests

Update `src/core/services/trip/__tests__/getTripStatus.test.ts` with cases for `byAccount`:

1. **Sorted descending by total** — two accounts with different totals appear highest-first.
2. **Tie broken by name ascending** — two accounts with equal totals appear in alphabetical order.
3. **Account with zero expenses excluded** — a configured account with no expenses does not appear.
4. **Orphan-account expense excluded** — an expense whose `accountId` does not match any known account contributes to the existing warning but not to `byAccount`.
5. **Expense missing THB rate excluded** — an expense whose conversion fails does not inflate `byAccount` totals or counts.
6. **`expenseCount` matches reality** — three expenses on the same account produce `expenseCount: 3`.

No new TUI rendering tests — `TripDashboard` does not currently have any, and that convention is preserved.

## Files changed

- `src/core/services/trip/getTripStatus.ts` — extend `TripStatus`, accumulate per-account totals + counts, build sorted `byAccount` array.
- `src/core/services/trip/__tests__/getTripStatus.test.ts` — new cases per above.
- `src/tui/components/organisms/TripDashboard.tsx` — add `AccountsBlock`, give `CategoriesBlock` and `CountsBlock` an explicit `width={38}`, replace the two row containers with a single `flexWrap` container, place blocks in the order Spend → Owners → Top categories → Accounts → Counts.

No changes to models, validators, or screens.
