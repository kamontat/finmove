# Inline Row Actions for `[d]` and `[x]`

**Date:** 2026-05-14
**Status:** Draft

## Goal

When focus is on the main zone of a list screen, pressing `[d]` (duplicate) or `[x]` (delete) acts on the currently highlighted row directly, rather than always opening the dedicated picker screen. Delete requires a two-press confirm (`[x]` `[x]`). When focus is on the menu, the existing picker-screen behavior is preserved.

This continues from `2026-05-14-delete-duplicate-dedicated-paths-design.md`, which moved each list's delete/duplicate UI onto dedicated child routes. That work stays intact; the picker screens remain reachable from the menu shortcut. This spec adds a faster inline path when the user already has a row highlighted.

## Scope

The same nine list screens that received dedicated delete/duplicate paths:

- `/trips` — `[d]` duplicate, `[x]` delete
- `/trips/owners` — `[x]` delete (with references check)
- `/trips/accounts` — `[x]` delete (with references check)
- `/trips/expenses` — `[d]` duplicate, `[x]` delete
- `/trips/settings/countries` — `[x]` delete
- `/trips/settings/categories` — `[x]` delete
- `/trips/settings/tags` — `[x]` delete
- `/trips/settings/currencies` — `[x]` delete
- `/trips/new/countries` — `[x]` delete

Out of scope:
- Core services (`deleteTrip`, `removeOwner`, etc.) — unchanged.
- Existing picker screens (`/trips/delete`, `/trips/duplicate`, `/trips/owners/delete`, etc.) — unchanged; remain the menu-focus destination.
- References screens (`/trips/owners/references`, `/trips/accounts/references`) — unchanged; inline owner/account delete navigates to them when refs exist.
- Visual UI of the picker screens themselves — unchanged.

## Behavior

### When `focus === "main"` and list is non-empty

