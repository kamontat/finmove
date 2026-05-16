# Trip List Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the trip list as a five-column `TableSelect` (Name | Start | End | Days | Status), inline the row-builder helpers in `TripList.tsx`, merge `expenseListRow.ts` into `ExpenseList.tsx`, and delete the unused `DataTable` organism.

**Architecture:** Reuse the existing `TableSelect` molecule (already powers `ExpenseList`). Top-level `buildTripListRows` helper in `TripList.tsx` maps `TripEntry[]` → `TableCell[][]`. Selection switches from value-string lookup (with `BROKEN_PREFIX`) to row-index lookup. `expenseListRow.ts` is merged into `ExpenseList.tsx` per user preference; `ExpenseDuplicateSelect.tsx` imports from `./ExpenseList`.

**Tech Stack:** Bun runtime, TypeScript, React + Ink TUI. Tests use `bun:test`. Lint/format via Biome. Strict TS with `exactOptionalPropertyTypes: true`.

**Reference spec:** `docs/superpowers/specs/2026-05-16-trip-list-table-design.md`

---

## File Map

- **Delete** `src/tui/components/organisms/DataTable.tsx` — no `src/` callers.
- **Delete** `src/tui/screens/expenseListRow.ts` — contents moved into `ExpenseList.tsx`.
- **Modify** `src/tui/screens/ExpenseList.tsx` — absorb `EXPENSE_LIST_HEADERS`, `buildExpenseListRows`, plus private `formatFinanceNumber` and `formatOwnersCell`. Export the public two.
- **Modify** `src/tui/screens/ExpenseDuplicateSelect.tsx` — change import path to `./ExpenseList`.
- **Modify** `src/tui/screens/TripList.tsx` — replace `ListSelect` with `TableSelect`, add `TRIP_LIST_HEADERS` / `getPhase` / `buildTripListRows` helpers, drop `BROKEN_PREFIX`, switch to row-index lookup.

## Verification commands (used throughout)

- Type check: `bun run check:type`
- Lint: `bun run check`
- Tests: `bun test`
- App (manual smoke): `bun run start --data-dir ./data`

Run all three of `check:type`, `check`, `bun test` after every task before committing.

---

### Task 1: Delete unused DataTable organism

**Files:**
- Delete: `src/tui/components/organisms/DataTable.tsx`

- [ ] **Step 1: Confirm no `src/` callers**

Run:
```bash
grep -rn "DataTable" /Users/kamontat/Documents/Personal/finmove/src --include="*.ts" --include="*.tsx"
```
Expected: only the file's own internal definitions (`interface DataTableProps` line and `export function DataTable` line). No imports from any other source file. If anything else appears, STOP and investigate.

- [ ] **Step 2: Delete the file**

Run:
```bash
rm /Users/kamontat/Documents/Personal/finmove/src/tui/components/organisms/DataTable.tsx
```

- [ ] **Step 3: Verify type-check / lint / tests pass**

Run (sequentially):
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass. If any fail, restore the file with `git checkout -- src/tui/components/organisms/DataTable.tsx` and investigate.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(tui): delete unused DataTable organism

No src/ callers remain — only historical doc references.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Merge expenseListRow.ts into ExpenseList.tsx

This task is atomic: move helpers + update both callers' state + delete sidecar, all in one commit. The codebase will not compile between the steps within this task — that's expected; only the final state must compile.

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`
- Modify: `src/tui/screens/ExpenseDuplicateSelect.tsx`
- Delete: `src/tui/screens/expenseListRow.ts`

- [ ] **Step 1: Rewrite `ExpenseList.tsx` with helpers inlined**

Replace the entire contents of `src/tui/screens/ExpenseList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { Expense, Trip } from "../../core/models";
import { convertToTHB } from "../../core/services/currency";
import { removeExpense } from "../../core/services/expense";
import { computeInitials } from "../../core/services/owner";
import type { TableCell } from "../components/molecules/TableSelect";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export const EXPENSE_LIST_HEADERS: string[] = [
	"Date",
	"Account",
	"Owners",
	"Payee",
	"Category",
	"Amount",
	"Rate",
	"THB",
	"Tags",
];

