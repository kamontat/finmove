# Screen-per-Mode Refactor

## Goals

Eliminate the in-screen `Mode` state machines that drive sub-view switching in seven list screens. Turn each distinct sub-view into its own route with props, following the existing router pattern. Keep "select-for-X" (delete/duplicate/remove) on the list page itself, toggled by a `selectMode` route prop. Extract the genuinely duplicated UI pieces (`RemoveSelector`, hint constants, slug helpers) into shared modules.

## Motivation

Seven screens currently implement a local `useState<Mode>` state machine to toggle between list / add / edit / select-for-remove sub-views. Each screen packs 150–320 lines of conditional rendering, with near-identical `useEffect` branches that reconfigure menu/hints/border color per mode. Three cross-cutting patterns are duplicated inline across those screens:

- Red-bordered "select X to remove" selector
- Hint arrays for list mode, form mode, and remove-selection mode
- `toSlug` / `uniqueSlug` helpers (two copies)

Splitting modes into routes restores single-responsibility to each screen file, gives automatic back-navigation for free via the existing router history, and makes the shared UI reusable.

## Routing

### Final route map

```
/trips                           TripList            { dataDir, selectMode? }
/trips/new                       TripCreate          { dataDir }
/trips/duplicate                 TripDuplicate       { dataDir, sourceDirPath, sourceName }
/trips/overview                  TripOverview        { tripDirPath, tripName, dataDir }

/trips/owners                    OwnerList           { tripDirPath, selectMode? }
/trips/owners/new                OwnerCreate         { tripDirPath }
/trips/owners/edit               OwnerEdit           { tripDirPath, ownerId }

/trips/accounts                  AccountList         { tripDirPath, selectMode? }
/trips/accounts/new              AccountCreate       { tripDirPath }
/trips/accounts/edit             AccountEdit         { tripDirPath, accountId }

/trips/expenses                  ExpenseList         (unchanged)
/trips/expenses/form             ExpenseForm         (unchanged)

/trips/settings                  TripSettings        (unchanged)
/trips/settings/countries        CountryList         { tripDirPath, selectMode? }
/trips/settings/countries/new    CountryCreate       { tripDirPath }
/trips/settings/countries/edit   CountryEdit         { tripDirPath, value }
/trips/settings/categories       CategoryList        { tripDirPath, selectMode? }
/trips/settings/categories/new   CategoryCreate      { tripDirPath }
/trips/settings/categories/edit  CategoryEdit        { tripDirPath, value }
/trips/settings/tags             TagList             { tripDirPath, selectMode? }
/trips/settings/tags/new         TagCreate           { tripDirPath }
/trips/settings/tags/edit        TagEdit             { tripDirPath, value }
/trips/settings/currencies       CurrencyList        { tripDirPath, selectMode? }
/trips/settings/currencies/new   CurrencyCreate      { tripDirPath }
/trips/settings/currencies/edit  CurrencyEdit        { tripDirPath, currencyCode }
/trips/settings/export           ExportScreen        (unchanged)
```

### Counts

- **14 new routes**: 7 new-item (`/new` for Trip, Owner, Account, Country, Category, Tag, Currency), 6 edit (`/edit` for Owner, Account, Country, Category, Tag, Currency), 1 duplicate-name form (`/trips/duplicate`).
- **1 route renamed**: `/trips/menu` → `/trips/overview`
- **0 routes removed**

### `selectMode` type

```ts
type SelectMode = "duplicate" | "delete" | "remove";
```

- `"duplicate"` and `"delete"` apply only to `TripList`.
- `"remove"` applies to all other list screens.
- No `"edit"` selectMode: editing is always achieved by clicking a row in browse mode. No Edit menu button on any screen.

## Screen changes

### Split (7 files → 21 files)

