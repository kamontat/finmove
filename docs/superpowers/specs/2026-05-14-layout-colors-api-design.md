# Layout Colors API

## Goal

Replace the single-color `setBorderColor` / `borderColor` slot on `LayoutContext` with a multi-slot `setColor({ border?, title? })` / `colors: LayoutColors` API. The immediate driver is that the title (breadcrumb) should match the screen's identity color — yellow on duplicate-pickers, red on delete screens, cyan everywhere else — and the existing API can only carry one value. Routing both slots through a single typed object also leaves room for future color slots without further API churn.

## Behavior

Visually after the change:

- **Default screens** (no `setColor` override): title is cyan, border is cyan (or the route's `defaultBorderColor` if set). Unchanged from today.
- **Delete screens** (currently `setBorderColor("red")`): title becomes red, border stays red.
- **Duplicate-pickers** (currently `setBorderColor("yellow")`): title becomes yellow, border stays yellow. The inner "Select to duplicate:" header text in each picker also becomes yellow.
- **Focus behavior**: the title and inner-header text always render in the identity color regardless of focus. Only the border itself dims to gray when focus is on the menu (today's behavior — unchanged for the border).

## API

`src/tui/states/layout.tsx`:

```ts
export interface LayoutColors {
    border?: string;
    title?: string;
}

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

`setColor` replaces the entire `colors` object — it does NOT merge. Callers pass the full intended shape. `setColor({})` clears overrides (defaults apply). `resetLayout()` resets `colors` to `{}`.

`LayoutColors` is exported because consumers — chiefly `Default.tsx` — destructure typed slots from `colors`. Screens that only call `setColor` do not need the type.

## Layout Rendering (`Default.tsx`)

```tsx
const { ..., colors } = useLayout();
const activeBorderColor = colors.border ?? defaultBorderColor ?? "cyan";
const activeTitleColor = colors.title ?? defaultBorderColor ?? "cyan";
const mainBorderColor =
    focus === "main" || focus === "input" ? activeBorderColor : "gray";
const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";

// title rendering:
<Text bold color={activeTitleColor}>
    {" "}
    {title}
</Text>
```

Notes:
- Title color falls back to the route's `defaultBorderColor` (then `"cyan"`) for consistency with border resolution. This means if a route ever sets a `defaultBorderColor` in `routes`, both the title and the border pick it up.
- The title's color is `activeTitleColor` directly, NOT `mainBorderColor`. That means the title stays yellow/red/cyan even when focus moves to the menu — only the border dims.
- The inner header text in the duplicate-pickers is rendered by the screen, not by `Default.tsx`. It is migrated independently (see below).

## Screen Migration

Every screen that uses `setBorderColor` migrates:

| Today                                  | After                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| `setBorderColor(null)` (default reset) | `setColor({})`                                          |
| `setBorderColor("red")`                | `setColor({ border: "red", title: "red" })`             |
| `setBorderColor("yellow")`             | `setColor({ border: "yellow", title: "yellow" })`       |

Cleanup returns in `useEffect` blocks (which currently call `setBorderColor(null)`) also migrate to `setColor({})`. Dependency arrays that reference `setBorderColor` change to `setColor`. The destructure of `useLayout()` changes accordingly.

The screens that set a non-null color (and thus need the `setColor({ border, title })` form):

- `src/tui/screens/AccountDelete.tsx` — red
- `src/tui/screens/AccountReferences.tsx` — red
- `src/tui/screens/CategoryDelete.tsx` — red
- `src/tui/screens/CountryDelete.tsx` — red
- `src/tui/screens/CurrencyDelete.tsx` — red
- `src/tui/screens/ExpenseDelete.tsx` — red
- `src/tui/screens/ExpenseDuplicateSelect.tsx` — yellow
- `src/tui/screens/OwnerDelete.tsx` — red
- `src/tui/screens/OwnerReferences.tsx` — red
- `src/tui/screens/TagDelete.tsx` — red
- `src/tui/screens/TripCreateCountryDelete.tsx` — red
- `src/tui/screens/TripDelete.tsx` — red
- `src/tui/screens/TripDuplicateSelect.tsx` — yellow

The remaining 15 screens (lists and selectors that only call `setBorderColor(null)` defensively) migrate to `setColor({})`. These are listed in the implementation plan; the change is mechanical.

## Inner Header Text in Duplicate-Pickers

`ExpenseDuplicateSelect.tsx` and `TripDuplicateSelect.tsx` render a "Select an X to duplicate:" line above their picker tables. That text currently uses `color="cyan"`. It moves to `color="yellow"` as an inline literal — not routed through `colors` because the layout does not render this text. Each screen owns its own content; the literal matches the same value the screen passes to `setColor`.

## Files

- `src/tui/states/layout.tsx` — interface change, state shape, setter rename, `resetLayout` updated
- `src/tui/layouts/Default.tsx` — consume `colors.border` and `colors.title`
- 28 screen files under `src/tui/screens/` — mechanical migration of `setBorderColor` → `setColor`
- `src/tui/screens/ExpenseDuplicateSelect.tsx`, `src/tui/screens/TripDuplicateSelect.tsx` — additionally flip the inner-header literal color from `"cyan"` to `"yellow"`

## Out of Scope

- Adding more color slots (e.g. `menu`, `hint`, `header`). YAGNI until a concrete use case appears.
- Convenience helpers like `setColor.uniform("red")`. The explicit object form is fine for the volume of callers.
- Threading the duplicate-picker inner header text through `colors` as a `header` slot.
- Changing the `defaultBorderColor` defaults declared in `routes`.

## Testing

No unit tests — this is a screen-level styling and React-context refactor. Manual TUI verification:

1. Open a delete screen (e.g. trip delete) → title and border both red.
2. Open a duplicate-picker → title, border, and inner "Select to duplicate" text all yellow.
3. Open any normal list → title and border cyan (unchanged from today).
4. On a duplicate-picker, press `[tab]` to move focus to the menu → title and inner header stay yellow; the main border dims to gray (existing behavior).
5. Back-navigate out of a delete or duplicate screen → the parent screen renders with its own (cyan) colors immediately, confirming the cleanup return correctly resets `colors` to `{}`.
