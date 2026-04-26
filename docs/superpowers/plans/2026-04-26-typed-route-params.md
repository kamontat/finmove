# Typed Route Params Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `goTo(path, { props })` and screen reads of route props fully type-safe; replace `Record<string, unknown>` and `as` casts with a per-route param map.

**Architecture:** Single `RouteParams` map type drives everything — `RoutePath` is derived from it, `goTo`'s second arg is typed conditionally per route, and screens read via a typed `useRouteProps(path)` hook. Migration is gradual: types and hook land first while keeping the navigation store internally loose; screens migrate one group at a time; the final task tightens the store to a discriminated union and updates `App.tsx`. Each task ends with a clean `bun run check:type` so commits stay green.

**Tech Stack:** TypeScript with `exactOptionalPropertyTypes`, React + Ink, Bun runtime, Bun test runner, Biome lint/format.

**Spec:** `docs/superpowers/specs/2026-04-26-typed-route-params-design.md`

---

## File Structure

**Modified:**
- `src/tui/models/index.ts` — add `RouteParams` map; derive `RoutePath` from it; add `RouteEntry` and `Routes` types; make `RouteConfig` generic
- `src/tui/states/navigation.tsx` — typed `goTo`, add `useRouteProps` hook, eventually tighten `RouteEntry` storage to discriminated union
- `src/tui/router.ts` — type `routes` as `Routes`; simplify `title` callbacks
- `src/tui/App.tsx` — replace `expenseFormLabel(props)` with discriminated narrowing
- All 17 screen files in `src/tui/screens/` that touch `currentRoute.props`

**No new files.** No test files (this is a TS-only refactor — `bun run check:type` is the test).

---

## Task 1: Add RouteParams map and derived types

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 1: Replace `RoutePath` and `RouteConfig` definitions**

Open `src/tui/models/index.ts`. Replace lines 5–38 (the standalone `RoutePath` union and the `RouteConfig` interface) with:

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
	"/trips/overview": {
		tripDirPath: string;
		tripName?: string;
		dataDir?: string;
	};

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
	"/trips/settings/countries/new": {
		tripDirPath: string;
		tripName?: string;
	};
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
	"/trips/settings/categories/new": {
		tripDirPath: string;
		tripName?: string;
	};
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
	"/trips/settings/tags/new": {
		tripDirPath: string;
		tripName?: string;
	};
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
	"/trips/settings/currencies/new": {
		tripDirPath: string;
		tripName?: string;
	};
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

The `RouteConfig` default param `<P extends RoutePath = RoutePath>` keeps the existing `Record<RoutePath, RouteConfig>` usage in `router.ts` compiling for now (it widens `props` back to the union of all param shapes, which is structurally compatible with the existing string-cast callbacks). Task 3 will swap to `Routes` for proper per-key narrowing.

`/trips/overview` includes `dataDir?: string` because `TripCreate.tsx` line 96 and `TripList.tsx` line 151 pass it. Verify in step 3 before continuing.

- [ ] **Step 2: Verify call-site coverage**

Run:

```bash
grep -n "/trips/overview" src/tui/screens/TripCreate.tsx src/tui/screens/TripList.tsx
```

Expected: hits in both files showing `goTo("/trips/overview", { ... dataDir })`. If `dataDir` is not in the props, drop it from `RouteParams["/trips/overview"]`.

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: PASS (zero errors). The new types are not yet wired into `navigation.tsx` or `router.ts`, so nothing should break.

- [ ] **Step 4: Run lint**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): add RouteParams map and derived route types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Type `goTo` and add `useRouteProps` hook

**Files:**
- Modify: `src/tui/states/navigation.tsx`

- [ ] **Step 1: Update imports**

In `src/tui/states/navigation.tsx`, change the imports at the top to include the new types:

```ts
import type { RouteEntry, RouteParams, RoutePath } from "../models";
```

Replace the existing `import type { RoutePath } from "../models";` line.

- [ ] **Step 2: Replace `RouteEntry` and `NavigationContextValue`**

Delete the local `interface RouteEntry { ... }` (lines 18–21). It's now imported from models.

