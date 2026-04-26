# Trip Countries, Zvent Auto-Tag, and Default Tags

## Problem

Three related gaps in the trip-creation flow:

1. **No way to record visited countries on trip create.** Countries are
   editable post-creation via Settings > Countries, but the create form
   skips them entirely.
2. **No standardised event tag.** Each trip should carry a per-trip event
   identifier of the form `Zvent: <id> <name> (<endMonth> <endYear>)` so
   expenses can be grouped consistently across trips.
3. **No "default tag" mechanism.** Tags listed in `settings.tags` are
   currently inert — the user must re-type them on every expense. Default
   tags should be auto-applied to every new expense in a trip.

## Decisions

### D1 — Countries input on TripCreate

Add a single comma-separated text field. Parsed by split-on-`,` + trim
+ drop-empties, mirroring the existing pattern used for expense tags and
owners. No new Form component types needed.

### D2 — Zvent id is optional, auto-incremented

The `<id>` is a 3-digit string (e.g., `"001"`, `"042"`, `"123"`). The
TripCreate / TripDuplicate forms accept it as an **optional** input:

- Blank → call `nextZventId(dataDir)` to compute `max(existing) + 1`,
  padded to 3 digits, falling back to `"001"` when no existing trip has
  a Zvent tag.
- Provided → validated against `/^\d{3}$/`. Invalid input shows an
  inline error.

If the auto-computed id would exceed 3 digits (max found is `"999"`),
the function returns `"999"` and the user is expected to override.
Collision is acceptable; the id is informational, not a primary key.

### D3 — Default tags = `settings.tags`

The existing `Settings.tags: string[]` field IS the default-tags list.
No schema change, no migration. Settings > Tags remains the management
UI.

### D4 — Domain rule lives in `addExpense`

`addExpense(trip, expense)` merges `trip.settings.tags` into
`expense.tags` (defaults first, then user tags, deduplicated). Any
caller — TUI, future web frontend, programmatic — gets the behavior.
`updateExpense` is **not** changed: edits don't re-apply defaults, so
removing a default from one expense sticks.

### D5 — TripDuplicate prompts for a fresh Zvent id

Carrying the source trip's Zvent id verbatim would make the new trip
ambiguous. The duplicate form gains the same optional `zventId` field;
on submit, any tag matching `ZVENT_TAG_REGEX` in the duplicated
settings is stripped and the new Zvent tag is prepended.

The duplicate uses the source's carried-over `endDate` (the duplicate
form does not collect a new end date). User can edit afterwards via
TripSettings.

### D6 — Trip constants move to `core/constants/`

User-requested. The `DEFAULT_SETTINGS` constant currently inlined at
`TripCreate.tsx:16` (and adjacent literals like the default categories
list and `"./expenses.csv"` export path) move into a new
`src/core/constants/` directory. The TUI imports from there.

## Architecture

### File layout

```
src/core/
├── constants/                  ← NEW directory
│   ├── defaults.ts             ← DEFAULT_TRIP_SETTINGS, DEFAULT_CATEGORIES,
│   │                             DEFAULT_EXPORT_PATH, DEFAULT_BASE_CURRENCY
│   ├── zvent.ts                ← ZVENT_TAG_PREFIX, ZVENT_ID_PATTERN,
│   │                             ZVENT_DEFAULT_ID, ZVENT_TAG_REGEX
│   └── index.ts                ← barrel
└── services/
    ├── trip/
    │   ├── buildZventTag.ts    ← NEW
    │   ├── nextZventId.ts      ← NEW
    │   ├── parseZventId.ts     ← NEW (helper)
    │   └── index.ts            ← updated barrel
    └── expense/
        └── addExpense.ts       ← merge defaults

src/tui/screens/
├── TripCreate.tsx              ← +countries, +zventId; reads DEFAULT_TRIP_SETTINGS
├── TripDuplicate.tsx           ← +zventId; rebuild Zvent tag post-duplicate
└── ExpenseForm.tsx             ← Tags label shows defaults
```

### `buildZventTag(id, name, endDate) → string`

Returns `Zvent: <id> <name> (<MMM> <YYYY>)`.

- `<MMM>` is short month name in English: `Jan`, `Feb`, …, `Dec`.
  Implemented with a 12-element constant table indexed by
  `new Date(endDate).getUTCMonth()` (avoids locale variance from
  `Intl.DateTimeFormat`).
- `<YYYY>` is `getUTCFullYear()` of the parsed endDate.

Inputs are trusted; no escaping/validation of `name` (consistent with
how trip names flow elsewhere in the codebase).

### `nextZventId(dataDir) → string`

1. Call `listTrips(dataDir)`.
2. For each trip, read `settings.yaml`, iterate `settings.tags`, run
   each through `parseZventId`.
3. Collect non-null parsed ids as integers.
4. Return `String(max + 1).padStart(3, "0")`, or `"001"` if none.
5. Clamp at `"999"` if the computed value exceeds 999.

Performance: trips are typically <100; reading each settings.yaml
synchronously is fine. No caching needed.

### `parseZventId(tag) → string | null`

Single-line: `tag.match(ZVENT_TAG_REGEX)?.[1] ?? null`.

### `addExpense` change

```ts
// after existing validations, before writing:
const defaults = trip.settings.tags;
const merged = [...defaults];
for (const t of expense.tags) {
  if (!merged.includes(t)) merged.push(t);
}
const expenseToWrite = { ...expense, tags: merged };
```

Order preserved (defaults first, user tags after) for predictable test
output and a stable display order in `ExpenseList`.

### TripCreate form fields

Final field order:

