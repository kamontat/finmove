# Layout Colors API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `setBorderColor` / `borderColor` on `LayoutContext` with `setColor({ border?, title? })` / `colors: LayoutColors`, so the title color can be set per-screen alongside the border color.

**Architecture:** Three coexistence-style commits. Task 1 adds the new API alongside the old one and updates `Default.tsx` to consume both (title from the new `colors.title`, border preferring `colors.border` then falling back to `borderColor`). Task 2 migrates all 23 consumer screens in one commit. Task 3 removes the deprecated `setBorderColor` / `borderColor` slot. Each task type-checks cleanly.

**Tech Stack:** React + Ink (TUI), TypeScript with `exactOptionalPropertyTypes: true`, Bun runtime + Bun test, Biome lint+format.

**Spec:** `docs/superpowers/specs/2026-05-14-layout-colors-api-design.md`

---

## Conventions used in every task

- All paths are absolute from the repo root `/Users/kamontat/Documents/Personal/finmove`.
- After each implementation step verify with `bun run check:type` and `bun run check`. If `bun run check` reports formatting errors, run `bun run fix` and re-verify.
- After each implementation step run `bun test` and expect the full suite to pass (current baseline: 171 tests).
- Each task ends with a commit step. Stage files explicitly by name — never `git add -A`.

---

## Task 1: Add `setColor` / `colors` alongside the existing `setBorderColor` / `borderColor`

Adds the new API surface and updates `Default.tsx` to render the title from `colors.title`. Old API remains functional; screens are not migrated yet. After this task, an unmigrated screen still sets red border via `setBorderColor("red")` and the title still renders cyan (no behavior change). The new API is available for any screen that opts in.

**Files:**
- Modify: `src/tui/states/layout.tsx`
- Modify: `src/tui/layouts/Default.tsx`

- [ ] **Step 1: Add the `LayoutColors` type and new state slot in `layout.tsx`**

Open `src/tui/states/layout.tsx`. Add the exported type at the top (after the `import type { HelpHint, SelectOption } from "../models";` line):

```ts
export interface LayoutColors {
    border?: string;
    title?: string;
}
```

Extend the `LayoutContextValue` interface with the new field and setter. Keep the existing `borderColor` / `setBorderColor` fields:

```ts
interface LayoutContextValue {
    menuOptions: SelectOption[];
    onMenuSelect: ((value: string) => void) | null;
    hints: HelpHint[];
    borderColor: string | null;
    colors: LayoutColors;
    titleSuffix: string | null;
    setMenu: (options: SelectOption[], onSelect: (value: string) => void) => void;
    setHints: (hints: HelpHint[]) => void;
    setBorderColor: (color: string | null) => void;
    setColor: (colors: LayoutColors) => void;
    setTitleSuffix: (suffix: string | null) => void;
    resetLayout: () => void;
}
```

- [ ] **Step 2: Add the new state, setter, and reset wiring inside `LayoutProvider`**

Inside `LayoutProvider`, after the existing `const [borderColor, setBorderColorState] = useState<string | null>(null);` line, add:

```ts
const [colors, setColorsState] = useState<LayoutColors>({});
```

After the existing `setBorderColor` `useCallback`, add:

```ts
const setColor = useCallback((next: LayoutColors) => {
    setColorsState(next);
}, []);
```

Update `resetLayout` to also reset `colors` to `{}`:

```ts
const resetLayout = useCallback(() => {
    setMenuOptions([]);
    setHintsState([]);
    setBorderColorState(null);
    setColorsState({});
    setTitleSuffixState(null);
    onMenuSelectRef.current = null;
    setCallbackTick((t) => t + 1);
}, []);
```

Update the `useMemo` returning the context value: add `colors` and `setColor` to both the object and the dependency array.

```ts
const value = useMemo<LayoutContextValue>(
    () => ({
        menuOptions,
        onMenuSelect: onMenuSelectSnapshot,
        hints,
        borderColor,
        colors,
        titleSuffix,
        setMenu,
        setHints,
        setBorderColor,
        setColor,
        setTitleSuffix,
        resetLayout,
    }),
    [
        menuOptions,
        onMenuSelectSnapshot,
        hints,
        borderColor,
        colors,
        titleSuffix,
        setMenu,
        setHints,
        setBorderColor,
        setColor,
        setTitleSuffix,
        resetLayout,
    ],
);
```

