# Unify Duplicate Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the duplicate experience consistent: expense submit lands on list, duplicate-pickers show a yellow border, and trip duplicate uses a unified `TripForm` (renamed from `TripCreate`) with pre-fill that matches the `ExpenseForm` pattern.

**Architecture:** Three coordinated, mostly independent threads. Threading order: (1) extend `goBack` API; (2) yellow border + (3) expense submit branch (both build on the API); (4) widen `duplicateTrip` service; (5) rename `TripCreate` → `TripForm` as a no-behavior-change move; (6) add duplicate mode to `TripForm`; (7) route picker to the unified form and delete the old form + dead route. Each task ships as one commit.

**Tech Stack:** React + Ink (TUI), TypeScript with `exactOptionalPropertyTypes: true`, Bun runtime + Bun test, Biome lint+format. Conventional commits with `tui` / `core` scopes.

**Spec:** `docs/superpowers/specs/2026-05-14-unify-duplicate-flow-design.md`

---

## Conventions used in every task

- All paths are absolute from the repo root `/Users/kamontat/Documents/Personal/finmove`.
- After each implementation step verify with `bun run check:type` and `bun run check`. If `bun run check` reports formatting errors, run `bun run fix` and re-verify.
- After each implementation step run `bun test` and expect the full suite to pass.
- Each task ends with a commit step. Stage files explicitly by name — never `git add -A`.

---

## Task 1: Extend `goBack` to accept an optional `steps` parameter

Widens the navigation API so callers can pop multiple history entries in one call. Used by later tasks (expense duplicate submit, trip duplicate submit).

**Files:**
- Modify: `src/tui/states/navigation.tsx`

- [ ] **Step 1: Read the current `goBack` implementation**

Open `src/tui/states/navigation.tsx`. The current shape (around lines 27, 94-101) is:

```tsx
interface NavigationContextValue {
    currentRoute: RouteEntry;
    goTo: <P extends RoutePath>(path: P, options?: GoToOptions<P>) => void;
    goBack: () => void;
    goExit: () => void;
}
```

```tsx
const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
        applyRoute(prev);
    } else {
        exit();
    }
}, [applyRoute, exit]);
```

- [ ] **Step 2: Widen the type to accept optional `steps`**

In `src/tui/states/navigation.tsx`, change the `goBack` field on `NavigationContextValue`:

```tsx
interface NavigationContextValue {
    currentRoute: RouteEntry;
    goTo: <P extends RoutePath>(path: P, options?: GoToOptions<P>) => void;
    goBack: (steps?: number) => void;
    goExit: () => void;
}
```

- [ ] **Step 3: Update the `goBack` implementation to pop N entries**

Replace the `goBack` `useCallback` block with:

```tsx
const goBack = useCallback((steps: number = 1) => {
    if (steps <= 0) return;
    let target: RouteEntry | undefined;
    for (let i = 0; i < steps; i++) {
        const prev = historyRef.current.pop();
        if (!prev) {
            exit();
            return;
        }
        target = prev;
    }
    if (target) {
        applyRoute(target);
    }
}, [applyRoute, exit]);
```

Semantics:
- `goBack()` and `goBack(1)` behave identically to before (pop one, apply, or exit if empty).
- `goBack(n)` pops up to `n` entries and applies the last one popped. If the stack empties before `n` pops complete, calls `exit()` to match the existing "no history → exit" rule.
- `goBack(0)` or negative is a no-op (defensive).

- [ ] **Step 4: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all three pass. The widening is backward-compatible — existing `goBack()` call sites are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/navigation.tsx
git commit -m "$(cat <<'EOF'
feat(tui): allow goBack to pop multiple history entries