function formatFinanceNumber(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function formatOwnersCell(
	expense: Expense,
	trip: Trip,
	initialsMap: Record<string, string>,
): TableCell {
	if (!expense.owners || expense.owners.length === 0) {
		return { text: "" };
	}
	// for...of over `(string[] | ExpenseOwnerSplit[])` gives a `string | ExpenseOwnerSplit`
	// element type that narrows cleanly with `typeof`. Using `.map` on the union
	// confuses TypeScript because it resolves to a union of two map signatures.
	const parts: string[] = [];
	for (const entry of expense.owners) {
		const id = typeof entry === "string" ? entry : entry.id;
		const owner = trip.owners.find((o) => o.id === id);
		parts.push(owner ? (initialsMap[owner.name] ?? owner.name) : id);
	}
	return { text: parts.join(", ") };
}

export function buildExpenseListRows(trip: Trip): TableCell[][] {
	const initialsMap = computeInitials(trip.owners.map((o) => o.name));

	// First pass: compute raw numeric strings per row for the Amount and THB columns.
	const numericData = trip.expenses.map((e) => {
		const amountNum = formatFinanceNumber(e.amount);

		const tripRate = trip.settings.currencies[e.currency]?.exchangeRate;
		const rate = e.exchangeRate ?? tripRate ?? null;

		let thbNum: string;
		let thbMissing = false;
		if (e.currency === "THB") {
			thbNum = formatFinanceNumber(e.amount);
		} else if (rate !== null) {
			thbNum = formatFinanceNumber(
				convertToTHB(e.amount, e.currency, e.exchangeRate, tripRate),
			);
		} else {
			thbNum = "?";
			thbMissing = true;
		}

		return { amountNum, thbNum, thbMissing, rate };
	});

	const amountWidth = numericData.reduce(
		(max, d) => Math.max(max, d.amountNum.length),
		0,
	);
	const thbWidth = numericData.reduce(
		(max, d) => Math.max(max, d.thbNum.length),
		0,
	);

	return trip.expenses.map((e, i) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		const data = numericData[i];
		if (!data) throw new Error("invariant: numericData index missing");

		const amountCell: TableCell = {
			text: `${data.amountNum.padStart(amountWidth)} ${e.currency}`,
		};

		let rateCell: TableCell;
		if (e.currency === "THB") {
			rateCell = { text: "" };
		} else if (data.rate !== null) {
			rateCell = { text: data.rate.toFixed(2) };
		} else {
			rateCell = { text: "?", color: "red" };
		}

		const thbCell: TableCell = data.thbMissing
			? { text: "?".padStart(thbWidth), color: "red" }
			: { text: `${data.thbNum.padStart(thbWidth)} THB` };

		return [
			{ text: e.date },
			{ text: account?.name ?? e.accountId },
			formatOwnersCell(e, trip, initialsMap),
			{ text: e.payee },
			{ text: e.category },
			amountCell,
			rateCell,
			thbCell,
			{ text: e.tags.length > 0 ? String(e.tags.length) : "" },
		];
	});
}

export function ExpenseList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("expense-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitle(tripTitle(trip, "Expenses"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [
							{
								label: "Duplicate",
								value: "duplicate",
								key: "d",
								mainAction: {
									onConfirm: (i: number) => {
										const e = trip.expenses[i];
										if (!e) return;
										goTo("/trips/expenses/form", {
											props: { tripDirPath, duplicateFromId: e.id },
										});
									},
								},
							},
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									onConfirm: (i: number) => {
										const e = trip.expenses[i];
										if (!e) return;
										removeExpense(trip, e.id);
										reloadTrip();
										if (trip.expenses.length === 0) {
											goBack();
										}
									},
								},
							},
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
	}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
	}

	const headers = EXPENSE_LIST_HEADERS;
	const rows = buildExpenseListRows(trip);

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
			onHighlight={setActiveIndex}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
```

Key changes vs. the original file:
- Added imports: `Expense`, `Trip`, `convertToTHB`, `computeInitials`, `TableCell` type.
- Removed import line: `import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./expenseListRow";`
- Inserted the three helpers (`EXPENSE_LIST_HEADERS`, `formatFinanceNumber`, `formatOwnersCell`, `buildExpenseListRows`) between imports and the component function. Only `EXPENSE_LIST_HEADERS` and `buildExpenseListRows` are exported; the other two are file-private.
- The component function body is unchanged.

- [ ] **Step 2: Update `ExpenseDuplicateSelect.tsx` import**

Edit `src/tui/screens/ExpenseDuplicateSelect.tsx` line 12:

Replace:
```ts
import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./expenseListRow";
```
with:
```ts
import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./ExpenseList";
```

No other changes to that file.

- [ ] **Step 3: Delete the sidecar file**

Run:
```bash
rm /Users/kamontat/Documents/Personal/finmove/src/tui/screens/expenseListRow.ts
```

- [ ] **Step 4: Verify no stale references remain**

Run:
```bash
grep -rn "expenseListRow" /Users/kamontat/Documents/Personal/finmove/src --include="*.ts" --include="*.tsx"
```
Expected: no output. Any output is a leftover reference that must be fixed before continuing.

- [ ] **Step 5: Type-check, lint, test**

Run:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass.

