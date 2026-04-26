# ID Customization & Expense List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement custom IDs in create forms (Trips/Owners/Accounts), structured expense IDs, the `[e]→[p]` shortcut fix, and the Expense list redesign — backed by a `VerticalSelect`/`ListSelect`/`TableSelect` refactor.

**Architecture:** Five feature changes from the spec, ordered so each commit leaves the app green: (1) pure-function service additions first (TDD), (2) a one-line bugfix, (3) the `VerticalSelect` refactor with all call sites migrated atomically, (4) form-config extension, (5) the create-form ID fields, (6) the ExpenseList rewrite. Each task ends with `bun run check:type` + `bun test` (and a commit) to keep main shippable.

**Tech Stack:** Bun, TypeScript (`exactOptionalPropertyTypes: true`), React + Ink for TUI, Bun test runner (`bun:test`), Biome for lint/format.

---

## Task 1: Add `isValidSlug` helper

Reused by Owner/Account/Trip create-form validation in later tasks.

**Files:**
- Create: `src/core/services/slug/isValidSlug.ts`
- Modify: `src/core/services/slug/index.ts`
- Test: `src/core/services/slug/__tests__/slug.test.ts` (existing file — append cases)

- [ ] **Step 1: Write the failing test**

Append to `src/core/services/slug/__tests__/slug.test.ts`:

```ts
import { isValidSlug } from "../isValidSlug";

describe("isValidSlug", () => {
	test("accepts lowercase letters, digits, and hyphens", () => {
		expect(isValidSlug("alice")).toBe(true);
		expect(isValidSlug("alice-2")).toBe(true);
		expect(isValidSlug("japan-trip-2026")).toBe(true);
		expect(isValidSlug("a1b2-c3")).toBe(true);
	});

	test("rejects uppercase letters", () => {
		expect(isValidSlug("Alice")).toBe(false);
	});

	test("rejects spaces and other punctuation", () => {
		expect(isValidSlug("alice 2")).toBe(false);
		expect(isValidSlug("alice_2")).toBe(false);
		expect(isValidSlug("alice/bob")).toBe(false);
		expect(isValidSlug("alice.")).toBe(false);
	});

	test("rejects empty string", () => {
		expect(isValidSlug("")).toBe(false);
	});

	test("rejects unicode", () => {
		expect(isValidSlug("αlice")).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/slug/__tests__/slug.test.ts`
Expected: FAIL — `Cannot find module '../isValidSlug'`

- [ ] **Step 3: Implement `isValidSlug`**

Create `src/core/services/slug/isValidSlug.ts`:

```ts
export function isValidSlug(s: string): boolean {
	return /^[a-z0-9-]+$/.test(s);
}
```

- [ ] **Step 4: Re-export from barrel**

Edit `src/core/services/slug/index.ts` — add export:

```ts
export { isValidSlug } from "./isValidSlug";
```