Replace the `NavigationContextValue` interface (lines 23–31) with:

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

The `Record<string, never> extends RouteParams[P]` test is the standard TS idiom for "all keys optional." For routes whose params are all optional (e.g. `/trips`, `/trips/new`), `props` itself is optional; for routes with required keys (e.g. `/trips/owners/edit`), `props` is required.

- [ ] **Step 3: Update `NavigationProviderProps`**

The provider initial-props field must be typed against `RouteEntry` so the App can pass typed initial state. Replace lines 35–39 with:

```ts
interface NavigationProviderProps {
	initialPath: RoutePath;
	initialProps?: Record<string, unknown>;
	children: ReactNode;
}
```

(unchanged — still loose. Tightened in Task 8.)

- [ ] **Step 4: Update `applyRoute` and `goTo` internals**

Replace the existing `applyRoute` and `goTo` definitions (lines 71–101) with:

```ts
	const applyRoute = useCallback(
		(entry: { path: RoutePath; props: Record<string, unknown> }) => {
			const config = routes[entry.path];
			resetLayout();
			setFocus(config.defaultFocus);
			setMenuAvailable(false);
			syncTripData(entry.path, entry.props);
			setCurrentRoute(entry as RouteEntry);
		},
		[resetLayout, setFocus, setMenuAvailable, syncTripData],
	);

	const goTo = useCallback(
		<P extends RoutePath>(path: P, options?: GoToOptions<P>) => {
			const props = (options as { props?: Record<string, unknown> } | undefined)
				?.props ?? {};
			const replace = options?.replace ?? false;

			setCurrentRoute((prev) => {
				if (!replace) {
					historyRef.current.push(prev);
				}
				return prev;
			});

			applyRoute({ path, props });
		},
		[applyRoute],
	);
```

The internal `applyRoute` parameter stays loose (`Record<string, unknown>`) — we only cast to `RouteEntry` at the `setCurrentRoute` boundary. This avoids fighting the discriminated union from inside the loose-typed call sites.

Update the `useState` initializer (line 51) to:

```ts
	const [currentRoute, setCurrentRoute] = useState<RouteEntry>(
		{ path: initialPath, props: initialProps } as RouteEntry,
	);
```

Update `historyRef` (line 55):

```ts
	const historyRef = useRef<RouteEntry[]>([]);
```

(unchanged — already `RouteEntry[]`, just verify after the import swap.)

- [ ] **Step 5: Add `useRouteProps` hook**

At the bottom of the file, after the `useNavigation` function, add:

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

- [ ] **Step 6: Run type check**

Run: `bun run check:type`
Expected: PASS (zero errors). All current `goTo` call sites pass typed objects whose shapes match the new `RouteParams` map. All current `currentRoute.props["xxx"] as Y` reads still compile because `RouteEntry` is a discriminated union but TS allows indexed access via string key on union members under `noUncheckedIndexedAccess: false` (the project default — verify by checking `tsconfig.json` if errors surface).

If errors do surface in screens, they indicate either:
1. A real shape mismatch at a `goTo` call site (fix the call site or the param map — consult the spec).
2. Read-side strictness from the discriminated union. If so, add an intermediate cast `(currentRoute as { path: RoutePath; props: Record<string, unknown> })` inside `useRouteProps` and at the screen-read site only as a temporary measure, to be cleaned up in Task 8.

- [ ] **Step 7: Run lint**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tui/states/navigation.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): type goTo and add useRouteProps hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Type `routes` as `Routes`

