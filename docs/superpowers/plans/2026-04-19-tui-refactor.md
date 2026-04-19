# TUI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the TUI layer to use a declarative route map, context-based global state, a default layout, and centralized keyboard handling — replacing the current switch-case routing in App.tsx.

**Architecture:** Route map (`router.ts`) maps string paths to screen components + metadata. Five React Context providers manage global state (navigation, focus, help, layout registration, data). A `Default.tsx` layout reads from contexts to render the standard Title/Main/Menu/Hint structure. Screens are pure content components that interact via hooks.

**Tech Stack:** TypeScript, React, Ink (terminal UI), Bun runtime

---

### Task 1: Create shared TUI models

Extract types used across multiple TUI files into `src/tui/models/`.

**Files:**
- Create: `src/tui/models/index.ts`

- [ ] **Step 1: Create the models barrel file with shared types**

```ts
// src/tui/models/index.ts

import type { ComponentType } from "react";

// --- Focus ---

export type FocusZone = "main" | "menu" | "input";

// --- Route ---

export type RoutePath =
  | "/trips"
  | "/trips/menu"
  | "/trips/owners"
  | "/trips/accounts"
  | "/trips/expenses"
  | "/trips/expenses/form"
  | "/trips/export";

export interface RouteConfig {
  component: ComponentType;
  title: string | ((props: Record<string, unknown>) => string);
  defaultFocus: FocusZone;
  borderColor?: string;
}

// --- UI ---

export interface SelectOption {
  label: string;
  value: string;
  key?: string;
}

export interface HelpHint {
  key: string;
  label: string;
}

export interface VerticalOption {
  label: string;
  value: string;
  detail?: string;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "refactor: add shared TUI models"
```

---

### Task 2: Create focus context

**Files:**
- Create: `src/tui/states/focus.tsx`

- [ ] **Step 1: Create the focus context**

```tsx
// src/tui/states/focus.tsx

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { FocusZone } from "../models";

interface FocusContextValue {
  focus: FocusZone;
  menuAvailable: boolean;
  setFocus: (zone: FocusZone) => void;
  toggleFocus: () => void;
  setMenuAvailable: (available: boolean) => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }): JSX.Element {
  const [focus, setFocusState] = useState<FocusZone>("main");
  const [menuAvailable, setMenuAvailable] = useState(false);

  const setFocus = useCallback((zone: FocusZone) => {
    setFocusState(zone);
  }, []);

  const toggleFocus = useCallback(() => {
    setFocusState((current) => {
      if (current === "input") return current;
      if (!menuAvailable) return current;
      return current === "main" ? "menu" : "main";
    });
  }, [menuAvailable]);

  const value = useMemo(
    () => ({ focus, menuAvailable, setFocus, toggleFocus, setMenuAvailable }),
    [focus, menuAvailable, setFocus, toggleFocus],
  );

  return (
    <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
  );
}

export function useFocus(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/focus.tsx
git commit -m "refactor: add focus context provider"
```

---

### Task 3: Create help context

**Files:**
- Create: `src/tui/states/help.tsx`

- [ ] **Step 1: Create the help context**

```tsx
// src/tui/states/help.tsx

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";

interface HelpContextValue {
  visible: boolean;
  toggleHelp: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }): JSX.Element {
  const [visible, setVisible] = useState(false);

  const toggleHelp = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const value = useMemo(() => ({ visible, toggleHelp }), [visible, toggleHelp]);

  return (
    <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
  );
}

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/help.tsx
git commit -m "refactor: add help context provider"
```

---

### Task 4: Create layout context

**Files:**
- Create: `src/tui/states/layout.tsx`

- [ ] **Step 1: Create the layout context**

```tsx
// src/tui/states/layout.tsx

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { HelpHint, SelectOption } from "../models";

interface LayoutContextValue {
  menuOptions: SelectOption[];
  onMenuSelect: ((value: string) => void) | null;
  hints: HelpHint[];
  borderColor: string | null;
  setMenu: (options: SelectOption[], onSelect: (value: string) => void) => void;
  setHints: (hints: HelpHint[]) => void;
  setBorderColor: (color: string | null) => void;
  resetLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }): JSX.Element {
  const [menuOptions, setMenuOptions] = useState<SelectOption[]>([]);
  const onMenuSelectRef = useRef<((value: string) => void) | null>(null);
  const [hints, setHintsState] = useState<HelpHint[]>([]);
  const [borderColor, setBorderColorState] = useState<string | null>(null);
  // Force re-render counter for onMenuSelect ref changes
  const [, setTick] = useState(0);

  const setMenu = useCallback((options: SelectOption[], onSelect: (value: string) => void) => {
    setMenuOptions(options);
    onMenuSelectRef.current = onSelect;
    setTick((t) => t + 1);
  }, []);

  const setHints = useCallback((h: HelpHint[]) => {
    setHintsState(h);
  }, []);

  const setBorderColor = useCallback((color: string | null) => {
    setBorderColorState(color);
  }, []);

  const resetLayout = useCallback(() => {
    setMenuOptions([]);
    onMenuSelectRef.current = null;
    setHintsState([]);
    setBorderColorState(null);
  }, []);

  const value = useMemo(
    () => ({
      menuOptions,
      onMenuSelect: onMenuSelectRef.current,
      hints,
      borderColor,
      setMenu,
      setHints,
      setBorderColor,
      resetLayout,
    }),
    [menuOptions, hints, borderColor, setMenu, setHints, setBorderColor, resetLayout],
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/layout.tsx
git commit -m "refactor: add layout context provider"
```

---

### Task 5: Create data context

**Files:**
- Create: `src/tui/states/data.tsx`

- [ ] **Step 1: Create the data context**