(Preserve any existing exports.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/core/services/slug/__tests__/slug.test.ts`
Expected: PASS for all `isValidSlug` cases plus existing `toSlug`/`uniqueSlug` cases.

- [ ] **Step 6: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/slug/isValidSlug.ts src/core/services/slug/index.ts src/core/services/slug/__tests__/slug.test.ts
git commit -m "feat(core): add isValidSlug helper for ID validation"
```

---

## Task 2: Add `nextExpenseId` service

Pure function for the new expense ID format `exp-YYYYMMDD-id<n>`. Per-date counter, highest+1.

**Files:**
- Create: `src/core/services/expense/nextExpenseId.ts`
- Modify: `src/core/services/expense/index.ts`
- Test: `src/core/services/expense/__tests__/nextExpenseId.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/services/expense/__tests__/nextExpenseId.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Expense, Trip } from "../../../models";
import { nextExpenseId } from "../nextExpenseId";

function makeTrip(expenseIds: string[]): Trip {
	const expenses: Expense[] = expenseIds.map((id) => ({
		id,
		accountId: "a1",
		date: "2026-04-26",
		payee: "x",
		category: "x",
		amount: 0,
		currency: "THB",
		description: "",
		tags: [],
	}));
	return {
		dirPath: "/tmp",
		settings: {
			name: "t",
			startDate: "2026-04-26",
			endDate: "2026-04-26",
			countries: [],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "",
		},
		owners: [],
		accounts: [],
		expenses,
	};
}

describe("nextExpenseId", () => {
	test("returns id0 when no expenses exist", () => {
		const trip = makeTrip([]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("returns id0 when no expenses for that date", () => {
		const trip = makeTrip(["exp-20260425-id0", "exp-20260427-id5"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("returns highest+1 for the date", () => {
		const trip = makeTrip([
			"exp-20260426-id0",
			"exp-20260426-id1",
			"exp-20260426-id2",
		]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id3");
	});

	test("uses highest+1, not count, when ids have gaps", () => {
		const trip = makeTrip(["exp-20260426-id0", "exp-20260426-id2"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id3");
	});

	test("ignores legacy timestamp ids", () => {
		const trip = makeTrip(["exp-1714080000000", "exp-1714166400000"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("strips hyphens from input date", () => {
		const trip = makeTrip([]);
		expect(nextExpenseId(trip, "2026-12-31")).toBe("exp-20261231-id0");
	});

	test("counter is independent per date", () => {
		const trip = makeTrip([
			"exp-20260426-id0",
			"exp-20260426-id1",
			"exp-20260427-id0",
		]);
		expect(nextExpenseId(trip, "2026-04-27")).toBe("exp-20260427-id1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/expense/__tests__/nextExpenseId.test.ts`
Expected: FAIL — `Cannot find module '../nextExpenseId'`

- [ ] **Step 3: Implement `nextExpenseId`**

Create `src/core/services/expense/nextExpenseId.ts`:

```ts
import type { Trip } from "../../models";

export function nextExpenseId(trip: Trip, date: string): string {
	const datePart = date.replaceAll("-", "");
	const prefix = `exp-${datePart}-id`;
	const max = trip.expenses
		.map((e) => e.id)
		.filter((id) => id.startsWith(prefix))
		.map((id) => Number.parseInt(id.slice(prefix.length), 10))
		.filter((n) => !Number.isNaN(n))
		.reduce((acc, n) => Math.max(acc, n), -1);
	return `${prefix}${max + 1}`;
}
```

- [ ] **Step 4: Re-export from barrel**

Edit `src/core/services/expense/index.ts` — add export alongside existing exports:

```ts
export { nextExpenseId } from "./nextExpenseId";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/core/services/expense/__tests__/nextExpenseId.test.ts`
Expected: PASS — all 7 cases.

- [ ] **Step 6: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/expense/nextExpenseId.ts src/core/services/expense/index.ts src/core/services/expense/__tests__/nextExpenseId.test.ts
git commit -m "feat(core): add nextExpenseId for per-date sequential ids"
```

---

## Task 3: Wire `nextExpenseId` into `ExpenseForm`

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx:140`

- [ ] **Step 1: Update the import block**

Edit `src/tui/screens/ExpenseForm.tsx` — change the import line currently reading:

```ts
import { addExpense, updateExpense } from "../../core/services/expense";
```

to:

```ts
import { addExpense, nextExpenseId, updateExpense } from "../../core/services/expense";
```

- [ ] **Step 2: Replace the ID generation line**

In `src/tui/screens/ExpenseForm.tsx`, find:

```ts
const id = existingExpense?.id ?? `exp-${Date.now()}`;
```

Replace with:

```ts
const id =
	existingExpense?.id ?? nextExpenseId(trip, values["date"] ?? today());
```

(`today` is already imported on line 5.)

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): use nextExpenseId for new expense id format"
```

---

## Task 4: Rebind `[e]` → `[p]` for Expenses on Trip Overview

Fixes the conflict with global `[e]` Exit. One-liner.

**Files:**
- Modify: `src/tui/screens/TripOverview.tsx:25`

- [ ] **Step 1: Change the menu item key**

Edit `src/tui/screens/TripOverview.tsx`. Find:

```ts
{ label: "Expenses", value: "expenses", key: "e" },
```

Replace with:

```ts
{ label: "Expenses", value: "expenses", key: "p" },
```

- [ ] **Step 2: Audit for other `key: "e"` collisions**

Run: `grep -rn 'key: "e"' src/tui/screens src/tui/components`
Expected: zero hits. (If any appear, remap them to a non-reserved letter — reserved are `q`, `e`, `?`, `esc`, `s`, `tab`.)

Also check for `key: "q"`, `key: "?"`, `key: "esc"`:

Run: `grep -rEn 'key: "(q|\\?|esc)"' src/tui`
Expected: zero hits.

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripOverview.tsx
git commit -m "fix(tui): use [p] for Expenses to avoid global [e] Exit collision"
```