Add optional steps parameter to goBack (default 1). Callers that need
to skip an intermediate page after a flow completes — like the
duplicate-form returning past its picker — can now pop both in one
call instead of stacking goBack() invocations.
EOF
)"
```

---

## Task 2: Yellow border on duplicate-pickers

Make duplicate mode visually distinct from default cyan (lists/forms) and red (delete). Same two-line change in each picker.

**Files:**
- Modify: `src/tui/screens/ExpenseDuplicateSelect.tsx`
- Modify: `src/tui/screens/TripDuplicateSelect.tsx`

- [ ] **Step 1: Update `ExpenseDuplicateSelect.tsx`**

In `src/tui/screens/ExpenseDuplicateSelect.tsx`, find the layout effect (currently around lines 18-26):

```tsx
useEffect(() => {
    setBorderColor(null);
    setMenu([], () => {});
    setHints(SELECT_DUPLICATE_HINTS);
    setTitleSuffix(null);
    return () => {
        setTitleSuffix(null);
    };
}, [setBorderColor, setMenu, setHints, setTitleSuffix]);
```

Replace it with:

```tsx
useEffect(() => {
    setBorderColor("yellow");
    setMenu([], () => {});
    setHints(SELECT_DUPLICATE_HINTS);
    setTitleSuffix(null);
    return () => {
        setBorderColor(null);
        setTitleSuffix(null);
    };
}, [setBorderColor, setMenu, setHints, setTitleSuffix]);
```

Two changes: initial `setBorderColor("yellow")`, and cleanup also resets `setBorderColor(null)` so the parent screen's color reapplies on unmount.

- [ ] **Step 2: Update `TripDuplicateSelect.tsx`**

In `src/tui/screens/TripDuplicateSelect.tsx`, find the layout effect (currently around lines 17-30):

```tsx
useEffect(() => {
    setBorderColor(null);
    setMenu([], () => {});
    setHints([
        { key: "↑↓", label: "Navigate" },
        { key: "Enter", label: "Select trip" },
        { key: "q/esc", label: "Back to list" },
        { key: "e", label: "Exit" },
    ]);
    setTitleSuffix(null);
    return () => {
        setTitleSuffix(null);
    };
}, [setBorderColor, setMenu, setHints, setTitleSuffix]);
```

Replace it with:

```tsx
useEffect(() => {
    setBorderColor("yellow");
    setMenu([], () => {});
    setHints([
        { key: "↑↓", label: "Navigate" },
        { key: "Enter", label: "Select trip" },
        { key: "q/esc", label: "Back to list" },
        { key: "e", label: "Exit" },
    ]);
    setTitleSuffix(null);
    return () => {
        setBorderColor(null);
        setTitleSuffix(null);
    };
}, [setBorderColor, setMenu, setHints, setTitleSuffix]);
```

- [ ] **Step 3: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseDuplicateSelect.tsx src/tui/screens/TripDuplicateSelect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): show yellow border on duplicate-pickers

Sets the picker border to yellow so duplicate mode is visually
distinct from default lists (cyan) and delete (red). The cleanup
return also resets the border so the parent screen's color reapplies
on unmount.
EOF
)"
```

---

## Task 3: Expense duplicate submit lands on list

In duplicate mode, pop both the form and the picker so the user lands on the expense list after submit. Edit and new modes are unchanged.

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Locate the submit handler**

Open `src/tui/screens/ExpenseForm.tsx`. The submit handler currently ends with (around lines 220-229):

```tsx
if (existingExpense) {
    updateExpense(trip, expense);
} else {
    addExpense(trip, expense);
}

reloadTrip();
buffer.clear();
setFocus("menu");
goBack();
```

The component already destructures `goBack` from `useNavigation()` at line 21.

- [ ] **Step 2: Branch the final `goBack` on duplicate mode**

Replace the final `goBack();` line in the submit handler with:

```tsx
if (isDuplicate) {
    goBack(2);
} else {
    goBack();
}
```

The component already computes `isDuplicate` at line 33 as `!existingExpense && !!duplicateSource`. No new state needed.

- [ ] **Step 3: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "$(cat <<'EOF'
feat(tui): land on expense list after duplicate submit