- [ ] **Step 3: Update `Default.tsx` to consume the new `colors` slot**

Open `src/tui/layouts/Default.tsx`. Update the destructure (currently `const { menuOptions, onMenuSelect, hints, borderColor } = useLayout();`):

```tsx
const { menuOptions, onMenuSelect, hints, borderColor, colors } = useLayout();
```

Replace the color-resolution block. Current code (line 35):

```tsx
const activeBorderColor = borderColor ?? defaultBorderColor ?? "cyan";
const mainBorderColor =
    focus === "main" || focus === "input" ? activeBorderColor : "gray";
const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";
```

Replace with:

```tsx
const activeBorderColor =
    colors.border ?? borderColor ?? defaultBorderColor ?? "cyan";
const activeTitleColor = colors.title ?? defaultBorderColor ?? "cyan";
const mainBorderColor =
    focus === "main" || focus === "input" ? activeBorderColor : "gray";
const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";
```

Notes:
- `activeBorderColor` prefers the new `colors.border`, then falls back to the legacy `borderColor`. This is what lets unmigrated screens continue to behave identically.
- `activeTitleColor` does NOT fall back to `borderColor` — it only uses `colors.title`, then the route-level default, then `"cyan"`. This is intentional: today's unmigrated delete screens render a cyan title; we want that behavior to persist until each screen migrates and opts in.

Update the title render (currently `<Text bold color="cyan">`):

```tsx
<Text bold color={activeTitleColor}>
    {" "}
    {title}
</Text>
```

- [ ] **Step 4: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. Existing screens still use the old API; no observable change yet.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/layout.tsx src/tui/layouts/Default.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add setColor / colors layout slot alongside setBorderColor

Introduces a multi-slot LayoutColors object (border, title) and the
setColor setter. Default.tsx reads colors.title for the breadcrumb and
prefers colors.border over the legacy borderColor for the main panel
border. The legacy setBorderColor / borderColor API is left intact so
screens can migrate one by one in the next commit.
EOF
)"
```

---

## Task 2: Migrate all screens from `setBorderColor` to `setColor`

Migrates every consumer screen to the new API in one commit. Also flips the inline `color="cyan"` literal on the two duplicate-pickers' inner header text to `"yellow"` so it matches the new yellow title.

**Migration recipe:**

For each file that destructures `setBorderColor` from `useLayout()`:

1. In the destructure, replace `setBorderColor` with `setColor`.
2. Inside the effect:
   - `setBorderColor(null)` → `setColor({})`
   - `setBorderColor("red")` → `setColor({ border: "red", title: "red" })`
   - `setBorderColor("yellow")` → `setColor({ border: "yellow", title: "yellow" })`
3. In any cleanup `return () => { ... }` that calls `setBorderColor(null)`, change to `setColor({})`.
4. In the `useEffect` dep array, replace `setBorderColor` with `setColor`.

Also flip `<Text bold color="cyan">` to `<Text bold color="yellow">` in the two duplicate-pickers.

**Files (count: 28 screen files; the 2 inline literal flips happen inside the two yellow-picker entries below, so they don't add to the file count):**

Screens that currently call `setBorderColor("red")` or `setBorderColor("yellow")` — also need the migration above:

- `src/tui/screens/AccountDelete.tsx` — `setBorderColor("red")` → `setColor({ border: "red", title: "red" })`
- `src/tui/screens/AccountReferences.tsx` — same red migration
- `src/tui/screens/CategoryDelete.tsx` — same red migration
- `src/tui/screens/CountryDelete.tsx` — same red migration
- `src/tui/screens/CurrencyDelete.tsx` — same red migration
- `src/tui/screens/ExpenseDelete.tsx` — same red migration
- `src/tui/screens/ExpenseDuplicateSelect.tsx` — `setBorderColor("yellow")` → `setColor({ border: "yellow", title: "yellow" })` + flip inner `color="cyan"` to `color="yellow"`
- `src/tui/screens/OwnerDelete.tsx` — same red migration
- `src/tui/screens/OwnerReferences.tsx` — same red migration
- `src/tui/screens/TagDelete.tsx` — same red migration
- `src/tui/screens/TripCreateCountryDelete.tsx` — same red migration
- `src/tui/screens/TripDelete.tsx` — same red migration
- `src/tui/screens/TripDuplicateSelect.tsx` — `setBorderColor("yellow")` → `setColor({ border: "yellow", title: "yellow" })` + flip inner `color="cyan"` to `color="yellow"`

Screens that only ever call `setBorderColor(null)` defensively — migrate to `setColor({})`:

- `src/tui/screens/AccountList.tsx`
- `src/tui/screens/AccountSelect.tsx`
- `src/tui/screens/AccountTypeSelect.tsx`
- `src/tui/screens/CategoryList.tsx`
- `src/tui/screens/CategorySelect.tsx`
- `src/tui/screens/CountryList.tsx`
- `src/tui/screens/CurrencyList.tsx`
- `src/tui/screens/CurrencySelect.tsx`
- `src/tui/screens/ExpenseList.tsx`
- `src/tui/screens/OwnerList.tsx`
- `src/tui/screens/OwnerSelect.tsx`
- `src/tui/screens/TagList.tsx`
- `src/tui/screens/TagSelect.tsx`
- `src/tui/screens/TripCreateCountryList.tsx`
- `src/tui/screens/TripList.tsx`

Total: 13 + 15 = 28 screens.

- [ ] **Step 1: Migrate the 13 non-null-color screens**

Work through each of these in order. For each file, open it, find the `useLayout()` destructure and the layout `useEffect`, and apply the recipe.

Worked example — `src/tui/screens/AccountDelete.tsx`:

Before:
```tsx
const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

