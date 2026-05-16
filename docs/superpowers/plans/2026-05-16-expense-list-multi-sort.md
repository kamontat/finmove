# Expense List Multi-Level Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-slot multi-level sort to the expense list. New `useExpenseListSort()` context drives a dedicated `/trips/expenses/sort` screen with an inline column picker; sort logic lives in a new pure `sortExpenses` core service.

**Architecture:** Slot-based state — `Slot[]` of length 5, each slot either `null` or `{ key, dir }`. Active slots (non-null, in order) are passed to `sortExpenses` for sorting; holes are simply skipped. Header subscripts number by position among active slots. Sort state is session-scoped (in-memory). Picker is an inline overlay within the sort screen with two-mode UX: view mode mutates slots immediately, picker mode mutates locally until `Enter` commits.

**Tech Stack:** Bun runtime, TypeScript, React + Ink TUI. Tests use `bun:test`. Lint/format via Biome. Strict TS with `exactOptionalPropertyTypes: true`.

**Reference spec:** `docs/superpowers/specs/2026-05-16-expense-list-multi-sort-design.md`

---

## File Map

- **Create** `src/core/services/expense/sortExpenses.ts` — pure sort function, no UI deps. Sorts `Expense[]` by an ordered list of `{ key, dir }` levels.
- **Create** `src/core/services/expense/__tests__/sortExpenses.test.ts` — unit tests for all 5 keys, both directions, stable tiebreak, missing-THB sink, multi-level chain, owner tuple sort, empty inputs.
- **Modify** `src/core/services/expense/index.ts` — export `sortExpenses` and its types.
- **Create** `src/tui/states/expenseListSort.tsx` — `ExpenseListSortProvider` + `useExpenseListSort()` hook + `Slot`/`SortKey`/`SortDir` types + `DEFAULT_SLOTS` + `activeSlots()` helper.
- **Modify** `src/tui/App.tsx` — wrap children with `ExpenseListSortProvider`.
- **Modify** `src/tui/screens/ExpenseList.tsx` — read slots → `activeSlots` → `sortExpenses`; refactor `buildExpenseListRows(trip)` to `buildExpenseListRows(trip, expenses)`; add `buildSortedHeaders` helper; switch three `trip.expenses[rowIndex]` lookups to `sortedExpenses[rowIndex]`; add `[s] Sort` menu entry; include `slots` (or `levels`) in menu effect deps.
- **Modify** `src/tui/screens/ExpenseDuplicateSelect.tsx` — pass `trip.expenses` to `buildExpenseListRows` (signature change ripple, no behavior change).
- **Modify** `src/tui/constants/hints.ts` — add `SORT_HINTS` (used by the sort screen view mode) and `SORT_PICKER_HINTS` (used by picker mode).
- **Create** `src/tui/screens/ExpenseListSort.tsx` — sort builder screen: 5 slot rows, inline picker overlay, Space-direction toggle in both modes, `[s]` apply, `[q/esc]` revert.
- **Modify** `src/tui/router.ts` — register `/trips/expenses/sort` → `ExpenseListSort`.

## Verification commands (used throughout)

- Type check: `bun run check:type`
- Lint: `bun run check`
- Tests: `bun test`
- App (manual smoke): `bun run start --data-dir ./data`

Run all three of `check:type`, `check`, `bun test` after every task before committing. If `bun run check` reports formatting differences, run `bun run fix` and re-check before continuing.

---

### Task 1: Core sort service + tests