When the expense form was opened via the duplicate-picker, submit now
pops two history entries (form + picker) so the user returns to the
expense list. Edit and new modes still pop one entry, as before.
EOF
)"
```

---

## Task 4: Widen `duplicateTrip` service to accept settings overrides

`TripForm` (Task 6) will let the user customize the duplicate's `name`, `startDate`, `endDate`, and `countries`. The service needs to accept and apply those overrides while preserving the rest of `settings.yaml`.

**Files:**
- Modify: `src/core/services/trip/duplicateTrip.ts`
- Modify: `src/core/services/trip/__tests__/tripService.test.ts` (add new tests)

- [ ] **Step 1: Read the current implementation**

`src/core/services/trip/duplicateTrip.ts` today:

```ts
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export function duplicateTrip(
    dataDir: string,
    sourcePath: string,
    newDirName: string,
    newName: string,
): Trip {
    const destPath = join(dataDir, newDirName);
    cpSync(sourcePath, destPath, { recursive: true });

    const settingsPath = join(destPath, "settings.yaml");
    const settings = parse(readFileSync(settingsPath, "utf-8"));
    settings.name = newName;
    writeFileSync(settingsPath, stringify(settings));

    return loadTrip(destPath);
}
```

The fourth parameter is currently a string (`newName`). It needs to become an object carrying name + date range + countries.

- [ ] **Step 2: Read existing trip-service tests to match style**

```bash
head -60 src/core/services/trip/__tests__/tripService.test.ts
```

Note the import path for `Settings`, `addOwner`, `loadTrip`, etc. Match the same fixture pattern (`TEST_DIR = join(import.meta.dir, "__fixtures__")`) when writing the new tests.

- [ ] **Step 3: Write failing tests for the widened signature**

Append to `src/core/services/trip/__tests__/tripService.test.ts` (or add inside an appropriate `describe` block):

```ts
import { duplicateTrip } from "../duplicateTrip";

describe("duplicateTrip", () => {
    const FIXTURE_DIR = join(import.meta.dir, "__fixtures__duplicate");
    const sourceDirName = "source-trip-2026";
    const sourcePath = join(FIXTURE_DIR, sourceDirName);

    beforeEach(() => {
        mkdirSync(sourcePath, { recursive: true });
        const sourceSettings: Settings = {
            name: "Source Trip",
            startDate: "2026-01-01",
            endDate: "2026-01-07",
            countries: ["Japan"],
            baseCurrency: "THB",
            currencies: { JPY: { exchangeRate: 0.23 } },
            categories: ["Food", "Transport"],
            tags: ["business"],
            exportPath: "./out.csv",
        };
        writeFileSync(join(sourcePath, "settings.yaml"), stringify(sourceSettings));
        writeFileSync(join(sourcePath, "owners.yaml"), stringify({ owners: [] }));
        writeFileSync(join(sourcePath, "accounts.yaml"), stringify({ accounts: [] }));
        writeFileSync(join(sourcePath, "expenses.yaml"), stringify({ expenses: [] }));
    });

    afterEach(() => {
        rmSync(FIXTURE_DIR, { recursive: true, force: true });
    });

    test("applies all four overrides to settings.yaml", () => {
        const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-2026", {
            name: "Dup Trip",
            startDate: "2026-02-01",
            endDate: "2026-02-10",
            countries: ["Japan", "Korea"],
        });

        expect(trip.settings.name).toBe("Dup Trip");
        expect(trip.settings.startDate).toBe("2026-02-01");
        expect(trip.settings.endDate).toBe("2026-02-10");
        expect(trip.settings.countries).toEqual(["Japan", "Korea"]);
    });

    test("preserves baseCurrency, currencies, categories, tags, exportPath from source", () => {
        const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-preserve", {
            name: "Dup Preserve",
            startDate: "2026-03-01",
            endDate: "2026-03-05",
            countries: [],
        });

        expect(trip.settings.baseCurrency).toBe("THB");
        expect(trip.settings.currencies).toEqual({ JPY: { exchangeRate: 0.23 } });
        expect(trip.settings.categories).toEqual(["Food", "Transport"]);
        expect(trip.settings.tags).toEqual(["business"]);
        expect(trip.settings.exportPath).toBe("./out.csv");
    });

    test("copies non-settings files from source", () => {
        // Write a non-empty owners file in source to confirm dir copy
        writeFileSync(
            join(sourcePath, "owners.yaml"),
            stringify({ owners: [{ id: "o1", name: "Alice" }] }),
        );

        const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-copy", {
            name: "Dup Copy",
            startDate: "2026-04-01",
            endDate: "2026-04-05",
            countries: [],
        });

        expect(trip.owners).toHaveLength(1);
        expect(trip.owners[0]?.name).toBe("Alice");
    });
});
```

If `mkdirSync`, `writeFileSync`, `rmSync`, `Settings`, `stringify`, and `join` aren't already imported at the top of the test file, add the imports — match the existing imports for `ownerService.test.ts` as a reference (`node:fs`, `node:path`, `yaml`).

- [ ] **Step 4: Run tests to verify they fail**

```bash
bun test src/core/services/trip/__tests__/tripService.test.ts
```

Expected: FAIL — the new tests call `duplicateTrip` with an object as the 4th arg, but the current signature expects a string. TypeScript will flag the call too; if the test file fails to type-check, that counts as the "fail" for this step.

- [ ] **Step 5: Update `duplicateTrip` to the new signature**

Replace `src/core/services/trip/duplicateTrip.ts` entirely with:

```ts
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export interface DuplicateTripOverrides {
    name: string;
    startDate: string;
    endDate: string;
    countries: string[];
}

