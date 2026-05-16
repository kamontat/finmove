# Trip List Table — Design

**Date:** 2026-05-16
**Status:** Approved — ready for implementation plan
**Type:** UI change (TripList rendering) + small cleanup

## Problem

`src/tui/screens/TripList.tsx` renders trips as a `ListSelect` (one row per trip: `name (start — end)`). Other list screens — notably `ExpenseList` — already use the column-aligned `TableSelect` molecule for the same kind of data. The trip list should match.

Separately:

- `src/tui/components/organisms/DataTable.tsx` is no longer referenced from `src/`. Only `docs/` mentions remain (historical specs/plans). It can be deleted.
- `src/tui/screens/expenseListRow.ts` holds row-building helpers shared by `ExpenseList.tsx` and `ExpenseDuplicateSelect.tsx`. Per user preference, these helpers should live inside the screen file as exported helper functions rather than in a separate sidecar module.

## Goals

- Render the trip list as a five-column `TableSelect`: **Name | Start | End | Days | Status**.
- Preserve all current behavior: selection, menu (`[c]` Create, `[d]` Duplicate, `[x]` Delete with armed-row confirm), opening broken trips for details, empty-state message, sort order.
- Drop `BROKEN_PREFIX` and the value-based dispatcher — selection switches to row-index lookup.
- Inline trip row building in `TripList.tsx` (no new sidecar module).
- Merge `expenseListRow.ts` into `ExpenseList.tsx` as exported helper functions; update `ExpenseDuplicateSelect.tsx` to import from `./ExpenseList`.
- Delete `DataTable.tsx`.

## Non-Goals

- Touching `TripDuplicateSelect.tsx` (still uses `ListSelect`, different shape — ok-only).
- Refactoring `getTripStatus` to extract a shared `getPhase` helper (phase logic is 3 lines; inline in both places is fine).
- Changing `TableSelect` itself.
- Coloring the broken row's `Status` cell (matches the preview the user picked — plain text; ⚠ icon on the Name cell is the visual marker).

## Architecture

### Columns

```
Name              Start         End           Days   Status
Bangkok 2025      2025-01-10    2025-01-20    11     ended
Tokyo 2026        2026-03-01    2026-03-14    14     upcoming
⚠ bad-dir         —             —             —      broken
```

- **Name** — `trip.settings.name` for ok rows; `⚠ ${dirName}` for broken rows.
- **Start / End** — `trip.settings.startDate` / `endDate` for ok; `"—"` for broken.
- **Days** — `daysBetween(startDate, endDate) + 1` for ok; `"—"` for broken. (Matches `getTripStatus.totalDays`.)
- **Status** — `"upcoming"` / `"ongoing"` / `"ended"` for ok (same rule as `getTripStatus`); `"broken"` for broken. All plain text.

### Phase rule (inlined in `TripList.tsx`)

```ts
function getPhase(startDate: string, endDate: string, today: string): "upcoming" | "ongoing" | "ended" {
  if (today < startDate) return "upcoming";
  if (today > endDate) return "ended";
  return "ongoing";
}
```

Mirrors `getTripStatus.ts` lines 63–72. Not extracted to `core/services/trip/` — only two call sites, both 3-line conditionals; extraction would add a file for net-zero clarity gain.

### `TripList.tsx` rewrite

Top-level helpers in the file:

```ts
const TRIP_LIST_HEADERS = ["Name", "Start", "End", "Days", "Status"];

function getPhase(...): "upcoming" | "ongoing" | "ended" { ... }

function buildTripListRows(entries: TripEntry[], today: string): TableCell[][] {
  return entries.map((e) => {
    if (e.kind === "ok") {
      const { name, startDate, endDate } = e.trip.settings;
      const days = daysBetween(startDate, endDate) + 1;
      return [
        { text: name },
        { text: startDate },
        { text: endDate },
        { text: String(days) },
        { text: getPhase(startDate, endDate, today) },
      ];
    }
    return [
      { text: `⚠ ${e.dirName}` },
      { text: "—" },
      { text: "—" },
      { text: "—" },
      { text: "broken" },
    ];
  });
}
```