useEffect(() => {
    setBorderColor("red");
    setMenu([], () => {});
    setHints(SELECT_REMOVE_HINTS);
    setTitleSuffix(null);
    return () => {
        setBorderColor(null);
        setTitleSuffix(null);
    };
}, [setBorderColor, setMenu, setHints, setTitleSuffix]);
```

After:
```tsx
const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();

useEffect(() => {
    setColor({ border: "red", title: "red" });
    setMenu([], () => {});
    setHints(SELECT_REMOVE_HINTS);
    setTitleSuffix(null);
    return () => {
        setColor({});
        setTitleSuffix(null);
    };
}, [setColor, setMenu, setHints, setTitleSuffix]);
```

Apply the same recipe to:
- `AccountReferences.tsx` (red)
- `CategoryDelete.tsx` (red)
- `CountryDelete.tsx` (red)
- `CurrencyDelete.tsx` (red)
- `ExpenseDelete.tsx` (red)
- `OwnerDelete.tsx` (red)
- `OwnerReferences.tsx` (red)
- `TagDelete.tsx` (red)
- `TripCreateCountryDelete.tsx` (red)
- `TripDelete.tsx` (red)

For the two yellow pickers, also flip the inner header literal:

- `src/tui/screens/ExpenseDuplicateSelect.tsx` — apply the migration with `border: "yellow", title: "yellow"`, and change the inline `<Text bold color="cyan">` to `<Text bold color="yellow">`. The inner text is `"Select an expense to duplicate:"`.
- `src/tui/screens/TripDuplicateSelect.tsx` — same migration with yellow, and flip the inline `<Text bold color="cyan">` to `<Text bold color="yellow">`. Inner text: `"Select a trip to duplicate:"`.

- [ ] **Step 2: Migrate the screens that only set `setBorderColor(null)`**

For each of these, the recipe is even simpler — `setBorderColor(null)` becomes `setColor({})` (and the destructure + dep array rename):

- `src/tui/screens/AccountList.tsx`
- `src/tui/screens/AccountSelect.tsx`
- `src/tui/screens/AccountTypeSelect.tsx`
- `src/tui/screens/CategoryList.tsx`
- `src/tui/screens/CategorySelect.tsx`
- `src/tui/screens/CountryList.tsx`
- `src/tui/screens/CurrencyList.tsx`
- `src/tui/screens/CurrencySelect.tsx`
- `src/tui/screens/ExpenseList.tsx`
- `src/tui/screens/OwnerList.tsx`
- `src/tui/screens/OwnerSelect.tsx`
- `src/tui/screens/TagList.tsx`
- `src/tui/screens/TagSelect.tsx`
- `src/tui/screens/TripCreateCountryList.tsx`
- `src/tui/screens/TripList.tsx`

Worked example — `src/tui/screens/AccountList.tsx`:

Before:
```tsx
const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

