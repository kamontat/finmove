# Trip Duplicate / Delete — Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `/trips/duplicate` and `/trips/delete` with the same `TableSelect` layout, columns, and sort order as `/trips`.

**Architecture:** Export `TRIP_LIST_HEADERS` and `buildTripListRows` from `TripList.tsx`. Rewrite `TripDuplicateSelect.tsx` and `TripDelete.tsx` to use `TableSelect` with those shared helpers, building entries from `sortTrips(listTrips(dataDir), today())`. No new files, no new util module — both consumers import from the sibling `./TripList`.

**Tech Stack:** TypeScript, React, Ink, Bun. Existing components: `TableSelect`, `sortTrips`, `listTrips`.

**Spec:** `docs/superpowers/specs/2026-05-16-trip-duplicate-delete-table-design.md`

**Note on tests:** Screen-level UI tests don't exist in this repo (`src/tui/__tests__` only covers state stores). Verification is via `bun run check:type`, `bun run check`, and a manual run, consistent with sibling screens. No screen unit tests are added.

---

### Task 1: Export shared row helpers from TripList

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Add `export` to `TRIP_LIST_HEADERS` and `buildTripListRows`**

In `src/tui/screens/TripList.tsx`, change:

```typescript
const TRIP_LIST_HEADERS: string[] = ["Name", "Start", "End", "Days", "Status"];
```

to:

```typescript
export const TRIP_LIST_HEADERS: string[] = ["Name", "Start", "End", "Days", "Status"];
```

And change:

```typescript
function buildTripListRows(
	entries: TripEntry[],
	todayDate: string,
): TableCell[][] {
```

to:

```typescript
export function buildTripListRows(
	entries: TripEntry[],
	todayDate: string,
): TableCell[][] {
```

Leave `getPhase` private (no `export`) — only `buildTripListRows` uses it.

- [ ] **Step 2: Type-check**

Run: `bun run check:type`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): export TRIP_LIST_HEADERS and buildTripListRows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rewrite TripDuplicateSelect as a table

**Files:**
- Modify: `src/tui/screens/TripDuplicateSelect.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/tui/screens/TripDuplicateSelect.tsx` with:

```typescript
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import {
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import { TableSelect } from "../components/molecules/TableSelect";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { buildTripListRows, TRIP_LIST_HEADERS } from "./TripList";

export function TripDuplicateSelect(): JSX.Element {
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/duplicate");

	// Only healthy trips can be duplicated — can't copy what we can't read.
	const [entries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()).filter((e) => e.kind === "ok"),
	);

	useEffect(() => {
		setColor({ border: "yellow", title: "yellow" });
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Select trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
		setTitle(["Trips", "Duplicate"]);
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle]);

	if (entries.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<TableSelect
			headers={TRIP_LIST_HEADERS}
			rows={buildTripListRows(entries, today())}
			onChange={(rowIndex) => {
				const entry = entries[rowIndex];
				if (!entry || entry.kind !== "ok") return;
				goTo("/trips/new", {
					replace: true,
					props: { dataDir, duplicateFromDirPath: entry.trip.dirPath },
				});
			}}
			isActive
		/>
	);
}
```

Key changes from the original:
- `Trip[]` state → `TripEntry[]` state, sorted via `sortTrips(...).filter(kind === "ok")`.
- `ListSelect` → `TableSelect` with shared headers + row builder.
- `onChange(value)` (dirPath string) → `onChange(rowIndex)` resolving the entry by index.

- [ ] **Step 2: Type-check and lint**

Run: `bun run check:type`
Expected: PASS.

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripDuplicateSelect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): render trip duplicate select as a table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rewrite TripDelete as a table

**Files:**
- Modify: `src/tui/screens/TripDelete.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/tui/screens/TripDelete.tsx` with:

```typescript
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import {
	deleteTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import { TableSelect } from "../components/molecules/TableSelect";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { buildTripListRows, TRIP_LIST_HEADERS } from "./TripList";

export function TripDelete(): JSX.Element {
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/delete");

	const [entries, setEntries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(["Trips", "Delete"]);
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle]);

	if (entries.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<TableSelect
			headers={TRIP_LIST_HEADERS}
			rows={buildTripListRows(entries, today())}
			onChange={(rowIndex) => {
				const entry = entries[rowIndex];
				if (!entry) return;
				const dirPath =
					entry.kind === "ok" ? entry.trip.dirPath : entry.dirPath;
				deleteTrip(dirPath);
				const next = sortTrips(listTrips(dataDir), today());
				setEntries(next);
				if (next.length === 0) {
					goBack();
				}
			}}
			isActive
		/>
	);
}
```

Key changes from the original:
- `entryLabel`/`entryDirPath`/`entryDetail` helpers removed — replaced by shared `buildTripListRows`.
- State now sorted via `sortTrips(listTrips(dataDir), today())` (was unsorted).
- `RemoveSelector` → `TableSelect`.
- `onConfirm(value: string)` (dirPath) → `onChange(rowIndex: number)` resolving entry then dirPath.
- Re-list after delete also uses `sortTrips`.

- [ ] **Step 2: Type-check and lint**

Run: `bun run check:type`
Expected: PASS.

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripDelete.tsx
git commit -m "$(cat <<'EOF'
feat(tui): render trip delete as a table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run all checks**

Run: `bun run check:type`
Expected: PASS.

Run: `bun run check`
Expected: PASS.

Run: `bun test`
Expected: PASS (unchanged — no screen tests exist).

- [ ] **Step 2: Manual smoke (report to user)**

Suggest the user run `bun run start`, open `/trips`, press `[d]` from the menu (with no row armed) to reach `/trips/duplicate`, then press `q` and `[x]` (no row armed) to reach `/trips/delete`. Both screens should show the same `Name | Start | End | Days | Status` columns and same row order as `/trips`. Pressing Enter on a row should still trigger the existing duplicate/delete flow.

If anything looks off, return to Task 2 or Task 3 for adjustments.

---

## Spec coverage check

- Shared `TRIP_LIST_HEADERS` + `buildTripListRows` exports — Task 1.
- `TripDuplicateSelect` uses `TableSelect` with shared helpers, sorted via `sortTrips`, filters to `kind === "ok"`, single-Enter confirm, yellow theme — Task 2.
- `TripDelete` uses `TableSelect` with shared helpers, sorted via `sortTrips`, includes broken trips, single-Enter confirm, red theme — Task 3.
- `getPhase` stays private — Task 1 (unchanged, no export).
- No new util module — Task 2/3 import from `./TripList`.
- Visual consistency on broken trips — Task 3 includes broken entries; `buildTripListRows` already handles them.
- Type check + lint + manual smoke — Task 4.

All spec items covered.