**Files:**
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`

- [ ] **Step 1: Tighten `RouteConfig` title type**

In Task 1 the `RouteConfig` interface kept a loose `title: (props: Record<string, unknown>) => string` and an unused `_P` type parameter, because the loose `Record<RoutePath, RouteConfig>` usage in `router.ts` couldn't survive a per-route narrowed title type. We're swapping that usage in this task, so we can also tighten the title type now.

In `src/tui/models/index.ts`, change `RouteConfig` (around lines 102–107) to:

```ts
export interface RouteConfig<P extends RoutePath = RoutePath> {
	component: ComponentType;
	title: string | ((props: RouteParams[P]) => string);
	defaultFocus: FocusZone;
	borderColor?: string;
}
```

Two changes: `_P` → `P`, and the title callback's `props` parameter type goes from `Record<string, unknown>` to `RouteParams[P]`.

After this change alone, `bun run check:type` will fail in `router.ts` (the existing callbacks indexing `props["tripName"]` on the union won't compile). That's expected — Step 2 fixes it in the same commit.

- [ ] **Step 2: Update `router.ts` imports**

In `src/tui/router.ts`, change line 2:

```ts
import type { Routes } from "./models";
```

Remove `RouteConfig` and `RoutePath` imports (no longer used directly).

- [ ] **Step 3: Update `routes` declaration and title callbacks**

Change line 30:

```ts
export const routes: Routes = {
```

Then for every entry whose `title` is a function, replace `props["xxx"] as string` with the typed property access. For example, line 48:

```ts
		title: (props) => props.tripName ?? "Trip Overview",
```

Apply the same simplification to all 11 entries that have function titles:

```ts
"/trips/overview":           title: (props) => props.tripName ?? "Trip Overview",
"/trips/settings":           title: (props) => props.tripName ?? "Settings",
"/trips/settings/countries":          title: (props) => props.tripName ?? "Countries",
"/trips/settings/countries/new":      title: (props) => props.tripName ?? "Country",
"/trips/settings/countries/edit":     title: (props) => props.tripName ?? "Country",
"/trips/settings/categories":         title: (props) => props.tripName ?? "Categories",
"/trips/settings/categories/new":     title: (props) => props.tripName ?? "Category",
"/trips/settings/categories/edit":    title: (props) => props.tripName ?? "Category",
"/trips/settings/tags":               title: (props) => props.tripName ?? "Tags",
"/trips/settings/tags/new":           title: (props) => props.tripName ?? "Tag",
"/trips/settings/tags/edit":          title: (props) => props.tripName ?? "Tag",
"/trips/settings/currencies":         title: (props) => props.tripName ?? "Currencies",
"/trips/settings/currencies/new":     title: (props) => props.tripName ?? "Currency",
"/trips/settings/currencies/edit":    title: (props) => props.tripName ?? "Currency",
"/trips/settings/export":             title: (props) => props.tripName ?? "Export CSV",
```

The `as unknown as ComponentType` casts on `component:` values stay (they exist to bypass screen-component prop typing and are out of scope for this refactor — see spec §4 "Out of scope").

- [ ] **Step 4: Run type check**

Run: `bun run check:type`
Expected: PASS. Each title callback's `props` parameter now has the per-route `RouteParams[P]` type, so `props.tripName` is typed correctly and no cast is needed.

- [ ] **Step 5: Run lint**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/models/index.ts src/tui/router.ts
git commit -m "$(cat <<'EOF'
refactor(tui): type router routes map with per-path RouteConfig

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate Trip-level screens to `useRouteProps`

**Files:**
- Modify: `src/tui/screens/TripList.tsx`
- Modify: `src/tui/screens/TripCreate.tsx`
- Modify: `src/tui/screens/TripDuplicate.tsx`

- [ ] **Step 1: Migrate `TripList.tsx`**

In `src/tui/screens/TripList.tsx`:

Delete line 13: `type SelectMode = "delete" | "duplicate";`

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 16 — drop `currentRoute` from the destructure:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace lines 20–22:

```ts
	const { dataDir = "./data", selectMode } = useRouteProps("/trips");
```

Note: `RouteParams["/trips"].dataDir` is `string | undefined`. The destructure default `= "./data"` covers the undefined case. `selectMode` is already typed as `"delete" | "duplicate" | undefined`.

- [ ] **Step 2: Migrate `TripCreate.tsx`**

Delete the `currentRoute` access. Change line 13 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 56:

```ts
	const { goTo } = useNavigation();
```

Replace lines 59–60:

```ts
	const { dataDir = "./data" } = useRouteProps("/trips/new");
```

- [ ] **Step 3: Migrate `TripDuplicate.tsx`**

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 14:

```ts
	const { goBack } = useNavigation();
```

Replace lines 17–21:

```ts
	const {
		dataDir = "./data",
		sourceDirPath,
		sourceName,
		sourceStartDate,
	} = useRouteProps("/trips/duplicate");
```

- [ ] **Step 4: Run type check**

Run: `bun run check:type`
Expected: PASS. The three migrated files now read props through the typed hook; remaining screens still use the loose `currentRoute.props["xxx"] as Y` pattern, which still compiles.

- [ ] **Step 5: Run lint and tests**

```bash
bun run check
bun test
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/TripList.tsx src/tui/screens/TripCreate.tsx src/tui/screens/TripDuplicate.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): migrate trip-level screens to useRouteProps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrate Owner / Account / Expense screens

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`
- Modify: `src/tui/screens/OwnerEdit.tsx`
- Modify: `src/tui/screens/AccountList.tsx`
- Modify: `src/tui/screens/AccountEdit.tsx`
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Migrate `OwnerList.tsx`**

Delete line 13: `type SelectMode = "remove";`

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/owners");
```