| key         | label                                  | type | required |
|-------------|----------------------------------------|------|----------|
| `name`      | Trip Name                              | text | yes      |
| `dirName`   | Directory Name                         | text | no       |
| `startDate` | Start Date                             | date | yes      |
| `endDate`   | End Date                               | date | yes      |
| `countries` | Countries (comma-separated)            | text | no       |
| `zventId`   | Zvent ID (3 digits, blank for auto)    | text | no       |

`zventId` placeholder is a function returning the auto-computed next id
at render time. (`nextZventId(dataDir)` is invoked once per render of
the TripCreate component; cheap.)

### TripDuplicate form fields

| key       | label                                  | type | required |
|-----------|----------------------------------------|------|----------|
| `newName` | New Trip Name                          | text | yes      |
| `zventId` | Zvent ID (3 digits, blank for auto)    | text | no       |

Submit handler order:

1. Resolve `zventId` (validate or auto).
2. Compute new dirName, check collision (existing logic).
3. `duplicateTrip(...)` (cp + update name).
4. Load duplicated settings, strip tags matching `ZVENT_TAG_REGEX`,
   prepend new Zvent tag built from new name + carried endDate.
5. `updateSettings(...)` to persist.
6. `goBack(); goBack();` (existing logic).

### ExpenseForm Tags-label hint

In the existing `useMemo` over `fields`, compute the Tags label:

```ts
const defaults = trip.settings.tags;
const tagsLabel =
  defaults.length > 0
    ? `Tags (auto-adds: ${defaults.join(", ")})`
    : "Tags";
```

No FormFieldConfig schema change. Hint is read-only — defaults can't
be removed from this form.

## Data flow

### TripCreate happy path

```
User fills name + dates + countries + (blank) zventId
  → onSubmit
  → resolveZventId(): nextZventId(dataDir) returns "003"
  → buildZventTag("003", "Japan", "2026-05-12") → "Zvent: 003 Japan (May 2026)"
  → settings = { ...DEFAULT_TRIP_SETTINGS, name, startDate, endDate,
                 countries: ["Japan", "Korea"],
                 tags: ["Zvent: 003 Japan (May 2026)"] }
  → createTrip(dataDir, dirName, settings)
  → goTo("/trips/overview", ...)
```

### Expense create with defaults

```
ExpenseForm submits expense with user tags ["food"]
  → addExpense(trip, expense)
  → reads trip.settings.tags = ["Zvent: 003 Japan (May 2026)", "team-lunch"]
  → merges → ["Zvent: 003 Japan (May 2026)", "team-lunch", "food"]
  → writes to expenses.yaml
```

## Testing

### New test files

- `src/core/services/trip/__tests__/buildZventTag.test.ts`
  - Months Jan, Jun, Dec produce `Jan`, `Jun`, `Dec`.
  - Year extraction across `2025-12-31` and `2026-01-01`.
  - Trip name with spaces / unicode passes through verbatim.

- `src/core/services/trip/__tests__/nextZventId.test.ts`
  - Empty data dir → `"001"`.
  - Single trip with `Zvent: 005 …` → `"006"`.
  - Multiple trips with mixed ids → max + 1.
  - Trips with no Zvent tag → ignored.
  - Trips with malformed `Zvent: 5 …` (1 digit) → ignored.
  - Max found is `"999"` → returns `"999"`.

- `src/core/services/trip/__tests__/parseZventId.test.ts`
  - `"Zvent: 042 Foo (Jan 2026)"` → `"042"`.
  - `"Zvent: 42 Foo"` → `null`.
  - `"random tag"` → `null`.

### Updated test files

- `src/core/services/expense/__tests__/addExpense.test.ts`
  - Defaults from `trip.settings.tags` are merged into new expense.
  - Dedup: user-typed tag matching a default is not duplicated.
  - Empty `settings.tags` leaves expense.tags untouched.
  - Order: defaults precede user tags in the persisted expense.

`updateExpense` tests remain unchanged.

### Manual TUI verification

- Create a new trip with countries `Japan, Korea` and blank zventId →
  verify `settings.yaml` shows `countries: [Japan, Korea]` and
  `tags: ["Zvent: 001 …"]`.
- Create a second trip with blank zventId → verify next id is `"002"`.
- Create a third trip with explicit `"050"` → accepted.
- Create a fourth with `"abc"` → inline error.
- Create an expense in any of the above → verify the Zvent tag appears
  in the saved expense and the Tags-field label shows
  `(auto-adds: Zvent: …)`.
- Duplicate trip 1 with blank zventId → verify the duplicated trip's
  Zvent tag is the next id, not `"001"`, and the trip name in the tag
  matches the new name.

## Out of scope

- Migrating existing trips' `settings.tags` content. Semantics shift is
  forward-only; pre-existing tags simply become defaults.
- A "non-default" flag for individual tags. Approach (a) means every
  tag in `settings.tags` is a default by design.
- Validating that entered country names match any reference list. Free
  text, same as categories.
- Refactoring constants outside the trip domain. Only the trip-related
  constants the user called out move into `core/constants/`.
- Retroactive removal of a tag from existing expenses when it's removed
  from `settings.tags`. Existing expenses keep what they were created
  with.

## Risks

- **`nextZventId` reads every trip's settings.yaml on TripCreate render.**
  At ≪100 trips this is a non-issue. If trip counts grow, cache the
  computed id in component state on mount.
- **Locale-dependent month names** if `buildZventTag` were implemented
  with `Intl.DateTimeFormat`. Mitigated by using a hard-coded English
  month-name table.
- **Date parsing of `endDate` strings.** `settings.endDate` is stored
  as `YYYY-MM-DD`. `new Date("YYYY-MM-DD")` parses as UTC midnight,
  which is what we want — using `getUTCMonth` / `getUTCFullYear` keeps
  the output deterministic regardless of system timezone.
