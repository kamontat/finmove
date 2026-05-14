# Unify Duplicate Flow

## Goal

Make the duplicate experience consistent across expenses and trips, and make duplicate mode visually obvious. Three coordinated changes:

1. After submitting a duplicate expense, land on the expense list (not back on the duplicate-picker).
2. The duplicate-picker screens render with a yellow border so the user can see at a glance they're in duplicate mode.
3. Trip duplication uses the same screen as trip creation (a `TripForm` that handles both new and duplicate modes), mirroring how `ExpenseForm` already handles new / edit / duplicate.

## Change 1 — Submit-from-expense-duplicate lands on list

### Today

`ExpenseForm.handleSubmit` calls `goBack()`. In duplicate mode the history stack at submit time is `[..., list, picker]` with the form on top, so `goBack()` lands on the picker. The user then has to press `q` again to reach the list.

### Change

Extend `goBack` in `src/tui/states/navigation.tsx` to accept an optional `steps` parameter:

```ts
goBack: (steps?: number) => void;   // default 1
```

Implementation pops `steps` entries off the history ref. If history empties before `steps` reach zero, `exit()` (matches existing "no history → exit" behavior). `steps <= 0` is a no-op.

In `ExpenseForm.tsx` submit handler:

```ts
if (duplicateFromId && !existingExpense) {
    goBack(2);   // pop form + picker → expense list
} else {
    goBack();    // new and edit unchanged
}
```

Cancel (`q`/`esc`) from the form continues to call the global single-step `goBack`, so the user lands on the picker — matching the current behavior.

## Change 2 — Yellow border on duplicate-pickers

The codebase already uses border color as a mode indicator: red for delete, default cyan for everything else. Duplicate mode currently looks identical to a normal list, which makes it easy to mistake the picker for the regular list.

### Change

Both picker screens set the border color to `"yellow"` in their layout effect, and restore `null` on cleanup:

- `src/tui/screens/ExpenseDuplicateSelect.tsx`
- `src/tui/screens/TripDuplicateSelect.tsx`

Existing `setBorderColor(null)` lines become `setBorderColor("yellow")`. Cleanup returns from the effect already exist for `setTitleSuffix(null)`; extend them to call `setBorderColor(null)` too so the border color resets when the screen unmounts.

Out of scope for color: `TripDuplicateForm` (deleted in Change 3), `ExpenseForm` in duplicate mode (keeps default cyan — the form fields and the `Duplicate of: <payee>` title already convey the mode).

## Change 3 — Unify trip duplicate into `TripForm`

### Today

- `TripCreate.tsx` (route `/trips/new`) renders a 5-field form: name, dirName, startDate, endDate, countries. Submit calls `createTrip` then routes to the new trip's overview.
- `TripDuplicateForm.tsx` (route `/trips/duplicate/new`) renders a 1-field form: newName. Submit calls `duplicateTrip(dataDir, sourcePath, newDirName, newName)` which `cpSync`s the whole source dir and rewrites only the `name` field in `settings.yaml`. The user cannot customize startDate, endDate, or countries when duplicating.

### Change

Rename `TripCreate.tsx` → `TripForm.tsx` (file rename, function rename `TripCreate` → `TripForm`). The renamed screen handles both new and duplicate modes, mirroring how `ExpenseForm` handles new / edit / duplicate.

**Route model (`src/tui/models/index.ts`):**

- Add `duplicateFromDirPath?: string` to the `/trips/new` route params.
- Remove the `/trips/duplicate/new` route entry entirely.

**`TripForm.tsx`:**

