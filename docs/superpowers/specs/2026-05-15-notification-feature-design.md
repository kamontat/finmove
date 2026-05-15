# Notification Feature

## Goal

Introduce an app-wide notification system: a single transient message rendered in the title bar (right-aligned, color-coded by severity), backed by a session-scoped history accessible on a new `/notifications` screen. Replaces the inline `useState<string | null>` error patterns currently scattered across screens (TripForm validation errors, country-add errors, etc.) so every screen surfaces user feedback the same way.

The feature is called **notifications** throughout. "Message" and "status" are not used as terms in the public API.

## Behavior

### Title bar

- Title row in the default layout becomes a two-column flex row. Left: existing breadcrumb. Right: the current notification's text, colored by severity.
- Severities:
  - `info` → cyan
  - `warn` → yellow
  - `error` → red
- No icon, prefix, or chip — color carries the meaning.
- When no notification is active the right side is empty (title renders as today).
- Width overflow: if the terminal is too narrow to fit `title + space + message`, the message is truncated with `…`. The title is never truncated.

### Lifecycle

- `notify(text, severity, opts?)` sets the current notification and appends it to history.
- Default auto-dismiss: 5 seconds after `notify`. Clearing only removes the title-bar display; history is untouched.
- `opts.persistent === true` skips auto-dismiss. The notification stays until `dismiss()` is called or the user presses `[m]`.
- A second `notify` call while a notification is active replaces the current one and resets the timer. Latest wins.
- Navigation has **no** effect on notifications — the title bar and the auto-dismiss timer are decoupled from route changes.

### Keybindings (global)

- `[m]` — dismiss current notification. Surfaced in the help bar only while a notification is active. Disabled in input mode (consistent with other global keys).
- `[n]` — navigate to `/notifications`. Surfaced in the help bar whenever history is non-empty. Does nothing if already on `/notifications`. Disabled in input mode.

Verified that neither `[m]` nor `[n]` collides with existing menu shortcuts or global keys.

### Notification list screen

- Route `/notifications`. No props.
- Renders `history` in reverse chronological order (newest first) as a `DataTable` with columns:
  - **Time** — `firedAt` formatted as `HH:mm:ss`.
  - **Severity** — `INFO` / `WARN` / `ERROR`, colored to match severity.
  - **Screen** — breadcrumb at fire time (e.g. `Trips > Japan 2026 > Owners`).
  - **Message** — `text`, truncated to remaining column width if necessary.
- Empty state: `"No notifications yet."`
- `[q]` returns to previous screen (existing global behavior; no special handling).
- v1 has no filtering, clearing, or pagination of history.

### History retention

- Session-only (in-memory). Lost on app exit.
- Capped at 100 entries. When a new notification would exceed the cap, the oldest entry is dropped (FIFO).
- The cap is generous for normal use and exists primarily to bound memory.

## Data Model

```ts
// src/tui/models/Notification.ts
export type NotificationSeverity = "info" | "warn" | "error";

export interface Notification {
    id: string;                       // crypto.randomUUID(); used as DataTable row key
    text: string;
    severity: NotificationSeverity;
    route: string;                    // breadcrumb captured at fire time
    firedAt: Date;
}
```

Add `Notification` and `NotificationSeverity` to `src/tui/models/index.ts` barrel re-export.

## API

New file `src/tui/states/notification.tsx`:

```ts
interface NotificationContextValue {
    current: Notification | null;
    history: Notification[];          // newest at end; capped at 100
    notify: (
        text: string,
        severity: NotificationSeverity,
        opts?: { persistent?: boolean },
    ) => void;
    dismiss: () => void;
}

export function NotificationProvider({ children }: { children: ReactNode }): JSX.Element;
export function useNotification(): NotificationContextValue;
```

### Implementation notes

- The provider depends on `useNavigation()` (to read `currentRoute`) and `useData()` (to read `trip`) so it can capture the breadcrumb at fire time. It must therefore be nested **inside** `DataProvider` and `NavigationProvider` in `App.tsx`.
- Breadcrumb capture goes through the shared `buildBreadcrumb` helper (see Refactor section).
- The auto-dismiss timer is stored in a `useRef<NodeJS.Timeout | null>(null)` so it survives renders. Cleared and re-created on each `notify` (latest-wins behavior). Cleared on `dismiss`. Cleared on `NotificationProvider` unmount.
- `notify` reads `currentRoute` and `trip` via refs that mirror the latest values, so a call made synchronously inside a React effect always pairs with the current route — not a stale closure capture.
- `history` is stored in `useState<Notification[]>([])`. Updates use the functional setter form and slice the array to enforce the 100-cap.

## Layout Rendering (`Default.tsx`)

The title row becomes:

```tsx
const { current } = useNotification();
const severityColor =
    current?.severity === "error" ? "red" :
    current?.severity === "warn"  ? "yellow" :
    current?.severity === "info"  ? "cyan" :
    undefined;

<Box justifyContent="space-between" paddingX={1}>
    <Text bold color={titleColor}>{title}</Text>
    {current !== null && (
        <Text color={severityColor}>{current.text}</Text>
    )}
</Box>
```

Padding is moved from the inline space character (`{" "}{title}`) into a `paddingX={1}` on the row Box so both sides are inset symmetrically.

Ink handles truncation when the row overflows the terminal width by clipping the right-side `Text` first. If that proves insufficient in testing, the implementation will manually truncate `current.text` to `width - title.length - separatorSpace - 1` characters and append `…`.

## Routing

`src/tui/router.ts` registers the new route with no props:

```ts
"/notifications": { component: NotificationList },
```

The `RouteParams` map in `src/tui/models/index.ts` gains:

```ts
"/notifications": Record<string, never>;
```

