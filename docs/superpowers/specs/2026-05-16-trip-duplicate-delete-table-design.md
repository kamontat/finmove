# Trip Duplicate / Delete — Table View

## Goal

Render `/trips/duplicate` and `/trips/delete` with the same table layout as `/trips` (TripList): columns `Name | Start | End | Days | Status`, sorted identically.

## Motivation

The trip list was recently converted to a table (commits `135b621`, `33e5cba`). The dedicated duplicate and delete screens still render as plain vertical lists with `name (startDate — endDate)` rows, which is visually inconsistent. Showing the same columns and sort order on all three screens gives the user a coherent mental model of "the same list, with different actions."

## Design

### Shared row helpers

Export from `src/tui/screens/TripList.tsx`:

- `TRIP_LIST_HEADERS: string[]`
- `buildTripListRows(entries: TripEntry[], todayDate: string): TableCell[][]`

`getPhase` stays a module-private helper inside `TripList.tsx` (only used by `buildTripListRows`).

No new util module — `TripDuplicateSelect.tsx` and `TripDelete.tsx` import directly from `./TripList` (sibling file in `src/tui/screens/`).

### `TripDuplicateSelect.tsx`

- State holds `TripEntry[]` (was `Trip[]`), built once via `sortTrips(listTrips(dataDir), today()).filter(e => e.kind === "ok")`. Keeps the "only healthy trips can be duplicated" rule, but goes through `sortTrips` first so order matches `/trips`.
- Replace `ListSelect` with `TableSelect`:
  - `headers={TRIP_LIST_HEADERS}`
  - `rows={buildTripListRows(entries, today())}`
  - `onChange={(rowIndex) => { const e = entries[rowIndex]; if (!e || e.kind !== "ok") return; goTo("/trips/new", { replace: true, props: { dataDir, duplicateFromDirPath: e.trip.dirPath } }); }}`
  - `isActive` (no focus zone toggle — this screen has no menu)
- Keep yellow border/title theme, current hints, `setMenu([], () => {})`.

### `TripDelete.tsx`

- State holds `TripEntry[]`, built via `sortTrips(listTrips(dataDir), today())` (includes broken trips, same as today).
- Replace `RemoveSelector` with `TableSelect`:
  - Same `headers` and `buildTripListRows` as above.
  - `onChange={(rowIndex) => { const e = entries[rowIndex]; if (!e) return; const dirPath = e.kind === "ok" ? e.trip.dirPath : e.dirPath; deleteTrip(dirPath); const next = sortTrips(listTrips(dataDir), today()); setEntries(next); if (next.length === 0) goBack(); }}`
  - `isActive`.
- Single-Enter confirm (no armed/2-press flow — matches current `RemoveSelector` behavior).
- Keep red border/title theme, `SELECT_REMOVE_HINTS`, `setMenu([], () => {})`.

### Visual consistency on broken trips

`buildTripListRows` already renders broken entries as `⚠ <dirName>` in the Name column with `—` placeholders and `broken` in Status. Because `TripDelete` keeps broken entries and `TripDuplicateSelect` filters them, the duplicate page never shows the `⚠`/`broken` rows — same as today.

## Out of scope

- Menu actions and the trip list itself.
- The `tripTitle` helpers.
- Route map / navigation changes.
- Changing the 2-press confirm on the trip list's `[x]` menu action.

## Test plan

- `bun run check:type`
- `bun run check`
- Manual: open the app, verify `/trips/duplicate` and `/trips/delete` render the same columns and sort order as `/trips`; selecting a row on each route still triggers the existing duplicate/delete flow.
