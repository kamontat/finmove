# Delete / Duplicate Dedicated Paths

**Date:** 2026-05-14
**Status:** Draft

## Goal

Move the inline `selectMode` delete/duplicate UI off every list screen and onto dedicated child routes. After this change, no route in `src/tui/models/index.ts` carries a `selectMode` prop, and each list screen is responsible only for rendering the list.

This continues the per-route-screen direction set by `2026-04-24-screen-per-mode-refactor-design.md`. Owners and accounts were partially done in recent commits (delete-via-references), but they still use `selectMode: "remove"` on the list route to drive the picker. This spec finishes the job for those two and applies the same pattern to the remaining seven list screens.

## Scope

All nine list screens currently using `selectMode`:

- `/trips` (modes: `delete`, `duplicate`)
- `/trips/owners` (mode: `remove`)
- `/trips/accounts` (mode: `remove`)
- `/trips/expenses` (modes: `remove`, `duplicate`)
- `/trips/settings/countries` (mode: `remove`)
- `/trips/settings/categories` (mode: `remove`)
- `/trips/settings/tags` (mode: `remove`)
- `/trips/settings/currencies` (mode: `remove`)
- `/trips/new/countries` (mode: `remove`)

Out of scope:
- Core services (`removeOwner`, `deleteTrip`, etc.) — unchanged.
- References screens (`/trips/owners/references`, `/trips/accounts/references`) — unchanged; the new delete screens navigate to them just as the list screens currently do.
- Other inline behaviors on the list screens (edit-on-Enter, etc.) — unchanged.
- Visual UI of the delete operation — still red border + `RemoveSelector` + `SELECT_REMOVE_HINTS`.

## Naming

- Path segment: `delete` and `duplicate`. Used consistently for every entity, including those whose previous menu label was "Remove".
- Menu label: "Delete" everywhere (previously "Remove" on most screens).
- Menu shortcut: `[x]` everywhere. `[d]` continues to mean "Duplicate" where applicable.
- File names follow existing PascalCase convention: `OwnerDelete.tsx`, `ExpenseDuplicateSelect.tsx`, etc.
- The existing `TripDuplicate.tsx` (the duplicate **form**) is renamed `TripDuplicateForm.tsx` so it pairs with the new `TripDuplicateSelect.tsx` picker. Its route moves from `/trips/duplicate` (which becomes the picker path) to `/trips/duplicate/new`.

## Route changes

### Renamed
- `/trips/duplicate` (form) → `/trips/duplicate/new` (same component, now `TripDuplicateForm`).

### Added

| New path | Component | Title suffix | Default focus | Border |
|---|---|---|---|---|
| `/trips/delete` | `TripDelete` | `Delete` | `main` | `red` |
| `/trips/duplicate` | `TripDuplicateSelect` | `Duplicate` | `main` | (default) |
| `/trips/owners/delete` | `OwnerDelete` | `Owners > Delete` | `main` | `red` |
| `/trips/accounts/delete` | `AccountDelete` | `Accounts > Delete` | `main` | `red` |
| `/trips/expenses/delete` | `ExpenseDelete` | `Expenses > Delete` | `main` | `red` |
| `/trips/expenses/duplicate` | `ExpenseDuplicateSelect` | `Expenses > Duplicate` | `main` | (default) |
| `/trips/settings/countries/delete` | `CountryDelete` | `Settings > Countries > Delete` | `main` | `red` |
| `/trips/settings/categories/delete` | `CategoryDelete` | `Settings > Categories > Delete` | `main` | `red` |
| `/trips/settings/tags/delete` | `TagDelete` | `Settings > Tags > Delete` | `main` | `red` |
| `/trips/settings/currencies/delete` | `CurrencyDelete` | `Settings > Currencies > Delete` | `main` | `red` |
| `/trips/new/countries/delete` | `TripCreateCountryDelete` | `Countries > Delete` | `main` | `red` |

**Breadcrumb mechanism:** `App.tsx` builds the breadcrumb from a hardcoded `switch (currentRoute.path)` and appends `titleSuffix` from `useLayout()`. The route-table `title` field is currently unused for breadcrumbs. To minimise churn, the new screens set their breadcrumb segment via `setTitleSuffix(...)` rather than expanding the switch. This matches how settings list screens already inject `Settings > <section>` into the breadcrumb today. Route-table `title` entries are still added for consistency with sibling routes.

### Modified
- `src/tui/models/index.ts`:
  - Drop `selectMode` from every list-screen entry.
  - Add the 11 new entries above; each accepts the same props as its parent list (typically `{ tripDirPath: string }` or `{ tripDirPath: string; tripName?: string }`). `/trips/delete` and `/trips/duplicate` take `{ dataDir?: string }`.
- `src/tui/router.ts`: register the 11 new components and the renamed `TripDuplicateForm`.

## Per-screen behavior

Each new delete/duplicate screen is responsible for:

1. Reading its own route props.
2. Loading the relevant data (`trip` from `useData()` for trip-scoped entities; `listTrips` for `/trips/delete`).
3. Calling `useLayout()` to set the red border (delete only), empty menu, and `SELECT_REMOVE_HINTS` or `SELECT_DUPLICATE_HINTS`.
4. Rendering `RemoveSelector` (delete) or `ListSelect`/`TableSelect` (duplicate picker).
5. Handling the confirm callback — exact same logic that lives in each list screen's `selectMode` branch today, including references navigation for owner/account delete and `goBack()` when the underlying list becomes empty.

Each list screen is then trimmed:

- Remove the `selectMode` prop usage and `useRouteProps` destructuring.
- Remove the `selectMode === "..."` branches in the `useEffect` for layout setup.
- Remove the `selectMode === "..."` branches in the render path.
- Update menu items: label `Remove` → `Delete`; `onSelect` calls `goTo("/trips/.../delete", { props })` (or `/duplicate` where applicable) instead of `goTo(self, { selectMode: ... })`.
- `useEffect` deps for focus and layout setup lose `selectMode`.

## Test plan

This is a routing/component restructure with no business-logic change. The existing core service tests stay green by construction.

Manual verification (one trip with a few owners/accounts/expenses/etc.):
1. From each list screen, press `[x]` — confirm navigation to the new `/delete` path, breadcrumb shows `... > Delete`, red border applied, `RemoveSelector` shown.
2. Confirm an item deletes correctly, list updates, and when the list empties the screen goes back.
3. For owners/accounts: confirm delete of a referenced item still navigates to the references screen.
4. Press `[d]` on `/trips` and `/trips/expenses` — confirm picker on its own path, no red border, selecting an item navigates to the duplicate form (`/trips/duplicate/new` or `/trips/expenses/form` with `duplicateFromId`).
5. Confirm `[q]`/`[esc]` from a delete or duplicate screen returns to its list.

## Risks / non-risks

- **Path-string typos:** caught at compile time by `RouteParams` since every `goTo` is typed.
- **Forgotten breadcrumb segment:** new screens must call `setTitleSuffix(...)` per the table above; without it, the breadcrumb loses the trailing `Delete`/`Duplicate` segment.
- **Duplicate route name conflict on /trips:** resolved by renaming the existing form route to `/trips/duplicate/new`.
