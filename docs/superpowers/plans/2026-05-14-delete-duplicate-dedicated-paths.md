# Delete / Duplicate Dedicated Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `selectMode`-driven delete and duplicate-picker UI off every list screen onto dedicated child routes (`/delete`, `/duplicate`), with breadcrumb-suffix segments for each new page.

**Architecture:** For each of the 9 list screens currently using `selectMode`, introduce a sibling screen at a new path. Each new screen owns the layout setup (red border for delete, hints), the data fetch, and the `RemoveSelector`/`ListSelect`/`TableSelect` render. The parent list screen loses its `selectMode` branch and simply navigates to the new child path. Route types in `src/tui/models/index.ts` lose the `selectMode` field. The breadcrumb segment is provided by `setTitleSuffix(...)` on each new screen, because `App.tsx` builds breadcrumbs from a hardcoded switch (route-table `title` is unused for breadcrumbs).

**Tech Stack:** React + Ink (TUI), TypeScript with `exactOptionalPropertyTypes: true`, Bun runtime, Biome (lint+format).

**Spec:** `docs/superpowers/specs/2026-05-14-delete-duplicate-dedicated-paths-design.md`

---

## Conventions used in every task

- All paths are absolute from the repo root.
- All commits use conventional-commit style with `tui` scope, matching recent history. Example: `refactor(tui): route owner delete to dedicated /delete path`.
- After each implementation step, verify with `bun run check:type` (TypeScript) and `bun run check` (Biome lint+format). If `bun run check` reports formatting errors, run `bun run fix` and re-verify.
- Each task ends with a commit step. Stage files explicitly by name — do not use `git add -A`.

---

## Task 1: Rename `/trips/duplicate` route to `/trips/duplicate/new`

This task only renames the existing trip-duplicate form route so the picker can later claim `/trips/duplicate`. No new screens yet.

**Files:**
- Rename: `src/tui/screens/TripDuplicate.tsx` → `src/tui/screens/TripDuplicateForm.tsx`
- Modify: `src/tui/models/index.ts` (rename `/trips/duplicate` key to `/trips/duplicate/new`)
- Modify: `src/tui/router.ts` (rename import + rename route key)
- Modify: `src/tui/screens/TripList.tsx` (line 122 — update `goTo("/trips/duplicate", ...)` target)
- Modify: `src/tui/App.tsx` (line 70-71 breadcrumb case)

- [ ] **Step 1: Rename the screen file and its exported function**

```bash
git mv src/tui/screens/TripDuplicate.tsx src/tui/screens/TripDuplicateForm.tsx
```

Inside `src/tui/screens/TripDuplicateForm.tsx`, rename the exported function:

```tsx
// Old
export function TripDuplicate(): JSX.Element {
// New
export function TripDuplicateForm(): JSX.Element {
```

Also update any internal `useRouteProps("/trips/duplicate")` call to `useRouteProps("/trips/duplicate/new")`.

- [ ] **Step 2: Update the route type entry**

In `src/tui/models/index.ts`, change:

```ts
"/trips/duplicate": {
    dataDir?: string;
    sourceDirPath: string;
    sourceName: string;
    sourceStartDate: string;
};
```

to:

```ts
"/trips/duplicate/new": {
    dataDir?: string;
    sourceDirPath: string;
    sourceName: string;
    sourceStartDate: string;
};
```

- [ ] **Step 3: Update the router**

In `src/tui/router.ts`:

```ts
// Old
import { TripDuplicate } from "./screens/TripDuplicate";
// ...
"/trips/duplicate": {
    component: TripDuplicate as unknown as ComponentType,
    title: "Duplicate Trip",
    defaultFocus: "main",
},

// New
import { TripDuplicateForm } from "./screens/TripDuplicateForm";
// ...
"/trips/duplicate/new": {
    component: TripDuplicateForm as unknown as ComponentType,
    title: "Duplicate Trip",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Update TripList's navigation**

In `src/tui/screens/TripList.tsx`, find the `onChange` callback inside the `selectMode === "duplicate"` branch (around line 122):

```tsx
// Old
goTo("/trips/duplicate", {
    props: {
        dataDir,
        sourceDirPath: trip.dirPath,
        sourceName: trip.settings.name,
        sourceStartDate: trip.settings.startDate,
    },
});

// New
goTo("/trips/duplicate/new", {
    props: {
        dataDir,
        sourceDirPath: trip.dirPath,
        sourceName: trip.settings.name,
        sourceStartDate: trip.settings.startDate,
    },
});
```

- [ ] **Step 5: Update the breadcrumb switch in App.tsx**

In `src/tui/App.tsx`, find the `switch (currentRoute.path)` block (around line 63). Change the `/trips/duplicate` case to `/trips/duplicate/new`:

```tsx
// Old
case "/trips/duplicate":
    breadcrumbs.push("Trips", "Duplicate");
    break;

// New
case "/trips/duplicate/new":
    breadcrumbs.push("Trips", "Duplicate", "New");
    break;
```

- [ ] **Step 6: Verify type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

If `bun run check` reports formatting issues, run `bun run fix` and re-run the verification.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/TripDuplicateForm.tsx src/tui/models/index.ts src/tui/router.ts src/tui/screens/TripList.tsx src/tui/App.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): rename /trips/duplicate route to /trips/duplicate/new

Frees the /trips/duplicate path for the upcoming duplicate-picker
screen. The duplicate form moves to /trips/duplicate/new and its
component file is renamed TripDuplicateForm for clarity.
EOF
)"
```