---

## Task 5: Refactor `VerticalSelect` to logic-only and introduce `ListSelect`

Atomic refactor: rewrite `VerticalSelect` with the new API and create `ListSelect` molecule preserving the old API. Migrate all eight call sites in the same commit so the codebase stays green.

**Files:**
- Modify: `src/tui/components/atoms/VerticalSelect.tsx` (full rewrite)
- Create: `src/tui/components/molecules/ListSelect.tsx`
- Modify: `src/tui/components/molecules/RemoveSelector.tsx`
- Modify: `src/tui/screens/OwnerList.tsx`
- Modify: `src/tui/screens/AccountList.tsx`
- Modify: `src/tui/screens/TripList.tsx`
- Modify: `src/tui/screens/CountryList.tsx`
- Modify: `src/tui/screens/CategoryList.tsx`
- Modify: `src/tui/screens/TagList.tsx`
- Modify: `src/tui/screens/CurrencyList.tsx`

- [ ] **Step 1: Rewrite `VerticalSelect` to logic-only**

Replace the entire contents of `src/tui/components/atoms/VerticalSelect.tsx` with:

```tsx
import { Box, useInput } from "ink";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

interface VerticalSelectProps {
	rowCount: number;
	renderRow: (index: number, selected: boolean) => ReactNode;
	onChange: (index: number) => void;
	onHighlight?: (index: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
}

export function VerticalSelect({
	rowCount,
	renderRow,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
}: VerticalSelectProps): JSX.Element {
	const [cursor, setCursor] = useState(0);

	useInput(
		(input, key) => {
			if (rowCount === 0) {
				if ((key.escape || input === "q") && onCancel) onCancel();
				return;
			}

			if (key.upArrow) {
				setCursor((c) => {
					const next = c > 0 ? c - 1 : rowCount - 1;
					if (onHighlight) onHighlight(next);
					return next;
				});
			} else if (key.downArrow) {
				setCursor((c) => {
					const next = c < rowCount - 1 ? c + 1 : 0;
					if (onHighlight) onHighlight(next);
					return next;
				});
			} else if (key.return) {
				if (cursor < rowCount) onChange(cursor);
			} else if ((key.escape || input === "q") && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	// Clamp cursor if rowCount shrinks below current cursor (e.g., after delete).
	const safeCursor = cursor >= rowCount ? Math.max(0, rowCount - 1) : cursor;

	return (
		<Box flexDirection="column">
			{Array.from({ length: rowCount }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable id here
				<Box key={i}>{renderRow(i, isActive && i === safeCursor)}</Box>
			))}
		</Box>
	);
}
```

Notes for the engineer:
- `VerticalSelect` no longer exports `VerticalOption`. Anyone importing it will need to switch — handled in the call-site migration steps below.
- The empty-state `<Text dimColor>No items.</Text>` from the previous version is now the caller's responsibility. All current call sites already gate empty-state rendering before invoking the component (see `OwnerList.tsx:95-97`, `AccountList.tsx:97-99`, etc.), so no behavior change.

- [ ] **Step 2: Create `ListSelect` molecule**

Create `src/tui/components/molecules/ListSelect.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface ListSelectProps {
	options: VerticalOption[];
	onChange: (value: string) => void;
	onHighlight?: (value: string) => void;
	onCancel?: () => void;
	isActive?: boolean;
	color?: string;
}

export function ListSelect({
	options,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
	color,
}: ListSelectProps): JSX.Element {
	return (
		<VerticalSelect
			rowCount={options.length}
			renderRow={(i, selected) => {
				const o = options[i];
				if (!o) return null;
				return (
					<Text
						inverse={selected}
						{...(color !== undefined ? { color } : {})}
					>
						{selected ? "> " : "  "}
						{o.label}
						{o.detail ? <Text dimColor={!selected}> {o.detail}</Text> : null}
					</Text>
				);
			}}
			onChange={(i) => {
				const o = options[i];
				if (o) onChange(o.value);
			}}
			{...(onHighlight
				? {
						onHighlight: (i: number) => {
							const o = options[i];
							if (o) onHighlight(o.value);
						},
					}
				: {})}
			{...(onCancel ? { onCancel } : {})}
			isActive={isActive}
		/>
	);
}
```