export function duplicateTrip(
    dataDir: string,
    sourcePath: string,
    newDirName: string,
    overrides: DuplicateTripOverrides,
): Trip {
    const destPath = join(dataDir, newDirName);
    cpSync(sourcePath, destPath, { recursive: true });

    const settingsPath = join(destPath, "settings.yaml");
    const settings = parse(readFileSync(settingsPath, "utf-8"));
    settings.name = overrides.name;
    settings.startDate = overrides.startDate;
    settings.endDate = overrides.endDate;
    settings.countries = overrides.countries;
    writeFileSync(settingsPath, stringify(settings));

    return loadTrip(destPath);
}
```

Notes:
- The four overrides are applied directly; other fields (`baseCurrency`, `currencies`, `categories`, `tags`, `exportPath`) survive the `parse`/`stringify` round-trip unchanged.
- `DuplicateTripOverrides` is exported so call sites can name it cleanly.

- [ ] **Step 6: Re-export the new type from the trip index (optional but consistent)**

Open `src/core/services/trip/index.ts`. The file currently re-exports `duplicateTrip` but not the overrides type. Add the type export alongside the function export:

```ts
export type { DuplicateTripOverrides } from "./duplicateTrip";
export { duplicateTrip } from "./duplicateTrip";
```

Keep the lines in alphabetical/grouping order matching the existing file.

- [ ] **Step 7: Update the only existing call site to compile against the new signature**

The only caller is `src/tui/screens/TripDuplicateForm.tsx`. It will be deleted in Task 7, but the codebase must type-check after Task 4 lands as a self-contained commit.

Open `src/tui/screens/TripDuplicateForm.tsx`. The route props it currently receives are `sourceDirPath`, `sourceName`, and `sourceStartDate` — it does NOT receive `sourceEndDate` or `sourceCountries`. To preserve the screen's current behavior (override only the name; keep date range and countries identical to the source), read the rest from disk inside the handler via `loadTrip`.

Add `loadTrip` to the existing trip-service import at the top of the file:

```tsx
import { duplicateTrip, loadTrip, toDirName } from "../../core/services/trip";
```

Replace the `onSubmit` body (currently lines 50-62):

```tsx
onSubmit={(values) => {
    const name = getString(values, "newName");
    const dirName = toDirName(name, sourceStartDate);
    const tripPath = join(dataDir, dirName);
    if (existsSync(tripPath)) {
        setError(`Trip "${name}" already exists (${dirName})`);
        return;
    }
    setError(null);
    const sourceTrip = loadTrip(sourceDirPath);
    duplicateTrip(dataDir, sourceDirPath, dirName, {
        name,
        startDate: sourceTrip.settings.startDate,
        endDate: sourceTrip.settings.endDate,
        countries: sourceTrip.settings.countries,
    });
    goBack();
    goBack();
}}
```

The change is intentionally minimal: same overall flow, just an extra `loadTrip` read and the new object-form call to `duplicateTrip`. Task 7 deletes this file entirely.

- [ ] **Step 8: Run tests to verify they pass**

```bash
bun test
```

Expected: full suite passes including the new `duplicateTrip` tests.

- [ ] **Step 9: Verify type-check and lint**

```bash
bun run check:type
bun run check
```

Expected: clean. If lint reports formatting issues, run `bun run fix`.

- [ ] **Step 10: Commit**

```bash
git add src/core/services/trip/duplicateTrip.ts src/core/services/trip/index.ts src/core/services/trip/__tests__/tripService.test.ts src/tui/screens/TripDuplicateForm.tsx
git commit -m "$(cat <<'EOF'
refactor(core): widen duplicateTrip to accept settings overrides