**`[d]`** (where the screen's menu offers Duplicate): fires the duplicate action for the highlighted row immediately. No confirmation. For trips, navigates to `/trips/duplicate/new` with source props prefilled. For expenses, navigates to `/trips/expenses/form` with `duplicateFromId`. The dedicated picker screen is skipped.

**`[x]`** (where the screen's menu offers Delete):

1. **First press.** Run the screen's `check` callback (if any). If `check` returns `false`, the screen has handled the action (e.g., navigated to a references screen) — no armed state, nothing further happens. If `check` returns `true` (or no check is supplied), arm the row: the row renders in red and a `Press [x] again to confirm delete` hint appears below the list.
2. **Second press on the same row.** Fire the delete handler. The actual delete + `reloadTrip()` (or local list refresh for `/trips`) runs. Armed state clears. If the list becomes empty as a result, the screen calls `goBack()` — same as today's picker screens.

While armed:
- Any cursor change (arrow keys) clears the armed state.
- Navigating away (`[esc]`, `[q]`, another menu shortcut that fires the menu callback) clears the armed state. The menu-shortcut path for any other option calls `reset()` before invoking the screen's `onSelect`.
- `[tab]` (focus switch) does not clear armed state. Coming back to main with the same cursor leaves the row still armed.

For owners and accounts, `check` runs `findOwnerReferences` / `findAccountReferences`. When refs exist, the check navigates to the references screen and returns `false`. When clean, returns `true` and the two-press arm proceeds.

### When `focus === "menu"` or list is empty

Unchanged. The menu's `[d]`/`[x]` shortcut fires the screen's `onSelect` callback, which navigates to the dedicated picker screen (`/trips/delete`, `/trips/expenses/duplicate`, etc.). Picker-screen behavior is unmodified.

### Visual

- Armed row: rendered with `color="red"` while preserving `inverse` if it is also the cursor row.
- Hint line: rendered red, inside the main box, directly below the list, by `layouts/Default.tsx` reading from `useMenu().armedHint`.
- Main box border: unchanged (no red border for inline confirm — only the row + hint).

## Architecture

### New `MenuContext` (`src/tui/states/menu.tsx`)

Menu state, currently part of `useLayout`, moves into its own context so the inline-action state machine has a clear home alongside the menu options.

```ts
interface MenuOption {
  label: string;
  value: string;
  key?: string;
  // Declarative inline behavior when focus === "main".
  mainAction?: {
    confirmCount?: number;                       // default 1 (single press); 2 for two-press confirm
    check?: (index: number) => boolean;          // false = skip arm (screen handled, e.g., navigated)
    onConfirm: (index: number) => void;          // fires when confirmCount reached
  };
}

interface MenuContextValue {
  options: MenuOption[];
  onSelect: ((value: string) => void) | null;    // menu-focus path; also options without mainAction

  // Exposed state for renderers:
  armed: { value: string; index: number; count: number } | null;
  armedHint: string | null;                       // e.g., "Press [x] again to confirm delete"

  // Setters used by screens:
  setMenu: (options: MenuOption[], onSelect: (value: string) => void) => void;

  // Setter used by selector components on cursor change:
  setActiveIndex: (index: number | null) => void;

  // Trigger used by Default layout (wraps SelectInput's onChange):
  trigger: (value: string, focus: FocusZone) => void;

  reset: () => void;
}
```

**`trigger(value, focus)` logic:**

```
opt = options.find(o => o.value === value)
if (!opt) return

if (focus === "main" && opt.mainAction && activeIndex !== null):
  runMainAction(opt, activeIndex)
else:
  reset()                       // leaving main or pressing another shortcut clears armed
  onSelect?.(value)
```

**`runMainAction(opt, index)` state machine:**

```
if armed matches (opt.value, index):
  armed.count += 1
  if armed.count >= (opt.mainAction.confirmCount ?? 1):
    opt.mainAction.onConfirm(index)
    armed = null
else:
  if opt.mainAction.check?.(index) === false:
    armed = null                # screen handled it
    return
  armed = { value: opt.value, index, count: 1 }
  if (opt.mainAction.confirmCount ?? 1) <= 1:
    opt.mainAction.onConfirm(index)
    armed = null
```

`armedHint` is derived from `armed`: `Press [<key>] again to confirm <label.toLowerCase()>`.

**`reset()` is called from:**
- `setMenu` (new screen → clean slate). `setMenu` also clears `activeIndex` to `null`, so screens without a list start clean and only re-populate `activeIndex` via the selector's `onHighlight`.
- `setActiveIndex` when the index changes and `armed.index !== newIndex`.
- `trigger` when falling through to the menu-focus / no-mainAction path.

### Changes to `layouts/Default.tsx`

- Read `options`, `onSelect`, `armed`, `armedHint`, `trigger` from `useMenu()` (replacing the equivalent fields from `useLayout`).
- Wire `SelectInput`: `onChange={(value) => trigger(value, focus)}`.
- Render `armedHint` (when non-null) as a red text line inside the main box, directly below `{children}`.

### Changes to `states/layout.tsx`

- Remove `menuOptions`, `onMenuSelect`, `setMenu` from `LayoutContextValue`.
- `useLayout()` returns: `hints`, `colors`, `titleSuffix`, `setHints`, `setColor`, `setTitleSuffix`, `resetLayout`.
- `App.tsx` adds `<MenuProvider>` around the rest of the provider tree.

### Changes to selectors

**`VerticalSelect` (atom):** add a `useEffect` to fire `onHighlight(0)` on mount so consumers' active-index state is in sync from the start. The existing arrow-key `onHighlight` calls are unchanged.

**`ListSelect` (molecule):**
- Change `onHighlight` signature from `(value: string) => void` to `(value: string, index: number) => void`. Add `index` as a second argument when forwarding from `VerticalSelect`'s index-based `onHighlight`.
- Add `armedRowIndex?: number | null`. When set, that row renders with `color="red"` (overriding the default), preserving `inverse` if also the cursor row.

**`TableSelect` (molecule):**
- Add `onHighlight?: (index: number) => void`. Forward from `VerticalSelect.onHighlight`.
- Add `armedRowIndex?: number | null`. When set, that row renders all cells with `color="red"`, preserving `inverse` if also the cursor row.

These props are optional. Picker screens that use these selectors do not pass them and behave as before.

### Per-screen changes (9 list screens)

Each list screen:

1. Imports `useMenu()` (replacing the menu pieces of `useLayout()`).
2. Declares `mainAction` on duplicate/delete options:
   - Duplicate: `mainAction: { onConfirm: (i) => goTo(...) }` (no `confirmCount`, no `check`).
   - Delete (no refs check): `mainAction: { confirmCount: 2, onConfirm: (i) => { deleteX(...); reload(); } }`.
   - Delete (with refs check — owners, accounts): `mainAction: { confirmCount: 2, check: (i) => { if (hasRefs) { goTo(refsPath); return false; } return true; }, onConfirm: (i) => { remove(...); reload(); } }`.
3. Provides one `onSelect: (value: string) => void` callback for menu-focus and non-`mainAction` paths — typically unchanged from today, just minus the wrapper around the inline-action keys.
4. Wires the selector:
   - `ListSelect`: `onHighlight={(_, i) => setActiveIndex(i)} armedRowIndex={armed?.value === "delete" ? armed.index : null}`.
   - `TableSelect`: `onHighlight={setActiveIndex} armedRowIndex={armed?.value === "delete" ? armed.index : null}`.

Screens do NOT track cursor or armed state themselves — that state lives in `MenuContext`.

The empty/loading branches that render plain `<Text>` instead of a selector simply don't wire `setActiveIndex`; the menu context's `activeIndex` stays `null` and `trigger` falls through to `onSelect` for menu-focus navigation.

### Files touched

**New:**
- `src/tui/states/menu.tsx` (~120 lines)
- `src/tui/states/__tests__/menu.test.tsx` (state machine coverage)

**Modified:**
- `src/tui/states/layout.tsx` — remove menu fields.
- `src/tui/App.tsx` — wrap with `<MenuProvider>`.
- `src/tui/layouts/Default.tsx` — switch to `useMenu`, render armed hint.
- `src/tui/components/atoms/VerticalSelect.tsx` — onHighlight on mount.
- `src/tui/components/molecules/ListSelect.tsx` — onHighlight signature + armedRowIndex.
- `src/tui/components/molecules/TableSelect.tsx` — onHighlight + armedRowIndex.
- 20+ screens that currently call `setMenu` via `useLayout` — switch import to `useMenu`.
- 9 list screens — additionally add `mainAction` declarations and selector wiring.

## Test plan

Hook/unit:
- `useMenu` state machine: single-press onConfirm fires immediately, two-press requires same `(value, index)`, mismatched index re-arms with check, check returning `false` does not arm, `setActiveIndex` change clears stale arm.

Manual (one trip with several owners, accounts, expenses, settings entries, and at least one referenced owner and account):

1. From each of the 9 list screens with focus on main, press `[d]` (where applicable) on a highlighted row → confirm the corresponding duplicate form opens with source data prefilled. Picker screen is not visited.
2. From each list screen with focus on main, press `[x]` on a highlighted row → confirm the row turns red and the hint appears. Press `[x]` again → confirm the item is deleted and the list refreshes. When the list empties, confirm `goBack()` runs.
3. Press `[x]` to arm, then press an arrow key → confirm armed state clears, row returns to normal color.
4. Press `[x]` to arm, then press `[esc]`/`[q]` → confirm navigation back and no stale armed state on return.
5. Press `[x]` to arm, then `[tab]` to menu and back → confirm armed state survives.
6. Owners/accounts: press `[x]` on a referenced row → confirm immediate navigation to `/references` with no arming.
7. Owners/accounts: press `[x]` on a clean row → arms; second `[x]` deletes.
8. With focus on menu, press `[d]`/`[x]` on any list screen → confirm the picker screen opens (existing behavior preserved).
9. Empty list states: with no items, menu options that require a list are hidden or no-op (existing behavior); arming impossible.
10. Help bar (`[?]`) shows `[d]` and `[x]` correctly while on a list screen.

## Risks / non-risks

- **Menu callback closures:** `mainAction.onConfirm` and `check` capture screen state (`trip`, `cursor`, `goTo`). The screen's `setMenu` call lives in a `useEffect` with appropriate deps; the menu context re-stores callbacks on each call. Same pattern as today's `onSelect`.
- **`onHighlight` signature change:** `ListSelect.onHighlight` gaining a second argument is a breaking change to existing call sites, but the prop is optional and used in only a handful of places. Audit during implementation.
- **`activeIndex` lifecycle:** `setMenu` clears `activeIndex` so each new screen starts at `null`. List screens repopulate it via the selector's `onHighlight(0)` on mount. If a screen has menu options with `mainAction` but no rendered list, `activeIndex` stays `null` and `trigger` falls through to the menu-focus path — same behavior as if the user were focused on the menu. Acceptable.
- **Two-press misfire:** without a timeout, an armed row stays armed across focus toggles. The cursor-change-clears rule covers the common case (user moves before second press). Documented behavior; acceptable trade-off vs. timer complexity.
- **Path-string typos in mainAction navigations:** caught at compile time by existing typed `goTo`.