If `bun run check` reports formatting differences in the new `ExpenseList.tsx` (e.g., import ordering), run `bun run fix` and re-run `bun run check` to confirm clean.

- [ ] **Step 6: Manual smoke**

Run: `bun run start --data-dir ./data` (or a data dir with at least one trip containing expenses).

Verify:
- Open a trip → Expenses. Table renders identically to before.
- Open a trip → Expenses → Duplicate. Table renders identically to before.
- `↑↓`, `[Enter]` (edit/duplicate), `[d]`, `[x]` all behave as before.

Quit with `[e]`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(tui): inline expenseListRow helpers into ExpenseList

Move EXPENSE_LIST_HEADERS and buildExpenseListRows (plus the private
formatFinanceNumber and formatOwnersCell helpers) from the sidecar
expenseListRow.ts into ExpenseList.tsx as exported top-level
functions. ExpenseDuplicateSelect now imports from ./ExpenseList.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rewrite TripList as a table

**Files:**
- Modify: `src/tui/screens/TripList.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `TripList.tsx`**

Replace the entire contents of `src/tui/screens/TripList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { daysBetween, today } from "../../core/services/date";
import {
	deleteTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import type { TableCell } from "../components/molecules/TableSelect";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

const TRIP_LIST_HEADERS: string[] = ["Name", "Start", "End", "Days", "Status"];

function getPhase(
	startDate: string,
	endDate: string,
	todayDate: string,
): "upcoming" | "ongoing" | "ended" {
	if (todayDate < startDate) return "upcoming";
	if (todayDate > endDate) return "ended";
	return "ongoing";
}

function buildTripListRows(
	entries: TripEntry[],
	todayDate: string,
): TableCell[][] {
	return entries.map((e) => {
		if (e.kind === "ok") {
			const { name, startDate, endDate } = e.trip.settings;
			const days = daysBetween(startDate, endDate) + 1;
			return [
				{ text: name },
				{ text: startDate },
				{ text: endDate },
				{ text: String(days) },
				{ text: getPhase(startDate, endDate, todayDate) },
			];
		}
		return [
			{ text: `⚠ ${e.dirName}` },
			{ text: "—" },
			{ text: "—" },
			{ text: "—" },
			{ text: "broken" },
		];
	});
}

export function TripList(): JSX.Element {
	const { goTo, goBack } = useNavigation();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();

	const { dataDir = "./data" } = useRouteProps("/trips");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("trip-");
	}, [clearByPrefix]);

	const [entries, setEntries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	const hasOk = entries.some((e) => e.kind === "ok");

	useEffect(() => {
		setTitle(["Trips"]);
		setColor({});

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{
					label: "Duplicate",
					value: "duplicate",
					key: "d",
					mainAction: {
						check: (i) => entries[i]?.kind === "ok",
						onConfirm: (i) => {
							const e = entries[i];
							if (!e || e.kind !== "ok") return;
							goTo("/trips/new", {
								props: {
									dataDir,
									duplicateFromDirPath: e.trip.dirPath,
								},
							});
						},
					},
				},
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: {
						confirmCount: 2,
						onConfirm: (i) => {
							const e = entries[i];
							if (!e) return;
							const path = e.kind === "ok" ? e.trip.dirPath : e.dirPath;
							deleteTrip(path);
							const next = sortTrips(listTrips(dataDir), today());
							setEntries(next);
							if (next.length === 0) {
								goBack();
							}
						},
					},
				},
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && hasOk) {
					goTo("/trips/duplicate", { props: { dataDir } });
				} else if (value === "delete" && entries.length > 0) {
					goTo("/trips/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
		return () => clearTitle();
	}, [
		dataDir,
		entries,
		hasOk,
		setMenu,
		setHints,
		setColor,
		setTitle,
		clearTitle,
		goTo,
		goBack,
	]);

	if (entries.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<TableSelect
			headers={TRIP_LIST_HEADERS}
			rows={buildTripListRows(entries, today())}
			onChange={(rowIndex) => {
				const entry = entries[rowIndex];
				if (!entry) return;
				if (entry.kind === "broken") {
					goTo("/trips/broken", {
						props: {
							dirName: entry.dirName,
							dirPath: entry.dirPath,
							error: entry.error,
							dataDir,
						},
					});
					return;
				}
				goTo("/trips/overview", {
					props: {
						tripDirPath: entry.trip.dirPath,
						tripName: entry.trip.settings.name,
						dataDir,
					},
				});
			}}
			onHighlight={setActiveIndex}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
```

Key differences vs. the original:
- Imports: dropped `ListSelect`; added `TableSelect`, `TableCell`, `daysBetween`.
- Removed: `BROKEN_PREFIX` constant.
- Added: `TRIP_LIST_HEADERS`, `getPhase`, `buildTripListRows` as top-level helpers.
- `onChange` signature changes from `(value: string)` to `(rowIndex: number)`. The dispatcher resolves the entry by index and routes by `entry.kind` (`"broken"` → `/trips/broken`, `"ok"` → `/trips/overview`).
- `onHighlight` changes from `(_, i) => setActiveIndex(i)` to `setActiveIndex` directly (TableSelect passes `rowIndex` already).
- Menu / armed-row / empty-state / sort / title / color / hints / form-buffer-clear behavior unchanged.

- [ ] **Step 2: Type-check**

Run:
```bash
bun run check:type
```
Expected: pass. Common failures to look for:
- `daysBetween` not exported from `../../core/services/date` → verify the import line matches `src/core/services/date/index.ts` (it exports both `daysBetween` and `today`).
- `TableCell` type mismatch → confirm cells are `{ text: string }`, not raw strings.
- Conditional spread issue with `exactOptionalPropertyTypes` → none expected here, but if you see one, mirror the existing `ExpenseList` pattern.

- [ ] **Step 3: Lint**

Run:
```bash
bun run check
```
Expected: pass. If formatting complains, run `bun run fix` and re-check.

- [ ] **Step 4: Tests**

Run:
```bash
bun test
```
Expected: all pass.

- [ ] **Step 5: Manual smoke — trip list table**

Run: `bun run start --data-dir ./data` (using a data dir with at least 2 trips of different phases; create one with `--data-dir ./tmp-data` and exercise the create flow if needed).

Verify each in turn:
1. **Render** — Table shows 5 columns: `Name | Start | End | Days | Status`. Column widths align.
2. **Phase** — A trip whose end date is before today shows `ended`. A trip whose start date is after today shows `upcoming`. A trip spanning today shows `ongoing`.
3. **Days** — Equals (endDate − startDate) + 1.
4. **Sort order** — Active trips first (ascending end date), then ended (descending end date), then broken — matches the pre-existing `sortTrips` order.
5. **Navigation** — `↑↓` moves cursor across rows; `[Enter]` on an ok row opens `/trips/overview`.
6. **Broken row** — If no broken trip exists, create one by running `mkdir -p ./data/zzz-broken && touch ./data/zzz-broken/settings.yaml` from a separate shell, restart the app. Confirm the row shows `⚠ zzz-broken | — | — | — | broken` and `[Enter]` opens `/trips/broken` with the error details.
7. **Empty state** — Move/rename the data dir aside (or use a fresh `--data-dir`) so it's empty; confirm `No trips yet. Press [c] to create one.` renders.
8. **Menu shortcuts** — `[c]` opens `/trips/new`. `[d]` (when an ok row is selected) arms duplicate; second `[d]` opens the duplicate flow from that row. Pressing `[d]` then `[Enter]` on a non-ok row should be a no-op (the `check` callback gates it).
9. **Delete** — `[x]` arms delete; second `[x]` deletes the row. Deleting the last trip triggers `goBack()`.
10. **Focus & menu** — `[tab]` switches between table and menu. Menu shortcuts still work regardless of focus.
11. **Title** — Breadcrumb reads `Trips` above the main box.

Clean up any test data you created (e.g., `rm -rf ./data/zzz-broken`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(tui): render trip list as a table

Replace ListSelect with TableSelect (Name, Start, End, Days, Status).
Phase is computed inline (upcoming/ongoing/ended); broken trips show as
'⚠ <dirName>' with dashes and a 'broken' status. Selection switches
from BROKEN_PREFIX value strings to row-index lookup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

After completing all three tasks, confirm against the spec at `docs/superpowers/specs/2026-05-16-trip-list-table-design.md`:

- [ ] Trip list renders 5 columns matching spec preview.
- [ ] Phase rule matches `getTripStatus` (lines 63–72 of `src/core/services/trip/getTripStatus.ts`).
- [ ] Broken trips show `⚠ ${dirName}` + dashes + `broken`, plain text — no color on the status cell.
- [ ] `BROKEN_PREFIX` removed.
- [ ] Menu (`[c]` / `[d]` / `[x]`) and armed-row behavior identical to before.
- [ ] Empty-state message unchanged.
- [ ] `expenseListRow.ts` removed; `ExpenseList.tsx` exports `EXPENSE_LIST_HEADERS` and `buildExpenseListRows`; `ExpenseDuplicateSelect.tsx` imports from `./ExpenseList`.
- [ ] `DataTable.tsx` removed.
- [ ] `bun run check:type`, `bun run check`, `bun test` all green on `main`.
- [ ] Manual smoke covered all 11 trip-list checks plus ExpenseList/ExpenseDuplicateSelect regression.

If anything fails, fix it before declaring done.