**Files:**
- Create: `src/core/services/expense/sortExpenses.ts`
- Create: `src/core/services/expense/__tests__/sortExpenses.test.ts`
- Modify: `src/core/services/expense/index.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/core/services/expense/__tests__/sortExpenses.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { AccountType } from "../../../models";
import type { Account, Expense, Owner, Trip } from "../../../models";
import { sortExpenses, type SortLevel } from "../sortExpenses";

const owners: Owner[] = [
	{ id: "alice", name: "Alice" },
	{ id: "bob", name: "Bob" },
	{ id: "carol", name: "Carol" },
];

const accounts: Account[] = [
	{ id: "acc-k", name: "Kasikorn", type: AccountType.Debit, owners: ["alice"] },
	{
		id: "acc-b",
		name: "Bangkok Bank",
		type: AccountType.Debit,
		owners: ["alice"],
	},
];

function makeTrip(expenses: Expense[]): Trip {
	return {
		dirPath: "/test",
		settings: {
			version: 1,
			name: "Test",
			startDate: "2026-01-01",
			endDate: "2026-01-31",
			countries: ["TH"],
			baseCurrency: "THB",
			currencies: {
				USD: { exchangeRate: 35 },
				EUR: { exchangeRate: 38 },
			},
			categories: ["Food", "Transport"],
			tags: [],
			exportPath: "/tmp/test.csv",
		},
		owners,
		accounts,
		expenses,
	};
}

function makeExpense(overrides: Partial<Expense>): Expense {
	return {
		id: overrides.id ?? "e1",
		accountId: overrides.accountId ?? "acc-k",
		date: overrides.date ?? "2026-01-15",
		payee: overrides.payee ?? "Generic",
		category: overrides.category ?? "Food",
		amount: overrides.amount ?? 100,
		currency: overrides.currency ?? "THB",
		description: overrides.description ?? "",
		tags: overrides.tags ?? [],
		...(overrides.exchangeRate !== undefined
			? { exchangeRate: overrides.exchangeRate }
			: {}),
		...(overrides.owners !== undefined ? { owners: overrides.owners } : {}),
	};
}

describe("sortExpenses", () => {
	test("empty levels → preserves insertion order (new array)", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-20" }),
			makeExpense({ id: "b", date: "2026-01-10" }),
		];
		const trip = makeTrip(expenses);
		const result = sortExpenses(expenses, trip, []);
		expect(result.map((e) => e.id)).toEqual(["a", "b"]);
		expect(result).not.toBe(expenses); // new array
	});

	test("empty expenses → empty array", () => {
		const trip = makeTrip([]);
		expect(sortExpenses([], trip, [{ key: "date", dir: "asc" }])).toEqual([]);
	});

	test("date asc and desc", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-20" }),
			makeExpense({ id: "b", date: "2026-01-10" }),
			makeExpense({ id: "c", date: "2026-01-15" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "c", "b"]);
	});

	test("stable: equal-key rows preserve insertion order", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-15" }),
			makeExpense({ id: "b", date: "2026-01-15" }),
			makeExpense({ id: "c", date: "2026-01-15" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "b", "c"]);
	});

	test("multi-level: date desc, then account asc within same date", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-10", accountId: "acc-k" }),
			makeExpense({ id: "b", date: "2026-01-20", accountId: "acc-b" }),
			makeExpense({ id: "c", date: "2026-01-10", accountId: "acc-b" }),
		];
		const trip = makeTrip(expenses);
		const levels: SortLevel[] = [
			{ key: "date", dir: "desc" },
			{ key: "account", dir: "asc" },
		];
		// 2026-01-20: b (Bangkok)
		// 2026-01-10: c (Bangkok), a (Kasikorn)
		expect(sortExpenses(expenses, trip, levels).map((e) => e.id)).toEqual([
			"b",
			"c",
			"a",
		]);
	});

	test("thb sort uses converted value; missing rate sinks last (asc and desc)", () => {
		const expenses = [
			makeExpense({ id: "a", amount: 200, currency: "THB" }),
			makeExpense({ id: "b", amount: 10, currency: "USD" }), // 10 * 35 = 350
			makeExpense({ id: "c", amount: 5, currency: "XXX" }), // no rate → missing
		];
		const trip = makeTrip(expenses);

		expect(
			sortExpenses(expenses, trip, [{ key: "thb", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "b", "c"]); // 200, 350, missing-last

		expect(
			sortExpenses(expenses, trip, [{ key: "thb", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "a", "c"]); // 350, 200, missing-last
	});

	test("account sort by account name, case-insensitive; falls back to id", () => {
		const expenses = [
			makeExpense({ id: "a", accountId: "acc-k" }), // Kasikorn
			makeExpense({ id: "b", accountId: "acc-b" }), // Bangkok Bank
			makeExpense({ id: "c", accountId: "ghost" }), // missing → id "ghost"
		];
		const trip = makeTrip(expenses);
		// Bangkok Bank (b), ghost (c, by id), Kasikorn (k)
		expect(
			sortExpenses(expenses, trip, [{ key: "account", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
	});

	test("category sort, case-insensitive", () => {
		const expenses = [
			makeExpense({ id: "a", category: "transport" }),
			makeExpense({ id: "b", category: "Food" }),
			makeExpense({ id: "c", category: "food" }),
		];
		const trip = makeTrip(expenses);
		// food/Food < transport (case-insensitive); food/Food are equal → stable tiebreak preserves b before c
		expect(
			sortExpenses(expenses, trip, [{ key: "category", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
	});

	test("owner sort: count first, then first-owner initials", () => {
		const expenses = [
			makeExpense({ id: "a", owners: ["alice", "bob"] }), // 2 owners, first = Alice → A
			makeExpense({ id: "b", owners: ["carol"] }), // 1 owner → C
			makeExpense({ id: "c", owners: [] }), // 0 owners
			makeExpense({ id: "d", owners: ["bob", "carol"] }), // 2 owners, first = Bob → B
		];
		const trip = makeTrip(expenses);
		// asc: 0 owners (c), then 1 owner (b), then 2 owners — within 2, A (a) < B (d)
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["c", "b", "a", "d"]);
		// desc: reverse both tuple elements
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["d", "a", "b", "c"]);
	});

	test("owner sort accepts ExpenseOwnerSplit entries", () => {
		const expenses = [
			makeExpense({ id: "a", owners: [{ id: "bob" }, { id: "alice" }] }),
			makeExpense({ id: "b", owners: [{ id: "alice" }, { id: "bob" }] }),
		];
		const trip = makeTrip(expenses);
		// both have 2 owners; tiebreak by first-owner initials: Alice (b) < Bob (a)
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "a"]);
	});
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run:
```bash
bun test src/core/services/expense/__tests__/sortExpenses.test.ts
```
Expected: fails because `../sortExpenses` doesn't exist yet (`Cannot find module`).

- [ ] **Step 3: Implement `sortExpenses`**

Create `src/core/services/expense/sortExpenses.ts` with:

```ts
import type { Expense, Trip } from "../../models";
import { computeInitials } from "../owner";
import { convertToTHB } from "../currency";