Notes:
- Conditional spreads on `onHighlight` and `onCancel` are required by `exactOptionalPropertyTypes: true` (per CLAUDE.md).

- [ ] **Step 3: Migrate `RemoveSelector` to use `ListSelect`**

Edit `src/tui/components/molecules/RemoveSelector.tsx` — change the import line:

```ts
import { VerticalSelect } from "../atoms/VerticalSelect";
```

to:

```ts
import { ListSelect } from "./ListSelect";
```

And in the JSX, change `<VerticalSelect ... />` to `<ListSelect ... />`. The full file becomes:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { ListSelect } from "./ListSelect";

interface RemoveSelectorProps {
	header: string;
	options: VerticalOption[];
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function RemoveSelector({
	header,
	options,
	onConfirm,
	onCancel,
}: RemoveSelectorProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<Text bold color="red">
				{header}
			</Text>
			<ListSelect
				options={options}
				onChange={onConfirm}
				onCancel={onCancel}
				color="red"
				isActive
			/>
		</Box>
	);
}
```

- [ ] **Step 4: Migrate `OwnerList` to use `ListSelect`**

Edit `src/tui/screens/OwnerList.tsx`. Change:

```ts
import { VerticalSelect } from "../components/atoms/VerticalSelect";
```

to:

```ts
import { ListSelect } from "../components/molecules/ListSelect";
```

And in the JSX (around line 100), change `<VerticalSelect` to `<ListSelect`. Closing tag is unchanged (self-closing JSX uses the opening name).

- [ ] **Step 5: Migrate `AccountList` to use `ListSelect`**

Edit `src/tui/screens/AccountList.tsx`. Change:

```ts
import { VerticalSelect } from "../components/atoms/VerticalSelect";
```

to:

```ts
import { ListSelect } from "../components/molecules/ListSelect";
```

And in the JSX (around line 102), change `<VerticalSelect` to `<ListSelect`.

- [ ] **Step 6: Migrate `TripList` to use `ListSelect`**

Edit `src/tui/screens/TripList.tsx`. Change:

```ts
import { VerticalSelect } from "../components/atoms/VerticalSelect";
```

to:

```ts
import { ListSelect } from "../components/molecules/ListSelect";
```

There are two `<VerticalSelect ...>` usages in this file (lines ~108 and ~138). Change both opening tags to `<ListSelect`.

- [ ] **Step 6b: Migrate the four settings list screens**

The same import-rename + tag-rename change applies to four more files. For each of these:

- `src/tui/screens/CountryList.tsx`
- `src/tui/screens/CategoryList.tsx`
- `src/tui/screens/TagList.tsx`
- `src/tui/screens/CurrencyList.tsx`

In each file:

1. Change the import line:
   ```ts
   import { VerticalSelect } from "../components/atoms/VerticalSelect";
   ```
   to:
   ```ts
   import { ListSelect } from "../components/molecules/ListSelect";
   ```

2. Find every `<VerticalSelect` opening tag in that file and change it to `<ListSelect` (there is typically one per file). Closing tags are self-closing JSX, so only the opening tag name changes.

After all four files are updated, the only remaining `VerticalSelect` import in the codebase should be inside `ListSelect.tsx` itself (and the atom's own self-export).

- [ ] **Step 7: Verify no other callers reference `VerticalSelect` directly**

Run: `grep -rn "from.*atoms/VerticalSelect\"" src/ --include='*.ts' --include='*.tsx'`
Expected: only one hit — `src/tui/components/molecules/ListSelect.tsx`.

Also: `grep -rn "VerticalOption" src/ --include='*.ts' --include='*.tsx'`
Expected: hits in the model file, `ListSelect.tsx`, and `RemoveSelector.tsx`. No other consumers should still be importing it from `VerticalSelect.tsx` directly.

If `VerticalSelect.tsx` previously re-exported `VerticalOption` (it did via `export type { VerticalOption } from "../../models";`), update any imports that came through it. Run:

`grep -rn 'from.*"../components/atoms/VerticalSelect"' src/ --include='*.tsx'`

For each hit, change the import to pull `VerticalOption` from `../models` (or `../../models` depending on depth) instead.

- [ ] **Step 8: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 9: Run all tests**

Run: `bun test`
Expected: all existing tests pass.

- [ ] **Step 10: Manually verify in the TUI**

Run: `bun run start`

Verify:
- Trip list: arrow keys move cursor with inverse highlight, Enter opens overview, `[c]` creates new trip.
- Inside a trip with owners: Owners screen shows list, Enter edits, `[x]` enters remove mode (red border, red rows), Esc exits remove mode.
- Same checks on Accounts.
- Trip duplicate flow (`[d]` from Trips list) shows the trip selector with red header.

If anything is visually different from before this refactor, fix it before continuing.

- [ ] **Step 11: Commit**

```bash
git add src/tui/components/atoms/VerticalSelect.tsx \
        src/tui/components/molecules/ListSelect.tsx \
        src/tui/components/molecules/RemoveSelector.tsx \
        src/tui/screens/OwnerList.tsx \
        src/tui/screens/AccountList.tsx \
        src/tui/screens/TripList.tsx \
        src/tui/screens/CountryList.tsx \
        src/tui/screens/CategoryList.tsx \
        src/tui/screens/TagList.tsx \
        src/tui/screens/CurrencyList.tsx