- [ ] **Step 2: Migrate `OwnerEdit.tsx`**

Change line 10 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 15:

```ts
	const { goBack } = useNavigation();
```

Replace line 17:

```ts
	const { ownerId } = useRouteProps("/trips/owners/edit");
```

- [ ] **Step 3: Migrate `AccountList.tsx`**

Delete line 13: `type SelectMode = "remove";`

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/accounts");
```

- [ ] **Step 4: Migrate `AccountEdit.tsx`**

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 16:

```ts
	const { goBack } = useNavigation();
```

Replace line 18:

```ts
	const { accountId } = useRouteProps("/trips/accounts/edit");
```

- [ ] **Step 5: Migrate `ExpenseForm.tsx`**

Change line 12 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 16:

```ts
	const { goBack } = useNavigation();
```

Replace line 20:

```ts
	const { expenseId } = useRouteProps("/trips/expenses/form");
```

- [ ] **Step 6: Run type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 7: Run lint and tests**

```bash
bun run check
bun test
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/OwnerList.tsx src/tui/screens/OwnerEdit.tsx src/tui/screens/AccountList.tsx src/tui/screens/AccountEdit.tsx src/tui/screens/ExpenseForm.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): migrate owner/account/expense screens to useRouteProps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Migrate Settings list screens

**Files:**
- Modify: `src/tui/screens/CountryList.tsx`
- Modify: `src/tui/screens/CategoryList.tsx`
- Modify: `src/tui/screens/TagList.tsx`
- Modify: `src/tui/screens/CurrencyList.tsx`

- [ ] **Step 1: Migrate `CountryList.tsx`**

Delete line 13: `type SelectMode = "remove";`

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/settings/countries");
```

- [ ] **Step 2: Migrate `CategoryList.tsx`**

Same shape as Step 1, but for path `/trips/settings/categories`:

Delete line 13: `type SelectMode = "remove";`

Change line 11:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/settings/categories");
```

- [ ] **Step 3: Migrate `TagList.tsx`**

Same shape, path `/trips/settings/tags`:

Delete line 13: `type SelectMode = "remove";`

Change line 11:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/settings/tags");
```

- [ ] **Step 4: Migrate `CurrencyList.tsx`**

Same shape, path `/trips/settings/currencies`:

Delete line 13: `type SelectMode = "remove";`

Change line 11:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 19:

```ts
	const { goTo, goBack } = useNavigation();
```

Replace line 21:

```ts
	const { selectMode } = useRouteProps("/trips/settings/currencies");
```

- [ ] **Step 5: Run type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 6: Run lint and tests**

```bash
bun run check
bun test
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/CountryList.tsx src/tui/screens/CategoryList.tsx src/tui/screens/TagList.tsx src/tui/screens/CurrencyList.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): migrate settings list screens to useRouteProps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Migrate Settings edit screens

**Files:**
- Modify: `src/tui/screens/CountryEdit.tsx`
- Modify: `src/tui/screens/CategoryEdit.tsx`
- Modify: `src/tui/screens/TagEdit.tsx`
- Modify: `src/tui/screens/CurrencyEdit.tsx`