export type SortKey = "date" | "thb" | "account" | "owner" | "category";
export type SortDir = "asc" | "desc";
export type SortLevel = { key: SortKey; dir: SortDir };

function firstOwnerInitial(
	expense: Expense,
	trip: Trip,
	initialsMap: Record<string, string>,
): string {
	if (!expense.owners || expense.owners.length === 0) return "";
	const first = expense.owners[0];
	if (first === undefined) return "";
	const id = typeof first === "string" ? first : first.id;
	const owner = trip.owners.find((o) => o.id === id);
	if (!owner) return id.toLowerCase();
	return (initialsMap[owner.name] ?? owner.name).toLowerCase();
}

function thbValue(expense: Expense, trip: Trip): number | null {
	if (expense.currency === "THB") return expense.amount;
	const tripRate = trip.settings.currencies[expense.currency]?.exchangeRate;
	const rate = expense.exchangeRate ?? tripRate;
	if (rate === undefined) return null;
	return convertToTHB(expense.amount, expense.currency, expense.exchangeRate, tripRate);
}

function accountName(expense: Expense, trip: Trip): string {
	const account = trip.accounts.find((a) => a.id === expense.accountId);
	return (account?.name ?? expense.accountId).toLowerCase();
}

function compareLevel(
	a: Expense,
	b: Expense,
	level: SortLevel,
	trip: Trip,
	initialsMap: Record<string, string>,
): number {
	const sign = level.dir === "asc" ? 1 : -1;
	switch (level.key) {
		case "date":
			return sign * a.date.localeCompare(b.date);
		case "thb": {
			const av = thbValue(a, trip);
			const bv = thbValue(b, trip);
			// Missing rate always sorts last, regardless of direction.
			if (av === null && bv === null) return 0;
			if (av === null) return 1;
			if (bv === null) return -1;
			return sign * (av - bv);
		}
		case "account":
			return sign * accountName(a, trip).localeCompare(accountName(b, trip));
		case "category":
			return sign * a.category.toLowerCase().localeCompare(b.category.toLowerCase());
		case "owner": {
			const aCount = a.owners?.length ?? 0;
			const bCount = b.owners?.length ?? 0;
			if (aCount !== bCount) return sign * (aCount - bCount);
			const aInit = firstOwnerInitial(a, trip, initialsMap);
			const bInit = firstOwnerInitial(b, trip, initialsMap);
			return sign * aInit.localeCompare(bInit);
		}
	}
}

export function sortExpenses(
	expenses: Expense[],
	trip: Trip,
	levels: SortLevel[],
): Expense[] {
	const initialsMap = computeInitials(trip.owners.map((o) => o.name));
	// Decorate with original index for stable tiebreak.
	const decorated = expenses.map((e, i) => ({ e, i }));
	decorated.sort((x, y) => {
		for (const level of levels) {
			const c = compareLevel(x.e, y.e, level, trip, initialsMap);
			if (c !== 0) return c;
		}
		return x.i - y.i;
	});
	return decorated.map((d) => d.e);
}
```

- [ ] **Step 4: Export from the barrel**

Edit `src/core/services/expense/index.ts` and add (alphabetically placed):

```ts
export { sortExpenses } from "./sortExpenses";
export type { SortDir, SortKey, SortLevel } from "./sortExpenses";
```

Final file contents should be:

```ts
export { addExpense } from "./addExpense";
export type { OwnerAmount } from "./calculateSplits";
export { calculateSplits } from "./calculateSplits";
export { getExpenses } from "./getExpenses";
export { nextExpenseId } from "./nextExpenseId";
export { removeExpense } from "./removeExpense";
export { sortExpenses } from "./sortExpenses";
export type { SortDir, SortKey, SortLevel } from "./sortExpenses";
export { updateExpense } from "./updateExpense";
```

- [ ] **Step 5: Run the new tests, verify pass**

Run:
```bash
bun test src/core/services/expense/__tests__/sortExpenses.test.ts
```
Expected: all tests pass.

- [ ] **Step 6: Run full test + type + lint suite**

Run sequentially:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass. If lint complains about formatting, run `bun run fix` and re-check.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/expense/sortExpenses.ts src/core/services/expense/__tests__/sortExpenses.test.ts src/core/services/expense/index.ts
git commit -m "$(cat <<'EOF'
feat(core): add sortExpenses service for multi-level expense sort

Stable comparator chain over date, thb, account, owner, category. THB
rows with missing exchange rate sort last regardless of direction.
Owner sort uses [count, first-owner-initial] tuple.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Refactor `buildExpenseListRows` signature

This is a no-behavior-change refactor. Splitting it from the wiring task keeps it diff-reviewable.

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`
- Modify: `src/tui/screens/ExpenseDuplicateSelect.tsx`

