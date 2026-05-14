# Duplicate Expense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users duplicate an existing expense by selecting it from the expense list; the duplicate opens as a pre-filled new expense form (all source fields except amount), and submitting creates a new expense without modifying the source.

**Architecture:** Mirrors the existing "Duplicate Trip" pattern on `TripList`. The list screen gains a `[d] Duplicate` menu entry that puts the screen into a `selectMode: "duplicate"` sub-view. Selecting a row navigates to the existing `ExpenseForm` route with a new `duplicateFromId` route prop. `ExpenseForm` reads that prop and uses the source expense's values as the form's default values (excluding `id` and `amount`); since `existingExpense` stays undefined, the existing submit path falls through to `addExpense` with a fresh id from `nextExpenseId`.

**Tech Stack:** TypeScript, React, Ink (terminal UI), Bun runtime, Biome for lint/format. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-14-duplicate-expense-design.md`

**Note on testing:** The codebase has unit tests for `src/core/services/` only; there are no Ink-component tests for `src/tui/screens/`. This feature does not change any core service, so the verification at each step is `bun run check:type` + `bun run check` and (at the end) a manual TUI walkthrough of the flow.

---

### Task 1: Extend route param types

**Files:**
- Modify: `src/tui/models/index.ts:30-31`

- [ ] **Step 1: Update `RouteParams` entries for `/trips/expenses` and `/trips/expenses/form`**

Open `src/tui/models/index.ts`. Find the existing block (around line 30):

```ts
	"/trips/expenses": { tripDirPath: string; selectMode?: "remove" };
	"/trips/expenses/form": { tripDirPath: string; expenseId?: string };
```

Replace with:

```ts
	"/trips/expenses": {
		tripDirPath: string;
		selectMode?: "remove" | "duplicate";
	};
	"/trips/expenses/form": {
		tripDirPath: string;
		expenseId?: string;
		duplicateFromId?: string;
	};
```

- [ ] **Step 2: Type-check**

Run: `bun run check:type`
Expected: passes with no errors. (The new union member and the new optional prop are backward compatible — existing call sites that don't pass them still type-check.)

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat(tui): extend expense route props for duplicate mode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `SELECT_DUPLICATE_HINTS` constant

**Files:**
- Modify: `src/tui/constants/hints.ts`

- [ ] **Step 1: Append the new hint set**

Open `src/tui/constants/hints.ts`. After the existing `SELECT_REMOVE_HINTS` declaration (line 18–23), add:

```ts
export const SELECT_DUPLICATE_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Duplicate" },
	{ key: "q/esc", label: "Back to list" },
	{ key: "e", label: "Exit" },
];
```

- [ ] **Step 2: Type-check**

Run: `bun run check:type`
Expected: passes.

- [ ] **Step 3: Lint**

Run: `bun run check`
Expected: passes (Biome will accept the file — formatting matches surrounding code).

- [ ] **Step 4: Commit**

```bash
git add src/tui/constants/hints.ts
git commit -m "feat(tui): add SELECT_DUPLICATE_HINTS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `ExpenseList` — menu entry + duplicate select-mode UI

This task adds the user-facing entry point and the duplicate-mode rendering branch in one commit, because each piece alone leaves the app in an incoherent state (a menu entry that navigates to an unhandled mode).

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Import the new hint constant**

Open `src/tui/screens/ExpenseList.tsx`. Change the existing hint import (line 7) from:

```ts
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
```

To:

```ts
import {
	LIST_HINTS,
	SELECT_DUPLICATE_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
```

- [ ] **Step 2: Add duplicate handling to the layout effect**

Find the existing layout effect (lines 32–73). The current `if (selectMode === "remove")` block looks like this:

```ts
		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}
```

Immediately after that block (before the `setBorderColor(null);` line that handles the default view), add:

```ts
		if (selectMode === "duplicate") {
			setBorderColor(null);
			setMenu([], () => {});
			setHints(SELECT_DUPLICATE_HINTS);
			return;
		}
```

- [ ] **Step 3: Add the Duplicate menu entry**

Still inside the same layout effect, find the default-view `setMenu(...)` call (currently around lines 47–63). Update the menu items array so a `Duplicate` entry is rendered when there are expenses, and add its handler clause. The current code:

```ts
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [{ label: "Remove", value: "remove", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/expenses/form", { props: { tripDirPath } });
				} else if (value === "remove" && hasExpenses) {
					goTo("/trips/expenses", {
						props: { tripDirPath, selectMode: "remove" },
					});
				}
			},
		);
```

Replace with:

```ts
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [
							{ label: "Duplicate", value: "duplicate", key: "d" },
							{ label: "Remove", value: "remove", key: "x" },
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/expenses/form", { props: { tripDirPath } });
				} else if (value === "duplicate" && hasExpenses) {
					goTo("/trips/expenses", {
						props: { tripDirPath, selectMode: "duplicate" },
					});
				} else if (value === "remove" && hasExpenses) {
					goTo("/trips/expenses", {
						props: { tripDirPath, selectMode: "remove" },
					});
				}
			},
		);
```

- [ ] **Step 4: Add the duplicate-mode rendering branch**

Find the existing `if (selectMode === "remove") { ... }` rendering block (lines 79–100). Immediately after that block (before `if (trip.expenses.length === 0)` for the default view at line 102), add:

```tsx
	if (selectMode === "duplicate") {
		if (trip.expenses.length === 0) {
			return <Text dimColor>No expenses.</Text>;
		}

		const dupHeaders = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
		const dupRows = trip.expenses.map((e) => {
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
					headers={dupHeaders}
					rows={dupRows}
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
					isActive
				/>
			</Box>
		);
	}
```

- [ ] **Step 5: Add the `Box` import**

The new JSX uses `Box`, which is not yet imported. Update the top-level Ink import (line 1):

```ts
import { Text } from "ink";
```

to:

```ts
import { Box, Text } from "ink";
```

- [ ] **Step 6: Type-check**

Run: `bun run check:type`
Expected: passes.

- [ ] **Step 7: Lint**

Run: `bun run check`
Expected: passes.

- [ ] **Step 8: Smoke-test manually**

Run: `bun run start` (open an existing trip with at least one expense, navigate to Expenses).

Verify:
- The menu shows `[a] Add  [d] Duplicate  [x] Remove` when expenses exist.
- The menu shows only `[a] Add` when there are no expenses.
- Pressing `[d]` switches to a view headed `Select an expense to duplicate:` with the same table; no red border.
- Pressing `[q]` / `[esc]` from duplicate-select returns to the list view without creating anything.
- Pressing `Enter` on a row navigates to the form (the form will not yet pre-fill anything until Task 4 lands — that is expected at this point).

- [ ] **Step 9: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "feat(tui): add duplicate menu and select mode to expense list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Support `duplicateFromId` in `ExpenseForm`

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Pull `setTitleSuffix` from `useLayout`**

Find the `useLayout()` destructure (line 23):

```ts
	const { setHints } = useLayout();
```

Replace with:

```ts
	const { setHints, setTitleSuffix } = useLayout();
```

- [ ] **Step 2: Read `duplicateFromId` from route props and resolve the source**

Find the route-prop destructure and `existingExpense` resolution (lines 25–26):

```ts
	const { expenseId, tripDirPath } = useRouteProps("/trips/expenses/form");
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);
```

Replace with:

```ts
	const { expenseId, tripDirPath, duplicateFromId } = useRouteProps(
		"/trips/expenses/form",
	);
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);
	const duplicateSource = duplicateFromId
		? trip?.expenses.find((e) => e.id === duplicateFromId)
		: undefined;
	const sourceForDefaults = existingExpense ?? duplicateSource;
	const isDuplicate = !existingExpense && !!duplicateSource;
```

- [ ] **Step 3: Compute `formId` for the duplicate case**

Find the `formId` line (line 28):

```ts
	const formId = expenseId ? `expense-edit-${expenseId}` : "expense-new";
```

Replace with:

```ts
	const formId = expenseId
		? `expense-edit-${expenseId}`
		: duplicateFromId
			? `expense-duplicate-${duplicateFromId}`
			: "expense-new";
```

- [ ] **Step 4: Set / clear the title suffix while in duplicate mode**

Immediately after the existing `useEffect` that calls `setHints` (lines 31–38), add a second effect:

```ts
	useEffect(() => {
		if (isDuplicate && duplicateSource) {
			setTitleSuffix(`Duplicate of: ${duplicateSource.payee}`);
		} else {
			setTitleSuffix(null);
		}
		return () => setTitleSuffix(null);
	}, [isDuplicate, duplicateSource, setTitleSuffix]);
```

- [ ] **Step 5: Extend the owners/tags pre-seed effect to cover duplicate mode**

Find the existing pre-seed effect (lines 41–52):

```ts
	useEffect(() => {
		if (!existingExpense) return;
		if (buffer.values["owners"] === undefined) {
			const ownerIds = Array.isArray(existingExpense.owners)
				? existingExpense.owners.map((o) => (typeof o === "string" ? o : o.id))
				: [];
			buffer.setField("owners", ownerIds);
		}
		if (buffer.values["tags"] === undefined) {
			buffer.setField("tags", existingExpense.tags);
		}
	}, [existingExpense, buffer]);
```

