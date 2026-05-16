# Move expense count from Spend block to Counts block

## Background

The trip overview dashboard (`/trips/overview`, rendered by `src/tui/components/organisms/TripDashboard.tsx`) currently shows the total number of expenses in the **Spend** block, alongside monetary totals:

```
Spend
─────
Total        ฿X,XXX.00
Avg/day      ฿X,XXX.00
Expenses     N
By currency  USD 100
```

The Spend block mixes a non-monetary count (`Expenses`) with monetary figures. Sibling counts (`Accounts`, `Categories`, `Tags`) already live in a dedicated **Counts** block. The expense count belongs with them.

## Goal

Move the `Expenses` row out of the Spend block and into the Counts block, as the first row. No other behavior changes.

## Scope

- TUI presentation only.
- File touched: `src/tui/components/organisms/TripDashboard.tsx`.
- No changes to `core/services/trip/getTripStatus` or the `TripStatus` type — `status.expenseCount` already exists and remains the data source.
- No new tests. `TripDashboard.tsx` has no existing unit tests (it is a pure presentation component); verification is via `bun run check:type`, `bun run check`, and visual inspection.

## Detailed changes

### Change A — `SpendBlock` (currently lines 90–134)

Remove the three lines that render the `Expenses` row:

```tsx
<Box>
  <Text dimColor>{"Expenses".padEnd(labelWidth)}</Text>
  <Text>{"  "}</Text>
  <Text bold>{status.expenseCount}</Text>
</Box>
```

`labelWidth` is currently derived from `"By currency".length` (11). After removal, recompute if needed — the remaining labels (`Total`, `Avg/day`, `By currency`) still fit, so `labelWidth` stays the same and no further changes are needed.

Resulting block:

```
Spend
─────
Total        ฿X,XXX.00
Avg/day      ฿X,XXX.00
By currency  USD 100
             EUR 50
```

### Change B — `CountsBlock` (currently lines 228–253)

Add `Expenses` as the first row, above `Accounts`:

```tsx
<Box>
  <Text dimColor>Expenses</Text>
  <Text>{"    "}</Text>
  <Text bold>{status.expenseCount}</Text>
</Box>
```

The 4-space gap matches the existing `Accounts` row (both labels are 8 chars), keeping the value column aligned. The other rows (`Categories`, `Tags`) already use longer/shorter pads to align their values with the same column.

Resulting block:

```
Counts
──────
Expenses    N
Accounts    N
Categories  N used / N total
Tags        N used / N total
```

### Layout

`CountsBlock` keeps `width={40}` and gains one row. The dashboard's outer flex container uses `flexDirection="row" flexWrap="wrap" gap={2}`, so vertical growth is already handled.

## Out of scope

- Renaming `expenseCount` to `transactionCount` (or any other naming change).
- Adding `Expenses` to `TripList` (the all-trips screen).
- Visual restyling of either block beyond moving the row.
- Adding tests for `TripDashboard.tsx`.

## Verification

- `bun run check:type` passes.
- `bun run check` passes.
- Running `bun run start` and opening a trip overview shows: no `Expenses` row inside Spend; an `Expenses` row at the top of Counts with the correct number.