```tsx
// src/tui/states/data.tsx

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { Trip } from "../../core/models";
import { loadTrip } from "../../core/services/trip/loadTrip";

interface DataContextValue {
  trip: Trip | null;
  loading: boolean;
  loadTripByPath: (tripDirPath: string) => void;
  reloadTrip: () => void;
  clearTrip: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTripPath, setCurrentTripPath] = useState<string | null>(null);

  const loadTripByPath = useCallback((tripDirPath: string) => {
    setLoading(true);
    try {
      const loaded = loadTrip(tripDirPath);
      setTrip(loaded);
      setCurrentTripPath(tripDirPath);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadTrip = useCallback(() => {
    if (currentTripPath) {
      setLoading(true);
      try {
        const loaded = loadTrip(currentTripPath);
        setTrip(loaded);
      } finally {
        setLoading(false);
      }
    }
  }, [currentTripPath]);

  const clearTrip = useCallback(() => {
    setTrip(null);
    setCurrentTripPath(null);
  }, []);

  const value = useMemo(
    () => ({ trip, loading, loadTripByPath, reloadTrip, clearTrip }),
    [trip, loading, loadTripByPath, reloadTrip, clearTrip],
  );

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/data.tsx
git commit -m "refactor: add data context provider"
```

---

### Task 6: Create navigation context

This depends on focus and data contexts.

**Files:**
- Create: `src/tui/states/navigation.tsx`

- [ ] **Step 1: Create the navigation context**

```tsx
// src/tui/states/navigation.tsx

import { useApp } from "ink";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { RoutePath } from "../models";
import { routes } from "../router";
import { useData } from "./data";
import { useFocus } from "./focus";
import { useLayout } from "./layout";

interface RouteEntry {
  path: RoutePath;
  props: Record<string, unknown>;
}

interface NavigationContextValue {
  currentRoute: RouteEntry;
  goTo: (path: RoutePath, options?: { props?: Record<string, unknown>; replace?: boolean }) => void;
  goBack: () => void;
  goExit: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  initialPath: RoutePath;
  initialProps?: Record<string, unknown>;
  children: ReactNode;
}

export function NavigationProvider({
  initialPath,
  initialProps,
  children,
}: NavigationProviderProps): JSX.Element {
  const [currentRoute, setCurrentRoute] = useState<RouteEntry>({
    path: initialPath,
    props: initialProps ?? {},
  });
  const historyRef = useRef<RouteEntry[]>([]);
  const { exit } = useApp();
  const { setFocus } = useFocus();
  const { resetLayout } = useLayout();
  const { loadTripByPath, reloadTrip, clearTrip } = useData();

  const syncTripData = useCallback(
    (path: RoutePath, props: Record<string, unknown>) => {
      if (path === "/trips") {
        clearTrip();
      } else if (props.tripDirPath) {
        loadTripByPath(props.tripDirPath as string);
      }
    },
    [loadTripByPath, clearTrip],
  );

  const goTo = useCallback(
    (path: RoutePath, options?: { props?: Record<string, unknown>; replace?: boolean }) => {
      const newProps = options?.props ?? {};
      const replace = options?.replace ?? false;

      if (replace) {
        // Replace current entry — don't push to history
      } else {
        historyRef.current.push({ ...currentRoute });
      }

      resetLayout();
      const routeConfig = routes[path];
      setFocus(routeConfig.defaultFocus);
      syncTripData(path, newProps);
      setCurrentRoute({ path, props: newProps });
    },
    [currentRoute, setFocus, resetLayout, syncTripData],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
      resetLayout();
      const routeConfig = routes[prev.path];
      setFocus(routeConfig.defaultFocus);
      if (prev.path !== "/trips") {
        reloadTrip();
      } else {
        clearTrip();
      }
      setCurrentRoute(prev);
    } else {
      exit();
    }
  }, [exit, setFocus, resetLayout, reloadTrip, clearTrip]);

  const goExit = useCallback(() => {
    exit();
  }, [exit]);

  const value = useMemo(
    () => ({ currentRoute, goTo, goBack, goExit }),
    [currentRoute, goTo, goBack, goExit],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: Will fail — `router.ts` doesn't exist yet. That's OK, we create it next.

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/navigation.tsx
git commit -m "refactor: add navigation context provider"
```

---

### Task 7: Create the router map

**Files:**
- Create: `src/tui/router.ts`

- [ ] **Step 1: Create the route map**

```ts
// src/tui/router.ts

import type { RouteConfig, RoutePath } from "./models";
import { AccountList } from "./screens/AccountList";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerList } from "./screens/OwnerList";
import { TripList } from "./screens/TripList";
import { TripMenu } from "./screens/TripMenu";

export const routes: Record<RoutePath, RouteConfig> = {
  "/trips": {
    component: TripList,
    title: "Trips",
    defaultFocus: "main",
  },
  "/trips/menu": {
    component: TripMenu,
    title: (props) => (props.tripName as string) ?? "Trip Menu",
    defaultFocus: "menu",
  },
  "/trips/owners": {
    component: OwnerList,
    title: "Owners",
    defaultFocus: "menu",
  },
  "/trips/accounts": {
    component: AccountList,
    title: "Accounts",
    defaultFocus: "menu",
  },
  "/trips/expenses": {
    component: ExpenseList,
    title: "Expenses",
    defaultFocus: "menu",
  },
  "/trips/expenses/form": {
    component: ExpenseForm,
    title: "Expense",
    defaultFocus: "main",
  },
  "/trips/export": {
    component: ExportScreen,
    title: "Export CSV",
    defaultFocus: "main",
  },
};
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: Will have errors — screens still expect old props. That's expected at this stage.

- [ ] **Step 3: Commit**

```bash
git add src/tui/router.ts
git commit -m "refactor: add route map"
```

---

### Task 8: Create the Default layout

**Files:**
- Create: `src/tui/layouts/Default.tsx`

- [ ] **Step 1: Create the default layout**

```tsx
// src/tui/layouts/Default.tsx

import { Box, Text, useStdout } from "ink";
import type { JSX, ReactNode } from "react";
import { SelectInput } from "../components/atoms/SelectInput";
import { HelpBar } from "../components/molecules/HelpBar";
import { useFocus } from "../states/focus";
import { useHelp } from "../states/help";
import { useLayout } from "../states/layout";

interface DefaultLayoutProps {
  title: string;
  defaultBorderColor?: string;
  children: ReactNode;
}