- [ ] **Step 1: Migrate `CountryEdit.tsx`**

Change line 10 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 15:

```ts
	const { goBack } = useNavigation();
```

Replace line 17:

```ts
	const { value: originalValue } = useRouteProps("/trips/settings/countries/edit");
```

- [ ] **Step 2: Migrate `CategoryEdit.tsx`**

Change line 10:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 15:

```ts
	const { goBack } = useNavigation();
```

Replace line 17:

```ts
	const { value: originalValue } = useRouteProps("/trips/settings/categories/edit");
```

- [ ] **Step 3: Migrate `TagEdit.tsx`**

Change line 10:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 15:

```ts
	const { goBack } = useNavigation();
```

Replace line 17:

```ts
	const { value: originalValue } = useRouteProps("/trips/settings/tags/edit");
```

- [ ] **Step 4: Migrate `CurrencyEdit.tsx`**

Change line 11 import to add `useRouteProps`:

```ts
import { useNavigation, useRouteProps } from "../states/navigation";
```

Change line 16:

```ts
	const { goBack } = useNavigation();
```

Replace line 18:

```ts
	const { currencyCode: code } = useRouteProps("/trips/settings/currencies/edit");
```

- [ ] **Step 5: Run type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 6: Run lint and tests**

```bash
bun run check
bun test
```

Expected: both PASS.

- [ ] **Step 7: Verify all screen reads are migrated**

Run:

```bash
grep -rn "currentRoute.props\[" src/tui/screens/
```

Expected: zero matches.

```bash
grep -rn "type SelectMode" src/tui/screens/
```

Expected: zero matches.

If either grep returns hits, migrate the missed file using the same `useRouteProps("<path>")` pattern before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/CountryEdit.tsx src/tui/screens/CategoryEdit.tsx src/tui/screens/TagEdit.tsx src/tui/screens/CurrencyEdit.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): migrate settings edit screens to useRouteProps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Tighten navigation store and update App.tsx breadcrumb

**Files:**
- Modify: `src/tui/states/navigation.tsx`
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Tighten `NavigationProviderProps.initialProps`**

In `src/tui/states/navigation.tsx`, change `NavigationProviderProps` to require a discriminated entry:

```ts
interface NavigationProviderProps {
	initial: RouteEntry;
	children: ReactNode;
}
```

Update the function signature (line 41):

```ts
export function NavigationProvider({
	initial,
	children,
}: NavigationProviderProps): JSX.Element {
```

Replace the `useState` initializer:

```ts
	const [currentRoute, setCurrentRoute] = useState<RouteEntry>(initial);
```

Now `currentRoute` is properly the discriminated union with no internal cast needed. The `applyRoute` body's parameter can also tighten:

```ts
	const applyRoute = useCallback(
		(entry: RouteEntry) => {
			const config = routes[entry.path];
			resetLayout();
			setFocus(config.defaultFocus);
			setMenuAvailable(false);
			syncTripData(entry.path, entry.props);
			setCurrentRoute(entry);
		},
		[resetLayout, setFocus, setMenuAvailable, syncTripData],
	);
```

For `goTo`, the cast at the body needs to assemble a `RouteEntry` from the generic `path: P, props: RouteParams[P]`:

```ts
	const goTo = useCallback(
		<P extends RoutePath>(path: P, options?: GoToOptions<P>) => {
			const props = (options as { props?: RouteParams[P] } | undefined)
				?.props ?? ({} as RouteParams[P]);
			const replace = options?.replace ?? false;

			setCurrentRoute((prev) => {
				if (!replace) {
					historyRef.current.push(prev);
				}
				return prev;
			});

			applyRoute({ path, props } as RouteEntry);
		},
		[applyRoute],
	);
```

The single `as RouteEntry` cast at the assembly site is unavoidable: TS cannot prove that `{ path: P, props: RouteParams[P] }` matches the distributive union shape without a cast. This is the only `as` in the navigation module after the refactor.

- [ ] **Step 2: Tighten `syncTripData` parameter**