Replace with:

```ts
	useEffect(() => {
		const source = existingExpense ?? duplicateSource;
		if (!source) return;
		if (buffer.values["owners"] === undefined) {
			const ownerIds = Array.isArray(source.owners)
				? source.owners.map((o) => (typeof o === "string" ? o : o.id))
				: [];
			buffer.setField("owners", ownerIds);
		}
		if (buffer.values["tags"] === undefined) {
			buffer.setField("tags", source.tags);
		}
	}, [existingExpense, duplicateSource, buffer]);
```

- [ ] **Step 6: Update field defaults to fall back to `duplicateSource`**

Replace the entire `useMemo` returning `fields` (lines 54–162). Current:

```ts
	const fields = useMemo((): FormFieldConfig[] => {
		if (!trip) return [];

		const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

		return [
			{
				key: "account",
				label: "Account",
				type: "select",
				required: true,
				options: trip.accounts.map((a) => ({
					label: `${a.name} (${a.type})`,
					value: a.id,
				})),
				onEdit: () =>
					goTo("/trips/expenses/form/account", {
						props: { tripDirPath, formId, fieldKey: "account" },
					}),
				...(existingExpense ? { defaultValue: existingExpense.accountId } : {}),
			},
			{
				key: "date",
				label: "Date",
				type: "date",
				required: true,
				defaultValue: existingExpense?.date ?? today(),
			},
			{
				key: "payee",
				label: "Payee",
				type: "text",
				required: true,
				...(existingExpense ? { defaultValue: existingExpense.payee } : {}),
			},
			{
				key: "category",
				label: "Category",
				type: "select",
				required: true,
				options: trip.settings.categories.map((c) => ({
					label: c,
					value: c,
				})),
				onEdit: () =>
					goTo("/trips/expenses/form/category", {
						props: { tripDirPath, formId, fieldKey: "category" },
					}),
				...(existingExpense ? { defaultValue: existingExpense.category } : {}),
			},
			{
				key: "amount",
				label: "Amount",
				type: "text",
				required: true,
				...(existingExpense
					? { defaultValue: existingExpense.amount.toString() }
					: {}),
			},
			{
				key: "currency",
				label: "Currency",
				type: "select",
				required: true,
				options: allCurrencies.map((c) => ({ label: c, value: c })),
				onEdit: () =>
					goTo("/trips/expenses/form/currency", {
						props: { tripDirPath, formId, fieldKey: "currency" },
					}),
				defaultValue: existingExpense?.currency ?? "THB",
			},
			{
				key: "exchangeRate",
				label: "Exchange Rate (1 currency = ? THB)",
				type: "text",
				...(existingExpense?.exchangeRate !== undefined
					? { defaultValue: existingExpense.exchangeRate.toString() }
					: {}),
			},
			{
				key: "owners",
				label: "Owners",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/owners", {
						props: { tripDirPath, formId, fieldKey: "owners" },
					}),
			},
			{
				key: "description",
				label: "Description",
				type: "text",
				...(existingExpense
					? { defaultValue: existingExpense.description }
					: {}),
			},
			{
				key: "tags",
				label: "Tags",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/tags", {
						props: { tripDirPath, formId, fieldKey: "tags" },
					}),
			},
		];
	}, [trip, existingExpense, goTo, tripDirPath, formId]);
```

Replace with:

```ts
	const fields = useMemo((): FormFieldConfig[] => {
		if (!trip) return [];

		const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

		return [
			{
				key: "account",
				label: "Account",
				type: "select",
				required: true,
				options: trip.accounts.map((a) => ({
					label: `${a.name} (${a.type})`,
					value: a.id,
				})),
				onEdit: () =>
					goTo("/trips/expenses/form/account", {
						props: { tripDirPath, formId, fieldKey: "account" },
					}),
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.accountId }
					: {}),
			},
			{
				key: "date",
				label: "Date",
				type: "date",
				required: true,
				defaultValue: sourceForDefaults?.date ?? today(),
			},
			{
				key: "payee",
				label: "Payee",
				type: "text",
				required: true,
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.payee }
					: {}),
			},
			{
				key: "category",
				label: "Category",
				type: "select",
				required: true,
				options: trip.settings.categories.map((c) => ({
					label: c,
					value: c,
				})),
				onEdit: () =>
					goTo("/trips/expenses/form/category", {
						props: { tripDirPath, formId, fieldKey: "category" },
					}),
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.category }
					: {}),
			},
			{
				key: "amount",
				label: "Amount",
				type: "text",
				required: true,
				...(existingExpense
					? { defaultValue: existingExpense.amount.toString() }
					: {}),
			},
			{
				key: "currency",
				label: "Currency",
				type: "select",
				required: true,
				options: allCurrencies.map((c) => ({ label: c, value: c })),
				onEdit: () =>
					goTo("/trips/expenses/form/currency", {
						props: { tripDirPath, formId, fieldKey: "currency" },
					}),
				defaultValue: sourceForDefaults?.currency ?? "THB",
			},
			{
				key: "exchangeRate",
				label: "Exchange Rate (1 currency = ? THB)",
				type: "text",
				...(sourceForDefaults?.exchangeRate !== undefined
					? { defaultValue: sourceForDefaults.exchangeRate.toString() }
					: {}),
			},
			{
				key: "owners",
				label: "Owners",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/owners", {
						props: { tripDirPath, formId, fieldKey: "owners" },
					}),
			},
			{
				key: "description",
				label: "Description",
				type: "text",
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.description }
					: {}),
			},
			{
				key: "tags",
				label: "Tags",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/tags", {
						props: { tripDirPath, formId, fieldKey: "tags" },
					}),
			},
		];
	}, [trip, existingExpense, sourceForDefaults, goTo, tripDirPath, formId]);
```