- [ ] **Step 1: Change the signature in `ExpenseList.tsx`**

Open `src/tui/screens/ExpenseList.tsx`. Find the function signature:

```ts
export function buildExpenseListRows(trip: Trip): TableCell[][] {
```

Change to:

```ts
export function buildExpenseListRows(
	trip: Trip,
	expenses: Expense[],
): TableCell[][] {
```

Then inside the function body, replace **all** uses of `trip.expenses` with `expenses`. There are two:

1. `const numericData = trip.expenses.map((e) => {` → `const numericData = expenses.map((e) => {`
2. `return trip.expenses.map((e, i) => {` → `return expenses.map((e, i) => {`

The `Expense` type is already imported at the top of the file (used in `formatOwnersCell`'s signature) — no new import needed.

- [ ] **Step 2: Update the call site inside `ExpenseList` component**

In the same file, find the line:

```ts
const rows = buildExpenseListRows(trip);
```

Change to:

```ts
const rows = buildExpenseListRows(trip, trip.expenses);
```

(Task 4 will replace `trip.expenses` here with `sortedExpenses`. For now, preserve current behavior.)

- [ ] **Step 3: Update the call in `ExpenseDuplicateSelect.tsx`**

Open `src/tui/screens/ExpenseDuplicateSelect.tsx`. Find the call to `buildExpenseListRows(trip)` and change to `buildExpenseListRows(trip, trip.expenses)`.

To locate it:
```bash
grep -n "buildExpenseListRows" /Users/kamontat/Documents/Personal/finmove/src/tui/screens/ExpenseDuplicateSelect.tsx
```

- [ ] **Step 4: Type-check, lint, test**

Run:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass. If lint complains, run `bun run fix`.

- [ ] **Step 5: Manual smoke (regression)**

Run `bun run start --data-dir ./data`. Open a trip with expenses → confirm the expense list renders identically. Open the duplicate selector → confirm it renders identically. No behavior change expected.

Quit with `[e]`.

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx src/tui/screens/ExpenseDuplicateSelect.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): buildExpenseListRows takes expenses as parameter

Decouples the row builder from trip.expenses so callers can supply a
sorted/filtered subset. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Session state provider + wire sort into ExpenseList

Adds the `useExpenseListSort()` context and consumes it in `ExpenseList` so the rendered rows go through `sortExpenses`. After this task, the default sort (`Date ↓`) is applied and the header shows `Date↓` — but there's still no UI to change the sort.

**Files:**
- Create: `src/tui/states/expenseListSort.tsx`
- Modify: `src/tui/App.tsx`
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Create the state provider**

Create `src/tui/states/expenseListSort.tsx` with:

```tsx
import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { SortDir, SortKey, SortLevel } from "../../core/services/expense";

export type Slot = { key: SortKey; dir: SortDir } | null;

export const SLOT_COUNT = 5;

export const DEFAULT_SLOTS: Slot[] = [
	{ key: "date", dir: "desc" },
	null,
	null,
	null,
	null,
];

export function activeSlots(slots: Slot[]): SortLevel[] {
	return slots.filter((s): s is SortLevel => s !== null);
}

interface ExpenseListSortContextValue {
	slots: Slot[];
	setSlots: (next: Slot[]) => void;
}

const ExpenseListSortContext =
	createContext<ExpenseListSortContextValue | null>(null);

interface ExpenseListSortProviderProps {
	children: ReactNode;
}

export function ExpenseListSortProvider({
	children,
}: ExpenseListSortProviderProps): JSX.Element {
	const [slots, setSlotsState] = useState<Slot[]>(DEFAULT_SLOTS);

	const setSlots = useCallback((next: Slot[]) => {
		setSlotsState(next);
	}, []);

	const value = useMemo<ExpenseListSortContextValue>(
		() => ({ slots, setSlots }),
		[slots, setSlots],
	);

	return (
		<ExpenseListSortContext.Provider value={value}>
			{children}
		</ExpenseListSortContext.Provider>
	);
}

export function useExpenseListSort(): ExpenseListSortContextValue {
	const ctx = useContext(ExpenseListSortContext);
	if (ctx === null) {
		throw new Error(
			"useExpenseListSort must be used within an ExpenseListSortProvider",
		);
	}
	return ctx;
}
```

- [ ] **Step 2: Mount the provider in `App.tsx`**

Edit `src/tui/App.tsx`. Add the import near the other state-provider imports:

```ts
import { ExpenseListSortProvider } from "./states/expenseListSort";
```

Then wrap the provider tree. Find the existing block:

```tsx
<FormBufferProvider>
    <NavigationProvider initial={initial} routes={routes}>
        <NotificationProvider>
            <Router />
        </NotificationProvider>
    </NavigationProvider>
</FormBufferProvider>
```

Change to:

```tsx
<FormBufferProvider>
    <ExpenseListSortProvider>
        <NavigationProvider initial={initial} routes={routes}>
            <NotificationProvider>
                <Router />
            </NotificationProvider>
        </NavigationProvider>
    </ExpenseListSortProvider>
</FormBufferProvider>
```