git commit -m "refactor(tui): split VerticalSelect into logic atom + ListSelect molecule"
```

---

## Task 6: Add `TableSelect` molecule

New molecule for the Expense list. No consumers yet — wired in Task 12.

**Files:**
- Create: `src/tui/components/molecules/TableSelect.tsx`

- [ ] **Step 1: Implement `TableSelect`**

Create `src/tui/components/molecules/TableSelect.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface TableSelectProps {
	headers: string[];
	rows: string[][];
	onChange: (rowIndex: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
}

export function TableSelect({
	headers,
	rows,
	onChange,
	onCancel,
	isActive = true,
}: TableSelectProps): JSX.Element {
	const colWidths = headers.map((h, i) => {
		const maxData = rows.reduce(
			(max, row) => Math.max(max, (row[i] ?? "").length),
			0,
		);
		return Math.max(h.length, maxData) + 2;
	});

	const formatRow = (cells: string[]): string =>
		cells
			.map((cell, i) => (cell ?? "").padEnd(colWidths[i] ?? 0))
			.join("");

	return (
		<Box flexDirection="column">
			{/* Header row — non-selectable, bold */}
			<Box>
				<Text bold>{"  "}{formatRow(headers)}</Text>
			</Box>

			<VerticalSelect
				rowCount={rows.length}
				renderRow={(i, selected) => {
					const row = rows[i] ?? [];
					return (
						<Text inverse={selected}>
							{selected ? "> " : "  "}
							{formatRow(row)}
						</Text>
					);
				}}
				onChange={onChange}
				{...(onCancel ? { onCancel } : {})}
				isActive={isActive}
			/>
		</Box>
	);
}
```

Notes:
- Column widths are computed once per render, including a `+2` cell padding (matches existing `DataTable` organism behavior).
- Header gets a leading `"  "` so it aligns with the data rows that have a `"> "` or `"  "` cursor prefix.
- Single-line `<Text inverse>` per row is required so Ink's inverse styling applies cleanly across the full row.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass (no new tests yet — this is a presentational molecule covered by integration in Task 12).

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/molecules/TableSelect.tsx
git commit -m "feat(tui): add TableSelect molecule for selectable tabular lists"
```

---

## Task 7: Extend `TextFormField.placeholder` to support a function

Foundation for dynamic placeholders showing live auto-generated IDs.

**Files:**
- Modify: `src/tui/models/index.ts:136-140`
- Modify: `src/tui/components/organisms/Form.tsx`

- [ ] **Step 1: Widen the type**

Edit `src/tui/models/index.ts`. Find:

```ts
export type TextFormField = FormFieldBase & {
	type: "text";
	defaultValue?: string;
	placeholder?: string;
};
```

Replace with:

```ts
export type TextFormField = FormFieldBase & {
	type: "text";
	defaultValue?: string;
	placeholder?: string | ((values: Record<string, string>) => string);
};
```

- [ ] **Step 2: Resolve placeholder once per render in `Form.tsx`**

Edit `src/tui/components/organisms/Form.tsx`. Inside the `fields.map((field, index) => { ... })` block, where `preview` is being computed (around lines 148-160), replace:

```ts
} else if (field.type === "text" && field.placeholder !== undefined) {
	preview = field.placeholder;
}
```

with:

```ts
} else if (field.type === "text" && field.placeholder !== undefined) {
	preview =
		typeof field.placeholder === "function"
			? field.placeholder(values)
			: field.placeholder;
}
```

Then in the same `field.type === "text"` editor block (around lines 193-206), where `<TextInput>` receives `placeholder`, replace:

```tsx
<TextInput
	{...(field.placeholder !== undefined
		? { placeholder: field.placeholder }
		: {})}
	...
/>
```

with:

```tsx
<TextInput
	{...(field.placeholder !== undefined
		? {
				placeholder:
					typeof field.placeholder === "function"
						? field.placeholder(values)
						: field.placeholder,
			}
		: {})}
	...
/>
```

(Preserve the surrounding props on `<TextInput>` — `defaultValue` conditional spread and `onSubmit`/`onCancel`.)

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: no errors. (Existing string-only placeholders like `"e.g. Alice"` continue to work since `string | (...) => string` accepts strings.)

- [ ] **Step 4: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/models/index.ts src/tui/components/organisms/Form.tsx
git commit -m "feat(tui): allow function placeholders in TextFormField for live previews"
```

---

## Task 8: Add custom ID field to `OwnerCreate`

**Files:**
- Modify: `src/tui/screens/OwnerCreate.tsx`

- [ ] **Step 1: Add the `id` field with dynamic placeholder + validation**

Replace the entire contents of `src/tui/screens/OwnerCreate.tsx` with:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { addOwner } from "../../core/services/owner";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	const takenIds = trip.owners.map((o) => o.id);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice",
		},
		{
			key: "id",
			label: "ID",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				if (name === "") return "auto-generate from name";
				return uniqueSlug(name, takenIds);
			},
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				const explicitId = (values["id"] ?? "").trim();
				const id =
					explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Owner ID "${id}" already exists.`);
				}

				addOwner(trip, { id, name });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