Note: only the `amount` field still references `existingExpense` directly — that is intentional per the spec ("amount is left empty when duplicating"). All other copied fields fall back to `sourceForDefaults`, which is `existingExpense ?? duplicateSource`.

- [ ] **Step 7: Type-check**

Run: `bun run check:type`
Expected: passes. (`exactOptionalPropertyTypes` is on in this project — the conditional spread pattern is already what the existing code uses for optional defaultValue props, so the new code follows the same idiom.)

- [ ] **Step 8: Lint**

Run: `bun run check`
Expected: passes.

- [ ] **Step 9: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): pre-fill expense form from duplicate source

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Final verification

**Files:**
- None modified.

- [ ] **Step 1: Run the full type check**

Run: `bun run check:type`
Expected: passes.

- [ ] **Step 2: Run the linter**

Run: `bun run check`
Expected: passes.

- [ ] **Step 3: Run the unit tests**

Run: `bun test`
Expected: all existing tests pass (no service-layer changes were made; this is a regression check).

- [ ] **Step 4: Manual TUI walkthrough**

Run: `bun run start`

Walk through each scenario from the spec's Testing section:

1. **Basic duplicate creates a new expense:**
   Open a trip that has at least one expense. Expenses → `[d] Duplicate` → pick a row → confirm the form is pre-filled (account, date, payee, category, currency, exchange rate, owners, description, tags all match the source; amount is empty). The title bar shows `Duplicate of: <payee>`. Enter an amount, press `[s]`, return to the list. Expected: a new row appears with a fresh id, and the source row is unchanged.

2. **`[d]` is hidden when there are no expenses:**
   Open a trip with zero expenses. Expenses → menu shows only `[a] Add` (no `[d]`, no `[x]`).

3. **Cancel the duplicate-select step:**
   Expenses → `[d]` → press `[q]` (or `[esc]`). Expected: returns to the default list with no expense created.

4. **Cancel the form step after entering duplicate mode:**
   Expenses → `[d]` → pick a row → form opens pre-filled → press `[q]`. Expected: returns without creating an expense.

5. **Owners and tags pre-seed correctly:**
   Pick a source expense that has multiple owners and at least one tag. After entering duplicate mode and reaching the form, navigate into the Owners and Tags sub-pages and confirm the source's selections are pre-selected. Modify them, submit, and confirm the new expense reflects the modifications.

6. **Title suffix clears on leaving:**
   From the duplicate-form, press `[q]` back to the list. The title bar should not say `Duplicate of: ...` anymore.

- [ ] **Step 5: No commit required**

This task introduces no file changes. If the manual walkthrough surfaces an issue, fix it as a follow-up commit in the appropriate prior task's scope.

---

## Self-Review Notes

Run after writing — confirmed before handoff:

- **Spec coverage:** Every section of the spec maps to a task. Route-prop changes → Task 1. New hint constant → Task 2. ExpenseList menu + select-mode UI → Task 3. ExpenseForm pre-fill + title suffix + addExpense fall-through → Task 4. Testing section (manual walkthrough of all six scenarios) → Task 5.
- **Placeholder scan:** No "TBD" / "similar to..." / vague handlers. Every code-touching step shows the full code in place.
- **Type consistency:** `duplicateFromId` is declared in Task 1 as `duplicateFromId?: string` and consumed in Task 4 with that exact spelling. `sourceForDefaults` and `isDuplicate` are introduced together in Task 4 step 2 and used in steps 4–6 of the same task. `SELECT_DUPLICATE_HINTS` is declared in Task 2 and imported in Task 3.
