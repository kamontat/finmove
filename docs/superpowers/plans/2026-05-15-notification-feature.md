# Notification Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an app-wide notification system that renders the current notification in the title bar (right-aligned, color-coded by severity), backed by a session-scoped history accessible at `/notifications` via the `[n]` key, and migrate the existing inline error displays in `TripForm` and `TripCreateCountryAdd` to use it.

**Architecture:** A pure `NotificationStore` class holds `current` and `history` and owns auto-dismiss timers (per the existing `MenuStore` / `FormBufferStore` pattern). A thin `NotificationProvider` exposes it as a React context. The default layout reads `current` and renders it on the right of the title row. Global keys `[m]` (dismiss) and `[n]` (open history) live in `useGlobalKeys`. The breadcrumb-building switch is extracted from `App.tsx` into a pure `buildBreadcrumb` helper so both the title and the history `route` capture share one source of truth.

**Tech Stack:** TypeScript, React, Ink, Bun test runner, Biome.

**Spec:** `docs/superpowers/specs/2026-05-15-notification-feature-design.md`

**Task ordering rationale:** Each task ends with a passing `bun run check:type && bun test`. The `/notifications` route — which touches the type union, the router map, the breadcrumb helper, and the screen — is introduced as a single coordinated task (Task 6) so the type-check is never red between commits.

---

## Pre-Flight

- [ ] **Step 0: Verify project type-checks and tests pass before starting**

Run: `bun run check:type && bun test`
Expected: All pass. If anything fails here, do not start — debug pre-existing breakage first.

---

## Task 1: Notification model types

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 1: Add `NotificationSeverity` and `Notification` types**

Open `src/tui/models/index.ts` and add the following after the `FieldValue` declaration (around line 5), before the `RouteParams` interface:

```ts
export type NotificationSeverity = "info" | "warn" | "error";

export interface Notification {
    id: string;
    text: string;
    severity: NotificationSeverity;
    route: string;
    firedAt: Date;
}
```

- [ ] **Step 2: Verify type-check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat(tui): add Notification model types"
```

---

## Task 2: NotificationStore class (TDD)

The store is a plain class — no React. This matches the existing `MenuStore` / `FormBufferStore` pattern and lets us unit-test all the timing/cap logic in isolation. The React provider in Task 4 will be a thin wrapper.

**Files:**
- Create: `src/tui/states/notificationStore.ts`
- Test: `src/tui/states/__tests__/notificationStore.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/tui/states/__tests__/notificationStore.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { NotificationStore } from "../notificationStore";