`syncTripData` currently takes `props: Record<string, unknown>`. Update lines 57–69 to read from the typed entry:

```ts
	const syncTripData = useCallback(
		(entry: RouteEntry) => {
			if (entry.path === "/trips") {
				clearTrip();
				return;
			}
			if ("tripDirPath" in entry.props) {
				loadTripByPath(entry.props.tripDirPath);
			}
		},
		[clearTrip, loadTripByPath],
	);
```

Update the call in `applyRoute`:

```ts
			syncTripData(entry);
```

The `"tripDirPath" in entry.props` check works because every route except `/trips` has `tripDirPath: string` in its params. After narrowing on `entry.path !== "/trips"`, TS still sees `entry.props` as a union, so `in` narrowing is the cleanest way to reach `entry.props.tripDirPath`.

- [ ] **Step 3: Update `App.tsx` to pass typed initial route**

In `src/tui/App.tsx`, replace `resolveInitialRoute`'s return type and body. Lines 14–34:

```ts
function resolveInitialRoute(args: AppArgs): RouteEntry {
	if (args.trip) {
		const tripDirPath = `${args.dataDir}/${args.trip}`;
		if (args.page) {
			const dataDir = args.dataDir;
			if (args.page === "owners") {
				return { path: "/trips/owners", props: { tripDirPath } };
			}
			if (args.page === "accounts") {
				return { path: "/trips/accounts", props: { tripDirPath } };
			}
			if (args.page === "expenses") {
				return { path: "/trips/expenses", props: { tripDirPath } };
			}
			if (args.page === "export") {
				return {
					path: "/trips/settings/export",
					props: { tripDirPath },
				};
			}
		}
		return {
			path: "/trips/overview",
			props: { tripDirPath, dataDir: args.dataDir },
		};
	}
	return { path: "/trips", props: { dataDir: args.dataDir } };
}
```

Add `RouteEntry` to the imports (line 6):

```ts
import type { RouteEntry } from "./models";
```

(remove the unused `RoutePath` import if it's only used for the old return type.)

- [ ] **Step 4: Rewrite breadcrumb logic with discriminated narrowing**

In `src/tui/App.tsx`, delete the `expenseFormLabel` function (lines 36–38) — it's no longer needed.

Replace the breadcrumb construction block (lines 58–82) with a discriminated switch on `currentRoute.path`. This both narrows `currentRoute.props.expenseId` correctly and removes the now-redundant `p` string-cast alias:

```ts
	const breadcrumbs: string[] = [];

	switch (currentRoute.path) {
		case "/trips":
			breadcrumbs.push("Trips");
			break;
		case "/trips/new":
			breadcrumbs.push("Trips", "New");
			break;
		case "/trips/duplicate":
			breadcrumbs.push("Trips", "Duplicate");
			break;
		default: {
			breadcrumbs.push("Trips");
			if (trip) {
				breadcrumbs.push(trip.settings.name);
			}
			switch (currentRoute.path) {
				case "/trips/owners":
					breadcrumbs.push("Owners");
					break;
				case "/trips/owners/new":
					breadcrumbs.push("Owners", "New");
					break;
				case "/trips/owners/edit":
					breadcrumbs.push("Owners", "Edit");
					break;
				case "/trips/accounts":
					breadcrumbs.push("Accounts");
					break;
				case "/trips/accounts/new":
					breadcrumbs.push("Accounts", "New");
					break;
				case "/trips/accounts/edit":
					breadcrumbs.push("Accounts", "Edit");
					break;
				case "/trips/expenses":
					breadcrumbs.push("Expenses");
					break;
				case "/trips/expenses/form":
					breadcrumbs.push(
						"Expenses",
						currentRoute.props.expenseId ? "Edit" : "New",
					);
					break;
			}
			break;
		}
	}
```

After the inner switch, `currentRoute.props.expenseId` is narrowed correctly. Settings sub-routes don't have explicit breadcrumb segments here (the existing code didn't add them either — `titleSuffix` from screens covers that case).

- [ ] **Step 5: Update `App` body to pass typed initial entry**

Replace `App` body (lines 106–122):

