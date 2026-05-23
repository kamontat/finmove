# Dashboard Spend Excluding Categories + Avg/Day/Person

## Summary

Two related additions to the trip dashboard:

1. Mark categories as "excluded from total" so the dashboard can report a second total spend that omits them (e.g., shopping). Excluded flag lives on each category, mirroring how tags carry a `default: boolean`.
2. Show per-person daily averages, divided by `trip.owners.length`.

Both totals come in pairs (full / excluded) so the user can compare lumpy categories against "everyday" spend.

## Goals

- Promote category from `string` to `{ value, excluded }` so exclusion is a first-class property.
- Surface 4 new derived numbers on the dashboard: `totalSpendExcludedThb`, `avgPerDayExcludedThb`, `avgPerDayPerPersonThb`, `avgPerDayPerPersonExcludedThb`.
- Keep all derivation in `core/` (pure, testable). UI stays presentational.
- Migrate existing v1 trip files automatically without user action.

## Non-goals

- No new menu item under Settings. Exclusion toggled inline on Category Create/Edit forms.
- No reporting elsewhere (CSV export untouched).
- No bulk-toggle UI; one category at a time via existing forms.
- No "rename propagation" code path — `excluded` lives on the category itself, so rename naturally carries it.
- No new keyboard shortcuts on Category list.

## Data model

### New `Category` type

```ts
// src/core/models/category.ts
export interface Category {
  value: string;
  excluded: boolean;
}
```

Re-exported from `src/core/models/index.ts`.

### `Settings` change

```ts
// src/core/models/settings.ts
export interface Settings {
  version: 2;            // bumped
  // ... unchanged fields
  categories: Category[]; // was: string[]
  // ... unchanged fields
}
```

`DEFAULT_CATEGORIES` becomes `Category[]` with `excluded: false` for each entry. `DEFAULT_TRIP_SETTINGS.version` becomes `2`.

### Schema v2 + migration

New files:

- `src/core/configs/trip/schemas/v2.ts` — zod schema identical to v1 except `version: z.literal(2)` and `categories: z.array(z.object({ value: z.string(), excluded: z.boolean() }))`.
- `src/core/configs/trip/migrations/v1_to_v2.ts` — maps each legacy `string` category to `{ value, excluded: false }` and sets `version: 2`.

`src/core/configs/trip/definition.ts` registers v2 as `latestVersion: 2` and wires `v1_to_v2`. The existing v0→v1 migration unchanged.

## Derivation

### `TripStatus` additions

```ts
// src/core/services/trip/getTripStatus.ts
export interface TripStatus {
  // ... existing fields unchanged
  totalSpendThb: number;                       // existing
  totalSpendExcludedThb: number;               // NEW
  avgPerDayThb: number;                        // existing
  avgPerDayExcludedThb: number;                // NEW
  avgPerDayPerPersonThb: number;               // NEW
  avgPerDayPerPersonExcludedThb: number;       // NEW
  hasExcludedCategories: boolean;              // NEW — drives UI gating
  // ... existing fields unchanged
}
```

### Compute

Build `excludedSet = new Set(settings.categories.filter(c => c.excluded).map(c => c.value))` before the expense loop.

Inside the existing loop, after `thb` is computed and the existing `totalSpendThb += thb` line:

```ts
if (!excludedSet.has(expense.category)) {
  totalSpendExcludedThb += thb;
}
```

After the loop:

```ts
const ownerCount = trip.owners.length;
const avgPerDayThb              = elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;
const avgPerDayExcludedThb      = elapsedDays > 0 ? round2(totalSpendExcludedThb / elapsedDays) : 0;
const avgPerDayPerPersonThb         = (elapsedDays > 0 && ownerCount > 0) ? round2(totalSpendThb / elapsedDays / ownerCount) : 0;
const avgPerDayPerPersonExcludedThb = (elapsedDays > 0 && ownerCount > 0) ? round2(totalSpendExcludedThb / elapsedDays / ownerCount) : 0;
const hasExcludedCategories = excludedSet.size > 0;
```

`categoryCount.total` reads `settings.categories.length` (still works). `topCategories` continues to key by `expense.category` (string) — no change.

## UI

### SpendBlock (`src/tui/components/organisms/TripDashboard.tsx`)

Row order, conditionally rendered:

```
Total                  (always)
Excl.                  (only if hasExcludedCategories)
Avg/day                (always)
Avg/day excl.          (only if hasExcludedCategories)
Avg/day/person         (only if hasOwners)
Avg/day/person excl.   (only if hasExcludedCategories && hasOwners)
By currency            (always, existing)
```