describe("NotificationStore", () => {
    test("initial state is empty", () => {
        const store = new NotificationStore();
        expect(store.getCurrent()).toBeNull();
        expect(store.getHistory()).toEqual([]);
    });

    test("notify sets current with the given fields", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        store.notify("hello", "info", "Trips", { now: () => new Date(0) });
        const current = store.getCurrent();
        expect(current).not.toBeNull();
        expect(current?.text).toBe("hello");
        expect(current?.severity).toBe("info");
        expect(current?.route).toBe("Trips");
        expect(current?.firedAt).toEqual(new Date(0));
        expect(typeof current?.id).toBe("string");
        expect(current?.id.length).toBeGreaterThan(0);
    });

    test("notify appends to history in fire order", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        store.notify("first", "info", "A");
        store.notify("second", "warn", "B");
        const history = store.getHistory();
        expect(history.length).toBe(2);
        expect(history[0]?.text).toBe("first");
        expect(history[1]?.text).toBe("second");
    });

    test("notify replaces current with the new notification (latest wins)", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        store.notify("first", "info", "A");
        store.notify("second", "warn", "B");
        expect(store.getCurrent()?.text).toBe("second");
    });

    test("dismiss clears current but leaves history intact", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        store.notify("hello", "info", "A");
        store.dismiss();
        expect(store.getCurrent()).toBeNull();
        expect(store.getHistory().length).toBe(1);
    });

    test("notify schedules auto-dismiss with 5000ms by default", () => {
        const scheduled: Array<{ ms: number; fn: () => void }> = [];
        const store = new NotificationStore({
            schedule: (fn, ms) => {
                scheduled.push({ ms, fn });
                return scheduled.length;
            },
            cancel: () => {},
        });
        store.notify("hello", "info", "A");
        expect(scheduled.length).toBe(1);
        expect(scheduled[0]?.ms).toBe(5000);
    });

    test("auto-dismiss callback clears current but keeps history", () => {
        const scheduled: Array<{ fn: () => void }> = [];
        const store = new NotificationStore({
            schedule: (fn) => {
                scheduled.push({ fn });
                return scheduled.length;
            },
            cancel: () => {},
        });
        store.notify("hello", "info", "A");
        scheduled[0]?.fn();
        expect(store.getCurrent()).toBeNull();
        expect(store.getHistory().length).toBe(1);
    });

    test("persistent: true skips auto-dismiss scheduling", () => {
        const scheduled: Array<unknown> = [];
        const store = new NotificationStore({
            schedule: () => {
                scheduled.push(true);
                return 0;
            },
            cancel: () => {},
        });
        store.notify("sticky", "error", "A", { persistent: true });
        expect(scheduled.length).toBe(0);
        expect(store.getCurrent()?.text).toBe("sticky");
    });

    test("second notify cancels the prior auto-dismiss timer", () => {
        const cancels: number[] = [];
        const store = new NotificationStore({
            schedule: () => 42,
            cancel: (token) => cancels.push(token as number),
        });
        store.notify("first", "info", "A");
        store.notify("second", "info", "B");
        expect(cancels).toEqual([42]);
    });

    test("dismiss cancels the pending auto-dismiss timer", () => {
        const cancels: number[] = [];
        const store = new NotificationStore({
            schedule: () => 99,
            cancel: (token) => cancels.push(token as number),
        });
        store.notify("hello", "info", "A");
        store.dismiss();
        expect(cancels).toEqual([99]);
    });

    test("history caps at 100 with FIFO drop", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        for (let i = 0; i < 101; i++) {
            store.notify(`msg-${i}`, "info", "A");
        }
        const history = store.getHistory();
        expect(history.length).toBe(100);
        expect(history[0]?.text).toBe("msg-1");
        expect(history[99]?.text).toBe("msg-100");
    });

    test("subscribe is called whenever current or history changes", () => {
        const store = new NotificationStore({
            schedule: () => 0,
            cancel: () => {},
        });
        let calls = 0;
        const unsubscribe = store.subscribe(() => {
            calls += 1;
        });
        store.notify("a", "info", "A");
        store.notify("b", "info", "B");
        store.dismiss();
        expect(calls).toBe(3);
        unsubscribe();
        store.notify("c", "info", "C");
        expect(calls).toBe(3);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tui/states/__tests__/notificationStore.test.ts`
Expected: FAIL — `Cannot find module '../notificationStore'`.

- [ ] **Step 3: Implement `NotificationStore`**

Create `src/tui/states/notificationStore.ts`:

```ts
import type { Notification, NotificationSeverity } from "../models";

const MAX_HISTORY = 100;
const AUTO_DISMISS_MS = 5000;

interface NotificationStoreOptions {
    schedule?: (fn: () => void, ms: number) => unknown;
    cancel?: (token: unknown) => void;
}

interface NotifyOptions {
    persistent?: boolean;
    now?: () => Date;
}

type Listener = () => void;

export class NotificationStore {
    private current: Notification | null = null;
    private history: Notification[] = [];
    private listeners: Set<Listener> = new Set();
    private timerToken: unknown = null;
    private readonly schedule: (fn: () => void, ms: number) => unknown;
    private readonly cancel: (token: unknown) => void;

    constructor(options: NotificationStoreOptions = {}) {
        this.schedule =
            options.schedule ??
            ((fn, ms) => setTimeout(fn, ms) as unknown);
        this.cancel =
            options.cancel ??
            ((token) => clearTimeout(token as ReturnType<typeof setTimeout>));
    }

    getCurrent(): Notification | null {
        return this.current;
    }

    getHistory(): Notification[] {
        return this.history;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    notify(
        text: string,
        severity: NotificationSeverity,
        route: string,
        options: NotifyOptions = {},
    ): void {
        this.cancelTimer();

        const notification: Notification = {
            id: generateId(),
            text,
            severity,
            route,
            firedAt: (options.now ?? (() => new Date()))(),
        };

        this.current = notification;
        this.history = [...this.history, notification].slice(-MAX_HISTORY);

        if (options.persistent !== true) {
            this.timerToken = this.schedule(() => {
                this.timerToken = null;
                this.current = null;
                this.emit();
            }, AUTO_DISMISS_MS);
        }

        this.emit();
    }

    dismiss(): void {
        this.cancelTimer();
        if (this.current === null) return;
        this.current = null;
        this.emit();
    }

    private cancelTimer(): void {
        if (this.timerToken !== null) {
            this.cancel(this.timerToken);
            this.timerToken = null;
        }
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

function generateId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/tui/states/__tests__/notificationStore.test.ts`
Expected: PASS (all 12 tests).

- [ ] **Step 5: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/states/notificationStore.ts src/tui/states/__tests__/notificationStore.test.ts
git commit -m "feat(tui): add NotificationStore with history and auto-dismiss"
```

---

## Task 3: Extract `buildBreadcrumb` helper (TDD)

Extract the breadcrumb-building `switch` from `App.tsx:62-143` into a pure, exhaustively-tested helper. Note: the `/notifications` route is NOT included here yet — that case (and its test) is added in Task 6 along with the rest of the route plumbing.

**Files:**
- Create: `src/tui/buildBreadcrumb.ts`
- Test: `src/tui/__tests__/buildBreadcrumb.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/tui/__tests__/buildBreadcrumb.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Trip } from "../../core/models";
import { buildBreadcrumb } from "../buildBreadcrumb";
import type { RouteEntry } from "../models";

const TRIP: Trip = {
    dirPath: "/data/japan-2026",
    settings: {
        name: "Japan 2026",
        startDate: "2026-04-01",
        endDate: "2026-04-15",
        countries: [],
        owners: [],
        accounts: [],
        categories: [],
        tags: [],
        currencies: [],
        defaultCurrency: "THB",
        version: 1,
    } as Trip["settings"],
    owners: [],
    accounts: [],
    expenses: [],
};

function route<P extends RouteEntry["path"]>(
    path: P,
    props: Extract<RouteEntry, { path: P }>["props"],
): RouteEntry {
    return { path, props } as RouteEntry;
}

describe("buildBreadcrumb", () => {
    test("/trips → 'Trips'", () => {
        expect(buildBreadcrumb(route("/trips", {}), null)).toBe("Trips");
    });

    test("/trips/new (no duplicate) → 'Trips > New'", () => {
        expect(buildBreadcrumb(route("/trips/new", {}), null)).toBe(
            "Trips > New",
        );
    });

    test("/trips/new (with duplicateFromDirPath) → 'Trips > Duplicate'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/new", { duplicateFromDirPath: "/data/old" }),
                null,
            ),
        ).toBe("Trips > Duplicate");
    });

    test("/trips/delete → 'Trips > Delete'", () => {
        expect(buildBreadcrumb(route("/trips/delete", {}), null)).toBe(
            "Trips > Delete",
        );
    });

    test("/trips/duplicate → 'Trips > Duplicate'", () => {
        expect(buildBreadcrumb(route("/trips/duplicate", {}), null)).toBe(
            "Trips > Duplicate",
        );
    });

    test("/trips/owners with trip → 'Trips > Japan 2026 > Owners'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/owners", { tripDirPath: "/data/japan-2026" }),
                TRIP,
            ),
        ).toBe("Trips > Japan 2026 > Owners");
    });

    test("/trips/owners/new → 'Trips > Japan 2026 > Owners > New'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/owners/new", { tripDirPath: "/data/japan-2026" }),
                TRIP,
            ),
        ).toBe("Trips > Japan 2026 > Owners > New");
    });

    test("/trips/expenses/form with expenseId → '... > Expenses > Edit'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/expenses/form", {
                    tripDirPath: "/data/japan-2026",
                    expenseId: "exp-1",
                }),
                TRIP,
            ),
        ).toBe("Trips > Japan 2026 > Expenses > Edit");
    });

    test("/trips/expenses/form with duplicateFromId → '... > Expenses > Duplicate'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/expenses/form", {
                    tripDirPath: "/data/japan-2026",
                    duplicateFromId: "exp-1",
                }),
                TRIP,
            ),
        ).toBe("Trips > Japan 2026 > Expenses > Duplicate");
    });

    test("/trips/expenses/form with no ids → '... > Expenses > New'", () => {
        expect(
            buildBreadcrumb(
                route("/trips/expenses/form", {
                    tripDirPath: "/data/japan-2026",
                }),
                TRIP,
            ),
        ).toBe("Trips > Japan 2026 > Expenses > New");
    });

    test("trip-scoped route without trip loaded omits the trip name", () => {
        expect(
            buildBreadcrumb(
                route("/trips/owners", { tripDirPath: "/data/japan-2026" }),
                null,
            ),
        ).toBe("Trips > Owners");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tui/__tests__/buildBreadcrumb.test.ts`
Expected: FAIL — `Cannot find module '../buildBreadcrumb'`.

- [ ] **Step 3: Implement `buildBreadcrumb`**

Create `src/tui/buildBreadcrumb.ts`:

```ts
import type { Trip } from "../core/models";
import type { RouteEntry } from "./models";

export function buildBreadcrumb(
    route: RouteEntry,
    trip: Trip | null,
): string {
    const parts: string[] = [];

    switch (route.path) {
        case "/trips":
            parts.push("Trips");
            break;
        case "/trips/new":
            parts.push(
                "Trips",
                route.props.duplicateFromDirPath ? "Duplicate" : "New",
            );
            break;
        case "/trips/delete":
            parts.push("Trips", "Delete");
            break;
        case "/trips/duplicate":
            parts.push("Trips", "Duplicate");
            break;
        default: {
            parts.push("Trips");
            if (trip) {
                parts.push(trip.settings.name);
            }
            switch (route.path) {
                case "/trips/owners":
                    parts.push("Owners");
                    break;
                case "/trips/owners/new":
                    parts.push("Owners", "New");
                    break;
                case "/trips/owners/edit":
                    parts.push("Owners", "Edit");
                    break;
                case "/trips/owners/delete":
                    parts.push("Owners", "Delete");
                    break;
                case "/trips/owners/references":
                    parts.push("Owners", "References");
                    break;
                case "/trips/accounts":
                    parts.push("Accounts");
                    break;
                case "/trips/accounts/new":
                    parts.push("Accounts", "New");
                    break;
                case "/trips/accounts/edit":
                    parts.push("Accounts", "Edit");
                    break;
                case "/trips/accounts/delete":
                    parts.push("Accounts", "Delete");
                    break;
                case "/trips/accounts/references":
                    parts.push("Accounts", "References");
                    break;
                case "/trips/expenses":
                    parts.push("Expenses");
                    break;
                case "/trips/expenses/delete":
                    parts.push("Expenses", "Delete");
                    break;
                case "/trips/expenses/duplicate":
                    parts.push("Expenses", "Duplicate");
                    break;
                case "/trips/expenses/form":
                    parts.push(
                        "Expenses",
                        route.props.expenseId
                            ? "Edit"
                            : route.props.duplicateFromId
                                ? "Duplicate"
                                : "New",
                    );
                    break;
            }
            break;
        }
    }

    return parts.join(" > ");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/tui/__tests__/buildBreadcrumb.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/buildBreadcrumb.ts src/tui/__tests__/buildBreadcrumb.test.ts
git commit -m "refactor(tui): extract buildBreadcrumb helper"
```

---

## Task 4: NotificationProvider + useNotification hook

A thin React wrapper around `NotificationStore`. Depends on `useNavigation()` and `useData()` so it can capture the breadcrumb at fire time via `buildBreadcrumb`.

**Files:**
- Create: `src/tui/states/notification.tsx`

- [ ] **Step 1: Implement the provider and hook**

Create `src/tui/states/notification.tsx`:

```tsx
import {
    createContext,
    type JSX,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react";
import { buildBreadcrumb } from "../buildBreadcrumb";
import type { Notification, NotificationSeverity } from "../models";
import { useData } from "./data";
import { useNavigation } from "./navigation";
import { NotificationStore } from "./notificationStore";

interface NotificationContextValue {
    current: Notification | null;
    history: Notification[];
    notify: (
        text: string,
        severity: NotificationSeverity,
        opts?: { persistent?: boolean },
    ) => void;
    dismiss: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
    children: ReactNode;
}

export function NotificationProvider({
    children,
}: NotificationProviderProps): JSX.Element {
    const { currentRoute } = useNavigation();
    const { trip } = useData();

    const storeRef = useRef<NotificationStore | null>(null);
    if (storeRef.current === null) {
        storeRef.current = new NotificationStore();
    }
    const store = storeRef.current;

    const routeRef = useRef(currentRoute);
    routeRef.current = currentRoute;
    const tripRef = useRef(trip);
    tripRef.current = trip;

    const subscribe = useCallback(
        (listener: () => void) => store.subscribe(listener),
        [store],
    );
    const current = useSyncExternalStore(
        subscribe,
        () => store.getCurrent(),
        () => store.getCurrent(),
    );
    const history = useSyncExternalStore(
        subscribe,
        () => store.getHistory(),
        () => store.getHistory(),
    );

    const notify = useCallback<NotificationContextValue["notify"]>(
        (text, severity, opts) => {
            const route = buildBreadcrumb(routeRef.current, tripRef.current);
            store.notify(text, severity, route, opts);
        },
        [store],
    );
    const dismiss = useCallback(() => {
        store.dismiss();
    }, [store]);

    const value = useMemo<NotificationContextValue>(
        () => ({ current, history, notify, dismiss }),
        [current, history, notify, dismiss],
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification(): NotificationContextValue {
    const ctx = useContext(NotificationContext);
    if (ctx === null) {
        throw new Error(
            "useNotification must be used within a NotificationProvider",
        );
    }
    return ctx;
}
```

- [ ] **Step 2: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS. (The provider isn't mounted yet, so no runtime impact.)

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/notification.tsx
git commit -m "feat(tui): add NotificationProvider and useNotification hook"
```

---

## Task 5: Wire NotificationProvider + adopt buildBreadcrumb in Router; render notification in title row

This task does three things together so the user-visible change (notification in title bar) lands atomically with the wiring:

1. Replace the inline breadcrumb switch in `Router` with `buildBreadcrumb`.
2. Mount `NotificationProvider` inside `NavigationProvider`.
3. Update `Default.tsx` to render the current notification on the right of the title row.

**Files:**
- Modify: `src/tui/App.tsx`
- Modify: `src/tui/layouts/Default.tsx`

- [ ] **Step 1: Update `App.tsx`**

Open `src/tui/App.tsx`. Add the imports near the existing imports:

```tsx
import { buildBreadcrumb } from "./buildBreadcrumb";
import { NotificationProvider } from "./states/notification";
```

Replace the `Router` function body (the existing function from line 44 through the `return` on line 152). New body:

```tsx
function Router(): JSX.Element {
    const { currentRoute } = useNavigation();
    const { setMenuAvailable } = useFocus();
    const { titleSuffix } = useLayout();
    const { options: menuOptions } = useMenu();
    const { trip } = useData();

    useGlobalKeys();

    const hasMenu = menuOptions.length > 0;
    useEffect(() => {
        setMenuAvailable(hasMenu);
    }, [hasMenu, setMenuAvailable]);

    const routeConfig = routes[currentRoute.path];
    const Component = routeConfig.component;

    const breadcrumb = buildBreadcrumb(currentRoute, trip);
    const title = titleSuffix ? `${breadcrumb} > ${titleSuffix}` : breadcrumb;

    return (
        <Default title={title}>
            <Component />
        </Default>
    );
}
```

In the `App` component's return, nest `NotificationProvider` inside `NavigationProvider`. Replace:

```tsx
<NavigationProvider initial={initial} routes={routes}>
    <Router />
</NavigationProvider>
```

with:

```tsx
<NavigationProvider initial={initial} routes={routes}>
    <NotificationProvider>
        <Router />
    </NotificationProvider>
</NavigationProvider>
```

- [ ] **Step 2: Update `Default.tsx`**

Open `src/tui/layouts/Default.tsx`. Replace the entire file with:

```tsx
import { Box, Text, useStdout } from "ink";
import type { JSX, ReactNode } from "react";
import { SelectInput } from "../components/atoms/SelectInput";
import { HelpBar } from "../components/molecules/HelpBar";
import type { NotificationSeverity } from "../models";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNotification } from "../states/notification";

interface DefaultLayoutProps {
    title: string;
    children: ReactNode;
}

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
    info: "cyan",
    warn: "yellow",
    error: "red",
};

export function Default({ title, children }: DefaultLayoutProps): JSX.Element {
    const { focus } = useFocus();
    const { hints, colors } = useLayout();
    const {
        options: menuOptions,
        onSelect: onMenuSelect,
        armedHint,
        trigger,
    } = useMenu();
    const { stdout } = useStdout();
    const { current } = useNotification();

    const terminalRows = stdout?.rows ?? 24;
    const hasMenu = menuOptions.length > 0 && onMenuSelect !== null;

    const titleHeight = 1;
    const mainBorderHeight = 2;
    const menuHeight = hasMenu ? 3 : 0;
    const helpHeight = 1;
    const reserved = titleHeight + mainBorderHeight + menuHeight + helpHeight;
    const mainHeight = Math.max(3, terminalRows - reserved);

    const activeBorderColor = colors.border ?? "cyan";
    const mainBorderColor =
        focus === "main" || focus === "input" ? activeBorderColor : "gray";
    const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";
    const titleColor = colors.title ?? "cyan";

    return (
        <Box flexDirection="column" width="100%">
            <Box justifyContent="space-between" paddingX={1}>
                <Text bold color={titleColor}>
                    {title}
                </Text>
                {current !== null && (
                    <Text color={SEVERITY_COLORS[current.severity]}>
                        {current.text}
                    </Text>
                )}
            </Box>

            <Box
                borderStyle="round"
                borderColor={mainBorderColor}
                paddingX={1}
                height={mainHeight}
                flexDirection="column"
            >
                {children}
                {armedHint !== null && <Text color="red">{armedHint}</Text>}
            </Box>

            {hasMenu && (
                <Box borderStyle="round" borderColor={menuBorderColor}>
                    <SelectInput
                        options={menuOptions}
                        onChange={(value) => trigger(value, focus)}
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

- [ ] **Step 3: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `bun run start --data-dir ./data`
Verify:
- App boots normally.
- Title row reads `Trips` on the left, nothing on the right.
- Navigate into a trip; breadcrumb updates as before.
- Exit with `[e]`.

- [ ] **Step 5: Commit**

```bash
git add src/tui/App.tsx src/tui/layouts/Default.tsx
git commit -m "feat(tui): mount NotificationProvider and render current notification in title"
```

---

## Task 6: Add `/notifications` route (type + screen + registration + breadcrumb case)

Add the `/notifications` route end-to-end in one task so the type system stays consistent across the commit boundary. Includes the type union entry, the screen file, the router registration, and the breadcrumb helper update (plus its test).

**Files:**
- Modify: `src/tui/models/index.ts`
- Create: `src/tui/screens/NotificationList.tsx`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/buildBreadcrumb.ts`
- Modify: `src/tui/__tests__/buildBreadcrumb.test.ts`

- [ ] **Step 1: Add `/notifications` to `RouteParams`**

Open `src/tui/models/index.ts`. Inside the `RouteParams` interface, add:

```ts
"/notifications": Record<string, never>;
```

(Place it after `/trips/delete` for tidiness; location inside the interface is not significant to behavior.)

- [ ] **Step 2: Create `NotificationList` screen**

Create `src/tui/screens/NotificationList.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { Notification, NotificationSeverity } from "../models";
import { useLayout } from "../states/layout";
import { useNotification } from "../states/notification";

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
    info: "cyan",
    warn: "yellow",
    error: "red",
};

const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
};

function formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

export function NotificationList(): JSX.Element {
    const { history } = useNotification();
    const { setHints } = useLayout();

    useEffect(() => {
        setHints([
            { key: "q/esc", label: "Back" },
            { key: "e", label: "Exit" },
        ]);
    }, [setHints]);

    if (history.length === 0) {
        return (
            <Box>
                <Text dimColor>No notifications yet.</Text>
            </Box>
        );
    }

    const rows: Notification[] = [...history].reverse();

    return (
        <Box flexDirection="column">
            <Box>
                <Box width={10}>
                    <Text bold>Time</Text>
                </Box>
                <Box width={8}>
                    <Text bold>Level</Text>
                </Box>
                <Box width={40}>
                    <Text bold>Screen</Text>
                </Box>
                <Box flexGrow={1}>
                    <Text bold>Message</Text>
                </Box>
            </Box>
            {rows.map((n) => (
                <Box key={n.id}>
                    <Box width={10}>
                        <Text>{formatTime(n.firedAt)}</Text>
                    </Box>
                    <Box width={8}>
                        <Text color={SEVERITY_COLORS[n.severity]}>
                            {SEVERITY_LABELS[n.severity]}
                        </Text>
                    </Box>
                    <Box width={40}>
                        <Text>{n.route}</Text>
                    </Box>
                    <Box flexGrow={1}>
                        <Text>{n.text}</Text>
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
```

- [ ] **Step 3: Register the route in `router.ts`**

Open `src/tui/router.ts`. Add the import alongside the other screen imports (alphabetical placement is fine; insert near `OwnerCreate`):

```ts
import { NotificationList } from "./screens/NotificationList";
```

Add the entry to the `routes` object (any location; put it after the `/trips/duplicate` entry for visibility):

```ts
"/notifications": {
    component: NotificationList,
},
```

- [ ] **Step 4: Add the `/notifications` case to `buildBreadcrumb`**

Open `src/tui/buildBreadcrumb.ts`. Add a case in the outer `switch` (before the `default:` branch):

```ts
case "/notifications":
    parts.push("Notifications");
    break;
```

- [ ] **Step 5: Add the test case**

Open `src/tui/__tests__/buildBreadcrumb.test.ts`. Add a test inside the `describe` block:

```ts
test("/notifications → 'Notifications'", () => {
    expect(buildBreadcrumb(route("/notifications", {}), null)).toBe(
        "Notifications",
    );
});
```

- [ ] **Step 6: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS (all buildBreadcrumb tests including the new one).

- [ ] **Step 7: Commit**

```bash
git add src/tui/models/index.ts src/tui/screens/NotificationList.tsx src/tui/router.ts src/tui/buildBreadcrumb.ts src/tui/__tests__/buildBreadcrumb.test.ts
git commit -m "feat(tui): add /notifications route and history screen"
```

---

## Task 7: Global keys `[m]` (dismiss) and `[n]` (open history)

**Files:**
- Modify: `src/tui/hooks/useGlobalKeys.ts`

- [ ] **Step 1: Update the hook**

Open `src/tui/hooks/useGlobalKeys.ts`. Replace the file with:

```ts
import { useInput } from "ink";
import { useFocus } from "../states/focus";
import { useHelp } from "../states/help";
import { useNavigation } from "../states/navigation";
import { useNotification } from "../states/notification";

export function useGlobalKeys(): void {
    const { focus, toggleFocus } = useFocus();
    const { currentRoute, goBack, goExit, goTo } = useNavigation();
    const { toggleHelp } = useHelp();
    const { current, history, dismiss } = useNotification();

    useInput((input, key) => {
        if (focus === "input") return;

        if (key.escape) {
            goBack();
            return;
        }

        if (input === "q") {
            goBack();
            return;
        }

        if (input === "e") {
            goExit();
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

        if (input === "m" && current !== null) {
            dismiss();
            return;
        }

        if (
            input === "n" &&
            history.length > 0 &&
            currentRoute.path !== "/notifications"
        ) {
            goTo("/notifications");
            return;
        }
    });
}
```

- [ ] **Step 2: Type-check and full test suite**

Run: `bun run check:type && bun test`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Run: `bun run start --data-dir ./data`
Verify:
- App boots normally. `[m]` and `[n]` do nothing yet (no notifications fired).
- `[?]` still toggles help.
- Exit with `[e]`.

- [ ] **Step 4: Commit**

```bash
git add src/tui/hooks/useGlobalKeys.ts
git commit -m "feat(tui): add [m] dismiss and [n] history global keys"
```

---

## Task 8: Migrate `TripForm.tsx` to notifications

`TripForm` has the canonical `useState<string | null>(error)` + inline `<Text color="red">` pattern. Replace with `notify` / `dismiss`.

**Files:**
- Modify: `src/tui/screens/TripForm.tsx`

- [ ] **Step 1: Update imports**

Open `src/tui/screens/TripForm.tsx`. At the top:

- Remove `useState` from the React import if no other `useState` call remains in the file (the only one is the `error` state we're removing — check after step 2).
- Add the notification hook import alongside the other state imports:

```ts
import { useNotification } from "../states/notification";
```

- [ ] **Step 2: Replace error state with notification hook**

Inside the `TripForm` function body, replace:

```ts
const [error, setError] = useState<string | null>(null);
```

with:

```ts
const { notify, dismiss } = useNotification();
```

- [ ] **Step 3: Replace the three `setError` calls inside `onSubmit`**

Find and replace the three calls:

```ts
setError(
    `Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
);
```

becomes:

```ts
notify(
    `Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
    "error",
    { persistent: true },
);
```

```ts
setError(`Trip directory "${dirName}" already exists`);
```

becomes:

```ts
notify(
    `Trip directory "${dirName}" already exists`,
    "error",
    { persistent: true },
);
```

```ts
setError(null);
```

becomes:

```ts
dismiss();
```

- [ ] **Step 4: Remove the inline error JSX block**

In the `return`, remove the `{error && (<Text color="red" bold>{error}</Text>)}` block. The return becomes:

```tsx
return (
    <Box flexDirection="column">
        <Form
            formId={formId}
            fields={fields}
            onSubmit={(values) => {
                /* body unchanged */
            }}
        />
    </Box>
);
```

Also remove `Text` from the `ink` import if no other `<Text>` remains in the file (check by searching for `<Text` after this edit). Same for `useState` if previously used only for `error`.

- [ ] **Step 5: Lint, type-check, tests**

Run: `bun run check && bun run check:type && bun test`
Expected: PASS. If Biome flags unused imports, remove them and re-run.

- [ ] **Step 6: Manual smoke test**

Run: `bun run start --data-dir ./data`
Walk through: Trips → `[c]` (or however a new trip is created) → fill name, then in the directory-name field type something with bad characters (e.g. `abc!`) → submit. Verify:
- The error appears on the right side of the title bar, in red.
- The form body shows no inline error.
- Press `[m]` — error clears.
- Cause the error again, then press `[n]` — `/notifications` opens, showing one row with the error: timestamp, red `ERROR`, screen `Trips > New`, message text.
- Press `[q]` to return.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/TripForm.tsx
git commit -m "refactor(tui): migrate TripForm errors to notifications"
```

---

## Task 9: Migrate `TripCreateCountryAdd.tsx` to notifications

Same pattern.

**Files:**
- Modify: `src/tui/screens/TripCreateCountryAdd.tsx`

- [ ] **Step 1: Update imports**

Open `src/tui/screens/TripCreateCountryAdd.tsx`. At the top:

- Remove `useState` from the React import (only one `useState` call exists, and we're removing it).
- Remove `Text` from the `ink` import (only used in the inline error block we're removing).
- Add:

```ts
import { useNotification } from "../states/notification";
```

- [ ] **Step 2: Replace error state**

Inside the function body, replace:

```ts
const [error, setError] = useState<string | null>(null);
```

with:

```ts
const { notify } = useNotification();
```

- [ ] **Step 3: Replace the two `setError` calls**

```ts
setError("Country name cannot be empty.");
```

becomes:

```ts
notify("Country name cannot be empty.", "error", { persistent: true });
```

```ts
setError(`"${value}" is already in the list.`);
```

becomes:

```ts
notify(`"${value}" is already in the list.`, "error", { persistent: true });
```

- [ ] **Step 4: Remove the inline error JSX block**

The return becomes:

```tsx
return (
    <Box flexDirection="column">
        <Form
            fields={FIELDS}
            onSubmit={(values) => {
                /* body unchanged */
            }}
        />
    </Box>
);
```

- [ ] **Step 5: Lint, type-check, tests**

Run: `bun run check && bun run check:type && bun test`
Expected: PASS.

- [ ] **Step 6: Manual smoke test**

Run: `bun run start --data-dir ./data`
Trips → create a trip → navigate to the Countries field → `[c]` (add) → submit empty value, then add a duplicate. Verify:
- Errors appear in the title bar.
- `[m]` dismisses.
- `[n]` opens history with both errors listed, each tagged with screen `Trips > New > Countries > New`.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/TripCreateCountryAdd.tsx
git commit -m "refactor(tui): migrate TripCreateCountryAdd errors to notifications"
```

---

## Task 10: Final integration verification

No code changes — confirm everything works end-to-end.

- [ ] **Step 1: Run the full check suite**

Run: `bun run check:type && bun run check && bun test`
Expected: PASS, no warnings, no failures.

- [ ] **Step 2: Manual end-to-end exercise**

Run: `bun run start --data-dir ./data`

Walk through and verify each:

1. **Title bar baseline** — Boots showing `Trips` on the left, nothing on the right.
2. **Fire an error** — Trips → create → submit with bad directory name. Red error appears right-aligned in the title bar; the form's main panel shows no inline error.
3. **Persistent stays** — Wait 6 seconds. Error still visible (errors are `persistent: true`).
4. **Manual dismiss** — Press `[m]`. Error disappears.
5. **History** — Press `[n]`. `/notifications` opens with the dismissed error listed (time, red `ERROR`, screen `Trips > New`, message).
6. **Back from history** — Press `[q]`. Returns to the form.
7. **Help bar** — Press `[?]` to toggle. Re-press to dismiss.
8. **No regression** — Navigate around trips, owners, accounts, expenses. Title bar shows the same breadcrumbs as before; no spurious notifications.
9. **Country-add migration** — Trips → create trip → Countries → add empty country. Error appears right-aligned. Dismiss with `[m]`. History via `[n]` shows the entry.
10. **Empty history** — Restart the app. Without firing anything, press `[n]`. Nothing happens (history is empty, so `[n]` is a no-op).

If any scenario fails, fix it before proceeding.

- [ ] **Step 3: No further commits required if all checks pass**

The plan is complete.

---

## Out of Scope

The following are explicitly out of scope, per the spec:

- Persisting notifications across app sessions.
- Filtering or clearing history from the `/notifications` screen.
- Toast stacking (multiple visible notifications).
- Mouse / click handling.
- Migrating screens beyond `TripForm` and `TripCreateCountryAdd`. The spec listed others, but on inspection those use `throw new Error()` inside `Form` field editors (which Form catches and displays in the editor) or are full-screen error views (`TripBroken`, `OwnerReferences`, `AccountReferences` — explanatory headers, not transient errors). They are left as-is. Future transient errors elsewhere can adopt the same pattern as Tasks 8 and 9.