---

## Task 2: Add `OwnerDelete` screen at `/trips/owners/delete`

**Files:**
- Create: `src/tui/screens/OwnerDelete.tsx`
- Modify: `src/tui/models/index.ts` (drop `selectMode` from `/trips/owners`; add `/trips/owners/delete`)
- Modify: `src/tui/router.ts` (register `OwnerDelete`)
- Modify: `src/tui/screens/OwnerList.tsx` (remove `selectMode` branches; update menu navigation; change label `Remove` → `Delete`)

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`, change the owners block:

```ts
// Old
"/trips/owners": { tripDirPath: string; selectMode?: "remove" };
"/trips/owners/new": { tripDirPath: string };
"/trips/owners/edit": { tripDirPath: string; ownerId: string };
"/trips/owners/references": { tripDirPath: string; ownerId: string };

// New
"/trips/owners": { tripDirPath: string };
"/trips/owners/new": { tripDirPath: string };
"/trips/owners/edit": { tripDirPath: string; ownerId: string };
"/trips/owners/delete": { tripDirPath: string };
"/trips/owners/references": { tripDirPath: string; ownerId: string };
```

- [ ] **Step 2: Create `OwnerDelete.tsx`**

Write to `src/tui/screens/OwnerDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Owners > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners.</Text>;
	}

	return (
		<RemoveSelector
			header="Select an owner to delete:"
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onConfirm={(value) => {
				const refs = findOwnerReferences(trip, value);
				if (refs.accounts.length === 0 && refs.expenses.length === 0) {
					removeOwner(trip, value);
					reloadTrip();
					if (trip.owners.length === 0) {
						goBack();
					}
					return;
				}
				goTo("/trips/owners/references", {
					props: { tripDirPath: trip.dirPath, ownerId: value },
				});
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

In `src/tui/router.ts`, add import (alphabetical with the other `Owner*` imports):

```ts
import { OwnerDelete } from "./screens/OwnerDelete";
```

Add the route entry just after the existing `/trips/owners/edit` entry, before `/trips/owners/references`:

```ts
"/trips/owners/delete": {
    component: OwnerDelete as unknown as ComponentType,
    title: "Delete Owner",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Trim `OwnerList.tsx`**

Replace the entire contents of `src/tui/screens/OwnerList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.owners.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasOwners = trip.owners.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasOwners ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/owners/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasOwners) {
					goTo("/trips/owners/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners yet.</Text>;
	}

	return (
		<ListSelect
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onChange={(ownerId) => {
				goTo("/trips/owners/edit", {
					props: { tripDirPath: trip.dirPath, ownerId },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0. (If lint fails for format, `bun run fix` and rerun.)

- [ ] **Step 6: Manual verification**

Start the app on a trip with multiple owners:

```bash
bun run start
```

Then in the TUI:
1. Navigate to Owners. Confirm menu shows `[a] Add  [x] Delete`.
2. Press `[x]`. Confirm breadcrumb ends with `Owners > Delete`, border is red, hints show `Enter Remove selected`.
3. Select an unreferenced owner → confirms deletion, list refreshes.
4. From owners list, press `[x]` again, select an owner that has account/expense references → confirms navigation to the references screen.
5. Press `[q]` from delete screen → returns to owners list with normal border.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/OwnerDelete.tsx src/tui/screens/OwnerList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move owner delete to dedicated /trips/owners/delete path

Eliminates the selectMode prop from the owners list route. The owner
delete picker, references handoff, and red-border layout are now
owned by OwnerDelete. Menu label changes from "Remove" to "Delete".
EOF
)"
```

---

## Task 3: Add `AccountDelete` screen at `/trips/accounts/delete`

**Files:**
- Create: `src/tui/screens/AccountDelete.tsx`
- Modify: `src/tui/models/index.ts` (drop `selectMode` from `/trips/accounts`; add `/trips/accounts/delete`)
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`, change the accounts block:

```ts
// Old
"/trips/accounts": { tripDirPath: string; selectMode?: "remove" };
"/trips/accounts/new": { tripDirPath: string };
"/trips/accounts/edit": { tripDirPath: string; accountId: string };
"/trips/accounts/references": { tripDirPath: string; accountId: string };

// New
"/trips/accounts": { tripDirPath: string };
"/trips/accounts/new": { tripDirPath: string };
"/trips/accounts/edit": { tripDirPath: string; accountId: string };
"/trips/accounts/delete": { tripDirPath: string };
"/trips/accounts/references": { tripDirPath: string; accountId: string };
```

- [ ] **Step 2: Create `AccountDelete.tsx`**

Write to `src/tui/screens/AccountDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
	findAccountReferences,
	removeAccount,
} from "../../core/services/account";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Accounts > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts.</Text>;
	}

	return (
		<RemoveSelector
			header="Select an account to delete:"
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onConfirm={(value) => {
				const refs = findAccountReferences(trip, value);
				if (refs.expenses.length === 0) {
					removeAccount(trip, value);
					reloadTrip();
					if (trip.accounts.length === 0) {
						goBack();
					}
					return;
				}
				goTo("/trips/accounts/references", {
					props: { tripDirPath: trip.dirPath, accountId: value },
				});
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

In `src/tui/router.ts`, add import:

```ts
import { AccountDelete } from "./screens/AccountDelete";
```

Add route entry near the other account routes:

```ts
"/trips/accounts/delete": {
    component: AccountDelete as unknown as ComponentType,
    title: "Delete Account",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Trim `AccountList.tsx`**

Replace the entire contents of `src/tui/screens/AccountList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("account-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.accounts.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasAccounts = trip.accounts.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [{ label: "Delete", value: "delete", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/accounts/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasAccounts) {
					goTo("/trips/accounts/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts yet.</Text>;
	}

	return (
		<ListSelect
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onChange={(accountId) => {
				goTo("/trips/accounts/edit", {
					props: { tripDirPath: trip.dirPath, accountId },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Same flow as Task 2 but for Accounts. Confirm delete works for unreferenced accounts and routes to references screen for accounts with expenses attached.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/AccountDelete.tsx src/tui/screens/AccountList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move account delete to dedicated /trips/accounts/delete path

Mirrors the owner-delete refactor: AccountDelete owns the picker,
references handoff, and red-border layout. Menu label changes from
"Remove" to "Delete".
EOF
)"
```

---

## Task 4: Add `CategoryDelete` screen at `/trips/settings/categories/delete`

**Files:**
- Create: `src/tui/screens/CategoryDelete.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/CategoryList.tsx`

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`, change:

```ts
// Old
"/trips/settings/categories": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
};

// New
"/trips/settings/categories": {
    tripDirPath: string;
    tripName?: string;
};
"/trips/settings/categories/delete": {
    tripDirPath: string;
    tripName?: string;
};
```

- [ ] **Step 2: Create `CategoryDelete.tsx`**

Write to `src/tui/screens/CategoryDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CategoryDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Categories > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (categories.length === 0) {
		return <Text dimColor>No categories.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a category to delete:"
			options={categories.map((c) => ({ label: c, value: c }))}
			onConfirm={(value) => {
				const remaining = categories.filter((c) => c !== value);
				updateSettings(trip.dirPath, { categories: remaining });
				reloadTrip();
				if (remaining.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

Add import + route entry adjacent to the existing categories routes in `src/tui/router.ts`:

```ts
import { CategoryDelete } from "./screens/CategoryDelete";
// ...
"/trips/settings/categories/delete": {
    component: CategoryDelete as unknown as ComponentType,
    title: (props) => props.tripName ?? "Category",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Trim `CategoryList.tsx`**

Replace the entire contents of `src/tui/screens/CategoryList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CategoryList(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Categories");
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.categories.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/categories/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/categories/delete", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (categories.length === 0) {
		return <Text dimColor>No categories yet.</Text>;
	}

	return (
		<ListSelect
			options={categories.map((c) => ({ label: c, value: c }))}
			onChange={(value) => {
				goTo("/trips/settings/categories/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Navigate to Settings → Categories. Confirm:
1. Menu shows `[a] Add  [x] Delete` (shortcut changed from `[d]` to `[x]`).
2. Press `[x]` → breadcrumb ends with `Settings > Categories > Delete`, red border.
3. Select a category → confirms removal, list refreshes.
4. When all categories removed → returns to list (empty state).
5. `[q]` returns to category list.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/CategoryDelete.tsx src/tui/screens/CategoryList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move category delete to dedicated /delete path

Eliminates selectMode from the categories settings route. Menu
shortcut changes from [d] to [x] for uniformity across the app.
EOF
)"
```

---

## Task 5: Add `TagDelete` screen at `/trips/settings/tags/delete`

Same pattern as Task 4 with `tags` substituted for `categories`.

**Files:**
- Create: `src/tui/screens/TagDelete.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/TagList.tsx`

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/settings/tags": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
};

// New
"/trips/settings/tags": {
    tripDirPath: string;
    tripName?: string;
};
"/trips/settings/tags/delete": {
    tripDirPath: string;
    tripName?: string;
};
```

- [ ] **Step 2: Create `TagDelete.tsx`**

Write to `src/tui/screens/TagDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TagDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Tags > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (tags.length === 0) {
		return <Text dimColor>No tags.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a tag to delete:"
			options={tags.map((t) => ({ label: t, value: t }))}
			onConfirm={(value) => {
				const remaining = tags.filter((t) => t !== value);
				updateSettings(trip.dirPath, { tags: remaining });
				reloadTrip();
				if (remaining.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

```ts
import { TagDelete } from "./screens/TagDelete";
// ...
"/trips/settings/tags/delete": {
    component: TagDelete as unknown as ComponentType,
    title: (props) => props.tripName ?? "Tag",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Trim `TagList.tsx`**

Replace the entire contents of `src/tui/screens/TagList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TagList(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags");
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.tags.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/tags/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/tags/delete", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<ListSelect
			options={tags.map((t) => ({ label: t, value: t }))}
			onChange={(value) => {
				goTo("/trips/settings/tags/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Same as Task 4 but for Tags.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/TagDelete.tsx src/tui/screens/TagList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move tag delete to dedicated /delete path

Eliminates selectMode from the tags settings route. Menu shortcut
changes from [d] to [x] for uniformity.
EOF
)"
```

---

## Task 6: Add `CountryDelete` screen at `/trips/settings/countries/delete`

**Files:**
- Create: `src/tui/screens/CountryDelete.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/CountryList.tsx`

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/settings/countries": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
};

// New
"/trips/settings/countries": {
    tripDirPath: string;
    tripName?: string;
};
"/trips/settings/countries/delete": {
    tripDirPath: string;
    tripName?: string;
};
```

- [ ] **Step 2: Read existing `CountryList.tsx` to see the data shape**

Run: `cat src/tui/screens/CountryList.tsx`

Note the existing remove handler — it uses `updateSettings(trip.dirPath, { countries: remaining })`. Use the same pattern in the new screen.

- [ ] **Step 3: Create `CountryDelete.tsx`**

Write to `src/tui/screens/CountryDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CountryDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Countries > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { countries } = trip.settings;

	if (countries.length === 0) {
		return <Text dimColor>No countries.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a country to delete:"
			options={countries.map((c) => ({ label: c, value: c }))}
			onConfirm={(value) => {
				const remaining = countries.filter((c) => c !== value);
				updateSettings(trip.dirPath, { countries: remaining });
				reloadTrip();
				if (remaining.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
```

If on inspecting `CountryList.tsx` the remove handler accesses different fields (e.g., labels vs. values), adapt the `options` mapping above to match.

- [ ] **Step 4: Register in router**

```ts
import { CountryDelete } from "./screens/CountryDelete";
// ...
"/trips/settings/countries/delete": {
    component: CountryDelete as unknown as ComponentType,
    title: (props) => props.tripName ?? "Country",
    defaultFocus: "main",
},
```

- [ ] **Step 5: Trim `CountryList.tsx`**

Open the file. Apply the same shape used in Tasks 4–5: remove `selectMode` destructuring, remove the `selectMode === "remove"` blocks in both the `useEffect` and the render path, change the menu label/key to `Delete`/`x`, and change the menu callback's `goTo` target to `/trips/settings/countries/delete`. Preserve all other behavior, the `setTitleSuffix("Settings > Countries")` call, and the original edit-on-Enter navigation.

For reference, the trimmed structure mirrors Task 5's TagList exactly except substitute `countries`, `Countries`, and the country-related path strings.

- [ ] **Step 6: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 7: Manual verification**

Navigate to Settings → Countries. Confirm `[x] Delete` flow as in Tasks 4–5.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/CountryDelete.tsx src/tui/screens/CountryList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move country delete to dedicated /delete path
EOF
)"
```

---

## Task 7: Add `CurrencyDelete` screen at `/trips/settings/currencies/delete`

`CurrencyList` has slightly different data — currencies have a code + name. Verify in `src/tui/screens/CurrencyList.tsx` before copying the option mapping. The settings field is `trip.settings.currencies` (array of `{ code, name }` or similar).

**Files:**
- Create: `src/tui/screens/CurrencyDelete.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/CurrencyList.tsx`

- [ ] **Step 1: Inspect existing `CurrencyList.tsx`**

Run: `cat src/tui/screens/CurrencyList.tsx`

Note the exact shape of `trip.settings.currencies` and how the existing `selectMode === "remove"` branch maps each currency to a `RemoveSelector` option. Reproduce this mapping (including any `label`/`value`/`detail` fields) in the new screen below.

- [ ] **Step 2: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/settings/currencies": {
    tripDirPath: string;
    tripName?: string;
    selectMode?: "remove";
};

// New
"/trips/settings/currencies": {
    tripDirPath: string;
    tripName?: string;
};
"/trips/settings/currencies/delete": {
    tripDirPath: string;
    tripName?: string;
};
```

- [ ] **Step 3: Create `CurrencyDelete.tsx`**

Use the Task 4/5/6 pattern. Copy the `RemoveSelector` `options` mapping and `onConfirm` handler from the existing `selectMode === "remove"` branch in `CurrencyList.tsx` verbatim. Use `setTitleSuffix("Settings > Currencies > Delete")`.

Skeleton (fill in the `options` map and `onConfirm` body from `CurrencyList.tsx`):

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { /* same imports CurrencyList uses for its remove path */ } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CurrencyDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Currencies > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;

	if (currencies.length === 0) {
		return <Text dimColor>No currencies.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a currency to delete:"
			options={/* TODO: copy from CurrencyList.tsx selectMode === "remove" branch */}
			onConfirm={(value) => {
				/* TODO: copy from CurrencyList.tsx selectMode === "remove" branch.
				   Call reloadTrip(). If the resulting list is empty, call goBack(). */
			}}
		/>
	);
}
```

Fill in the two `TODO` markers from the existing CurrencyList code before considering the step done. Do not leave `TODO` in the final file.

- [ ] **Step 4: Register in router**

```ts
import { CurrencyDelete } from "./screens/CurrencyDelete";
// ...
"/trips/settings/currencies/delete": {
    component: CurrencyDelete as unknown as ComponentType,
    title: (props) => props.tripName ?? "Currency",
    defaultFocus: "main",
},
```

- [ ] **Step 5: Trim `CurrencyList.tsx`**

Apply the same transformation as Task 5: remove `selectMode`, change menu to `[x] Delete`, point the menu callback at `/trips/settings/currencies/delete`. Preserve the existing `setTitleSuffix("Settings > Currencies")` call and the edit-on-Enter navigation.

- [ ] **Step 6: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 7: Manual verification**

Navigate to Settings → Currencies. Confirm `[x] Delete` flow. Confirm the deleted currency disappears from the list and from any currency-picker screens.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/CurrencyDelete.tsx src/tui/screens/CurrencyList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move currency delete to dedicated /delete path
EOF
)"
```

---

## Task 8: Add `TripCreateCountryDelete` screen at `/trips/new/countries/delete`

This is the country list shown during the trip-creation flow. Distinct from `/trips/settings/countries`. Operates on a draft `dataDir` rather than a saved trip.

**Files:**
- Create: `src/tui/screens/TripCreateCountryDelete.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/TripCreateCountryList.tsx`

- [ ] **Step 1: Inspect existing `TripCreateCountryList.tsx`**

Run: `cat src/tui/screens/TripCreateCountryList.tsx`

Identify the storage backing for the draft countries (likely an in-memory store via `useFormBuffer` or similar, NOT `updateSettings`). Reproduce the same write path in the new delete screen.

- [ ] **Step 2: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/new/countries": {
    dataDir?: string;
    selectMode?: "remove";
};

// New
"/trips/new/countries": {
    dataDir?: string;
};
"/trips/new/countries/delete": {
    dataDir?: string;
};
```

- [ ] **Step 3: Create `TripCreateCountryDelete.tsx`**

Use Task 4's pattern. Set `setTitleSuffix("Countries > Delete")` (parent's titleSuffix, if any, plus `> Delete`). Copy the `RemoveSelector` `options` and `onConfirm` from the existing `selectMode === "remove"` branch in `TripCreateCountryList.tsx`. After confirm, call `goBack()` if the resulting list is empty.

If the parent screen sets a `titleSuffix` (e.g., `"Countries"`), match that prefix in the new screen: `setTitleSuffix("Countries > Delete")`.

- [ ] **Step 4: Register in router**

```ts
import { TripCreateCountryDelete } from "./screens/TripCreateCountryDelete";
// ...
"/trips/new/countries/delete": {
    component: TripCreateCountryDelete as unknown as ComponentType,
    title: "Delete Country",
    defaultFocus: "main",
},
```

- [ ] **Step 5: Trim `TripCreateCountryList.tsx`**

Remove `selectMode` plumbing and the `selectMode === "remove"` branches. Menu: change to `[x] Delete`. Menu callback navigates to `/trips/new/countries/delete` instead of self+`selectMode`.

- [ ] **Step 6: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 7: Manual verification**

Start a new trip (`bun run start`, press `[c]` Create from Trips). Add a couple of countries via the countries step. Confirm `[x] Delete` works the same as the saved-trip countries flow.

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/TripCreateCountryDelete.tsx src/tui/screens/TripCreateCountryList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move trip-create country delete to dedicated /delete path
EOF
)"
```

---

## Task 9: Add `ExpenseDelete` screen at `/trips/expenses/delete`

This is the first task that removes one mode from a list screen that has TWO modes. Leave the `duplicate` selectMode in place; Task 10 will handle it.

**Files:**
- Create: `src/tui/screens/ExpenseDelete.tsx`
- Modify: `src/tui/models/index.ts` (narrow `selectMode?: "remove" | "duplicate"` to `selectMode?: "duplicate"`; add `/trips/expenses/delete`)
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/ExpenseList.tsx` (remove only the `selectMode === "remove"` branches and the menu `Remove` option; keep `Duplicate`)

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/expenses": {
    tripDirPath: string;
    selectMode?: "remove" | "duplicate";
};

// New
"/trips/expenses": {
    tripDirPath: string;
    selectMode?: "duplicate";
};
"/trips/expenses/delete": {
    tripDirPath: string;
};
```

- [ ] **Step 2: Create `ExpenseDelete.tsx`**

Write to `src/tui/screens/ExpenseDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeExpense } from "../../core/services/expense";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Expenses > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses.</Text>;
	}

	return (
		<RemoveSelector
			header="Select an expense to delete:"
			options={trip.expenses.map((e) => ({
				label: e.payee,
				value: e.id,
				detail: `(${e.date} · ${e.amount} ${e.currency})`,
			}))}
			onConfirm={(value) => {
				removeExpense(trip, value);
				reloadTrip();
				if (trip.expenses.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

```ts
import { ExpenseDelete } from "./screens/ExpenseDelete";
// ...
"/trips/expenses/delete": {
    component: ExpenseDelete as unknown as ComponentType,
    title: "Delete Expense",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Modify `ExpenseList.tsx`**

In `src/tui/screens/ExpenseList.tsx`:

1. Remove the import of `RemoveSelector`.
2. Remove the import of `removeExpense`.
3. Remove the `SELECT_REMOVE_HINTS` import (keep `LIST_HINTS` and `SELECT_DUPLICATE_HINTS`).
4. Remove the `selectMode === "remove"` block inside the `useEffect` (around lines 43–48 in the current file).
5. Remove the `selectMode === "remove"` branch in the render path (around lines 110–131).
6. In the menu construction, change:

```tsx
// Old
...(hasExpenses
    ? [
            { label: "Duplicate", value: "duplicate", key: "d" },
            { label: "Remove", value: "remove", key: "x" },
        ]
    : []),
```

to:

```tsx
...(hasExpenses
    ? [
            { label: "Duplicate", value: "duplicate", key: "d" },
            { label: "Delete", value: "delete", key: "x" },
        ]
    : []),
```

7. In the menu callback, change the `remove` branch:

```tsx
// Old
} else if (value === "remove" && hasExpenses) {
    goTo("/trips/expenses", {
        props: { tripDirPath, selectMode: "remove" },
    });
}

// New
} else if (value === "delete" && hasExpenses) {
    goTo("/trips/expenses/delete", { props: { tripDirPath } });
}
```

Leave the `selectMode === "duplicate"` branch and the duplicate menu option untouched.

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Navigate to Expenses on a trip with several expenses. Confirm `[x] Delete` goes to the new screen and works. Confirm `[d] Duplicate` still works on the old `selectMode` path (will be removed in Task 10).

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/ExpenseDelete.tsx src/tui/screens/ExpenseList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move expense delete to dedicated /trips/expenses/delete path
EOF
)"
```

---

## Task 10: Add `ExpenseDuplicateSelect` screen at `/trips/expenses/duplicate`

**Files:**
- Create: `src/tui/screens/ExpenseDuplicateSelect.tsx`
- Modify: `src/tui/models/index.ts` (drop the now-only `selectMode` from `/trips/expenses`; add `/trips/expenses/duplicate`)
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/ExpenseList.tsx` (remove the `selectMode === "duplicate"` branch and the `selectMode` plumbing entirely)

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips/expenses": {
    tripDirPath: string;
    selectMode?: "duplicate";
};

// New
"/trips/expenses": {
    tripDirPath: string;
};
"/trips/expenses/duplicate": {
    tripDirPath: string;
};
```

- [ ] **Step 2: Create `ExpenseDuplicateSelect.tsx`**

Write to `src/tui/screens/ExpenseDuplicateSelect.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { SELECT_DUPLICATE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseDuplicateSelect(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setBorderColor(null);
		setMenu([], () => {});
		setHints(SELECT_DUPLICATE_HINTS);
		setTitleSuffix("Expenses > Duplicate");
		return () => {
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses.</Text>;
	}

	const headers = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
	const rows = trip.expenses.map((e) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			e.date,
			account?.name ?? e.accountId,
			e.payee,
			e.category,
			`${e.amount} ${e.currency}`,
			e.tags.length > 0 ? String(e.tags.length) : "",
		];
	});

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				Select an expense to duplicate:
			</Text>
			<TableSelect
				headers={headers}
				rows={rows}
				onChange={(rowIndex) => {
					const expense = trip.expenses[rowIndex];
					if (!expense) return;
					goTo("/trips/expenses/form", {
						props: {
							tripDirPath: trip.dirPath,
							duplicateFromId: expense.id,
						},
					});
				}}
				isActive={focus === "main"}
			/>
		</Box>
	);
}
```

- [ ] **Step 3: Register in router**

```ts
import { ExpenseDuplicateSelect } from "./screens/ExpenseDuplicateSelect";
// ...
"/trips/expenses/duplicate": {
    component: ExpenseDuplicateSelect as unknown as ComponentType,
    title: "Duplicate Expense",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Fully trim `ExpenseList.tsx`**

Replace the entire contents of `src/tui/screens/ExpenseList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("expense-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [
							{ label: "Duplicate", value: "duplicate", key: "d" },
							{ label: "Delete", value: "delete", key: "x" },
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/expenses/form", { props: { tripDirPath } });
				} else if (value === "duplicate" && hasExpenses) {
					goTo("/trips/expenses/duplicate", { props: { tripDirPath } });
				} else if (value === "delete" && hasExpenses) {
					goTo("/trips/expenses/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const headers = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
	const rows = trip.expenses.map((e) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			e.date,
			account?.name ?? e.accountId,
			e.payee,
			e.category,
			`${e.amount} ${e.currency}`,
			e.tags.length > 0 ? String(e.tags.length) : "",
		];
	});

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
	}

	return (
		<TableSelect
			headers={headers}
			rows={rows}
			onChange={(rowIndex) => {
				const expense = trip.expenses[rowIndex];
				if (!expense) return;
				goTo("/trips/expenses/form", {
					props: { tripDirPath: trip.dirPath, expenseId: expense.id },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Navigate to Expenses. Confirm:
1. Menu shows `[a] Add  [d] Duplicate  [x] Delete`.
2. `[d]` goes to `/trips/expenses/duplicate`, breadcrumb ends with `Expenses > Duplicate`, no red border.
3. Selecting an expense navigates to `/trips/expenses/form` with `duplicateFromId` (the form prefills).
4. `[x]` still works (Task 9).

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/ExpenseDuplicateSelect.tsx src/tui/screens/ExpenseList.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
refactor(tui): move expense duplicate-picker to dedicated /duplicate path

Completes the selectMode removal for the expenses list.
EOF
)"
```

---

## Task 11: Add `TripDelete` screen at `/trips/delete`

Like Task 9, this only removes one mode (`delete`) from `TripList`; Task 12 handles `duplicate`. The `/trips` route uses an in-memory `useState` for the trip list rather than `useData().trip`, since trips are sibling directories.

**Files:**
- Create: `src/tui/screens/TripDelete.tsx`
- Modify: `src/tui/models/index.ts` (narrow `selectMode?: "delete" | "duplicate"` to `selectMode?: "duplicate"`; add `/trips/delete`)
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/TripList.tsx` (remove `selectMode === "delete"` branches)

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips": { dataDir?: string; selectMode?: "delete" | "duplicate" };

// New
"/trips": { dataDir?: string; selectMode?: "duplicate" };
"/trips/delete": { dataDir?: string };
```

- [ ] **Step 2: Create `TripDelete.tsx`**

Write to `src/tui/screens/TripDelete.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { deleteTrip, listTrips } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDelete(): JSX.Element {
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/delete");

	const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (trips.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a trip to delete:"
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onConfirm={(dirPath) => {
				deleteTrip(dirPath);
				const next = listTrips(dataDir);
				setTrips(next);
				if (next.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
```

- [ ] **Step 3: Register in router**

```ts
import { TripDelete } from "./screens/TripDelete";
// ...
"/trips/delete": {
    component: TripDelete as unknown as ComponentType,
    title: "Delete Trip",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Update App.tsx breadcrumb switch**

In `src/tui/App.tsx`, add a case alongside the existing `/trips` and `/trips/new` cases (around line 64):

```tsx
case "/trips/delete":
    breadcrumbs.push("Trips");
    break;
```

The new screen's `setTitleSuffix("Delete")` will append `> Delete` to produce `Trips > Delete`.

- [ ] **Step 5: Modify `TripList.tsx`**

In `src/tui/screens/TripList.tsx`:

1. Remove `RemoveSelector` import.
2. Remove `deleteTrip` import.
3. Remove the `SELECT_REMOVE_HINTS` import (keep `LIST_HINTS`).
4. Remove the `selectMode === "delete"` block in the layout `useEffect` (around lines 31–36).
5. Remove the `selectMode === "delete"` render branch (around lines 80–102).
6. In the menu callback, change the `delete` branch:

```tsx
// Old
} else if (value === "delete" && trips.length > 0) {
    goTo("/trips", { props: { dataDir, selectMode: "delete" } });
}

// New
} else if (value === "delete" && trips.length > 0) {
    goTo("/trips/delete", { props: { dataDir } });
}
```

Leave the menu entries and the `duplicate` selectMode branch alone.

- [ ] **Step 6: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 7: Manual verification**

Start the app. From the trips list:
1. Press `[x]` Delete → breadcrumb shows `Trips > Delete`, red border, list of trips.
2. Select a trip → it deletes, list refreshes.
3. When all trips removed → returns to trips list (empty state).

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/TripDelete.tsx src/tui/screens/TripList.tsx src/tui/router.ts src/tui/models/index.ts src/tui/App.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): move trip delete to dedicated /trips/delete path
EOF
)"
```

---

## Task 12: Add `TripDuplicateSelect` screen at `/trips/duplicate`

The `/trips/duplicate` path is now available (renamed to `/trips/duplicate/new` in Task 1). Add the picker here. This task completes selectMode removal for `/trips`.

**Files:**
- Create: `src/tui/screens/TripDuplicateSelect.tsx`
- Modify: `src/tui/models/index.ts` (drop the now-only `selectMode` from `/trips`; add `/trips/duplicate`)
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/TripList.tsx` (remove the `selectMode === "duplicate"` branch and `selectMode` entirely)
- Modify: `src/tui/App.tsx` (breadcrumb case for `/trips/duplicate`)

- [ ] **Step 1: Update route types**

In `src/tui/models/index.ts`:

```ts
// Old
"/trips": { dataDir?: string; selectMode?: "duplicate" };

// New
"/trips": { dataDir?: string };
"/trips/duplicate": { dataDir?: string };
```

- [ ] **Step 2: Create `TripDuplicateSelect.tsx`**

Write to `src/tui/screens/TripDuplicateSelect.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { listTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDuplicateSelect(): JSX.Element {
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/duplicate");

	const [trips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setBorderColor(null);
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Select trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
		setTitleSuffix("Duplicate");
		return () => {
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (trips.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				Select a trip to duplicate:
			</Text>
			<ListSelect
				options={trips.map((t) => ({
					label: t.settings.name,
					value: t.dirPath,
					detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
				}))}
				onChange={(dirPath) => {
					const trip = trips.find((t) => t.dirPath === dirPath);
					if (!trip) return;
					goTo("/trips/duplicate/new", {
						props: {
							dataDir,
							sourceDirPath: trip.dirPath,
							sourceName: trip.settings.name,
							sourceStartDate: trip.settings.startDate,
						},
					});
				}}
				isActive
			/>
		</Box>
	);
}
```

- [ ] **Step 3: Register in router**

```ts
import { TripDuplicateSelect } from "./screens/TripDuplicateSelect";
// ...
"/trips/duplicate": {
    component: TripDuplicateSelect as unknown as ComponentType,
    title: "Duplicate Trip",
    defaultFocus: "main",
},
```

- [ ] **Step 4: Update App.tsx breadcrumb switch**

In `src/tui/App.tsx`, add a case:

```tsx
case "/trips/duplicate":
    breadcrumbs.push("Trips");
    break;
```

(`/trips/duplicate/new` is already in the switch from Task 1 with `breadcrumbs.push("Trips", "Duplicate", "New")`.)

- [ ] **Step 5: Fully trim `TripList.tsx`**

Replace the entire contents of `src/tui/screens/TripList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { listTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripList(): JSX.Element {
	const { goTo } = useNavigation();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const { dataDir = "./data" } = useRouteProps("/trips");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("trip-");
	}, [clearByPrefix]);

	const [trips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{ label: "Duplicate", value: "duplicate", key: "d" },
				{ label: "Delete", value: "delete", key: "x" },
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && trips.length > 0) {
					goTo("/trips/duplicate", { props: { dataDir } });
				} else if (value === "delete" && trips.length > 0) {
					goTo("/trips/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [dataDir, trips.length, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (trips.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<ListSelect
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onChange={(value) => {
				const trip = trips.find((t) => t.dirPath === value);
				if (trip) {
					goTo("/trips/overview", {
						props: {
							tripDirPath: trip.dirPath,
							tripName: trip.settings.name,
							dataDir,
						},
					});
				}
			}}
			isActive={focus === "main"}
		/>
	);
}
```

Note: the trip list is loaded once via `useState` initializer. The previous implementation had a `setTrips` for inline delete refresh — that's no longer needed. The router unmounts and remounts the screen component on navigation, so when the user returns from `/trips/delete` via `goBack()`, TripList remounts and the `useState` initializer re-runs, picking up the post-deletion trip list.

- [ ] **Step 6: Type-check and lint**

Run: `bun run check:type && bun run check`
Expected: both exit 0.

- [ ] **Step 7: Manual verification**

1. Trips list shows `[c] Create  [d] Duplicate  [x] Delete`.
2. `[d]` goes to `/trips/duplicate` (picker, no red border), breadcrumb `Trips > Duplicate`.
3. Selecting a trip navigates to `/trips/duplicate/new` (form), breadcrumb `Trips > Duplicate > New`, prefilled with source.
4. Confirm duplicating creates a new trip and returns to list.
5. `[x]` from trips list still works (Task 11).
6. Delete a couple of trips on the delete screen → return to trips list → confirm the deleted trips are gone (the `useState` initializer re-runs on remount).

- [ ] **Step 8: Commit**

```bash
git add src/tui/screens/TripDuplicateSelect.tsx src/tui/screens/TripList.tsx src/tui/router.ts src/tui/models/index.ts src/tui/App.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): move trip duplicate-picker to dedicated /trips/duplicate

Completes the selectMode removal for the trips list. The picker
lives at /trips/duplicate; the duplicate form (now
/trips/duplicate/new) is reached by selecting a source trip.
EOF
)"
```

---

## Task 13: Final cleanup and verification

- [ ] **Step 1: Confirm `selectMode` is gone**

Run: `grep -rn "selectMode" src/tui/`
Expected: no matches. If any remain (other than this plan's spec file), investigate and remove.

- [ ] **Step 2: Confirm no references to old `/trips/duplicate` form path remain**

Run: `grep -rn '"/trips/duplicate"' src/tui/`
Expected: matches should reference `/trips/duplicate` only as the picker path (in `TripList`, `TripDuplicateSelect`, `router.ts`, `models/index.ts`, `App.tsx`). The form should always be referenced as `/trips/duplicate/new`.

Run: `grep -rn '"/trips/duplicate/new"' src/tui/`
Expected: matches in `TripDuplicateSelect`, `TripDuplicateForm`, `router.ts`, `models/index.ts`, `App.tsx`.

- [ ] **Step 3: Run full type-check, lint, and tests**

```bash
bun run check:type
bun run check
bun test
```

Expected: all three exit 0. `bun test` confirms no regressions in core service tests.

- [ ] **Step 4: Full app walkthrough**

Start the app: `bun run start`

Walk through, on a test trip with sample data:
1. Trips list → `[d]` Duplicate → pick trip → form prefilled → confirm.
2. Trips list → `[x]` Delete → pick trip → confirm delete.
3. Trip overview → Owners → `[x]` Delete → unreferenced owner → confirms.
4. Owners → `[x]` Delete → referenced owner → routes to references screen.
5. Accounts → `[x]` Delete → unreferenced account → confirms.
6. Expenses → `[d]` Duplicate → pick expense → form prefilled.
7. Expenses → `[x]` Delete → pick expense → confirms.
8. Settings → Categories → `[x]` Delete (note shortcut changed from `[d]`).
9. Settings → Tags → `[x]` Delete.
10. Settings → Countries → `[x]` Delete.
11. Settings → Currencies → `[x]` Delete.
12. Create new trip → Countries step → add a couple → `[x]` Delete one.

For each: verify breadcrumb shows the appropriate `... > Delete` or `... > Duplicate` suffix, red border on delete screens, navigation returns to the right place via `[q]`/`[esc]`.

- [ ] **Step 5: No-op commit (only if Step 3 prompted any format-only fixes)**

If Biome made formatting adjustments during the walkthrough that haven't been committed:

```bash
git status
# review
git add -- <specific-files>
git commit -m "style(tui): biome formatting after delete/duplicate refactor"
```

Otherwise skip.

---

## Self-Review Notes

- **Spec coverage:** Tasks 2–12 cover all 9 list screens (Owner, Account, Category, Tag, Country, Currency, TripCreateCountry, Expense × 2 modes, Trip × 2 modes). Task 1 handles the route rename. Task 13 verifies. All spec items have a task.
- **Placeholders:** Task 7 (CurrencyDelete) and Task 8 (TripCreateCountryDelete) have inline "copy from existing" instructions because the data shape for these two is more variable than the others; the engineer must read the source file to copy the mapping. The instruction explicitly forbids leaving `TODO` in the final file.
- **Type consistency:** `setTitleSuffix` strings consistently follow `<Parent>... > <Section> > Delete` (or `Duplicate`). Route paths match types in `models/index.ts`. Menu shortcuts are `[x] Delete` everywhere; `[d] Duplicate` only on `TripList` and `ExpenseList`.