| Old file (lines, modes) | New files |
|---|---|
| `TripList.tsx` (323, 5) | `TripList.tsx`, `TripCreate.tsx`, `TripDuplicate.tsx` |
| `OwnerList.tsx` (221, 4) | `OwnerList.tsx`, `OwnerCreate.tsx`, `OwnerEdit.tsx` |
| `AccountList.tsx` (287, 4) | `AccountList.tsx`, `AccountCreate.tsx`, `AccountEdit.tsx` |
| `TripSettingsCurrencies.tsx` (244, 4) | `CurrencyList.tsx`, `CurrencyCreate.tsx`, `CurrencyEdit.tsx` |
| `TripSettingsCountries.tsx` (153, 3) | `CountryList.tsx`, `CountryCreate.tsx`, `CountryEdit.tsx` |
| `TripSettingsCategories.tsx` (153, 3) | `CategoryList.tsx`, `CategoryCreate.tsx`, `CategoryEdit.tsx` |
| `TripSettingsTags.tsx` (153, 3) | `TagList.tsx`, `TagCreate.tsx`, `TagEdit.tsx` |

### Renamed

- `TripMenu.tsx` → `TripOverview.tsx` (route `/trips/overview`). The organism `components/organisms/TripDashboard.tsx` is **not** renamed — no collision.

### Unchanged

`TripSettings.tsx`, `ExpenseList.tsx`, `ExpenseForm.tsx`, `Export.tsx`.

### Browse-mode representation for settings lists

`CountryList`, `CategoryList`, and `TagList` currently render a plain `<Text>• {value}</Text>` bullet list. After the refactor they render a `VerticalSelect` so rows are clickable for edit, matching Owner/Account/Currency behavior.

## Menus per list screen (browse mode)

| Screen | Menu |
|---|---|
| `TripList` | `[c] Create`, `[d] Duplicate`, `[x] Delete` |
| `OwnerList` | `[a] Add`, `[x] Remove` |
| `AccountList` | `[a] Add`, `[x] Remove` |
| `CurrencyList` | `[a] Add`, `[d] Delete` |
| `CountryList` / `CategoryList` / `TagList` | `[a] Add`, `[d] Delete` |

When an item menu entry `[x]` or `[d]` is pressed, the handler calls `goTo(currentPath, { props: { ..., selectMode: "remove" | "delete" } })`. `[c] Create` / `[d] Duplicate` / `[a] Add` navigate to `/new` (or `/trips/duplicate`).

## Row-click behavior

```
TripList:
  selectMode == undefined   → goTo("/trips/overview", { props: { tripDirPath, tripName, dataDir } })
  selectMode == "delete"    → deleteTrip(dirPath); refresh; goBack() if list now empty
  selectMode == "duplicate" → goTo("/trips/duplicate", { props: { dataDir, sourceDirPath, sourceName } })

OwnerList / AccountList / CurrencyList / CountryList / CategoryList / TagList:
  selectMode == undefined → goTo(".../edit", { props: { tripDirPath, <idField> } })
  selectMode == "remove"  → removeItem(); reloadTrip(); goBack() if list now empty
```

## Shared components

### `molecules/RemoveSelector.tsx`

New molecule wrapping the red-bordered "Select X to remove" pattern.

```ts
interface RemoveSelectorProps {
  header: string;
  options: VerticalOption[];
  onConfirm: (value: string) => void;
  onCancel: () => void;
}
```

Internally renders a red `<Text bold>` header followed by a `VerticalSelect` with `color="red"` and `isActive`. Replaces 7 near-identical inline copies.

### `src/tui/constants/hints.ts`

New constants module with the three hint presets:

```ts
export const LIST_HINTS: HelpHint[] = [
  { key: "tab", label: "Switch focus" },
  { key: "←→", label: "Navigate menu" },
  { key: "Enter", label: "Confirm" },
  { key: "q/esc", label: "Back" },
  { key: "e", label: "Exit" },
];

export const FORM_HINTS: HelpHint[] = [
  { key: "↑↓", label: "Navigate" },
  { key: "Enter", label: "Edit field" },
  { key: "q/esc", label: "Back" },
  { key: "e", label: "Exit" },
];

export const SELECT_REMOVE_HINTS: HelpHint[] = [
  { key: "↑↓", label: "Navigate" },
  { key: "Enter", label: "Remove selected" },
  { key: "q/esc", label: "Back to list" },
  { key: "e", label: "Exit" },
];
```

### `src/core/services/slug/`

