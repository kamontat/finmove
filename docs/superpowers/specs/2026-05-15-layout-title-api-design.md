# Layout Title API

## Goal

Replace `titleSuffix` / `setTitleSuffix` on `LayoutContext` with a full title-array API (`titles`, `title`, `setTitle`, `clearTitle`) so each screen owns its complete breadcrumb. Delete `src/tui/buildBreadcrumb.ts` (and its test) — the switch that maps route paths to breadcrumb segments. Title state moves entirely into `LayoutContext`; the Router reads the joined `title` and hands it to the layout, without consulting trip data or a switch.

## Why

The current split is awkward:

- `buildBreadcrumb.ts` hard-codes breadcrumbs for some routes (everything under `/trips`, `/trips/owners/*`, `/trips/accounts/*`, `/trips/expenses/*`, plus `/notifications`) but not for `/trips/settings/*`.
- Screens are inconsistent about what they pass to `setTitleSuffix`:
  - Some pass a dynamic single segment (e.g. `OwnerEdit` passes `owner.name`),
  - Some pass an entire breadcrumb path (e.g. `TagDelete` passes `"Settings > Tags > Delete"`),
  - Some pass standalone titles (e.g. `OwnerSelect` passes `"Select Owners"`).
- Adding a new screen requires editing both the central `buildBreadcrumb` switch and the screen's own `setTitleSuffix` call.

Moving title ownership fully to each screen removes the central switch, makes the title source for any screen findable by reading just that screen, and unifies the three current usage patterns into one.

## API

`TitleSegment` is a shared type added to `src/tui/models/index.ts` so both `layout.tsx` and the `titles.ts` helpers can import it without creating a state-layer dependency for utilities:

```ts
export type TitleSegment = string | null | undefined | false;
```

`src/tui/states/layout.tsx`:

```ts
import type { TitleSegment } from "../models";

interface LayoutContextValue {
    hints: HelpHint[];
    colors: LayoutColors;
    titles: string[];   // filtered: only non-empty strings
    title: string;      // titles.join(" > ")
    setHints: (hints: HelpHint[]) => void;
    setColor: (colors: LayoutColors) => void;
    setTitle: (segments: TitleSegment[]) => void;
    clearTitle: () => void;
    resetLayout: () => void;
}
```

Behavior:

- `setTitle(segments)` replaces the entire title. Internally filters out `null | undefined | false | ""` and stores the resulting `string[]` in `titles`. `title` is the `" > "`-joined form, exposed as a memoized field for direct rendering.
- `clearTitle()` is equivalent to `setTitle([])`. Provided as a named cleanup verb so screens read clearly: `return () => clearTitle();`.
- `resetLayout()` clears `titles` (in addition to today's reset of `hints` and `colors`).
- `TitleSegment` accepts falsy values so screens can spread `trip?.settings.name` without guarding loading states. Before the trip loads, that segment is `undefined`, gets filtered, and the title renders without it; once the trip loads, the `useEffect` re-runs and the title gains the trip name. This matches today's behavior where the breadcrumb omits the trip name pre-load.

`titleSuffix` and `setTitleSuffix` are removed from the interface entirely. No backwards-compatibility shim.

## Helpers (`src/tui/utils/titles.ts`)

New file. Two helpers cover the two prefix patterns that recur across many screens:

```ts
import type { Trip } from "../../core/models";
import type { TitleSegment } from "../models";

export function tripTitle(
    trip: Trip | null | undefined,
    ...rest: TitleSegment[]
): TitleSegment[] {
    return ["Trips", trip?.settings.name, ...rest];
}

export function settingsTitle(
    trip: Trip | null | undefined,
    ...rest: TitleSegment[]
): TitleSegment[] {
    return [...tripTitle(trip), "Settings", ...rest];
}
```

Notes:

- Helpers return `TitleSegment[]` (still containing potential `undefined` for `trip?.settings.name`). The filtering happens inside `setTitle`, so loading-state handling stays in one place.
- `tripTitle` covers ~25 screens under `/trips/<id>/*`. `settingsTitle` covers ~20 screens under `/trips/<id>/settings/*`.
- No helpers for `Owners`, `Accounts`, `Expenses` single segments — passing the literal as a `rest` arg is short enough that a dedicated helper adds no value.
- No helper for the modal-style `Select <X>` titles either (each modal screen has its own one-off title).

## App.tsx Router

After the refactor, the `Router` function shrinks to:

```ts
function Router(): JSX.Element {
    const { currentRoute } = useNavigation();
    const { setMenuAvailable } = useFocus();
    const { title } = useLayout();
    const { options: menuOptions } = useMenu();

    useGlobalKeys();

    const hasMenu = menuOptions.length > 0;
    useEffect(() => {
        setMenuAvailable(hasMenu);
    }, [hasMenu, setMenuAvailable]);

    const Component = routes[currentRoute.path].component;

    return (
        <Default title={title}>
            <Component />
        </Default>
    );
}
```

Removed from `Router`:

- The `buildBreadcrumb(currentRoute, trip)` call.
- The `useLayout().titleSuffix` destructure.
- The `titleSuffix ? \`${breadcrumb} > ${titleSuffix}\` : breadcrumb` line.
- The `useData()` call (Router no longer needs trip data — screens get it themselves).

Files deleted:

- `src/tui/buildBreadcrumb.ts`
- `src/tui/__tests__/buildBreadcrumb.test.ts`

The `Default` layout's interface does not change — it still receives `title: string`.

## Screen Migration

Every screen that currently calls `setTitleSuffix` switches to `setTitle` + `clearTitle`. The mapping rules:

1. **Screens that previously passed a dynamic single segment** and relied on `App.tsx` to build the prefix — now pass the full breadcrumb using helpers.

    `OwnerEdit` (today):
    ```ts
    setTitleSuffix(owner?.name ?? ownerId);
    ```
    `OwnerEdit` (after):
    ```ts
    setTitle(tripTitle(trip, "Owners", "Edit", owner?.name ?? ownerId));
    return () => clearTitle();
    ```

2. **Screens that previously passed a full path string** — now return an array.

    `TagDelete` (today):
    ```ts
    setTitleSuffix("Settings > Tags > Delete");
    ```
    `TagDelete` (after):
    ```ts
    setTitle(settingsTitle(trip, "Tags", "Delete"));
    return () => clearTitle();
    ```

3. **Screens that previously cleared the suffix** (`setTitleSuffix(null)`) — were relying on the `App.tsx` switch to provide the whole breadcrumb. They now need to set their own title explicitly.

    `OwnerList` (today): had `setTitleSuffix(null)`, breadcrumb came from `App.tsx` switch.
    `OwnerList` (after):
    ```ts
    setTitle(tripTitle(trip, "Owners"));
    return () => clearTitle();
    ```

4. **Modal-style screens** (`OwnerSelect`, `AccountSelect`, etc.) — keep their standalone titles, no prefix.

    `OwnerSelect` (today):
    ```ts
    setTitleSuffix("Select Owners");
    ```
    `OwnerSelect` (after):
    ```ts
    setTitle(["Select Owners"]);
    return () => clearTitle();
    ```

5. **Screens not currently using `setTitleSuffix` at all** (`TripOverview`, `TripBroken`, `NotificationList`) — were fully driven by the `buildBreadcrumb` switch. They now need to add a `useEffect` that calls `setTitle` themselves. Examples:

    ```ts
    // TripOverview: Trips > [tripName]
    setTitle(tripTitle(trip));

    // TripBroken: Trips > [tripName] (or just "Trips" if no trip loaded)
    setTitle(tripTitle(trip));

    // NotificationList: Notifications
    setTitle(["Notifications"]);
    ```

### Cleanup pattern

All screens follow:

```ts
useEffect(() => {
    setTitle([...]);
    return () => clearTitle();
}, [setTitle, clearTitle, ...dependencies]);
```

Cleanup ensures the next screen renders with an empty title for a single frame until its own effect runs — matching the existing pattern used by `setHints` / `setColor` cleanups today.

### `useData()` additions

Screens that previously did not import `useData` but need `trip` for the title prefix must add the import and destructure `trip`. This affects modal-style screens (e.g. `OwnerSelect`, `AccountSelect`) only if they're switched to include the trip prefix — per rule 4 above, they stay standalone, so no `useData` is needed.

Screens already using `useData()` for other reasons (form data, validation) — most edit/list screens — gain no new dependency.

### Full screen list

45 screens currently call `setTitleSuffix` and must migrate to `setTitle` + `clearTitle`:

AccountCreate, AccountDelete, AccountEdit, AccountList, AccountReferences, AccountSelect, AccountTypeSelect, CategoryCreate, CategoryDelete, CategoryEdit, CategoryList, CategorySelect, CountryCreate, CountryDelete, CountryEdit, CountryList, CurrencyCreate, CurrencyDelete, CurrencyEdit, CurrencyList, CurrencySelect, ExpenseDelete, ExpenseDuplicateSelect, ExpenseForm, ExpenseList, Export, OwnerCreate, OwnerDelete, OwnerEdit, OwnerList, OwnerReferences, OwnerSelect, TagCreate, TagDelete, TagEdit, TagList, TagSelect, TripCreateCountryAdd, TripCreateCountryDelete, TripCreateCountryList, TripDelete, TripDuplicateSelect, TripForm, TripList, TripSettings.

3 screens do NOT currently call `setTitleSuffix` but are covered by the `buildBreadcrumb` switch — they must add a new `setTitle` effect:

TripOverview, TripBroken, NotificationList.

Total: 48 screen files modified.

For `NotificationList`, the title is a standalone `setTitle(["Notifications"])` (matches the current breadcrumb behavior — no trip prefix).

## CLAUDE.md update

The current section on `titleSuffix` in `CLAUDE.md` is replaced with guidance for the new API:

- Each screen owns its full title via `setTitle([...])` in `useEffect`, with `clearTitle()` cleanup.
- Falsy segments are filtered, so `trip?.settings.name` is safe to spread before data loads.
- Two helpers in `src/tui/utils/titles.ts`: `tripTitle(trip, ...rest)` and `settingsTitle(trip, ...rest)` for the two recurring prefix patterns.
- Modal-style screens (selectors) use bare `setTitle(["Select X"])` — no prefix.
- `App.tsx`'s `Router` is no longer responsible for breadcrumbs.

## Files

- `src/tui/models/index.ts` — add and export `TitleSegment` type.
- `src/tui/states/layout.tsx` — replace `titleSuffix`/`setTitleSuffix` with `titles`/`title`/`setTitle`/`clearTitle`. Update `resetLayout` to clear titles. Import `TitleSegment` from models.
- `src/tui/utils/titles.ts` — new file with `tripTitle` and `settingsTitle`.
- `src/tui/App.tsx` — drop `buildBreadcrumb` call, drop `useLayout().titleSuffix`, drop `useData()` in Router, read `title` from `useLayout()`.
- `src/tui/buildBreadcrumb.ts` — **deleted**.
- `src/tui/__tests__/buildBreadcrumb.test.ts` — **deleted**.
- 48 screen files under `src/tui/screens/` — 45 migrate `setTitleSuffix` calls to `setTitle` + `clearTitle`; 3 (`TripOverview`, `TripBroken`, `NotificationList`) add a new `setTitle` effect. Full list under "Screen Migration".
- `CLAUDE.md` — replace the `titleSuffix` documentation block.

## Out of Scope

- Route-config-driven titles (declaring `title` per `RouteConfig` entry). Was explored during brainstorming; rejected in favor of keeping title state in `LayoutContext` so dynamic data (loaded trip, owner, expense) flows through the same hook screens already use.
- A `parent`/hierarchy mechanism on `RouteConfig`. Same reason.
- `appendTitle` / mutating helpers. Single-write semantics via `setTitle` avoid ordering bugs across effects.
- Per-segment styling (e.g. coloring the trip name differently). Out of scope; title remains a plain joined string.
- Adding helpers for `Owners` / `Accounts` / `Expenses` prefixes. Only saves one literal segment per call; not worth a helper.

## Testing

No unit tests — this is a context-state refactor with screen-level effect changes. Manual TUI verification:

1. Launch app with no `--trip` flag → title is `Trips` (no trip context).
2. Open a trip from the list (`TripOverview`) → title is `Trips > [name]`.
3. Navigate into owners, accounts, expenses, settings → title prefix updates correctly through `tripTitle` helper.
4. Open an owner edit screen for an owner whose data is mid-load → title temporarily renders without the owner name segment, then includes it after load (verifies falsy-segment filtering).
5. Open a settings sub-page (e.g. tags delete) → title is `Trips > [name] > Settings > Tags > Delete` (verifies `settingsTitle`).
6. Open a duplicate flow (`/trips/new` with `duplicateFromDirPath`) → title is `Trips > Duplicate`.
7. Open a modal selector (e.g. `OwnerSelect`) → title is just `Select Owners` (no trip prefix).
8. Back-navigate from any screen → parent screen's title renders immediately (verifies `clearTitle` cleanup followed by parent's effect re-running).
9. Run `bun run check:type` → no type errors after removing `titleSuffix` from `LayoutContextValue`.