`hasOwners = status.ownerBalances.length > 0`. `hasExcludedCategories = status.hasExcludedCategories`.

Column widths recalculated to fit the longest label (`Avg/day/person excl.`). Bump `labelWidth` to that length; keep numeric column right-aligned via `padStart`. Box `width={40}` may need a small bump to accommodate the longer labels; verify visually.

### CategoryList (`src/tui/screens/CategoryList.tsx`)

Each row label becomes `${marker} ${category.value}` where `marker = category.excluded ? "[ ]" : "[✓]"`. Reads `.value` instead of treating items as strings. Delete handler filters by `.value`.

### CategoryCreate (`src/tui/screens/CategoryCreate.tsx`)

Add second form field:

```ts
{
  key: "excluded",
  label: "Exclude from total",
  type: "select",
  required: true,
  options: [
    { label: "No", value: "no" },
    { label: "Yes", value: "yes" },
  ],
  defaultValue: "no",
}
```

On submit, append `{ value, excluded: values.excluded === "yes" }`.

### CategoryEdit (`src/tui/screens/CategoryEdit.tsx`)

Add same `excluded` select with `defaultValue` reflecting the current category. The screen receives `originalValue` (string) via route props today — extend to also load the current `Category` from `trip.settings.categories.find(c => c.value === originalValue)`. On submit, replace the matched entry with `{ value: next, excluded: nextExcluded }`.

### CategoryDelete / CategorySelect

Adapt iteration to `.value`. No behavior change.

### Other readers

- `src/core/validators/*` — anywhere category names are compared against `settings.categories`, switch to `c.value`.
- `src/core/services/expense/*` — if any service consumes `settings.categories`, switch to `c.value`.
- `src/tui/screens/ExpenseForm.tsx` — wherever category options are built from `settings.categories`, switch to `c.value`.

(Exhaustive list determined during plan; spec calls out the pattern.)

## File touch list

**New**
- `src/core/models/category.ts`
- `src/core/configs/trip/schemas/v2.ts`
- `src/core/configs/trip/migrations/v1_to_v2.ts`

**Modified**
- `src/core/models/index.ts`
- `src/core/models/settings.ts`
- `src/core/constants/defaults.ts`
- `src/core/configs/trip/definition.ts`
- `src/core/services/trip/getTripStatus.ts`
- `src/tui/components/organisms/TripDashboard.tsx`
- `src/tui/screens/CategoryList.tsx`
- `src/tui/screens/CategoryCreate.tsx`
- `src/tui/screens/CategoryEdit.tsx`
- `src/tui/screens/CategoryDelete.tsx`
- `src/tui/screens/CategorySelect.tsx`
- Any validator/service/screen that reads `settings.categories` as strings
- Test fixtures using `categories: ["..."]` literals — converted to `Category[]`

## Testing

| Test | Cases |
|---|---|
| `getTripStatus.test.ts` | excluded total < total when category excluded; excluded total = total when no exclusions; avg/day excl. correct; per-person divides by `owners.length`; ownerCount=0 yields per-person fields = 0; elapsedDays=0 yields all averages = 0; multiple excluded categories sum correctly; expenses with missing THB rate not counted in either total |
| New migration test (`v1_to_v2` in existing `configs/__tests__/trip.test.ts` or new file) | string[] categories become Category[] with `excluded: false`; version bumps to 2 |
| `updateSettings.test.ts` | round-trip of `categories` array preserves `excluded` flag |
| Existing tests | Fixtures using `categories: ["..."]` updated to Category[] shape; expectations unchanged |

No Ink/snapshot tests added (consistent with project convention).

## Edge cases

- Trip file at v0: still migrates v0→v1→v2 via existing kernel chaining.
- Excluded category later un-excluded: re-render, exclusion rows hide if no excludes remain.
- Excluded category deleted while still referenced by expenses: `excludedSet` rebuilds from current `settings.categories`, which no longer contains the deleted name. Those orphaned expenses become *included* in `totalSpendExcludedThb` (they're no longer excluded). Acceptable — deletion implies the category is no longer special.
- Two categories with same `value`: validators must reject duplicates on add/rename. Existing validator already enforces unique category names (verify in plan; if not, add).

## Out of scope

- Multi-tag-style "default" semantics for categories (only `excluded` for now).
- Bulk import/export of excluded categories.
- Per-category color or icon.