Render:

```tsx
<TableSelect
  headers={TRIP_LIST_HEADERS}
  rows={buildTripListRows(entries, today())}
  onChange={(rowIndex) => {
    const entry = entries[rowIndex];
    if (!entry) return;
    if (entry.kind === "broken") {
      goTo("/trips/broken", { props: { dirName: entry.dirName, dirPath: entry.dirPath, error: entry.error, dataDir } });
      return;
    }
    goTo("/trips/overview", { props: { tripDirPath: entry.trip.dirPath, tripName: entry.trip.settings.name, dataDir } });
  }}
  onHighlight={setActiveIndex}
  armedRowIndex={armed?.index ?? null}
  isActive={focus === "main"}
/>
```

Removed: `BROKEN_PREFIX` constant, the `value.startsWith(BROKEN_PREFIX)` branching, the `entries.find(...)` lookups by value string.

Menu (`[c]`, `[d]`, `[x]`) and armed-row delete/duplicate behavior unchanged — `mainAction` callbacks still receive the row index from the menu system and use it the same way.

### `ExpenseList.tsx` merge

Move from `expenseListRow.ts` into `ExpenseList.tsx`:

- `export const EXPENSE_LIST_HEADERS` (top of file)
- `export function buildExpenseListRows(trip: Trip): TableCell[][]`
- Private helpers `formatFinanceNumber` and `formatOwnersCell` (file-scope, not exported)

These sit above the `ExpenseList` component function. `TableCell` is still imported from `../components/molecules/TableSelect` as before.

### `ExpenseDuplicateSelect.tsx` import update

```ts
- import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./expenseListRow";
+ import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./ExpenseList";
```

This creates a screen-to-screen import. Accepted per user preference — the alternative (keeping the sidecar file) was explicitly rejected.

### Deletions

- `src/tui/screens/expenseListRow.ts` — contents moved into `ExpenseList.tsx`.
- `src/tui/components/organisms/DataTable.tsx` — no `src/` callers.

## Behavior Invariants to Preserve

- Empty state: `"No trips yet. Press [c] to create one."` still renders when `entries.length === 0`.
- `sortTrips` order unchanged.
- Title (`["Trips"]`), color, hints, menu, armed-row delete/duplicate confirm — all unchanged.
- Selecting an ok row → `/trips/overview` with `tripDirPath`, `tripName`, `dataDir`.
- Selecting a broken row → `/trips/broken` with `dirName`, `dirPath`, `error`, `dataDir`.
- Delete that empties the list → `goBack()`.
- `clearByPrefix("trip-")` still runs on mount.
- Existing form-buffer clear and `useRouteProps("/trips")` behavior unchanged.

For ExpenseList / ExpenseDuplicateSelect: no behavior change. Same rows, same headers, same routing — only the import path moves.

## Verification

- `bun run check:type`
- `bun run check`
- `bun test`
- Manual smoke:
  - Trip list renders as table with 5 columns; pad widths align.
  - Cursor moves with `↑↓`; `[Enter]` opens trip overview.
  - Broken trip row shows `⚠ name` + `—` cells + `broken` status; `[Enter]` opens `/trips/broken`.
  - `[c]` → create flow; `[d]` armed → duplicate from row; `[x]` armed twice → deletes row; deleting last trip returns to previous screen.
  - Empty state message renders when no trips.
  - ExpenseList still renders identically (regression check on the helper move).
  - ExpenseDuplicateSelect still renders identically.

## Risk

Low.

- `TripList.tsx` is the only changed behavior — same data, same routes, different rendering. The row-index-based `onChange` is the same pattern already used by `ExpenseList`.
- The `expenseListRow.ts` merge is a pure refactor — same exports, different file. Both callers updated in the same commit.
- `DataTable.tsx` deletion: pre-verified no `src/` references; only doc mentions remain (historical, no callers).