New core service directory with `toSlug.ts`, `uniqueSlug.ts`, and `index.ts` barrel. Pure functions, no UI imports. Replaces duplicated helpers in `OwnerList.tsx` and `AccountList.tsx`. `toDirName` in `core/services/trip` stays where it is — it's trip-specific (encodes the year suffix).

## Navigation & state mechanics

### Menu actions

Menu buttons on list screens navigate instead of setting local state. `goTo(samePath, differentProps)` pushes the current entry onto history (already works in `NavigationProvider.applyRoute`), so `[q]` returns to the prior props.

### Exiting `selectMode`

Three paths converge on `goBack()`:

1. User presses `[q]` (global) → `goBack()` → browse list.
2. User presses `[esc]` inside the `RemoveSelector` → `onCancel` → `goBack()`.
3. Action leaves the collection empty → screen calls `goBack()`.

### Form submit → back

All create/edit/duplicate screens call `goBack()` after a successful write. `resetLayout()` already runs on every route change in `applyRoute`, so no manual menu/hints/focus reset is needed at the boundary.

### Border color

Screens still call `setBorderColor("red")` from within their effect when `selectMode === "remove" | "delete"`, and `null` otherwise. Hints come from the three constants in `constants/hints.ts`.

## Testing

### Unit tests

Add `__tests__/toSlug.test.ts` and `__tests__/uniqueSlug.test.ts` under `src/core/services/slug/`. Cover:

- `toSlug`: lowercase, non-alphanum → hyphen, strip leading/trailing hyphens
- `uniqueSlug`: returns base when free, appends `-2`, `-3`, … when taken

No TUI unit tests are added — the codebase has no existing TUI test harness; manual smoke-testing is the current verification path.

### Manual smoke-test checklist

Run against a throwaway trip with `bun run start --data-dir /tmp/finmove-smoke`:

**Trip flows**
- `[c]` Create → form → submit → lands on `/trips/overview`.
- `[d]` Duplicate → pick source → name form → submit → back on `/trips`; new trip visible.
- `[x]` Delete → pick → removes; stays in delete mode until list empty, then `goBack()`.
- `[q]` during any selectMode returns to normal list.

**Owner / Account / Currency flows**
- `[a]` Add → form → submit → back on list.
- Row-click in browse mode → edit form prefilled → submit → back on list.
- `[x]` or `[d]` Remove → pick → confirms; stays in remove mode until empty.

**Settings lists (Countries / Categories / Tags)**
- Row-click → edit form (new behavior).
- Add & Delete as above.

**Regression checks**
- `[q]` from deep route navigates up one level at a time.
- `[e]` / `[esc]` exits program from any screen.
- `[tab]` switches focus between main and menu on list screens.
- Border color is red on `selectMode === "remove" | "delete"`, default otherwise.
- Hints update on every route change.

## Build order

Each step leaves the app in a working state.

1. **Extract shared pieces** (no caller changes)
   1. `src/core/services/slug/` (+ unit tests)
   2. `src/tui/constants/hints.ts`
   3. `src/tui/components/molecules/RemoveSelector.tsx`
2. **Router infra**
   1. Extend `RoutePath` union with the new paths.
   2. Rename `/trips/menu` → `/trips/overview`; rename `TripMenu.tsx` → `TripOverview.tsx`; update callers.
3. **Split screens** (simplest first, one family per commit)
   1. Tags, Countries, Categories (identical shape)
   2. Currencies
   3. Owners
   4. Accounts
   5. Trips (most complex — two-step duplicate flow)
4. **Cleanup**
   - Delete old screen files once their replacements are wired up.
   - Replace inline slug helpers with imports from `core/services/slug`.
   - Replace inline hint arrays with imports from `constants/hints`.

## Non-goals

- No changes to `core/services` beyond adding the slug module.
- No changes to `ExpenseList`, `ExpenseForm`, `Export`, `TripSettings`.
- No new validation (e.g., duplicate category name detection on edit) — separate concern; applies equally to existing add paths.
- No changes to global keybindings, focus model, or layout context.
- No introduction of a `useListMenu` hook or `SingleFieldForm` wrapper — `Form` already covers the one-text-field case; the Add/Edit/Remove menu setup is small enough that the hint constants alone remove the duplication.