- [ ] **Step 3: Wire sort into `ExpenseList.tsx`**

Open `src/tui/screens/ExpenseList.tsx`. Add the following imports near the existing imports (keep alphabetical/grouping consistent — Biome will normalize on `bun run fix`):

```ts
import { sortExpenses, type SortKey, type SortLevel } from "../../core/services/expense";
import { activeSlots, useExpenseListSort } from "../states/expenseListSort";
```

Add header indicator helper above the `ExpenseList` component function (after the existing top-level helpers):

```ts
const SORT_KEY_TO_HEADER: Record<SortKey, string> = {
	date: "Date",
	thb: "THB",
	account: "Account",
	owner: "Owner",
	category: "Category",
};

const PRIORITY_SUBSCRIPTS = ["₁", "₂", "₃", "₄", "₅"] as const;

export function buildSortedHeaders(
	headers: string[],
	levels: SortLevel[],
): string[] {
	if (levels.length === 0) return headers;
	return headers.map((h) => {
		const idx = levels.findIndex((l) => SORT_KEY_TO_HEADER[l.key] === h);
		if (idx === -1) return h;
		const arrow = levels[idx]!.dir === "desc" ? "↓" : "↑";
		const subscript =
			levels.length > 1 ? (PRIORITY_SUBSCRIPTS[idx] ?? "") : "";
		return `${h}${arrow}${subscript}`;
	});
}
```

Inside the `ExpenseList` component, near the other hook calls at the top, add:

```ts
const { slots } = useExpenseListSort();
```

Update the menu effect to include `slots` in its dependency array:

Find:
```ts
}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack]);
```

Replace with:
```ts
}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack, slots]);
```

Inside the same menu effect, replace **both** `trip.expenses[i]` lookups inside `mainAction.onConfirm` with `sortedExpenses[i]`. Specifically the two callbacks for `Duplicate` and `Delete`. To do this safely, compute `sortedExpenses` inside the effect (before `setMenu`):

Find (inside `useEffect(() => { setColor({}); if (!trip) return; ...`):

```ts
const tripDirPath = trip.dirPath;
const hasExpenses = trip.expenses.length > 0;

setMenu(
```

Change to:

```ts
const tripDirPath = trip.dirPath;
const hasExpenses = trip.expenses.length > 0;
const levels = activeSlots(slots);
const sortedExpenses = sortExpenses(trip.expenses, trip, levels);

setMenu(
```

Then inside `mainAction.onConfirm` for both `Duplicate` and `Delete`, change:

```ts
const e = trip.expenses[i];
```

to:

```ts
const e = sortedExpenses[i];
```

(There are two such lines — one in each `mainAction`.)

Finally, at the bottom of the component (the render section), replace:

```ts
const headers = EXPENSE_LIST_HEADERS;
const rows = buildExpenseListRows(trip, trip.expenses);

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
```

with:

```ts
const levels = activeSlots(slots);
const sortedExpenses = sortExpenses(trip.expenses, trip, levels);
const headers = buildSortedHeaders(EXPENSE_LIST_HEADERS, levels);
const rows = buildExpenseListRows(trip, sortedExpenses);

return (
    <TableSelect
        headers={headers}
        rows={rows}
        onChange={(rowIndex) => {
            const expense = sortedExpenses[rowIndex];
            if (!expense) return;
            goTo("/trips/expenses/form", {
                props: { tripDirPath: trip.dirPath, expenseId: expense.id },
            });
        }}
```

Note: `levels` and `sortedExpenses` are computed twice (once in the menu effect, once at render). This is fine — both are pure and the data is small. Memoization is unnecessary.

- [ ] **Step 4: Type-check, lint, test**

Run:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass. If lint complains about import order, run `bun run fix`.

- [ ] **Step 5: Manual smoke**

Run `bun run start --data-dir ./data`. Open a trip with expenses.

Verify:
- The expense list renders. Header shows `Date↓` (with the arrow appended). All other headers unchanged.
- Rows are ordered newest-date-first. (If the trip's expenses are already in date-desc order in YAML, you'll see the same rows; if not, the order will change — both are correct.)
- `[Enter]` on a row opens the expense form for the **correct** expense (the one visually selected in the sorted view). To stress-test, find a trip where YAML order differs from date-desc order, highlight a non-first row, press Enter, and confirm the form loads that row's expense.
- `[d]` then `[Enter]` (armed-duplicate) duplicates the highlighted row's expense.
- `[x]` then `[x]` deletes the highlighted row's expense.
- `[a] Add` still works.

Quit with `[e]`.

- [ ] **Step 6: Commit**

