# Typed Route Params

## Goal

Make `goTo(path, { props })` and screen reads of route props fully type-safe. Today both sides use `Record<string, unknown>`, so call sites pass any shape and screens read with `as` casts (`currentRoute.props["ownerId"] as string`). Drift between callers and readers is invisible to the compiler.

After this refactor:

- `goTo` enforces the correct prop shape per route at the call site (typo-checked, required vs. optional fields enforced).
- Screens read props through a typed accessor — no `as` casts, no string indexing.
- The route param map is the single source of truth: `RoutePath` is derived from it.

This is a types-only refactor. No behavioral or UX change.

## Current state

- `src/tui/models/index.ts` — defines `RoutePath` (28-member string union) and `RouteConfig` (with `title: (props: Record<string, unknown>) => string`).
- `src/tui/router.ts` — `routes: Record<RoutePath, RouteConfig>`, with title callbacks doing `(props["tripName"] as string) ?? "..."`. Component values cast as `as unknown as ComponentType`.
- `src/tui/states/navigation.tsx` — `RouteEntry = { path: RoutePath; props: Record<string, unknown> }`. `goTo(path, options?: { props?: Record<string, unknown>; replace?: boolean })`.
- 35 `goTo` call sites across screens and `App.tsx`.
- ~20 screens read props with `as` casts. Each list screen declares its own local `type SelectMode = "remove"` (or `"delete" | "duplicate"` in `TripList`).

## Design

### 1. `RouteParams` map (single source of truth)

In `src/tui/models/index.ts`, replace the standalone `RoutePath` union with a `RouteParams` interface keyed by path. `RoutePath` is derived from it.

`selectMode` is narrowed per route — `/trips` accepts `"delete" | "duplicate"` (trip-scoped operations), every sub-list accepts `"remove"` (entry-scoped). No shared `SelectMode` alias.

```ts
export interface RouteParams {
  "/trips": { dataDir?: string; selectMode?: "delete" | "duplicate" };
  "/trips/new": { dataDir?: string };
  "/trips/duplicate": {
    dataDir?: string;
    sourceDirPath: string;
    sourceName: string;
    sourceStartDate: string;
  };
  "/trips/overview": { tripDirPath: string; tripName?: string };

  "/trips/owners": { tripDirPath: string; selectMode?: "remove" };
  "/trips/owners/new": { tripDirPath: string };
  "/trips/owners/edit": { tripDirPath: string; ownerId: string };

  "/trips/accounts": { tripDirPath: string; selectMode?: "remove" };
  "/trips/accounts/new": { tripDirPath: string };
  "/trips/accounts/edit": { tripDirPath: string; accountId: string };

  "/trips/expenses": { tripDirPath: string };
  "/trips/expenses/form": { tripDirPath: string; expenseId?: string };

  "/trips/settings": { tripDirPath: string; tripName?: string };

  "/trips/settings/countries": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
  };
  "/trips/settings/countries/new": { tripDirPath: string; tripName?: string };
  "/trips/settings/countries/edit": {
    tripDirPath: string;
    tripName?: string;
    value: string;
  };

  "/trips/settings/categories": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
  };
  "/trips/settings/categories/new": { tripDirPath: string; tripName?: string };
  "/trips/settings/categories/edit": {
    tripDirPath: string;
    tripName?: string;
    value: string;
  };

  "/trips/settings/tags": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
  };
  "/trips/settings/tags/new": { tripDirPath: string; tripName?: string };
  "/trips/settings/tags/edit": {
    tripDirPath: string;
    tripName?: string;
    value: string;
  };

  "/trips/settings/currencies": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
  };
  "/trips/settings/currencies/new": { tripDirPath: string; tripName?: string };
  "/trips/settings/currencies/edit": {
    tripDirPath: string;
    tripName?: string;
    currencyCode: string;
  };

  "/trips/settings/export": { tripDirPath: string; tripName?: string };
}

export type RoutePath = keyof RouteParams;

export type RouteEntry = {
  [P in RoutePath]: { path: P; props: RouteParams[P] };
}[RoutePath];

export interface RouteConfig<P extends RoutePath = RoutePath> {
  component: ComponentType;
  title: string | ((props: RouteParams[P]) => string);
  defaultFocus: FocusZone;
  borderColor?: string;
}

export type Routes = { [P in RoutePath]: RouteConfig<P> };
```

### 2. Typed `goTo` (`src/tui/states/navigation.tsx`)

`goTo`'s second argument becomes conditional: when `RouteParams[P]` has any required fields, `props` is required; otherwise optional.

```ts
type GoToOptions<P extends RoutePath> = {
  replace?: boolean;
} & (Record<string, never> extends RouteParams[P]
  ? { props?: RouteParams[P] }
  : { props: RouteParams[P] });

interface NavigationContextValue {
  currentRoute: RouteEntry;
  goTo: <P extends RoutePath>(path: P, options?: GoToOptions<P>) => void;
  goBack: () => void;
  goExit: () => void;
}
```

The `Record<string, never> extends RouteParams[P]` check is true exactly when the params object has no required keys (the standard TS idiom for "all keys optional"). Routes with required params force the caller to pass `{ props: { ... } }`; routes with all-optional params allow omitting it entirely.