Notes:
- The placeholder function returns the live auto-generated ID based on the current `name` field value.
- If `id` is left blank, the auto-generated value is used (same as today's behavior).
- If `id` is provided, it's validated against `isValidSlug` and uniqueness. Errors thrown from `onSubmit` are caught by `Form`'s existing `error` state.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Manually verify**

Run: `bun run start`

Test:
- Create a trip, navigate to Owners, `[a]` Add. Type "Alice" in name. Move cursor to ID field — placeholder should show `(alice)`. Submit without filling ID — verify owner created with ID `alice`.
- Same flow, but type `bob-2` in ID. Submit — verify owner created with ID `bob-2`.
- Same flow, type `Alice` (capital) in ID. Submit — verify red error: `ID "Alice" is invalid. Use lowercase letters, digits, and hyphens.`
- Same flow, type `alice` in ID when `alice` already exists. Submit — verify red error: `Owner ID "alice" already exists.`

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/OwnerCreate.tsx
git commit -m "feat(tui): add optional id field with validation to OwnerCreate"
```

---

## Task 9: Add custom ID field to `AccountCreate`

**Files:**
- Modify: `src/tui/screens/AccountCreate.tsx`

- [ ] **Step 1: Add the `id` field with dynamic placeholder + validation**

Replace the entire contents of `src/tui/screens/AccountCreate.tsx` with:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	const takenIds = trip.accounts.map((a) => a.id);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice's Visa",
		},
		{
			key: "id",
			label: "ID",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				if (name === "") return "auto-generate from name";
				return uniqueSlug(name, takenIds);
			},
		},
		{
			key: "type",
			label: "Account Type",
			type: "select",
			required: true,
			options: [
				{ label: "Credit", value: "Credit" },
				{ label: "Debit", value: "Debit" },
			],
			defaultValue: "Credit",
		},
		{
			key: "owners",
			label: "Owner IDs (comma-separated)",
			type: "text",
			required: true,
			placeholder: "e.g. alice,bob",
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				const explicitId = (values["id"] ?? "").trim();
				const id =
					explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Account ID "${id}" already exists.`);
				}

				const ownersStr = values["owners"] ?? "";
				const owners = ownersStr.split(",").map((s) => s.trim());

				addAccount(trip, {
					id,
					name,
					type: (values["type"] ?? "Credit") as AccountType,
					owners,
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Manually verify**

Run: `bun run start`

Test the same scenarios as Task 8 — submit blank ID (auto), submit valid custom ID, invalid format ID, duplicate ID.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/AccountCreate.tsx
git commit -m "feat(tui): add optional id field with validation to AccountCreate"
```

---

## Task 10: Add custom `dirName` field to `TripCreate`

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Add the `dirName` field with dynamic placeholder + validation**

Replace the entire contents of `src/tui/screens/TripCreate.tsx` with:

```tsx
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const DEFAULT_SETTINGS: Omit<Settings, "name" | "startDate" | "endDate"> = {
	countries: [],
	baseCurrency: "THB",
	currencies: {},
	categories: [
		"Flight",
		"Hotels",
		"Transportation",
		"Shopping",
		"Eating",
		"Activities",
	],
	tags: [],
	exportPath: "./expenses.csv",
};

export function TripCreate(): JSX.Element {
	const { goTo } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const { dataDir = "./data" } = useRouteProps("/trips/new");

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Trip Name",
			type: "text",
			required: true,
			placeholder: "e.g. Japan Trip",
		},
		{
			key: "dirName",
			label: "Directory Name",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				const startDate = values["startDate"] ?? today();
				if (name === "") return "auto-generate from name + start year";
				return toDirName(name, startDate);
			},
		},
		{
			key: "startDate",
			label: "Start Date",
			type: "date",
			required: true,
			defaultValue: today(),
		},
		{
			key: "endDate",
			label: "End Date",
			type: "date",
			required: true,
			defaultValue: addDays(today(), 1),
		},
	];

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = values["name"] ?? "";
					const startDate = values["startDate"] ?? today();
					const endDate = values["endDate"] ?? addDays(today(), 1);
					const explicitDirName = (values["dirName"] ?? "").trim();
					const dirName =
						explicitDirName === ""
							? toDirName(name, startDate)
							: explicitDirName;

					if (!isValidSlug(dirName)) {
						setError(
							`Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
						);
						return;
					}

					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip directory "${dirName}" already exists`);
						return;
					}
					setError(null);
					const settings: Settings = {
						...DEFAULT_SETTINGS,
						name,
						startDate,
						endDate,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
					goTo("/trips/overview", {
						replace: true,
						props: {
							tripDirPath: newTrip.dirPath,
							tripName: name,
							dataDir,
						},
					});
				}}
			/>
		</Box>
	);
}
```

Notes:
- `fields` is now built inside the component (was previously a module-level constant) so the placeholder closure can reference no external state — but we keep it inline for consistency with the OwnerCreate / AccountCreate pattern.
- `setError` is used (rather than throwing) because that's the existing TripCreate pattern; the error renders above the form, not via the `Form`'s internal error state.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Manually verify**

Run: `bun run start`

Test:
- Create a trip with name "Japan Trip", start 2026-04-26. Move to directory name field — placeholder shows `(japan-trip-2026)`. Submit without filling — verify directory `japan-trip-2026` is created.
- Create another trip with name "Japan Trip" but explicit directory `japan-2`. Submit — verify directory `japan-2` is created.
- Create a trip with explicit directory `Japan_Trip` (invalid). Submit — verify red error: `Directory name "Japan_Trip" is invalid. ...`
- Create a trip with directory matching an existing one. Submit — verify red error: `Trip directory "..." already exists`.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/TripCreate.tsx
git commit -m "feat(tui): add optional directory name field with validation to TripCreate"
```