export function Default({
  title,
  defaultBorderColor,
  children,
}: DefaultLayoutProps): JSX.Element {
  const { focus } = useFocus();
  const { visible: helpVisible } = useHelp();
  const { menuOptions, onMenuSelect, hints, borderColor } = useLayout();

  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;

  const hasMenu = menuOptions.length > 0;

  // Calculate dynamic main height:
  // 1 line for title
  // 2 lines for main box borders (top + bottom)
  // 3 lines for menu box (top border + content + bottom border) — only if menu visible
  // 1 line for help bar
  const menuHeight = hasMenu ? 3 : 0;
  const helpHeight = 1;
  const titleHeight = 1;
  const mainBorderHeight = 2;
  const mainHeight = terminalHeight - titleHeight - mainBorderHeight - menuHeight - helpHeight;

  const activeBorderColor = borderColor ?? defaultBorderColor ?? "cyan";

  return (
    <Box flexDirection="column" gap={0}>
      <Text bold color="cyan">
        {" "}
        {title}
      </Text>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={focus === "main" || focus === "input" ? activeBorderColor : "gray"}
        paddingX={1}
        height={mainHeight > 3 ? mainHeight : 3}
      >
        {children}
      </Box>
      {hasMenu && onMenuSelect && (
        <Box
          paddingX={1}
          borderStyle="round"
          borderColor={focus === "menu" ? activeBorderColor : "gray"}
        >
          <SelectInput
            options={menuOptions}
            onChange={onMenuSelect}
            isActive={focus === "menu"}
          />
        </Box>
      )}
      <Box paddingX={1}>
        <HelpBar hints={hints} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS (or minor issues from HelpBar changes — see next task)

- [ ] **Step 3: Commit**

```bash
git add src/tui/layouts/Default.tsx
git commit -m "refactor: add Default layout"
```

---

### Task 9: Update HelpBar to use help context

Currently `HelpBar` manages its own visibility with local state and its own `useInput` for `?`. Move visibility to the help context — the global keyboard handler will call `toggleHelp()`.

**Files:**
- Modify: `src/tui/components/molecules/HelpBar.tsx`

- [ ] **Step 1: Refactor HelpBar to read from help context**

Replace the entire file content:

```tsx
// src/tui/components/molecules/HelpBar.tsx

import { Text } from "ink";
import type { JSX } from "react";
import type { HelpHint } from "../../models";
import { useHelp } from "../../states/help";

interface HelpBarProps {
  hints: HelpHint[];
}

export function HelpBar({ hints }: HelpBarProps): JSX.Element {
  const { visible } = useHelp();

  if (!visible) {
    return <Text dimColor>[?] Help</Text>;
  }

  return (
    <Text dimColor>
      {hints.map((h, i) => (
        <Text key={h.key}>
          {i > 0 ? " · " : ""}
          <Text>[{h.key}]</Text> {h.label}
        </Text>
      ))}
    </Text>
  );
}
```

Note: Remove the `HelpHint` export from this file — it now comes from `models/index.ts`. Any existing imports of `HelpHint` from this file will need updating later (they'll be caught by type check).

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: Errors from App.tsx still importing `HelpHint` from here. That's OK — App.tsx gets rewritten in a later task.

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/HelpBar.tsx
git commit -m "refactor: HelpBar reads from help context"
```

---

### Task 10: Update SelectInput and VerticalSelect to use models

Update atom components to import shared types from `models/` instead of defining them locally.

**Files:**
- Modify: `src/tui/components/atoms/SelectInput.tsx`
- Modify: `src/tui/components/atoms/VerticalSelect.tsx`

- [ ] **Step 1: Update SelectInput**

In `src/tui/components/atoms/SelectInput.tsx`, remove the `SelectOption` interface definition and import it from models:

Replace:
```ts
export interface SelectOption {
	label: string;
	value: string;
	key?: string;
}
```

With:
```ts
import type { SelectOption } from "../../models";
export type { SelectOption } from "../../models";
```

The re-export ensures existing consumers importing from this file still work during migration.

- [ ] **Step 2: Update VerticalSelect**

In `src/tui/components/atoms/VerticalSelect.tsx`, remove the `VerticalOption` interface and import from models:

Replace:
```ts
export interface VerticalOption {
	label: string;
	value: string;
	detail?: string;
}
```

With:
```ts
import type { VerticalOption } from "../../models";
export type { VerticalOption } from "../../models";
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: PASS — re-exports maintain backward compatibility

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/atoms/SelectInput.tsx src/tui/components/atoms/VerticalSelect.tsx
git commit -m "refactor: atoms use shared models with re-exports"
```

---

### Task 11: Create the global keyboard handler

**Files:**
- Create: `src/tui/hooks/useGlobalKeys.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/tui/hooks/useGlobalKeys.ts

import { useInput } from "ink";
import { useFocus } from "../states/focus";
import { useHelp } from "../states/help";
import { useNavigation } from "../states/navigation";

export function useGlobalKeys(): void {
  const { focus, toggleFocus } = useFocus();
  const { goBack, goExit } = useNavigation();
  const { toggleHelp } = useHelp();

  useInput((input, key) => {
    // In input mode, only esc is relevant — but it's handled by the screen component
    if (focus === "input") return;

    if (key.escape) {
      goExit();
      return;
    }

    if (input === "q") {
      goBack();
      return;
    }

    if (key.tab) {
      toggleFocus();
      return;
    }

    if (input === "?") {
      toggleHelp();
      return;
    }
  });
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/hooks/useGlobalKeys.ts
git commit -m "refactor: add useGlobalKeys hook"
```

---

### Task 12: Rewrite App.tsx

Replace the entire App.tsx with the thin shell + Router pattern.

**Files:**
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire file content:

```tsx
// src/tui/App.tsx

import type { JSX } from "react";
import type { AppArgs } from "../core/parseArgs";
import { useGlobalKeys } from "./hooks/useGlobalKeys";
import { Default } from "./layouts/Default";
import type { RoutePath } from "./models";
import { routes } from "./router";
import { DataProvider, useData } from "./states/data";
import { FocusProvider, useFocus } from "./states/focus";
import { HelpProvider } from "./states/help";
import { LayoutProvider, useLayout } from "./states/layout";
import { NavigationProvider, useNavigation } from "./states/navigation";

function resolveInitialRoute(args: AppArgs): { path: RoutePath; props: Record<string, unknown> } {
  if (args.trip) {
    const tripDirPath = `${args.dataDir}/${args.trip}`;
    const props = { tripDirPath, dataDir: args.dataDir };
    if (args.page) {
      const pageMap: Record<string, RoutePath> = {
        owners: "/trips/owners",
        accounts: "/trips/accounts",
        expenses: "/trips/expenses",
        export: "/trips/export",
      };
      const path = pageMap[args.page];
      if (path) return { path, props };
    }
    return { path: "/trips/menu", props };
  }
  return { path: "/trips", props: { dataDir: args.dataDir } };
}

function Router(): JSX.Element {
  const { currentRoute } = useNavigation();
  const { focus, setMenuAvailable } = useFocus();
  const { menuOptions } = useLayout();
  const { trip } = useData();

  useGlobalKeys();

  // Sync menu availability to focus context
  const hasMenu = menuOptions.length > 0;
  // Use a layout effect approach: update on each render
  if (hasMenu !== undefined) {
    setMenuAvailable(hasMenu);
  }

  const routeConfig = routes[currentRoute.path];
  const Component = routeConfig.component;

  const title =
    typeof routeConfig.title === "function"
      ? routeConfig.title(currentRoute.props)
      : routeConfig.title;

  return (
    <Default title={title} defaultBorderColor={routeConfig.borderColor}>
      <Component />
    </Default>
  );
}

interface AppProps {
  args: AppArgs;
}

export function App({ args }: AppProps): JSX.Element {
  const { path, props } = resolveInitialRoute(args);

  return (
    <DataProvider>
      <FocusProvider>
        <HelpProvider>
          <LayoutProvider>
            <NavigationProvider initialPath={path} initialProps={props}>
              <Router />
            </NavigationProvider>
          </LayoutProvider>
        </HelpProvider>
      </FocusProvider>
    </DataProvider>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: Errors from screen components — they still expect old props. This is expected.

- [ ] **Step 3: Commit**

```bash
git add src/tui/App.tsx
git commit -m "refactor: rewrite App.tsx as thin shell with Router"
```

---

### Task 13: Rewrite TripMenu screen

The simplest screen — good starting point.

**Files:**
- Modify: `src/tui/screens/TripMenu.tsx`

- [ ] **Step 1: Rewrite TripMenu to use hooks**

```tsx
// src/tui/screens/TripMenu.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TripMenu(): JSX.Element {
  const { goTo } = useNavigation();
  const { trip } = useData();
  const { setMenu, setHints } = useLayout();

  useEffect(() => {
    if (!trip) return;
    setMenu(
      [
        { label: "Owners", value: "owners", key: "o" },
        { label: "Accounts", value: "accounts", key: "a" },
        { label: "Expenses", value: "expenses", key: "e" },
        { label: "Export CSV", value: "export", key: "x" },
      ],
      (value) => {
        const routeMap: Record<string, string> = {
          owners: "/trips/owners",
          accounts: "/trips/accounts",
          expenses: "/trips/expenses",
          export: "/trips/export",
        };
        const path = routeMap[value];
        if (path) {
          goTo(path as "/trips/owners" | "/trips/accounts" | "/trips/expenses" | "/trips/export", {
            props: { tripDirPath: trip.dirPath },
          });
        }
      },
    );
    setHints([
      { key: "o", label: "Owners" },
      { key: "a", label: "Accounts" },
      { key: "e", label: "Expenses" },
      { key: "x", label: "Export CSV" },
    ]);
  }, [trip, goTo, setMenu, setHints]);

  if (!trip) return <Text dimColor>Loading...</Text>;

  const { settings } = trip;
  return (
    <Text dimColor>
      {settings.startDate} — {settings.endDate} |{" "}
      {settings.countries.join(", ")}
    </Text>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: May have minor issues depending on other files, but TripMenu itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripMenu.tsx
git commit -m "refactor: TripMenu uses hooks instead of props"
```

---

### Task 14: Rewrite ExpenseList screen

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Rewrite ExpenseList to use hooks**

```tsx
// src/tui/screens/ExpenseList.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { DataTable } from "../components/organisms/DataTable";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseList(): JSX.Element {
  const { goTo } = useNavigation();
  const { trip } = useData();
  const { setMenu, setHints } = useLayout();

  useEffect(() => {
    if (!trip) return;
    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...trip.expenses.map((e, i) => ({
          label: e.payee,
          value: `edit:${e.id}`,
          key: String(i + 1),
        })),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/expenses/form", {
            props: { tripDirPath: trip.dirPath },
          });
        } else if (value.startsWith("edit:")) {
          goTo("/trips/expenses/form", {
            props: {
              tripDirPath: trip.dirPath,
              expenseId: value.replace("edit:", ""),
            },
          });
        }
      },
    );
    setHints([{ key: "a", label: "Add expense" }]);
  }, [trip, goTo, setMenu, setHints]);

  if (!trip) return <Text dimColor>Loading...</Text>;

  if (trip.expenses.length === 0) {
    return <Text dimColor>No expenses yet.</Text>;
  }

  const rows = trip.expenses.map((e, i) => {
    const account = trip.accounts.find((a) => a.id === e.accountId);
    return [
      String(i + 1),
      e.date,
      account?.name ?? e.accountId,
      e.payee,
      e.category,
      `${e.amount} ${e.currency}`,
    ];
  });

  return (
    <DataTable
      headers={["#", "Date", "Account", "Payee", "Category", "Amount"]}
      rows={rows}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "refactor: ExpenseList uses hooks instead of props"
```

---

### Task 15: Rewrite ExpenseForm screen

This is the most complex screen — multi-step form with input mode.

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Rewrite ExpenseForm to use hooks**

```tsx
// src/tui/screens/ExpenseForm.tsx

import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Expense } from "../../core/models";
import { today } from "../../core/services/date";
import { addExpense, updateExpense } from "../../core/services/expense";
import { SelectInput } from "../components/atoms/SelectInput";
import { TextLabel } from "../components/atoms/TextLabel";
import { DateField } from "../components/molecules/DateField";
import { FormField } from "../components/molecules/FormField";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type FormStep =
  | "account"
  | "date"
  | "payee"
  | "category"
  | "amount"
  | "currency"
  | "exchangeRate"
  | "owners"
  | "description"
  | "tags";

export function ExpenseForm(): JSX.Element {
  const { currentRoute, goBack } = useNavigation();
  const { trip, reloadTrip } = useData();
  const { setFocus } = useFocus();
  const { setHints } = useLayout();

  const expenseId = currentRoute.props.expenseId as string | undefined;
  const existingExpense = expenseId
    ? trip?.expenses.find((e) => e.id === expenseId)
    : undefined;

  const [step, setStep] = useState<FormStep>("account");
  const [accountId, setAccountId] = useState(existingExpense?.accountId ?? "");
  const [date, setDate] = useState(existingExpense?.date ?? "");
  const [payee, setPayee] = useState(existingExpense?.payee ?? "");
  const [category, setCategory] = useState(existingExpense?.category ?? "");
  const [amount, setAmount] = useState(
    existingExpense?.amount?.toString() ?? "",
  );
  const [currency, setCurrency] = useState(existingExpense?.currency ?? "THB");
  const [exchangeRate, setExchangeRate] = useState(
    existingExpense?.exchangeRate?.toString() ?? "",
  );
  const [owners, setOwners] = useState("");
  const [description, setDescription] = useState(
    existingExpense?.description ?? "",
  );

  // Enter input mode on mount
  useEffect(() => {
    setFocus("input");
    setHints([
      { key: "Enter", label: "Confirm" },
      { key: "esc", label: "Back" },
    ]);
  }, [setFocus, setHints]);

  if (!trip) return <TextLabel text="Loading..." dimColor />;

  const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

  const handleDone = () => {
    reloadTrip();
    goBack();
  };

  switch (step) {
    case "account":
      return (
        <Box flexDirection="column">
          <TextLabel text="Select account:" bold />
          <SelectInput
            options={trip.accounts.map((a, i) => ({
              label: `${a.name} (${a.type})`,
              value: a.id,
              key: String(i + 1),
            }))}
            onChange={(value) => {
              setAccountId(value);
              setStep("date");
            }}
          />
        </Box>
      );

    case "date":
      return (
        <DateField
          label="Date:"
          defaultValue={date || today()}
          onSubmit={(v) => {
            setDate(v);
            setStep("payee");
          }}
        />
      );

    case "payee":
      return (
        <FormField
          label="Payee:"
          defaultValue={payee}
          onSubmit={(v) => {
            setPayee(v);
            setStep("category");
          }}
        />
      );

    case "category":
      return (
        <Box flexDirection="column">
          <TextLabel text="Category:" bold />
          <SelectInput
            options={trip.settings.categories.map((c, i) => ({
              label: c,
              value: c,
              key: String(i + 1),
            }))}
            onChange={(value) => {
              setCategory(value);
              setStep("amount");
            }}
          />
        </Box>
      );

    case "amount":
      return (
        <FormField
          label="Amount:"
          defaultValue={amount}
          onSubmit={(v) => {
            setAmount(v);
            setStep("currency");
          }}
        />
      );

    case "currency":
      return (
        <Box flexDirection="column">
          <TextLabel text="Currency:" bold />
          <SelectInput
            options={allCurrencies.map((c, i) => ({
              label: c,
              value: c,
              key: String(i + 1),
            }))}
            onChange={(value) => {
              setCurrency(value);
              setStep(value === "THB" ? "owners" : "exchangeRate");
            }}
          />
        </Box>
      );

    case "exchangeRate": {
      const tripRate = trip.settings.currencies[currency]?.exchangeRate;
      return (
        <FormField
          label={`Exchange rate (1 ${currency} = ? THB)${tripRate !== undefined ? ` [default: ${tripRate}]` : ""}:`}
          onSubmit={(v) => {
            setExchangeRate(v);
            setStep("owners");
          }}
        />
      );
    }

    case "owners":
      return (
        <FormField
          label="Expense owner IDs (comma-separated, empty for all):"
          placeholder={trip.owners.map((o) => o.id).join(",")}
          onSubmit={(v) => {
            setOwners(v);
            setStep("description");
          }}
        />
      );

    case "description":
      return (
        <FormField
          label="Description:"
          defaultValue={description}
          onSubmit={(v) => {
            setDescription(v);
            setStep("tags");
          }}
        />
      );

    case "tags":
      return (
        <FormField
          label="Tags (comma-separated):"
          onSubmit={(tagsStr) => {
            const tags = tagsStr ? tagsStr.split(",").map((s) => s.trim()) : [];
            const ownerList =
              owners.trim() === ""
                ? undefined
                : owners.split(",").map((s) => s.trim());

            const id = existingExpense?.id ?? `exp-${Date.now()}`;

            const expense: Expense = {
              id,
              accountId,
              date,
              payee,
              category,
              amount: Number.parseFloat(amount),
              currency,
              ...(exchangeRate
                ? { exchangeRate: Number.parseFloat(exchangeRate) }
                : {}),
              ...(ownerList ? { owners: ownerList } : {}),
              description,
              tags,
            };

            if (existingExpense) {
              updateExpense(trip, expense);
            } else {
              addExpense(trip, expense);
            }
            handleDone();
          }}
        />
      );
  }
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "refactor: ExpenseForm uses hooks instead of props"
```

---

### Task 16: Rewrite OwnerList screen

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`

- [ ] **Step 1: Rewrite OwnerList to use hooks**

```tsx
// src/tui/screens/OwnerList.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addOwner, removeOwner } from "../../core/services/owner";
import { ConfirmPrompt } from "../components/molecules/ConfirmPrompt";
import { FormField } from "../components/molecules/FormField";
import { DataTable } from "../components/organisms/DataTable";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add-id" | "add-name" | "remove";

export function OwnerList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { setFocus } = useFocus();
  const { setMenu, setHints } = useLayout();
  const [mode, setMode] = useState<Mode>("list");
  const [newId, setNewId] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (!trip || mode !== "list") return;
    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...trip.owners.map((o, i) => ({
          label: `Remove ${o.name}`,
          value: `remove:${o.id}`,
          key: String(i + 1),
        })),
      ],
      (v) => {
        if (v === "add") {
          setMode("add-id");
          setFocus("input");
        } else if (v.startsWith("remove:")) {
          setRemoveId(v.replace("remove:", ""));
          setMode("remove");
          setFocus("input");
        }
      },
    );
    setHints([{ key: "a", label: "Add owner" }]);
  }, [trip, mode, setMenu, setHints, setFocus]);

  if (!trip) return <Text dimColor>Loading...</Text>;

  if (mode === "add-id") {
    return (
      <FormField
        label="Owner ID (slug):"
        placeholder="e.g. alice"
        onSubmit={(id) => {
          setNewId(id);
          setMode("add-name");
        }}
        onCancel={() => {
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (mode === "add-name") {
    return (
      <FormField
        label="Owner display name:"
        placeholder="e.g. Alice"
        onSubmit={(name) => {
          addOwner(trip, { id: newId, name });
          reloadTrip();
          setMode("list");
          setFocus("menu");
        }}
        onCancel={() => setMode("add-id")}
      />
    );
  }

  if (mode === "remove" && removeId) {
    return (
      <ConfirmPrompt
        message={`Remove owner "${removeId}"?`}
        onConfirm={(yes) => {
          if (yes) {
            removeOwner(trip, removeId);
            reloadTrip();
          }
          setRemoveId(null);
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (trip.owners.length === 0) {
    return <Text dimColor>No owners yet.</Text>;
  }

  return (
    <DataTable
      headers={["ID", "Name"]}
      rows={trip.owners.map((o) => [o.id, o.name])}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/OwnerList.tsx
git commit -m "refactor: OwnerList uses hooks instead of props"
```

---

### Task 17: Rewrite AccountList screen

**Files:**
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 1: Rewrite AccountList to use hooks**

```tsx
// src/tui/screens/AccountList.tsx

import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { AccountType } from "../../core/models";
import { addAccount, removeAccount } from "../../core/services/account";
import { SelectInput } from "../components/atoms/SelectInput";
import { TextLabel } from "../components/atoms/TextLabel";
import { FormField } from "../components/molecules/FormField";
import { DataTable } from "../components/organisms/DataTable";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add-id" | "add-name" | "add-type" | "add-owners";

export function AccountList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { setFocus } = useFocus();
  const { setMenu, setHints } = useLayout();
  const [mode, setMode] = useState<Mode>("list");
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>(AccountType.Credit);

  useEffect(() => {
    if (!trip || mode !== "list") return;
    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...trip.accounts.map((a, i) => ({
          label: `Remove ${a.name}`,
          value: `remove:${a.id}`,
          key: String(i + 1),
        })),
      ],
      (v) => {
        if (v === "add") {
          setMode("add-id");
          setFocus("input");
        } else if (v.startsWith("remove:")) {
          removeAccount(trip, v.replace("remove:", ""));
          reloadTrip();
        }
      },
    );
    setHints([{ key: "a", label: "Add account" }]);
  }, [trip, mode, setMenu, setHints, setFocus, reloadTrip]);

  if (!trip) return <Text dimColor>Loading...</Text>;

  if (mode === "add-id") {
    return (
      <FormField
        label="Account ID (slug):"
        placeholder="e.g. alice-credit"
        onSubmit={(id) => {
          setNewId(id);
          setMode("add-name");
        }}
        onCancel={() => {
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (mode === "add-name") {
    return (
      <FormField
        label="Account display name:"
        placeholder="e.g. Alice's Visa"
        onSubmit={(name) => {
          setNewName(name);
          setMode("add-type");
        }}
        onCancel={() => setMode("add-id")}
      />
    );
  }

  if (mode === "add-type") {
    return (
      <Box flexDirection="column">
        <TextLabel text="Account type:" bold />
        <SelectInput
          options={[
            { label: "Credit", value: "Credit", key: "c" },
            { label: "Debit", value: "Debit", key: "d" },
          ]}
          onChange={(value) => {
            setNewType(value as AccountType);
            setMode("add-owners");
          }}
        />
      </Box>
    );
  }

  if (mode === "add-owners") {
    return (
      <FormField
        label="Owner IDs (comma-separated):"
        placeholder="e.g. alice,bob"
        onSubmit={(ownersStr) => {
          const ownerIds = ownersStr.split(",").map((s) => s.trim());
          addAccount(trip, {
            id: newId,
            name: newName,
            type: newType,
            owners: ownerIds,
          });
          reloadTrip();
          setMode("list");
          setFocus("menu");
        }}
        onCancel={() => setMode("add-type")}
      />
    );
  }

  if (trip.accounts.length === 0) {
    return <Text dimColor>No accounts yet.</Text>;
  }

  return (
    <DataTable
      headers={["ID", "Name", "Type", "Owners"]}
      rows={trip.accounts.map((a) => [
        a.id,
        a.name,
        a.type,
        a.owners.join(", "),
      ])}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/AccountList.tsx
git commit -m "refactor: AccountList uses hooks instead of props"
```

---

### Task 18: Rewrite Export screen

**Files:**
- Modify: `src/tui/screens/Export.tsx`

- [ ] **Step 1: Rewrite Export to use hooks**

```tsx
// src/tui/screens/Export.tsx

import { writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { exportCSV } from "../../core/services/export";
import { TextLabel } from "../components/atoms/TextLabel";
import { ConfirmPrompt } from "../components/molecules/ConfirmPrompt";
import { FormField } from "../components/molecules/FormField";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "path" | "preview" | "done";

export function ExportScreen(): JSX.Element {
  const { goBack } = useNavigation();
  const { trip } = useData();
  const { setFocus } = useFocus();
  const { setHints } = useLayout();
  const [mode, setMode] = useState<Mode>("path");
  const [exportPath, setExportPath] = useState("");

  // Enter input mode on mount
  useEffect(() => {
    setFocus("input");
    setHints([
      { key: "Enter", label: "Confirm" },
      { key: "esc", label: "Back" },
    ]);
  }, [setFocus, setHints]);

  // Set default export path from trip settings
  useEffect(() => {
    if (trip && !exportPath) {
      setExportPath(trip.settings.exportPath);
    }
  }, [trip, exportPath]);

  if (!trip) return <Text dimColor>Loading...</Text>;

  if (mode === "path") {
    return (
      <FormField
        label="Export path:"
        defaultValue={exportPath}
        onSubmit={(path) => {
          setExportPath(path);
          setMode("preview");
        }}
      />
    );
  }

  const csv = exportCSV(trip);

  if (mode === "preview") {
    const previewLines = csv.split("\n").slice(0, 6);
    return (
      <Box flexDirection="column" gap={1}>
        <TextLabel text="CSV Preview:" bold color="cyan" />
        <Box flexDirection="column">
          {previewLines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: preview lines have no stable identity
            <Text key={`line-${i}`}>{line}</Text>
          ))}
          {csv.split("\n").length > 6 && (
            <Text dimColor>... and {csv.split("\n").length - 6} more rows</Text>
          )}
        </Box>
        <ConfirmPrompt
          message="Export this CSV?"
          onConfirm={(yes) => {
            if (yes) {
              const fullPath = isAbsolute(exportPath)
                ? exportPath
                : join(trip.dirPath, exportPath);
              writeFileSync(fullPath, csv);
              setMode("done");
            } else {
              goBack();
            }
          }}
        />
      </Box>
    );
  }

  // mode === "done"
  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text="CSV exported successfully!" bold color="green" />
      <TextLabel text={`Path: ${exportPath}`} dimColor />
      <ConfirmPrompt message="Go back?" onConfirm={() => goBack()} />
    </Box>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/Export.tsx
git commit -m "refactor: Export uses hooks instead of props"
```

---

### Task 19: Rewrite TripList screen

The most complex screen — handles create, duplicate, delete flows with pending actions managed internally.

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Rewrite TripList to use hooks**

```tsx
// src/tui/screens/TripList.tsx

import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addDays, today } from "../../core/services/date";
import { createTrip } from "../../core/services/trip/createTrip";
import { deleteTrip } from "../../core/services/trip/deleteTrip";
import { duplicateTrip } from "../../core/services/trip/duplicateTrip";
import { listTrips } from "../../core/services/trip/listTrips";
import { toDirName } from "../../core/services/trip/toDirName";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { DateField } from "../components/molecules/DateField";
import { FormField } from "../components/molecules/FormField";
import type { RoutePath } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode =
  | "list"
  | "select-for-duplicate"
  | "select-for-delete"
  | "create-name"
  | "create-start"
  | "create-end"
  | "duplicate-name";

export function TripList(): JSX.Element {
  const { currentRoute, goTo } = useNavigation();
  const { focus, setFocus } = useFocus();
  const { setMenu, setHints, setBorderColor } = useLayout();
  const { loadTripByPath } = useData();

  const dataDir = (currentRoute.props.dataDir as string) ?? "./data";
  const [mode, setMode] = useState<Mode>("list");
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetTrip, setTargetTrip] = useState<{ dirPath: string; name: string } | null>(null);
  const trips = listTrips(dataDir);

  const defaultSettings = {
    name: "",
    startDate: "",
    endDate: "",
    countries: [] as string[],
    baseCurrency: "THB" as const,
    currencies: {},
    categories: [
      "Flight",
      "Hotels",
      "Transportation",
      "Shopping",
      "Eating",
      "Activities",
    ],
    tags: [] as string[],
    exportPath: "./expenses.csv",
  };

  // Register menu when in list mode
  useEffect(() => {
    if (mode !== "list") return;
    setBorderColor(null);
    setMenu(
      [
        { label: "Create", value: "create", key: "c" },
        ...(trips.length > 0
          ? [
              { label: "Duplicate", value: "duplicate", key: "d" },
              { label: "Delete", value: "delete", key: "x" },
            ]
          : []),
      ],
      (v) => {
        if (v === "create") {
          setMode("create-name");
          setFocus("input");
        } else if (v === "duplicate" && trips.length > 0) {
          setMode("select-for-duplicate");
          setFocus("main");
        } else if (v === "delete" && trips.length > 0) {
          setMode("select-for-delete");
          setBorderColor("red");
          setFocus("main");
        }
      },
    );
    setHints([{ key: "c", label: "Create trip" }]);
  }, [mode, trips.length, setMenu, setHints, setFocus, setBorderColor]);

  // Clear menu during action modes
  useEffect(() => {
    if (mode !== "list") {
      setMenu([], () => {});
    }
  }, [mode, setMenu]);

  // --- Create flow ---
  if (mode === "create-name") {
    return (
      <FormField
        label="Trip name:"
        placeholder="e.g. Japan Trip"
        onSubmit={(name) => {
          setTripName(name);
          setMode("create-start");
        }}
        onCancel={() => {
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (mode === "create-start") {
    return (
      <Box flexDirection="column">
        <Text dimColor>Name: {tripName}</Text>
        <DateField
          label="Start date:"
          defaultValue={today()}
          onSubmit={(date) => {
            setStartDate(date);
            setMode("create-end");
          }}
          onCancel={() => setMode("create-name")}
        />
      </Box>
    );
  }

  if (mode === "create-end") {
    return (
      <Box flexDirection="column">
        <Text dimColor>Name: {tripName}</Text>
        <Text dimColor>Start: {startDate}</Text>
        <DateField
          label="End date:"
          defaultValue={addDays(startDate, 1)}
          onSubmit={(endDate) => {
            const dirName = toDirName(tripName, startDate);
            const trip = createTrip(dataDir, dirName, {
              ...defaultSettings,
              name: tripName,
              startDate,
              endDate,
            });
            goTo("/trips/menu" as RoutePath, {
              props: { tripDirPath: trip.dirPath },
            });
          }}
          onCancel={() => setMode("create-start")}
        />
      </Box>
    );
  }

  // --- Select trip for duplicate/delete ---
  if (mode === "select-for-duplicate" || mode === "select-for-delete") {
    const isDelete = mode === "select-for-delete";
    return (
      <VerticalSelect
        options={trips.map((t) => ({
          label: t.settings.name,
          value: t.dirPath,
          detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
        }))}
        onChange={(value) => {
          const trip = trips.find((t) => t.dirPath === value);
          if (!trip) return;
          if (isDelete) {
            deleteTrip(value);
            setMode("list");
            setFocus("menu");
          } else {
            setTargetTrip({ dirPath: trip.dirPath, name: trip.settings.name });
            setMode("duplicate-name");
            setFocus("input");
          }
        }}
        onCancel={() => {
          setMode("list");
          setFocus("menu");
        }}
        {...(isDelete ? { color: "red" } : {})}
        isActive
      />
    );
  }

  // --- Duplicate: ask for name ---
  if (mode === "duplicate-name" && targetTrip) {
    return (
      <FormField
        label={`Duplicate "${targetTrip.name}" — new name:`}
        placeholder="e.g. Japan Trip v2"
        onSubmit={(name) => {
          const dirName = toDirName(name, "2026-01-01");
          duplicateTrip(dataDir, targetTrip.dirPath, dirName, name);
          setTargetTrip(null);
          setMode("list");
          setFocus("menu");
        }}
        onCancel={() => {
          setTargetTrip(null);
          setMode("select-for-duplicate");
          setFocus("main");
        }}
      />
    );
  }

  // --- Default: trip list ---
  if (trips.length === 0) {
    return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
  }

  return (
    <VerticalSelect
      options={trips.map((t) => ({
        label: t.settings.name,
        value: t.dirPath,
        detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
      }))}
      onChange={(value) => {
        goTo("/trips/menu" as RoutePath, {
          props: { tripDirPath: value },
        });
      }}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS for this file

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "refactor: TripList uses hooks, manages pending actions internally"
```

---

### Task 20: Delete Page organism and clean up imports

**Files:**
- Delete: `src/tui/components/organisms/Page.tsx`
- Modify: `src/tui/components/organisms/NavigationMenu.tsx` (update import if needed)

- [ ] **Step 1: Delete Page.tsx**

```bash
rm src/tui/components/organisms/Page.tsx
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS — no remaining imports of Page.tsx since App.tsx was rewritten.

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove Page organism, replaced by Default layout"
```

---

### Task 21: Full integration test

Run the application and verify all flows work end-to-end.

- [ ] **Step 1: Run type check**

Run: `bun run check:type`
Expected: PASS — zero errors

- [ ] **Step 2: Run lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `bun test`
Expected: All existing tests pass (core tests should be unaffected)

- [ ] **Step 4: Run lint auto-fix**

Run: `bun run fix`
Expected: Fixes any formatting issues

- [ ] **Step 5: Manual smoke test**

Run: `bun run start`
Verify:
1. Trip list renders with menu
2. `[c]` triggers create flow
3. Navigate into a trip → trip menu shows
4. `[tab]` switches focus between main and menu
5. `[q]` goes back
6. `[esc]` exits the program
7. `[?]` toggles help
8. Navigate to expenses → add expense form → `[esc]` steps back through form
9. Navigate to owners → add owner → confirm it saves
10. Export flow works

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "refactor: fix integration issues from TUI refactor"
```

---

### Task 22: Update CLAUDE.md

Update the project documentation to reflect the new architecture.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Architecture section**

Update these sections in CLAUDE.md:

Replace the `tui/screens/` description:
> **tui/screens/** — Screen content components. Each screen renders main box content only; layout is handled by the `Page` organism.

With:
> **tui/screens/** — Screen components. Each screen renders main box content and registers menu/hints via `useLayout()` hook. Layout is handled by `layouts/Default.tsx`.

Add new directory entries:
> - **tui/layouts/** — Layout components. `Default.tsx` renders the standard Title/Main/Menu/Hint structure, reading from context providers.
> - **tui/models/** — Shared TUI types (SelectOption, HelpHint, FocusZone, RoutePath, etc.). Uses `index.ts` barrel re-export.
> - **tui/states/** — React Context providers and hooks for global state: `useNavigation()`, `useFocus()`, `useHelp()`, `useLayout()`, `useData()`.
> - **tui/hooks/** — Custom hooks. `useGlobalKeys` handles global keyboard shortcuts.
> - **tui/router.ts** — Route map: path string → component + metadata (title, defaultFocus, borderColor).

Update the App.tsx description:
> **tui/App.tsx** — Thin shell: wraps context providers and renders the Router, which looks up the current route and renders the Default layout with the screen component.

Replace the UI Layout section title/content to reflect the new layout:
> ### UI Layout (Default Layout)
>
> Every screen follows a 3-area layout via `layouts/Default.tsx`:
>
> 1. **Title** — displayed above the main box, resolved from route config
> 2. **Main box** — bordered, dynamic height fills remaining terminal space, contains screen content
> 3. **Menu** — bordered, horizontal `[key] label` items. Hidden when screen registers no menu options.
> 4. **Help bar** — hidden by default, toggled with `[?]`
>
> Screens register menu options and hints via `useLayout()` hook. Border color defaults to route config value (fallback cyan), overridable at runtime via `useLayout().setBorderColor()`. Unfocused borders are always gray.

Update the Keyboard Navigation section:
> ### Keyboard Navigation
>
> Global shortcuts handled by `useGlobalKeys` hook:
> - `[q]` — go back (or quit if no history). Disabled during input mode.
> - `[esc]` — exit program. During input mode, handled by screen (e.g., step back in form).
> - `[tab]` — switch focus between main and menu. Disabled when no menu or in input mode.
> - `[?]` — toggle help bar. Disabled during input mode.
>
> Focus zones: `"main"` | `"menu"` | `"input"`. Screens enter input mode via `useFocus().setFocus("input")`.

- [ ] **Step 2: Run lint on CLAUDE.md**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect TUI refactor architecture"
```