useEffect(() => {
    setTitleSuffix(null);
    setBorderColor(null);
    setMenu(...);
    setHints(...);
}, [..., setBorderColor, ...]);
```

After:
```tsx
const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();

useEffect(() => {
    setTitleSuffix(null);
    setColor({});
    setMenu(...);
    setHints(...);
}, [..., setColor, ...]);
```

Keep all other lines in the file unchanged. Make sure to update the dep array.

- [ ] **Step 3: Catch any other consumers**

Run a grep to confirm no screen still references `setBorderColor`:

```bash
grep -rn "setBorderColor" src/ --include="*.tsx" --include="*.ts"
```

Expected: matches only in `src/tui/states/layout.tsx` (the legacy API definition). Every other reference should have been migrated. If anything else turns up, apply the recipe.

- [ ] **Step 4: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. Run `bun run fix` if Biome reports formatting issues, then re-verify.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/AccountDelete.tsx src/tui/screens/AccountList.tsx src/tui/screens/AccountReferences.tsx src/tui/screens/AccountSelect.tsx src/tui/screens/AccountTypeSelect.tsx src/tui/screens/CategoryDelete.tsx src/tui/screens/CategoryList.tsx src/tui/screens/CategorySelect.tsx src/tui/screens/CountryDelete.tsx src/tui/screens/CountryList.tsx src/tui/screens/CurrencyDelete.tsx src/tui/screens/CurrencyList.tsx src/tui/screens/CurrencySelect.tsx src/tui/screens/ExpenseDelete.tsx src/tui/screens/ExpenseDuplicateSelect.tsx src/tui/screens/ExpenseList.tsx src/tui/screens/OwnerDelete.tsx src/tui/screens/OwnerList.tsx src/tui/screens/OwnerReferences.tsx src/tui/screens/OwnerSelect.tsx src/tui/screens/TagDelete.tsx src/tui/screens/TagList.tsx src/tui/screens/TagSelect.tsx src/tui/screens/TripCreateCountryDelete.tsx src/tui/screens/TripCreateCountryList.tsx src/tui/screens/TripDelete.tsx src/tui/screens/TripDuplicateSelect.tsx src/tui/screens/TripList.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): migrate screens from setBorderColor to setColor

Every screen that used setBorderColor now calls setColor with explicit
border + title slots so the title color matches the screen's identity.
Delete screens get a red title alongside the red border; duplicate-
pickers get a yellow title plus yellow border, and their inner
"Select to duplicate:" header text flips from cyan to yellow.
EOF
)"
```

If any file path in the `git add` command above doesn't exist (e.g. you renamed something), drop it from the list and add only the files you actually modified.

---

## Task 3: Remove the deprecated `setBorderColor` / `borderColor` slot

With every consumer migrated, the legacy API is dead code. Remove it from `layout.tsx` and from `Default.tsx`'s fallback.

**Files:**
- Modify: `src/tui/states/layout.tsx`
- Modify: `src/tui/layouts/Default.tsx`

- [ ] **Step 1: Confirm no remaining references to the deprecated API**