(The `RoutePath` union and `Routes` type derive from `RouteParams` automatically.)

The `App.tsx` breadcrumb logic gains a case so that `/notifications` produces the breadcrumb `"Notifications"`.

## Refactor: `buildBreadcrumb`

The breadcrumb-building `switch` in `src/tui/App.tsx:62-143` is extracted into a pure helper:

```ts
// src/tui/buildBreadcrumb.ts
import type { Trip } from "../core/models";
import type { RouteEntry } from "./models";

export function buildBreadcrumb(route: RouteEntry, trip: Trip | null): string;
```

Returns the breadcrumb string for the given route, **without** the `titleSuffix` appendix. Callers append `titleSuffix` themselves if needed.

`Router` in `App.tsx` calls `buildBreadcrumb(currentRoute, trip)` and appends `titleSuffix` for the title.
`NotificationProvider.notify` calls `buildBreadcrumb(currentRoute, trip)` to capture `route` on the `Notification`. (titleSuffix is not relevant for history.)

This eliminates duplication and makes the breadcrumb logic testable in isolation.

## App Wiring

`src/tui/App.tsx` provider stack updates. `NotificationProvider` must be nested inside `DataProvider` and `NavigationProvider`:

```tsx
<DataProvider>
    <FocusProvider>
        <HelpProvider>
            <LayoutProvider>
                <MenuProvider>
                    <FormBufferProvider>
                        <NavigationProvider initial={initial} routes={routes}>
                            <NotificationProvider>
                                <Router />
                            </NotificationProvider>
                        </NavigationProvider>
                    </FormBufferProvider>
                </MenuProvider>
            </LayoutProvider>
        </HelpProvider>
    </FocusProvider>
</DataProvider>
```

## Global Keys

`src/tui/hooks/useGlobalKeys.ts` is extended with two keys:

- `[m]` — when `current !== null` and focus is not `"input"`, call `dismiss()`.
- `[n]` — when `history.length > 0`, focus is not `"input"`, and `currentRoute.path !== "/notifications"`, call `goTo("/notifications")`.

The help bar (`HelpBar` / `useLayout().hints`) gains entries automatically when these keys are active. Implementation detail: the global-keys hook also registers the corresponding `HelpHint` entries via the existing hints mechanism so they appear in the `[?]` help overlay.

## Notification List Screen

`src/tui/screens/NotificationList.tsx`:

- Reads `history` via `useNotification()`.
- Reverses the array (`[...history].reverse()`) so newest renders first.
- Empty state: a centered `Text dimColor` reading `"No notifications yet."`
- Renders a `DataTable` with the four columns described in **Behavior → Notification list screen**.
- Severity column uses a colored `Text` per row matching the title-bar palette.
- Registers no menu (so `[q]` to go back is the only navigation, handled globally).
- Does not call `notify()` itself.

## Screen Migrations

Replace inline error display in:

- `src/tui/screens/TripForm.tsx`
- `src/tui/screens/TripCreateCountryAdd.tsx`
- `src/tui/screens/OwnerCreate.tsx`
- `src/tui/screens/OwnerReferences.tsx`
- `src/tui/screens/AccountCreate.tsx`
- `src/tui/screens/AccountReferences.tsx`
- `src/tui/screens/CurrencyEdit.tsx`
- `src/tui/screens/TagCreate.tsx`
- `src/tui/screens/TagEdit.tsx`
- `src/tui/screens/TripDelete.tsx`
- `src/tui/screens/TripList.tsx`

For each:

1. Remove the local `useState<string | null>(error)` (or equivalent) declaration.
2. Remove the inline `<Text color="red">{error}</Text>` block from the JSX.
3. Replace `setError(message)` calls with `notify(message, "error", { persistent: true })`. Validation errors are persistent because they should remain visible until the user fixes the input.
4. Replace `setError(null)` calls (typically just before a successful action) with `dismiss()`.

Success-path notifications can also be added where useful (e.g. `notify("Trip created", "info")` before navigating to `/trips`), but those additions are an enhancement, not a required part of the migration.

### Untouched

- `src/tui/screens/TripBroken.tsx` — full-screen error view, not a transient message. Stays as-is.

## Testing

- `src/tui/states/__tests__/notification.test.tsx`
  - `notify` sets `current` to the new notification.
  - `notify` appends to `history` and preserves insertion order.
  - After 5s (via fake timers) `current` clears but `history` retains the entry.
  - `notify(..., { persistent: true })` does not auto-clear.
  - A second `notify` resets the auto-dismiss timer (the first notification's timer does not fire after the second arrives).
  - `dismiss()` clears `current` and cancels the pending timer; history is untouched.
  - History caps at 100 with FIFO drop (101st `notify` removes the oldest).
  - The `route` field on each notification matches `buildBreadcrumb(currentRoute, trip)` at fire time.
- `src/tui/__tests__/buildBreadcrumb.test.ts`
  - Each `RoutePath` produces the expected breadcrumb for the given `trip` (null or a sample trip with a name).
  - `/notifications` produces `"Notifications"`.
- `src/tui/screens/__tests__/NotificationList.test.tsx`
  - Empty state renders `"No notifications yet."`.
  - Three sample notifications render newest first.
  - Severity column uses the correct color per row.
- Existing screen tests that asserted on inline error text are updated to assert on the notification context instead — via a test render helper that spies on `notify` and exposes `history`/`current` for assertions.

## Out of Scope (v1)

- Persisting notifications to disk across app sessions.
- Filtering or clearing the notification history from the `/notifications` screen.
- Toast-style stacked notifications (current shows only one at a time).
- Click-to-dismiss or any mouse interactions.
- Notifications surfaced from `src/core/` directly — `core` remains UI-free. Screens are responsible for translating core failures into `notify()` calls.