The fourth parameter becomes a DuplicateTripOverrides object so callers
can change name, startDate, endDate, and countries when duplicating —
not just the name. Other settings fields (baseCurrency, currencies,
categories, tags, exportPath) continue to come from the source.

TripDuplicateForm is updated to the new signature using the source's
existing date range and countries, preserving its current behavior
until the screen is removed in a follow-up.
EOF
)"
```

---

## Task 5: Rename `TripCreate` to `TripForm` (no-behavior-change move)

Self-contained file + symbol rename. The screen still only handles "new" mode; duplicate-mode awareness is added in Task 6. Keeping the rename in its own commit makes the larger Task 6 diff easier to review.

**Files:**
- Rename: `src/tui/screens/TripCreate.tsx` → `src/tui/screens/TripForm.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 1: Move the file with git**

```bash
git mv src/tui/screens/TripCreate.tsx src/tui/screens/TripForm.tsx
```

- [ ] **Step 2: Rename the exported function inside the file**

In `src/tui/screens/TripForm.tsx`, change the export line (currently `export function TripCreate(): JSX.Element {`) to:

```tsx
export function TripForm(): JSX.Element {
```

No other lines inside this file need to change in this task — the formId constant `trip-new`, the field list, and the submit handler stay exactly the same.

- [ ] **Step 3: Update the router import and registration**

In `src/tui/router.ts`, find the line:

```tsx
import { TripCreate } from "./screens/TripCreate";
```

Replace with:

```tsx
import { TripForm } from "./screens/TripForm";
```

Then find the `/trips/new` route entry:

```tsx
"/trips/new": {
    component: TripCreate as unknown as ComponentType,
    title: "New Trip",
    defaultFocus: "main",
},
```

Replace with:

```tsx
"/trips/new": {
    component: TripForm as unknown as ComponentType,
    title: "New Trip",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Search for any other reference to `TripCreate`**

```bash
grep -rn "TripCreate" src/ --include="*.tsx" --include="*.ts"
```

Expected matches (do NOT rename these — they are unrelated sub-page components and route paths that happen to start with `TripCreate`):
- `src/tui/screens/TripCreateCountryAdd.tsx`
- `src/tui/screens/TripCreateCountryDelete.tsx`
- `src/tui/screens/TripCreateCountryList.tsx`
- Router imports/registrations for `TripCreateCountry*`
- Route paths `/trips/new/countries/*` use these sub-pages

If `grep` returns any reference to the bare symbol `TripCreate` (not `TripCreateCountry...`), update it. The expected diff for this task touches only `TripForm.tsx` (renamed) and `router.ts`.

- [ ] **Step 5: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. No behavior change.

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/TripForm.tsx src/tui/router.ts
git commit -m "$(cat <<'EOF'
refactor(tui): rename TripCreate to TripForm

The screen will handle both new and duplicate modes (matching the
ExpenseForm pattern). This commit is the file + symbol rename only —
no behavior change. The follow-up adds duplicate-mode logic.
EOF
)"
```

If `git status` after the commit shows a stray rename detection issue (e.g., file listed as both deletion and addition), use `git mv` again or commit with explicit paths.

---

## Task 6: Add duplicate mode to `TripForm`

Reads optional `duplicateFromDirPath`, loads the source trip, pre-fills `startDate`/`endDate`/`countries` (leaving `name` blank for the user to re-enter), shows a `Duplicate of: <name>` title suffix, seeds the form buffer with countries, and branches the submit handler.

**Files:**
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/screens/TripForm.tsx`

- [ ] **Step 1: Add `duplicateFromDirPath` to the `/trips/new` route params**

In `src/tui/models/index.ts`, find the `/trips/new` entry (currently `"/trips/new": { dataDir?: string };`) and change to:

```ts
"/trips/new": { dataDir?: string; duplicateFromDirPath?: string };
```

- [ ] **Step 2: Verify type-check (expect existing call sites still compile)**

```bash
bun run check:type
```

Expected: clean. The new field is optional, so existing `goTo("/trips/new", { props: { dataDir } })` calls remain valid.

- [ ] **Step 3: Wire the source-trip read into `TripForm`**

Open `src/tui/screens/TripForm.tsx`. The current imports near the top include `addDays`, `today`, `isValidSlug`, `createTrip`, `toDirName`. Add `loadTrip` and `duplicateTrip` from the trip service barrel:

```tsx
import {
    createTrip,
    duplicateTrip,
    loadTrip,
    toDirName,
} from "../../core/services/trip";
```

Replace the existing destructuring block (currently `const { dataDir = "./data" } = useRouteProps("/trips/new");`) with:

```tsx
const { dataDir = "./data", duplicateFromDirPath } =
    useRouteProps("/trips/new");

const duplicateSource = duplicateFromDirPath
    ? loadTrip(duplicateFromDirPath)
    : null;
const isDuplicate = duplicateSource !== null;
```

Notes:
- `loadTrip` is synchronous (it parses YAML from disk). Calling it on each render is acceptable for this screen — the file is small and renders are infrequent.
- If `duplicateFromDirPath` points at a missing dir, `loadTrip` will throw. That's a programmer error path (the picker only sends valid paths); no defensive fallback needed.

- [ ] **Step 4: Branch the `formId` and title suffix on duplicate mode**

Replace the existing `FORM_ID` constant + `buffer` line (currently `const FORM_ID = "trip-new";` at module scope and `const buffer = useFormBuffer(FORM_ID);` inside the component) with a per-render computed `formId`:

Remove the module-level constant:

```tsx
const FORM_ID = "trip-new";
```

Inside the component (replacing the `useFormBuffer(FORM_ID)` line):

```tsx
const formId = duplicateFromDirPath
    ? `trip-duplicate-${duplicateFromDirPath}`
    : "trip-new";
const buffer = useFormBuffer(formId);
```

Update the existing title-suffix effect (currently sets `setTitleSuffix(null)` unconditionally):

```tsx
useEffect(() => {
    if (isDuplicate && duplicateSource) {
        setTitleSuffix(`Duplicate of: ${duplicateSource.settings.name}`);
    } else {
        setTitleSuffix(null);
    }
    setHints(FORM_HINTS);
    return () => setTitleSuffix(null);
}, [isDuplicate, duplicateSource, setHints, setTitleSuffix]);
```

Note: the existing effect's dep array was `[setHints, setTitleSuffix]`. Add `isDuplicate` and `duplicateSource` so the suffix updates correctly when navigating between new and duplicate modes within the same screen mount.

- [ ] **Step 5: Pre-fill `startDate`, `endDate`, and seed the `countries` buffer**

Update the `defaultValue` for the date fields. In the `fields` array, the existing entries are:

```tsx
{
    key: "startDate",
    label: "Start Date",
    type: "date",
    required: true,
    defaultValue: today(),
},
{
    key: "endDate",
    label: "End Date",
    type: "date",
    required: true,
    defaultValue: addDays(today(), 1),
},
```

Change them to:

```tsx
{
    key: "startDate",
    label: "Start Date",
    type: "date",
    required: true,
    defaultValue: duplicateSource?.settings.startDate ?? today(),
},
{
    key: "endDate",
    label: "End Date",
    type: "date",
    required: true,
    defaultValue:
        duplicateSource?.settings.endDate ?? addDays(today(), 1),
},
```

For `countries` (which is a multiselect with sub-page navigation and no `defaultValue`), add a buffer-seed effect modeled after the one in `ExpenseForm.tsx` (lines 60-73). Add this effect after the title-suffix effect:

```tsx
useEffect(() => {
    if (!duplicateSource) return;
    if (buffer.values["countries"] === undefined) {
        buffer.setField("countries", duplicateSource.settings.countries);
    }
}, [duplicateSource, buffer]);
```

This seeds the buffer once on mount (when `buffer.values["countries"]` is still undefined), letting the user freely re-pick from the countries sub-page afterward.

The `name` and `dirName` fields get NO duplicate-mode defaultValue — `name` stays empty so the user must type one, and `dirName` keeps its existing auto-derive placeholder.

- [ ] **Step 6: Branch the submit handler**

The existing submit handler currently ends with `goTo("/trips/overview", { replace: true, props: {...} })`. Wrap the trip-creation step in a duplicate-mode branch.

Replace the submit handler body. The current body (around lines 87-129) is:

```tsx
onSubmit={(values) => {
    const name = getString(values, "name");
    const startDate = getString(values, "startDate") || today();
    const endDate = getString(values, "endDate") || addDays(today(), 1);
    const explicitDirName = getString(values, "dirName").trim();
    const dirName =
        explicitDirName === ""
            ? toDirName(name, startDate)
            : explicitDirName;

    const countries = getStringArray(values, "countries");

    if (!isValidSlug(dirName)) {
        setError(
            `Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
        );
        return;
    }

    const tripPath = join(dataDir, dirName);
    if (existsSync(tripPath)) {
        setError(`Trip directory "${dirName}" already exists`);
        return;
    }
    setError(null);
    const settings: Settings = {
        ...DEFAULT_TRIP_SETTINGS,
        name,
        startDate,
        endDate,
        countries,
    };
    const newTrip = createTrip(dataDir, dirName, settings);
    buffer.clear();
    goTo("/trips/overview", {
        replace: true,
        props: {
            tripDirPath: newTrip.dirPath,
            tripName: name,
            dataDir,
        },
    });
}}
```

Replace with:

```tsx
onSubmit={(values) => {
    const name = getString(values, "name");
    const startDate = getString(values, "startDate") || today();
    const endDate = getString(values, "endDate") || addDays(today(), 1);
    const explicitDirName = getString(values, "dirName").trim();
    const dirName =
        explicitDirName === ""
            ? toDirName(name, startDate)
            : explicitDirName;

    const countries = getStringArray(values, "countries");

    if (!isValidSlug(dirName)) {
        setError(
            `Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
        );
        return;
    }

    const tripPath = join(dataDir, dirName);
    if (existsSync(tripPath)) {
        setError(`Trip directory "${dirName}" already exists`);
        return;
    }
    setError(null);

    if (duplicateSource) {
        duplicateTrip(dataDir, duplicateSource.dirPath, dirName, {
            name,
            startDate,
            endDate,
            countries,
        });
        buffer.clear();
        goBack(2);
        return;
    }

    const settings: Settings = {
        ...DEFAULT_TRIP_SETTINGS,
        name,
        startDate,
        endDate,
        countries,
    };
    const newTrip = createTrip(dataDir, dirName, settings);
    buffer.clear();
    goTo("/trips/overview", {
        replace: true,
        props: {
            tripDirPath: newTrip.dirPath,
            tripName: name,
            dataDir,
        },
    });
}}
```

Notes:
- Validation (`isValidSlug`, dirName uniqueness) applies to both modes — duplicate also writes to a new directory and must not collide.
- The component already destructures `goBack` from `useNavigation()` once Task 1's change is in place; verify the destructure includes `goBack`. The existing line is `const { goTo } = useNavigation();` — change to `const { goTo, goBack } = useNavigation();`.

- [ ] **Step 7: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/tui/models/index.ts src/tui/screens/TripForm.tsx
git commit -m "$(cat <<'EOF'
feat(tui): TripForm handles duplicate mode with prefill

Adds optional duplicateFromDirPath route param. When set, TripForm
loads the source trip, pre-fills startDate / endDate / countries, and
shows a "Duplicate of: <name>" title suffix. The name field stays
empty so the user must type a fresh identity. Submit branches: duplicate
mode calls duplicateTrip and pops back to the trips list; new mode is
unchanged.
EOF
)"
```

---

## Task 7: Route picker to `/trips/new` and remove the old form

Switches `TripDuplicateSelect` to navigate to the unified `TripForm`, deletes `TripDuplicateForm`, and tears down the now-dead `/trips/duplicate/new` route.

**Files:**
- Modify: `src/tui/screens/TripDuplicateSelect.tsx`
- Delete: `src/tui/screens/TripDuplicateForm.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Update the picker's navigation target**

Open `src/tui/screens/TripDuplicateSelect.tsx`. The `onChange` block currently navigates to `/trips/duplicate/new`:

```tsx
onChange={(dirPath) => {
    const trip = trips.find((t) => t.dirPath === dirPath);
    if (!trip) return;
    goTo("/trips/duplicate/new", {
        props: {
            dataDir,
            sourceDirPath: trip.dirPath,
            sourceName: trip.settings.name,
            sourceStartDate: trip.settings.startDate,
        },
    });
}}
```

Replace with:

```tsx
onChange={(dirPath) => {
    const trip = trips.find((t) => t.dirPath === dirPath);
    if (!trip) return;
    goTo("/trips/new", {
        props: { dataDir, duplicateFromDirPath: trip.dirPath },
    });
}}
```

- [ ] **Step 2: Delete the old form file**

```bash
git rm src/tui/screens/TripDuplicateForm.tsx
```

- [ ] **Step 3: Remove the `/trips/duplicate/new` route from the type model**

In `src/tui/models/index.ts`, delete the entire `/trips/duplicate/new` block (it currently spans `"/trips/duplicate/new": { dataDir?: string; sourceDirPath: string; sourceName: string; sourceStartDate: string; };`):

Before:
```ts
"/trips/new": { dataDir?: string; duplicateFromDirPath?: string };
"/trips/duplicate/new": {
    dataDir?: string;
    sourceDirPath: string;
    sourceName: string;
    sourceStartDate: string;
};
```

After:
```ts
"/trips/new": { dataDir?: string; duplicateFromDirPath?: string };
```

- [ ] **Step 4: Remove the route registration from the router**

In `src/tui/router.ts`, delete the import:

```tsx
import { TripDuplicateForm } from "./screens/TripDuplicateForm";
```

And delete the route entry:

```tsx
"/trips/duplicate/new": {
    component: TripDuplicateForm as unknown as ComponentType,
    title: "Duplicate Trip",
    defaultFocus: "main",
},
```

- [ ] **Step 5: Remove the breadcrumb case from `App.tsx`**

In `src/tui/App.tsx`, find the breadcrumb switch (around line 76-78):

```tsx
case "/trips/duplicate/new":
    breadcrumbs.push("Trips", "Duplicate", "New");
    break;
```

Delete this case entirely. The `/trips/new` breadcrumb (`Trips > New`) handles both fresh-new and duplicate-from-picker flows; the `Duplicate of: <name>` title suffix from `TripForm` provides the duplicate context.

- [ ] **Step 6: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. TypeScript will fail loudly if any stray reference to `/trips/duplicate/new` or `TripDuplicateForm` remains.

- [ ] **Step 7: Manual TUI smoke test**

```bash
bun run start
```

Verify on a trip list with at least two trips:

1. `[d] Duplicate` on trips list → picker shows yellow border. ✓
2. Pick a trip → `TripForm` opens with breadcrumb `Trips > New > Duplicate of: <sourceName>`. ✓
3. `startDate` and `endDate` fields are pre-filled with source's dates. `name` field is empty. `countries` field shows source's countries.
4. Edit `name` to something new. Submit `[s]`. → lands on trips list (not picker). ✓
5. New trip directory exists with the user's customizations applied; source trip is untouched.
6. From trips list, `[c]` (Create) → fresh `TripForm` with empty `name`, `startDate = today()`, `endDate = today() + 1`, empty `countries`. Submit → lands on the new trip's overview. ✓
7. Cancel (q/esc) from a duplicate `TripForm` → back to picker. Cancel from picker → back to trips list.

Also verify expense duplicate flow still works:

8. Open a trip → Expenses → `[d] Duplicate` → picker yellow border. ✓
9. Pick a row → form opens → submit → lands on expense list (not picker). ✓
10. Cancel from duplicate expense form → back to picker.

Report any deviation. If everything matches, proceed.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/TripDuplicateSelect.tsx src/tui/models/index.ts src/tui/router.ts src/tui/App.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): route trip duplicate to TripForm; remove TripDuplicateForm

The trip duplicate-picker now navigates to /trips/new with
duplicateFromDirPath, and TripForm handles both new and duplicate modes.
Removes the dedicated TripDuplicateForm screen, the /trips/duplicate/new
route, and its breadcrumb case. The expense-side flow already lives at
/trips/expenses/form with duplicateFromId — this brings trip duplication
to the same shape.
EOF
)"
```

---

## Done criteria

- `bun test` green (existing 161 + 3 new `duplicateTrip` tests = 164).
- `bun run check:type` clean.
- `bun run check` clean.
- Manual checks from Task 7 Step 7 all pass.
- The `/trips/duplicate/new` route, `TripDuplicateForm` screen, and the breadcrumb case for the old route are gone from the codebase.
- The expense duplicate flow lands on the expense list after submit; the trip duplicate flow lands on the trips list after submit. Both pickers show a yellow border.