```ts
export function App({ args }: AppProps): JSX.Element {
	const initial = resolveInitialRoute(args);

	return (
		<DataProvider>
			<FocusProvider>
				<HelpProvider>
					<LayoutProvider>
						<NavigationProvider initial={initial}>
							<Router />
						</NavigationProvider>
					</LayoutProvider>
				</HelpProvider>
			</FocusProvider>
		</DataProvider>
	);
}
```

- [ ] **Step 6: Run type check**

Run: `bun run check:type`
Expected: PASS. The discriminated union is now end-to-end. If TS errors point to other screens still using `currentRoute.props["xxx"]`, the migration was incomplete — return to the relevant Task 4–7 step.

- [ ] **Step 7: Run lint and tests**

```bash
bun run check
bun test
```

Expected: both PASS.

- [ ] **Step 8: Manual smoke test**

Run: `bun run start`

Walk through these flows in the TUI; each should complete without errors:
1. Trip list → create → land on overview.
2. Overview → owners → add owner → back to owners → edit owner → back.
3. Overview → settings → countries → add → edit existing → back.
4. Trip list → press `x` (delete mode) → cancel.
5. Quit with `[q]` from list and `[esc]` from anywhere.

Expected: no console errors. Title breadcrumbs render correctly (e.g. `Trips > MyTrip > Owners > Edit`).

If `useRouteProps` throws in any flow, the route's `RouteParams` shape doesn't match what the screen expects — fix the param map.

- [ ] **Step 9: Commit**

```bash
git add src/tui/states/navigation.tsx src/tui/App.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): tighten navigation store to discriminated RouteEntry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full check suite**

```bash
bun run check:type
bun run check
bun test
```

Expected: all three PASS.

- [ ] **Step 2: Cast audit**

Run:

```bash
grep -rn "as Record<string, unknown>" src/tui/
grep -rn "currentRoute.props\[" src/tui/
grep -rn "type SelectMode" src/tui/
```

Expected: only the single `as RouteEntry` cast inside `goTo` in `navigation.tsx` (and the body of `useRouteProps`) should remain. No screen-level casts. No `currentRoute.props["xxx"]` indexed access. No local `SelectMode` types.

If any unexpected hit appears, fix it before closing the task.

- [ ] **Step 3: Final manual smoke**

Run: `bun run start --trip <existing-slug>` and `bun run start` (no args).

Verify both entry points work — exercises both branches of `resolveInitialRoute`.

- [ ] **Step 4: No commit**

Verification only. If fixes were needed in step 2, commit them with an appropriate message:

```bash
git commit -m "$(cat <<'EOF'
refactor(tui): clean up residual route-prop casts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Each spec section maps to tasks — §1 types→Task 1, §2 goTo→Task 2, §3 hook→Task 2, §4 router/App→Tasks 3 + 8, §5 screen migrations→Tasks 4–7, §6 build sequence is the task order.
- **Type-test coverage:** This is a TS refactor; verification is `bun run check:type` after every task plus a cast-audit grep in Task 9. No new unit tests are added — the existing `bun test` suite (core services) must continue to pass to confirm no behavioral regression.
- **Type consistency:** `useRouteProps`, `goTo`, `RouteEntry`, `Routes`, and `RouteConfig<P>` names match the spec exactly. The Task 8 cast (`as RouteEntry` inside `goTo`) is the one acknowledged escape hatch — documented inline.
- **Risk: discriminated narrowing in `applyRoute`/`syncTripData`.** Task 8 relies on `"tripDirPath" in entry.props` for narrowing. If a future route adds `tripDirPath` optionally, the `in` check would still be true on the type level even when undefined at runtime — fine since `loadTripByPath(undefined)` would be a runtime crash separately. Today no route has optional `tripDirPath`.
- **Risk: Task 2 `Record<string, never> extends RouteParams[P]`.** This idiom returns true for routes with all-optional fields (e.g. `/trips`, `/trips/new`). If a route's params type ever uses `extends Record<string, unknown>` patterns, the check might misbehave; verify by attempting `goTo("/trips/owners/edit")` — should be a TS error.