```bash
grep -rn "setBorderColor\b\|borderColor\b" src/tui --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: matches only in `src/tui/states/layout.tsx` (definition) and `src/tui/layouts/Default.tsx` (fallback usage). If any screen still references the deprecated names, complete Task 2's migration before continuing.

- [ ] **Step 2: Remove `borderColor` / `setBorderColor` from the interface in `layout.tsx`**

In `src/tui/states/layout.tsx`, update the `LayoutContextValue` interface to drop the two deprecated fields. The final shape:

```ts
interface LayoutContextValue {
    menuOptions: SelectOption[];
    onMenuSelect: ((value: string) => void) | null;
    hints: HelpHint[];
    colors: LayoutColors;
    titleSuffix: string | null;
    setMenu: (
        options: SelectOption[],
        onSelect: (value: string) => void,
    ) => void;
    setHints: (hints: HelpHint[]) => void;
    setColor: (colors: LayoutColors) => void;
    setTitleSuffix: (suffix: string | null) => void;
    resetLayout: () => void;
}
```

- [ ] **Step 3: Remove the deprecated state and setter from `LayoutProvider`**

Inside `LayoutProvider`:

- Delete the line `const [borderColor, setBorderColorState] = useState<string | null>(null);`
- Delete the `setBorderColor` `useCallback` block (the entire `const setBorderColor = useCallback((color: string | null) => { setBorderColorState(color); }, []);`).
- In `resetLayout`, delete the line `setBorderColorState(null);`. Keep `setColorsState({});`.
- In the `useMemo` that returns the context value: remove `borderColor` and `setBorderColor` from both the object literal and the dependency array.

Final `useMemo` shape:

```tsx
const value = useMemo<LayoutContextValue>(
    () => ({
        menuOptions,
        onMenuSelect: onMenuSelectSnapshot,
        hints,
        colors,
        titleSuffix,
        setMenu,
        setHints,
        setColor,
        setTitleSuffix,
        resetLayout,
    }),
    [
        menuOptions,
        onMenuSelectSnapshot,
        hints,
        colors,
        titleSuffix,
        setMenu,
        setHints,
        setColor,
        setTitleSuffix,
        resetLayout,
    ],
);
```

- [ ] **Step 4: Remove the legacy fallback in `Default.tsx`**

In `src/tui/layouts/Default.tsx`, update the destructure to drop `borderColor`:

```tsx
const { menuOptions, onMenuSelect, hints, colors } = useLayout();
```

Update the active-border-color computation to drop the legacy fallback:

```tsx
const activeBorderColor = colors.border ?? defaultBorderColor ?? "cyan";
```

Keep `activeTitleColor` unchanged (it never used the legacy slot).

- [ ] **Step 5: Verify type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all pass. If anything fails, it likely means a screen still references the deprecated API — run the grep from Step 1 and migrate the stragglers.

- [ ] **Step 6: Manual TUI smoke test**

Start the app and verify the four key scenarios:

```bash
bun run start
```

1. Open a delete screen (e.g. `[x] Delete` on a trip with at least one expense → `[x] Delete` on an expense). Title and border both render red. ✓
2. Open the expense duplicate-picker (`[d]` on expense list). Title is yellow, border is yellow, inner "Select an expense to duplicate:" header is yellow. ✓
3. Open the trip duplicate-picker (`[d]` on trip list). Same expectations — yellow title, yellow border, yellow inner header. ✓
4. Open any normal list (expense list, trip list, owner list). Title and border are cyan as before. ✓
5. On a duplicate-picker, press `[tab]` to move focus to the menu. Title and inner header stay yellow; the main border dims to gray. ✓

Report any deviation.

- [ ] **Step 7: Commit**

```bash
git add src/tui/states/layout.tsx src/tui/layouts/Default.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): remove deprecated setBorderColor / borderColor slot

Every consumer migrated to setColor / colors in the prior commit. Drop
the legacy fields from LayoutContextValue, LayoutProvider state, and
Default.tsx's fallback chain.
EOF
)"
```

---

## Done criteria

- `bun test` green (171 — no new tests, no regressions).
- `bun run check:type` clean.
- `bun run check` clean.
- Manual checks from Task 3 Step 6 all pass.
- `grep -rn "setBorderColor\|borderColor" src/` returns no matches outside the spec/plan docs.
- Three commits on the branch — one per task — forming a clean review history.