```bash
git add src/tui/states/expenseListSort.tsx src/tui/App.tsx src/tui/screens/ExpenseList.tsx
git commit -m "$(cat <<'EOF'
feat(tui): apply session-scoped sort to expense list

Adds ExpenseListSortProvider with a 5-slot sort state (default
slot 1 = Date desc). ExpenseList runs trip.expenses through
sortExpenses, adds an arrow indicator in the sorted column's
header, and resolves duplicate/delete/edit lookups via the
sorted view instead of the raw array.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sort builder screen + route + `[s] Sort` menu entry

Adds the `/trips/expenses/sort` screen with slot list, inline picker, direction toggling, and apply/cancel — and the entry point on `ExpenseList`.

**Files:**
- Modify: `src/tui/constants/hints.ts`
- Create: `src/tui/screens/ExpenseListSort.tsx`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Add hint constants**

Edit `src/tui/constants/hints.ts`. Append at the end:

```ts
export const SORT_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Edit slot" },
	{ key: "Space", label: "Direction" },
	{ key: "s", label: "Apply" },
	{ key: "q/esc", label: "Cancel" },
	{ key: "e", label: "Exit" },
];

export const SORT_PICKER_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Space", label: "Direction" },
	{ key: "Enter", label: "Confirm" },
	{ key: "esc", label: "Cancel" },
];
```

- [ ] **Step 2: Create the sort screen**

Create `src/tui/screens/ExpenseListSort.tsx`:

```tsx
import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { SortDir, SortKey } from "../../core/services/expense";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { SORT_HINTS, SORT_PICKER_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import {
	type Slot,
	SLOT_COUNT,
	useExpenseListSort,
} from "../states/expenseListSort";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

const COLUMN_ORDER: SortKey[] = [
	"date",
	"thb",
	"account",
	"owner",
	"category",
];

const COLUMN_LABEL: Record<SortKey, string> = {
	date: "Date",
	thb: "THB",
	account: "Account",
	owner: "Owner",
	category: "Category",
};

const DEFAULT_DIR: Record<SortKey, SortDir> = {
	date: "desc",
	thb: "desc",
	account: "asc",
	owner: "asc",
	category: "asc",
};

function dirArrow(dir: SortDir): string {
	return dir === "desc" ? "↓" : "↑";
}

type PickerOption =
	| { kind: "unset" }
	| { kind: "column"; key: SortKey; dir: SortDir };

interface PickerState {
	slotIndex: number;
	options: PickerOption[];
	cursor: number;
}

function buildPickerOptions(slots: Slot[], slotIndex: number): PickerOption[] {
	const current = slots[slotIndex] ?? null;
	const usedKeys = new Set<SortKey>();
	for (let i = 0; i < slots.length; i++) {
		if (i === slotIndex) continue;
		const s = slots[i];
		if (s) usedKeys.add(s.key);
	}
	const options: PickerOption[] = [{ kind: "unset" }];
	if (current) {
		options.push({ kind: "column", key: current.key, dir: current.dir });
	}
	for (const col of COLUMN_ORDER) {
		if (current && current.key === col) continue;
		if (usedKeys.has(col)) continue;
		options.push({ kind: "column", key: col, dir: DEFAULT_DIR[col] });
	}
	return options;
}

function initialPickerCursor(
	options: PickerOption[],
	current: Slot,
): number {
	if (current === null) return 0;
	const idx = options.findIndex(
		(o) => o.kind === "column" && o.key === current.key,
	);
	return idx === -1 ? 0 : idx;
}

export function ExpenseListSort(): JSX.Element {
	const { trip } = useData();
	const { slots, setSlots } = useExpenseListSort();
	const { focus, setFocus } = useFocus();
	const { setTitle, clearTitle, setHints, setColor } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();

	const initialSlotsRef = useRef<Slot[]>(slots);
	const [slotCursor, setSlotCursor] = useState(0);
	const [picker, setPicker] = useState<PickerState | null>(null);

	useEffect(() => {
		setTitle(tripTitle(trip, "Expenses", "Sort by"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		setMenu([], () => {});
		setHints(picker ? SORT_PICKER_HINTS : SORT_HINTS);
	}, [setColor, setMenu, setHints, picker]);

	function openPicker(slotIndex: number) {
		const options = buildPickerOptions(slots, slotIndex);
		const cursor = initialPickerCursor(options, slots[slotIndex] ?? null);
		setPicker({ slotIndex, options, cursor });
		setFocus("input");
	}

	function closePicker() {
		setPicker(null);
		setFocus("main");
	}

	function commitPicker() {
		if (!picker) return;
		const choice = picker.options[picker.cursor];
		if (!choice) {
			closePicker();
			return;
		}
		const next: Slot[] = [...slots];
		next[picker.slotIndex] =
			choice.kind === "unset" ? null : { key: choice.key, dir: choice.dir };
		setSlots(next);
		closePicker();
	}

	function togglePickerDir() {
		if (!picker) return;
		const opt = picker.options[picker.cursor];
		if (!opt || opt.kind !== "column") return;
		const newOptions = [...picker.options];
		newOptions[picker.cursor] = {
			kind: "column",
			key: opt.key,
			dir: opt.dir === "asc" ? "desc" : "asc",
		};
		setPicker({ ...picker, options: newOptions });
	}

	function toggleSlotDir() {
		const slot = slots[slotCursor];
		if (!slot) return;
		const next: Slot[] = [...slots];
		next[slotCursor] = {
			key: slot.key,
			dir: slot.dir === "asc" ? "desc" : "asc",
		};
		setSlots(next);
	}

	function cancelAll() {
		setSlots(initialSlotsRef.current);
		goBack();
	}

	function applyAll() {
		goBack();
	}

	// View-mode keys (focus = "main", picker closed)
	useInput(
		(input) => {
			if (input === " ") toggleSlotDir();
			else if (input === "s") applyAll();
		},
		{ isActive: focus === "main" && picker === null },
	);

	// Picker-mode keys (focus = "input", picker open)
	useInput(
		(input, key) => {
			if (!picker) return;
			if (input === " ") {
				togglePickerDir();
			} else if (key.upArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor > 0 ? picker.cursor - 1 : picker.options.length - 1,
				});
			} else if (key.downArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor < picker.options.length - 1 ? picker.cursor + 1 : 0,
				});
			} else if (key.return) {
				commitPicker();
			} else if (key.escape || input === "q") {
				closePicker();
			}
		},
		{ isActive: focus === "input" && picker !== null },
	);

	function renderSlotRow(i: number, selected: boolean): JSX.Element {
		const slot = slots[i];
		const label = slot
			? `${i + 1}. ${COLUMN_LABEL[slot.key]}  ${dirArrow(slot.dir)}`
			: `${i + 1}. <not set>`;
		return (
			<Text
				inverse={selected}
				{...(slot === null ? { dimColor: true } : {})}
			>
				{selected ? "> " : "  "}
				{label}
			</Text>
		);
	}

	function renderPicker(): JSX.Element {
		if (!picker) return <Text />;
		return (
			<Box flexDirection="column" marginLeft={4}>
				{picker.options.map((opt, idx) => {
					const selected = idx === picker.cursor;
					const text =
						opt.kind === "unset"
							? "<not set>"
							: `${COLUMN_LABEL[opt.key]}  ${dirArrow(opt.dir)}`;
					return (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: index is stable here
							key={idx}
							inverse={selected}
							{...(opt.kind === "unset" ? { dimColor: true } : {})}
						>
							{selected ? "> " : "  "}
							{text}
						</Text>
					);
				})}
			</Box>
		);
	}

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	return (
		<Box flexDirection="column">
			<VerticalSelect
				rowCount={SLOT_COUNT}
				renderRow={renderSlotRow}
				onChange={(i) => openPicker(i)}
				onHighlight={setSlotCursor}
				onCancel={cancelAll}
				isActive={focus === "main" && picker === null}
			/>
			{picker && renderPicker()}
		</Box>
	);
}
```

- [ ] **Step 3: Register the route**

Edit `src/tui/router.ts`. Add the import near the other expense screen imports:

```ts
import { ExpenseListSort } from "./screens/ExpenseListSort";
```

Add the route entry next to the other expense routes (e.g., after `/trips/expenses/duplicate`):

```ts
"/trips/expenses/sort": {
    component: ExpenseListSort,
},
```

- [ ] **Step 4: Add `[s] Sort` to ExpenseList's menu**

Edit `src/tui/screens/ExpenseList.tsx`. Find the existing menu setup (inside `setMenu([...], (value) => {...})`).

Add a new menu entry as the **first** item (before `Add`):

```ts
{ label: "Sort", value: "sort", key: "s" },
```

So the menu options array becomes:

```ts
setMenu(
    [
        { label: "Sort", value: "sort", key: "s" },
        { label: "Add", value: "add", key: "a" },
        ...(hasExpenses
            ? [
                    /* Duplicate, Delete as before */
                ]
            : []),
    ],
```

In the menu handler (the `(value) => {...}` callback), add a new clause **first**:

```ts
(value) => {
    if (value === "sort") {
        goTo("/trips/expenses/sort", { props: { tripDirPath } });
    } else if (value === "add") {
        goTo("/trips/expenses/form", { props: { tripDirPath } });
    } else if (value === "duplicate" && hasExpenses) {
        goTo("/trips/expenses/duplicate", { props: { tripDirPath } });
    } else if (value === "delete" && hasExpenses) {
        goTo("/trips/expenses/delete", { props: { tripDirPath } });
    }
},
```

Note: `[s]` is fine here because `ExpenseList` is not a form screen; the global form-submit key has no conflict.

- [ ] **Step 5: Type-check, lint, test**

Run:
```bash
bun run check:type
bun run check
bun test
```
Expected: all pass. Run `bun run fix` if Biome complains.

- [ ] **Step 6: Manual smoke**

Run `bun run start --data-dir ./data`. Open a trip with expenses.

Verify each in turn:

1. **Entry point.** The expense list menu now shows `[s] Sort` first. Press `[s]` → the sort screen opens. Title reads `Trips / <name> / Expenses / Sort by`. Five slot rows render with slot 1 = `Date ↓` and slots 2–5 = `<not set>` (dim). Hints show `[↑↓] Navigate  [Enter] Edit slot  [Space] Direction  [s] Apply  [q/esc] Cancel  [e] Exit`.

2. **Direction toggle in view mode.** With cursor on slot 1, press `[Space]` → slot 1 becomes `Date ↑`. Press `[Space]` again → back to `Date ↓`. Press `[Space]` on slot 2 (`<not set>`) → no change.

3. **Open picker.** Press `[Enter]` on slot 1 → picker overlay opens below. Hints switch to `[↑↓] Navigate  [Space] Direction  [Enter] Confirm  [esc] Cancel`. Cursor is on `Date ↓` (current value). Options also include `<not set>`, `THB ↓`, `Account ↑`, `Owner ↑`, `Category ↑`. (Date is shown because it's slot 1's current column; everything else is unused.)

4. **Picker direction toggle is local.** With cursor on `Date ↓`, press `[Space]` → option becomes `Date ↑`. Press `[esc]` → picker closes, slot 1 still reads `Date ↓` (local change reverted).

5. **Picker confirm.** Open slot 2's picker (`[↓]` to slot 2, `[Enter]`). Cursor on `<not set>` (slot 2 is unset). Press `[↓]` to highlight a column (e.g., `Account ↑`). Press `[Space]` → `Account ↓`. Press `[Enter]` → picker closes, slot 2 reads `Account ↓`.

6. **Hide already-used columns.** Re-open slot 2's picker → `Account` is **not** shown (it's slot 2's own current column, so it IS shown; verify by opening slot 3 instead, where `Account` should NOT appear because it's used in slot 2). Slot 3's picker should show: `<not set>`, `THB ↓`, `Owner ↑`, `Category ↑` (no Date, no Account).

7. **Apply and verify on expense list.** Setting slot 1 = `Account ↑`, slot 3 = `Date ↓`. Press `[s]` to apply → returns to expense list. Header now shows `Account↑₁` and `Date↓₂` (subscripts because there are two active sorts). Rows are ordered by account asc, then date desc within each account group.

8. **Hole in the middle.** Set slot 1 = `Date ↓`, slot 2 = `<not set>`, slot 3 = `Account ↑`. Apply. Header shows `Date↓₁  Account↑₂` (subscripts skip the hole). Expense rows reflect effective chain `[date desc, account asc]`.

9. **Cancel reverts.** From the sort screen, change a few slots. Press `[q]` → returns to expense list with the slots reverted to whatever they were when you opened the sort screen.

10. **Picker `<not set>` clears a slot.** Open a set slot's picker, highlight `<not set>` (it's the first option), press `[Enter]` → slot becomes `<not set>`. Apply → expense list header arrow for that column disappears.

11. **`[e] Exit` works everywhere** (global key).

Quit with `[e]`.

- [ ] **Step 7: Commit**

```bash
git add src/tui/constants/hints.ts src/tui/screens/ExpenseListSort.tsx src/tui/router.ts src/tui/screens/ExpenseList.tsx
git commit -m "$(cat <<'EOF'
feat(tui): sort builder screen for expense list

Adds /trips/expenses/sort with 5 fixed slots, inline column picker,
Space-direction toggle in both modes, and [s] Sort entry on the
expense list menu. Picker hides columns already in other slots.
Holes in the slot chain are skipped at sort time; header subscripts
number by position among active slots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

After completing all four tasks, confirm against the spec at `docs/superpowers/specs/2026-05-16-expense-list-multi-sort-design.md`:

- [ ] `sortExpenses` exists in `src/core/services/expense/sortExpenses.ts` with the documented per-key rules; tests cover each rule.
- [ ] `Slot[]` state with `DEFAULT_SLOTS = [Date desc, null, null, null, null]` lives in `src/tui/states/expenseListSort.tsx`. `activeSlots()` filters nulls.
- [ ] `ExpenseListSortProvider` is mounted in `App.tsx` inside `FormBufferProvider`.
- [ ] `buildExpenseListRows(trip, expenses)` signature; both call sites updated.
- [ ] `ExpenseList` renders `sortedExpenses`, shows arrow in header (`Date↓` for single, subscripts for multi-level), and looks up `sortedExpenses[i]` in `onChange`/Duplicate/Delete callbacks. `slots` is in the menu effect's dep array.
- [ ] `[s] Sort` menu entry on `ExpenseList`, visible regardless of expense count.
- [ ] `ExpenseListSort` screen registered at `/trips/expenses/sort`. Renders 5 slots, supports `↑↓ Enter Space s q/esc`. Picker hides columns in other slots, includes `<not set>` first, defaults direction per column, toggles direction locally with `Space`.
- [ ] `SORT_HINTS` and `SORT_PICKER_HINTS` constants added.
- [ ] `q/esc` reverts slots to the snapshot captured on mount; `[s]` applies.
- [ ] Missing-THB row sinks to the bottom on `thb` sort regardless of direction.
- [ ] Stable insertion-order tiebreak.
- [ ] `bun run check:type`, `bun run check`, `bun test` all green.
- [ ] Manual smoke covered: entry, direction toggle (view + picker), picker open/confirm/cancel, column-hide rule, multi-level with hole, apply, cancel revert, `<not set>` clears.

If anything fails, fix it before declaring done.
