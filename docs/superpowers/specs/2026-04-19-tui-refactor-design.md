# TUI Refactor Design Spec

## Overview

Refactor the TUI layer (`src/tui/`) to introduce a proper routing system, context-based global state, a default layout component, and centralized keyboard handling. The core goal is to replace the current discriminated-union switch-case routing in App.tsx with a declarative route map, and to extract global concerns (navigation, focus, help, layout registration, data) into React Context providers.

## Directory Structure

```
src/tui/
├── App.tsx              — thin shell: wraps AppProviders + renders Router
├── router.ts            — route path → route config map (no switch-case)
├── components/
│   ├── atoms/           — TextInput, SelectInput, VerticalSelect, etc.
│   ├── molecules/       — FormField, HelpBar, ConfirmPrompt, etc.
│   └── organisms/       — DataTable, NavigationMenu
├── layouts/
│   └── Default.tsx      — default layout: Title + Main + Menu + Hint
├── screens/             — screen components (one per route)
│   ├── TripList.tsx
│   ├── TripMenu.tsx
│   ├── OwnerList.tsx
│   ├── AccountList.tsx
│   ├── ExpenseList.tsx
│   ├── ExpenseForm.tsx
│   └── Export.tsx
├── models/              — shared TUI types (barrel re-export via index.ts)
│   └── index.ts
└── states/              — React Context providers + hooks
    ├── navigation.tsx   — useNavigation()
    ├── focus.tsx         — useFocus()
    ├── help.tsx          — useHelp()
    ├── layout.tsx        — useLayout()
    └── data.tsx          — useData()
```

### What moves where

- `screens/` stays as-is (renamed from the concept of "pages" back to screens).
- `components/` stays as-is with atomic design (atoms, molecules, organisms).
- The `Page` organism is replaced by `layouts/Default.tsx`.
- `models/` holds shared TUI types that are used across multiple files. Types used in only one file stay inline. Uses `index.ts` barrel re-export (same convention as `core/models/`).
- `states/` holds all context providers and their hooks.

## Routing

### Route Map (`router.ts`)

A plain object mapping string route paths to route configuration. No switch-case anywhere.

```ts
type RoutePath = 
  | "/trips"
  | "/trips/menu"
  | "/trips/owners"
  | "/trips/accounts"
  | "/trips/expenses"
  | "/trips/expenses/form"
  | "/trips/export"

type RouteConfig = {
  component: React.ComponentType<any>
  title: string | ((props: Record<string, unknown>) => string)
  defaultFocus: "main" | "menu"
  borderColor?: string  // default border color for this route (default: "cyan")
}

const routes: Record<RoutePath, RouteConfig> = {
  "/trips":               { component: TripList,    title: "Trips",       defaultFocus: "main" },
  "/trips/menu":          { component: TripMenu,    title: (p) => p.trip.name, defaultFocus: "menu" },
  "/trips/owners":        { component: OwnerList,   title: "Owners",      defaultFocus: "menu" },
  "/trips/accounts":      { component: AccountList, title: "Accounts",    defaultFocus: "menu" },
  "/trips/expenses":      { component: ExpenseList, title: "Expenses",    defaultFocus: "menu" },
  "/trips/expenses/form": { component: ExpenseForm, title: "Add Expense", defaultFocus: "main" },
  "/trips/export":        { component: Export,      title: "Export",      defaultFocus: "main" },
}
```

### Navigation

Navigation uses string paths with props passed via `goTo()`:

```ts
goTo("/trips/menu", { props: { tripName: "japan-2026" } })
goTo("/trips/expenses", { props: { tripName: "japan-2026" }, replace: true })
goBack()   // pops history stack, or exits if empty
goExit()   // exits program immediately
```

The history stack stores `{ path, props }` entries. `replace: true` replaces the current entry instead of pushing.

### Route Resolution in App.tsx

App.tsx becomes a thin shell:

```ts
const App = () => (
  <AppProviders>
    <Router />
  </AppProviders>
)

const Router = () => {
  const { currentRoute } = useNavigation()
  const route = routes[currentRoute.path]
  const Component = route.component

  useGlobalKeys()

  return (
    <Default title={route.title} defaultBorderColor={route.borderColor}>
      <Component {...currentRoute.props} />
    </Default>
  )
}
```

No switch-case — route lookup is a direct map access.

## Global State (Contexts)

Five React Context providers, each with its own file, provider component, and hook.

### Navigation Context (`states/navigation.tsx`)