---

## Task 11: Add `selectMode` to `/trips/expenses` route params

Foundation for the ExpenseList rewrite in Task 12.

**Files:**
- Modify: `src/tui/models/index.ts:28`

- [ ] **Step 1: Widen the route params type**

Edit `src/tui/models/index.ts`. Find:

```ts
"/trips/expenses": { tripDirPath: string };
```

Replace with:

```ts
"/trips/expenses": { tripDirPath: string; selectMode?: "remove" };
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors. (Existing `goTo("/trips/expenses", { props: { tripDirPath } })` calls remain valid since `selectMode` is optional.)

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat(tui): add selectMode to /trips/expenses route params"
```

---

## Task 12: Rewrite `ExpenseList` with `TableSelect`

Final task: replace the DataTable + per-expense `Edit:` menu items with a `TableSelect` + Add/Remove menu, mirroring `AccountList`.

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `ExpenseList`**

Replace the entire contents of `src/tui/screens/ExpenseList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeExpense } from "../../core/services/expense";
import { TableSelect } from "../components/molecules/TableSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function ExpenseList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { selectMode } = useRouteProps("/trips/expenses");

	useEffect(() => {
		if (!trip || selectMode) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, selectMode, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
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
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (selectMode === "remove") {
		if (trip.expenses.length === 0) {
			return <Text dimColor>No expenses.</Text>;
		}
		return (
			<RemoveSelector
				header="Select an expense to remove:"
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
				onCancel={goBack}
			/>
		);
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
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

Notes:
- Mirrors `AccountList.tsx` structure exactly: same `useEffect` shape for focus + menu/hints, same `selectMode === "remove"` branch.
- The Remove flow uses `RemoveSelector` (which uses `ListSelect` internally), label = payee, detail = `(date · amount currency)`. Tabular display in the main view; row-based display in the remove mode (matches Owners/Accounts UX).
- The old `Edit:` per-expense menu items are gone — selection via `TableSelect.onChange` replaces them.
- `removeExpense` is imported from the service barrel; verify it's exported there (it is, as of the spec — see `src/core/services/expense/index.ts`).

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Manually verify**

Run: `bun run start`

In a trip with several expenses:
- Open Expenses (via `[p]` from Trip Overview, fixed in Task 4). Verify a tabular layout: header row (bold) + one row per expense, columns aligned, no `#` column.
- Press `↑↓` — cursor row inverse-highlighted.
- Press Enter on a row — opens ExpenseForm in edit mode for that expense.
- `[a]` — opens new ExpenseForm. Submit a new expense; verify ID format `exp-YYYYMMDD-id<n>` in the YAML file.
- `[x]` — enters remove mode (red border, `RemoveSelector`-style list with red rows). Select one — expense removed, list refreshes, stays in remove mode.
- Esc from remove mode — returns to list mode.
- Delete the last expense from remove mode — auto-returns to list mode (now showing "No expenses yet.").

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "feat(tui): redesign ExpenseList with TableSelect and Add/Remove menu"
```

---

## Self-Review Notes

The plan covers every requirement of the spec:

| Spec section | Covered by |
|---|---|
| Section A — Custom IDs in create forms | Task 1 (`isValidSlug`), Task 7 (function-placeholder support), Task 8 (Owner), Task 9 (Account), Task 10 (Trip) |
| Section B — Trip Overview shortcut fix | Task 4 |
| Section C — Expense ID format | Task 2 (`nextExpenseId` + tests), Task 3 (wire into form) |
| Section D — VerticalSelect refactor | Task 5 (atom rewrite + ListSelect), Task 6 (TableSelect) |
| Section E — ExpenseList redesign | Task 11 (`selectMode` route param), Task 12 (full screen rewrite) |

No placeholders, no `// TODO`s, every code block is complete. Type signatures cross-check between tasks (e.g., `nextExpenseId(trip, date)` defined in Task 2 is called in Task 3 with the same signature; `isValidSlug` from Task 1 is used in Tasks 8/9/10).

Build sequence ordering keeps `main` green at every commit:
- Tasks 1, 2 — pure additions, no consumers.
- Task 3 — replaces internal expense ID generation, doesn't change interface.
- Task 4 — one-line shortcut fix.
- Task 5 — atomic refactor with all migrations in one commit.
- Task 6 — pure addition.
- Task 7 — type widening, fully backwards compatible (`string` is assignable to `string | function`).
- Tasks 8-10 — depend on Tasks 1 and 7.
- Task 11 — type widening, backwards compatible.
- Task 12 — depends on Tasks 5, 6, 11.