`RouteEntry` becomes the discriminated union from §1, replacing the local interface in `navigation.tsx`. Internal storage (`useState<RouteEntry>`, `historyRef.current`) is unchanged structurally.

### 3. Typed read hook

Add `useRouteProps` exported alongside `useNavigation`:

```ts
export function useRouteProps<P extends RoutePath>(path: P): RouteParams[P] {
  const { currentRoute } = useNavigation();
  if (currentRoute.path !== path) {
    throw new Error(
      `useRouteProps("${path}") called on route ${currentRoute.path}`,
    );
  }
  return currentRoute.props as RouteParams[P];
}
```

The runtime check protects against a screen being mounted on the wrong route (shouldn't happen, but the assertion makes the cast safe). Screens then call:

```ts
const { tripDirPath, ownerId } = useRouteProps("/trips/owners/edit");
```

No casts, all field accesses typed.

### 4. Router and App updates

- `src/tui/router.ts` — `routes` typed as `Routes` (from §1). Each `title` callback receives the correctly-typed `RouteParams[P]`, so `(props) => props.tripName ?? "..."` works without casts. The `as unknown as ComponentType` casts on each `component:` value remain — they exist because individual screens have `(): JSX.Element` signatures and `RouteConfig.component: ComponentType` accepts components with no required props. Out of scope to remove here (would require typing each screen's props, which we've decided against — screens read from hooks).
- `src/tui/App.tsx` — the breadcrumb `expenseFormLabel` helper currently takes `Record<string, unknown>`. Inline its logic into the breadcrumb branch and use the discriminated `currentRoute`:

  ```ts
  if (currentRoute.path === "/trips/expenses/form") {
    breadcrumbs.push("Expenses", currentRoute.props.expenseId ? "Edit" : "New");
  }
  ```

  `resolveInitialRoute`'s return type tightens to `RouteEntry` (or equivalent). The `pageMap` cast inside it stays (string→path lookup from CLI input is a true boundary — validate by membership check).

### 5. Screen migrations

For each of the ~20 screens currently doing `currentRoute.props["x"] as ...`:

1. Replace `const { currentRoute } = useNavigation()` with `const route = useRouteProps("<path>")` (or destructure directly), keeping `useNavigation()` only when `goTo`/`goBack`/`goExit` are also needed.
2. Drop the local `type SelectMode = ...` declaration in each list screen — the route's params type already narrows it.
3. No other changes to screen logic.

### 6. Build sequence

1. Add `RouteParams` map and derived types in `models/index.ts`. Remove the old standalone `RoutePath` union.
2. Update `navigation.tsx` — typed `goTo`, `RouteEntry` import from models, add `useRouteProps`. Compiler now flags every drift between `goTo` callers and the new param map.
3. Fix all flagged `goTo` call sites — these surface real shape mismatches (e.g. a caller passing `selectMode: "delete"` to `/trips/owners` would fail).
4. Update `router.ts` to type `routes` as `Routes`; simplify `title` callbacks now that `props` is typed.
5. Migrate screens to `useRouteProps`; remove local `SelectMode` types.
6. Update `App.tsx` breadcrumb logic.
7. Verify: `bun run check:type && bun run check && bun test && bun run start` (manual smoke through a couple of nav flows).

### 7. Out of scope

- Changing component prop types or how screens are rendered. Screens still read via hooks, not React props.
- Refactoring `pageMap` in `App.tsx` into a typed structure — the CLI string→path mapping is a separate concern.
- Persisting any of this beyond runtime (no URL serialization, no router library swap).
- Renaming `selectMode` values or unifying delete/remove/duplicate semantics.

## Risks

- **Drift surfacing.** TS may flag genuine bugs where a screen reads a prop no caller passes (or where a caller passes a prop the screen never reads). These get fixed inline during step 3 — they're not refactor regressions, they're pre-existing issues the old types hid.
- **`Record<string, never> extends RouteParams[P]` edge cases.** This idiom is well-known but subtle. We don't currently have any zero-key routes; if the conditional misbehaves on a route with all-optional fields, fall back to making `options?: { props?: RouteParams[P]; replace?: boolean }` unconditionally and accept that "props can be omitted even when required" gets caught at runtime. Verify during step 2 by trying `goTo("/trips/owners/edit")` (should error) and `goTo("/trips")` (should compile).
- **Title callback variance.** `RouteConfig<P>.title` is contravariant in `P`, so `Routes[P]` typing requires the mapped form `{ [P in RoutePath]: RouteConfig<P> }` — a plain `Record<RoutePath, RouteConfig>` would erase the param specificity and bring back `Record<string, unknown>` in callbacks. Use the mapped type form.

## Acceptance

- `bun run check:type` passes.
- `bun run check` passes.
- `bun test` passes.
- Manual: launch the app and walk through trip create → overview → owners list → owner edit → back, plus a delete flow on `/trips`. No runtime errors from `useRouteProps` assertions.
- Grep verification: zero occurrences of `currentRoute.props[` and zero `as SelectMode` in `src/tui/screens/`.