**Hook:** `useNavigation()`

**State:**
- `currentRoute: { path: RoutePath, props: Record<string, unknown> }`
- `history: { path: RoutePath, props: Record<string, unknown> }[]`

**Actions:**
- `goTo(path, { props?, replace? })` — pushes current route to history (unless `replace: true`), sets new route, resets focus to the new route's `defaultFocus`, triggers data reload if entering a trip-scoped route.
- `goBack()` — pops history and restores previous route. If history is empty, exits the app. Triggers data reload for the restored route.
- `goExit()` — calls Ink's `useApp().exit()` immediately.

### Focus Context (`states/focus.tsx`)

**Hook:** `useFocus()`

**State:**
- `focus: "main" | "menu" | "input"`

**Actions:**
- `toggleFocus()` — toggles between "main" and "menu". No-op if menu is not available or focus is "input".
- `setFocus(zone)` — directly sets focus zone. Used by screens to enter "input" mode, and by navigation to reset on route change.

**Menu availability:** The layout tells the focus context whether a menu is currently visible (based on what the screen registered via `useLayout()`). `toggleFocus()` respects this.

### Help Context (`states/help.tsx`)

**Hook:** `useHelp()`

**State:**
- `visible: boolean` (default: `false`)

**Actions:**
- `toggleHelp()` — toggles visibility.

### Layout Context (`states/layout.tsx`)

**Hook:** `useLayout()`

Allows screen components to register their menu options, hints, and border color overrides. The Default layout reads from this context to render.

**State:**
- `menuOptions: SelectOption[]`
- `onMenuSelect: ((value: string) => void) | null`
- `hints: HelpHint[]`
- `borderColor: string | null` (runtime override, takes precedence over route config default)

**Actions:**
- `setMenu(options, onSelect)` — registers menu options and callback. Called by screens.
- `setHints(hints)` — registers help hints. Called by screens.
- `setBorderColor(color)` — overrides the route's default border color at runtime (e.g., red during delete). Pass `null` to reset to route default.

State resets when route changes — the navigation context calls a reset function on the layout context before rendering the new screen component. This ensures stale menu/hints from the previous screen don't flash on the new screen.

### Data Context (`states/data.tsx`)

**Hook:** `useData()`

Owns trip data loading and state. Screens read trip data from here instead of receiving it via props.

**State:**
- `trip: Trip | null` — the currently loaded trip
- `loading: boolean`

**Actions:**
- `loadTrip(tripName: string)` — reads trip data from YAML files on disk.
- `reloadTrip()` — reloads the current trip (for refreshing after edits).

**Integration with navigation:**
- `goTo()` with a trip-scoped route triggers `loadTrip()` using the `tripName` from props.
- `goBack()` triggers `reloadTrip()` when returning to a trip-scoped route.
- `/trips` route sets `trip` to `null`.

### Provider Composition

A single `AppProviders` component wraps all providers:

```ts
const AppProviders = ({ children }) => (
  <DataProvider>
    <NavigationProvider initialPath="/trips">
      <FocusProvider>
        <HelpProvider>
          <LayoutProvider>
            {children}
          </LayoutProvider>
        </HelpProvider>
      </FocusProvider>
    </NavigationProvider>
  </DataProvider>
)
```

Provider order matters: Navigation depends on Data (for trip loading on route change), and Layout depends on Focus (for menu availability).

## Default Layout (`layouts/Default.tsx`)

### Visual Structure

```
TITLE

┌─────────────────────────┐
│                         │
│          Main           │  ← dynamic height
│                         │
└─────────────────────────┘

┌─────────────────────────┐
│          Menu           │  ← hidden when no menu options
└─────────────────────────┘

[?] Help                     ← hidden until [?] pressed
```

### Behavior

- **Title:** Rendered above the main box. Resolved from route config — static string or function of current route props.
- **Main box:** Bordered. Height dynamically adjusts to fill remaining terminal space (uses `useStdout()` to get terminal rows, subtracts title/menu/help heights). Contains the screen component's rendered content (children).
- **Menu box:** Bordered. Rendered only when `menuOptions` from layout context is non-empty. Hidden entirely when empty (main box expands to fill the space).
- **Help bar:** Hidden by default. Toggled via `[?]`. Renders hints from layout context.

### Border Colors

Two-layer system:

1. **Focused border color:**
   - Route config can define a default via `borderColor` (e.g., `"green"` for expenses).
   - Screen can override at runtime via `useLayout().setBorderColor()` (e.g., `"red"` during delete confirmation).
   - Runtime override takes precedence over route default.
   - Falls back to `"cyan"` if neither is set.
2. **Unfocused border color:** Always `"gray"`.

### Props

The layout reads most data from contexts. It receives from the Router:
- `title` — resolved from route config
- `defaultBorderColor` — from route config (optional)
- `children` — the screen component

## Keyboard Handling

### Global Handler (`useGlobalKeys`)

A single `useInput` hook in the Router component handles all global shortcuts. Behavior depends on the current focus zone:

| Key     | main       | menu       | input              |
|---------|------------|------------|--------------------|
| `[q]`   | goBack()   | goBack()   | disabled (typing)  |
| `[esc]` | goExit()   | goExit()   | screen handles it  |
| `[tab]` | → menu     | → main     | disabled           |
| `[?]`   | toggleHelp | toggleHelp | disabled           |

### Input Mode

When a screen enters input mode (text fields, date pickers, form steps):
- Screen calls `useFocus().setFocus("input")`
- Global handler disables `[q]`, `[tab]`, `[?]`
- `[esc]` is not intercepted globally — the screen's input component handles it (e.g., go back one form step)
- When input completes or is cancelled, screen restores focus to `"main"` or `"menu"`

### Component-Level Keys

These remain in their respective components (not global):
- **Arrow keys** in SelectInput, VerticalSelect, DateInput
- **Enter** for selection/submission
- **Shortcut keys** (e.g., `[e]`, `[o]`, `[a]`) in SelectInput — always fire regardless of focus zone

## Shared TUI Models (`models/`)

Types that appear in multiple files move to `models/` with barrel re-export:

- `SelectOption` — `{ label: string; value: string; key?: string }`
- `HelpHint` — `{ key: string; label: string }`
- `RoutePath` — union of valid route path strings
- `RouteConfig` — route metadata type
- `FocusZone` — `"main" | "menu" | "input"`

Types used in only one file stay defined inline in that file.

## Screen Component Contract

Screens are normal React components. They interact with the system via hooks:

```ts
const ExpenseList = () => {
  const { goTo, goBack } = useNavigation()
  const { focus, setFocus } = useFocus()
  const { setMenu, setHints, setBorderColor } = useLayout()
  const { trip, reloadTrip } = useData()

  // Register menu and hints
  useEffect(() => {
    setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      (v) => { if (v === "add") goTo("/trips/expenses/form") }
    )
    setHints([{ key: "a", label: "Add expense" }])
  }, [])

  // Render main box content only
  return (
    <Box flexDirection="column">
      {/* expense list content */}
    </Box>
  )
}
```

### What screens do:
- Call `useLayout().setMenu()` and `useLayout().setHints()` to register menu/hints (via useEffect)
- Call `useLayout().setBorderColor()` for runtime color overrides
- Call `useFocus().setFocus("input")` when entering input mode
- Read `useData().trip` for trip data
- Use `useNavigation().goTo()` for navigation
- Render only their main box content as JSX return

### What screens don't do:
- No layout rendering (no borders, title, menu box)
- No global keyboard handling (no `[q]`, `[esc]`, `[tab]`, `[?]`)
- No trip data loading (data context handles it)

## Migration Notes

### Files to create:
- `src/tui/router.ts`
- `src/tui/layouts/Default.tsx`
- `src/tui/states/navigation.tsx`
- `src/tui/states/focus.tsx`
- `src/tui/states/help.tsx`
- `src/tui/states/layout.tsx`
- `src/tui/states/data.tsx`
- `src/tui/models/index.ts` (and individual type files)

### Files to heavily modify:
- `src/tui/App.tsx` — gut and replace with thin shell
- All screen files — remove layout rendering, replace prop-based navigation with hooks, replace trip prop with `useData()`

### Files to delete:
- `src/tui/components/organisms/Page.tsx` — replaced by `layouts/Default.tsx`

### Components unchanged:
- All atoms (TextInput, SelectInput, VerticalSelect, DateInput, etc.)
- All molecules (FormField, DateField, ConfirmPrompt, HelpBar, ListItem)
- DataTable, NavigationMenu organisms

### Pending action handling:
Currently `pendingAction` is managed in App.tsx and passed to screens. After refactor, `pendingAction` stays per-screen (managed internally by the screen that needs it, e.g., TripList, OwnerList, AccountList). It is not global state since it only affects one screen at a time.