- Reads `duplicateFromDirPath` via `useRouteProps("/trips/new")`.
- When set, loads source via `loadTrip(duplicateFromDirPath)`. Source is non-fatal-on-missing — if the source no longer exists, fall through to fresh-new behavior (defensive; shouldn't happen via the picker).
- Pre-fill rules:
  - `name` — no `defaultValue` in duplicate mode (user must type a new name, otherwise the duplicate-detection check rejects on submit).
  - `dirName` — no explicit `defaultValue`; the existing placeholder logic auto-derives from new name + startDate when blank.
  - `startDate` — `defaultValue: source.settings.startDate` in duplicate mode, else `today()` (current behavior).
  - `endDate` — `defaultValue: source.settings.endDate` in duplicate mode, else `addDays(today(), 1)` (current behavior).
  - `countries` — in duplicate mode, pre-seed the form buffer with `source.settings.countries` so the `countries` field shows the existing list. Existing TripCreate has no `defaultValue` for `countries` (it's a multiselect with sub-page navigation); the pre-seed uses the same buffer mechanism `ExpenseForm` uses for `owners`/`tags` in duplicate mode.
- `formId`: `trip-duplicate-${duplicateFromDirPath}` in duplicate mode, else `trip-new` (unchanged).
- Title suffix: when in duplicate mode, `setTitleSuffix(\`Duplicate of: ${source.settings.name}\`)`. Otherwise `setTitleSuffix(null)` (current behavior). Cleanup on unmount.
- Submit branches:
  - New mode (no `duplicateFromDirPath`): unchanged — `createTrip(...)` then `goTo("/trips/overview", { replace: true, ... })`.
  - Duplicate mode: validate name and dirName the same way as new (dirName uniqueness, slug validity), then call the widened `duplicateTrip(...)` (see below) with the user's overrides. After success, `buffer.clear()` then `goBack(2)` — lands on the trip list, popping form + picker. This matches the current `TripDuplicateForm` behavior of going back to the trips list.

**Service (`src/core/services/trip/duplicateTrip.ts`):**

Widen the signature to accept settings overrides for the fields the form now exposes:

```ts
export function duplicateTrip(
    dataDir: string,
    sourcePath: string,
    newDirName: string,
    overrides: {
        name: string;
        startDate: string;
        endDate: string;
        countries: string[];
    },
): Trip;
```

Implementation: `cpSync(sourcePath, destPath, { recursive: true })`, read `destPath/settings.yaml`, apply the four overrides, write back. Preserve `baseCurrency`, `currencies`, `categories`, `tags`, `exportPath` from the source. Return `loadTrip(destPath)` (unchanged).

**`TripDuplicateSelect.tsx`:**

Update the navigation target from `/trips/duplicate/new` to `/trips/new` with the new prop shape:

```ts
goTo("/trips/new", {
    props: { dataDir, duplicateFromDirPath: trip.dirPath },
});
```

The spread-out `sourceDirPath`/`sourceName`/`sourceStartDate` props are no longer needed because `TripForm` loads the source itself.

**File renames and deletions:**

- Rename `src/tui/screens/TripCreate.tsx` → `src/tui/screens/TripForm.tsx`. Function export renamed `TripCreate` → `TripForm`.
- Delete `src/tui/screens/TripDuplicateForm.tsx`.
- `src/tui/router.ts`: update the import (`TripCreate` → `TripForm`) and remove the `/trips/duplicate/new` route entry.
- `src/tui/App.tsx`: remove the `case "/trips/duplicate/new":` breadcrumb. The `/trips/new` breadcrumb (`Trips > New`) remains unchanged; the title suffix from `TripForm` provides the duplicate-of context.

## Files

- `src/tui/states/navigation.tsx` — widen `goBack`
- `src/tui/screens/ExpenseForm.tsx` — branch in submit
- `src/tui/screens/ExpenseDuplicateSelect.tsx` — yellow border + cleanup reset
- `src/tui/screens/TripDuplicateSelect.tsx` — yellow border + cleanup reset + new navigation target
- `src/tui/screens/TripCreate.tsx` → `src/tui/screens/TripForm.tsx` (renamed; widened to handle duplicate mode)
- `src/tui/screens/TripDuplicateForm.tsx` — **deleted**
- `src/tui/models/index.ts` — add `duplicateFromDirPath` to `/trips/new`, remove `/trips/duplicate/new`
- `src/tui/router.ts` — rename import, drop `/trips/duplicate/new` route
- `src/tui/App.tsx` — drop `/trips/duplicate/new` breadcrumb case
- `src/core/services/trip/duplicateTrip.ts` — widen signature, accept settings overrides

## Out of Scope

- Auto-routing to the duplicated trip's overview after submit. Trip duplicate continues to land on the trips list, matching today's behavior.
- Border color change for `ExpenseForm` in duplicate mode.
- Renaming `/trips/new` route. Path stays the same even though the screen now handles both modes — keeps URL stability and minimizes diff churn.
- Adding an "edit" mode to `TripForm`. The screen handles new and duplicate; edits to existing trips still happen via `TripSettings`.

## Testing

- No unit tests for the screen changes (consistent with the codebase: TUI screens are manually verified).
- Existing service tests for `duplicateTrip` need to be updated to the new signature. If no existing tests cover `duplicateTrip`, add a minimal test covering the override-merge behavior (overrides applied, `categories`/`tags`/`currencies`/`exportPath`/`baseCurrency` preserved from source).
- Manual TUI verification:
  - Duplicate an expense: picker has yellow border; pick a row → form opens with cyan border; submit → lands on expense list (not picker). Cancel from form lands on picker.
  - Duplicate a trip: picker has yellow border; pick a row → `TripForm` opens with title `Trips > New > Duplicate of: <sourceName>` and dates/countries pre-filled but name blank; edit fields freely; submit → trip is created in a new directory with the user's overrides and the source's owners/accounts/expenses copied across; user lands on trips list.
  - Create a trip the normal way (`[c]` on trip list): unchanged behavior — fresh form, lands on the new trip's overview.
  - Cancel from `TripForm` in duplicate mode (q): lands on trip duplicate-picker (one step back).
