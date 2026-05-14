# Expense List Table Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three columns to the expense list table — Owners (smart unique-prefix initials), Rate (resolved exchange rate), and THB (converted amount) — and apply a strict finance format (2-decimal thousand-sep numbers, right-aligned, currency-code suffix) to monetary cells.

**Architecture:** Pure helper `computeInitials` lives in `src/core/services/owner/` and computes shortest-unique-prefix names. `TableSelect`'s cell type widens from `string` to `{ text: string; color?: string }` so individual cells can be colored red (used for missing-rate `?`). `ExpenseList` builds rows with the new layout `Date | Account | Owners | Payee | Category | Amount | Rate | THB | Tags`, formats monetary columns with a per-column right-aligned numeric width, and reuses the same rows in both default and `selectMode === "duplicate"` views.

**Tech Stack:** React + Ink (TUI), TypeScript with `exactOptionalPropertyTypes: true`, Bun runtime + Bun test, Biome (lint+format).

**Spec:** `docs/superpowers/specs/2026-05-14-expense-list-table-columns-design.md`

---

## Conventions used in every task

- All paths are absolute from the repo root `/Users/kamontat/Documents/Personal/finmove`.
- Conventional-commit style matching recent history: `feat(core): ...`, `feat(tui): ...`, `refactor(tui): ...`.
- After implementation steps verify with `bun run check:type` and `bun run check`. If `bun run check` reports formatting errors run `bun run fix` and re-verify.
- Each task ends with a commit step. Stage files explicitly by name — no `git add -A`.

---

## Task 1: Add `computeInitials` helper

Adds a pure function in `core` that maps owner names to their shortest unique prefix, used by the TUI to render the Owners column compactly.

**Files:**
- Create: `src/core/services/owner/computeInitials.ts`
- Create: `src/core/services/owner/__tests__/computeInitials.test.ts`
- Modify: `src/core/services/owner/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/services/owner/__tests__/computeInitials.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { computeInitials } from "../computeInitials";

describe("computeInitials", () => {
	test("returns empty map for empty input", () => {
		expect(computeInitials([])).toEqual({});
	});

	test("single name maps to first character", () => {
		expect(computeInitials(["Alice"])).toEqual({ Alice: "A" });
	});

	test("two distinct first letters disambiguate at length 1", () => {
		expect(computeInitials(["Alice", "Bob"])).toEqual({
			Alice: "A",
			Bob: "B",
		});
	});

	test("shared first letter disambiguates at length 2", () => {
		expect(computeInitials(["Net", "Nid"])).toEqual({
			Net: "Ne",
			Nid: "Ni",
		});
	});

	test("three names with mixed disambiguation lengths", () => {
		expect(computeInitials(["Alice", "Aaron", "Bob"])).toEqual({
			Alice: "Al",
			Aaron: "Aa",
			Bob: "B",
		});
	});

	test("three names all sharing first letter disambiguate at length 2", () => {
		expect(computeInitials(["Net", "Nid", "Nan"])).toEqual({
			Net: "Ne",
			Nid: "Ni",
			Nan: "Na",
		});
	});

	test("identical names fall back to the full name", () => {
		expect(computeInitials(["Sam", "Sam"])).toEqual({ Sam: "Sam" });
	});

	test("one name is a prefix of another", () => {
		expect(computeInitials(["Sam", "Sammy"])).toEqual({
			Sam: "Sam",
			Sammy: "Samm",
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/core/services/owner/__tests__/computeInitials.test.ts
```

Expected: FAIL with "Cannot find module '../computeInitials'".

- [ ] **Step 3: Implement `computeInitials`**

Create `src/core/services/owner/computeInitials.ts`:

```ts
export function computeInitials(names: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const name of names) {
		const maxLen = Math.max(name.length, ...names.map((n) => n.length));
		let chosen = name;
		for (let k = 1; k <= maxLen; k++) {
			const prefix = name.slice(0, k);
			const collides = names.some(
				(other) => other !== name && other.slice(0, k) === prefix,
			);
			if (!collides) {
				chosen = prefix;
				break;
			}
		}
		result[name] = chosen;
	}
	return result;
}
```

Notes on the algorithm:
- For each name, find the smallest `k` (1..maxLen) where no *other* name in the list shares the same length-`k` prefix.
- If no such `k` exists (identical names, or one name is fully a prefix of another), fall back to the full `name`.
- The "other !== name" check is reference-style on strings; two identical strings still satisfy `other === name` if they are the same JS string reference, but the input is `string[]` and JS may intern, so the safer interpretation matters: when names are equal, no `k` ever yields uniqueness, and we fall through to the full-name fallback. The test case `["Sam", "Sam"]` pins this behavior down.

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/core/services/owner/__tests__/computeInitials.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Re-export from owner index**

Modify `src/core/services/owner/index.ts` — add the export line in alphabetical position:

```ts
export { addOwner } from "./addOwner";
export { computeInitials } from "./computeInitials";
export type { OwnerReferences } from "./findOwnerReferences";
export { findOwnerReferences } from "./findOwnerReferences";
export { getOwners } from "./getOwners";
export { removeOwner } from "./removeOwner";
export { updateOwner } from "./updateOwner";
```

- [ ] **Step 6: Verify type-check and lint**

```bash
bun run check:type
bun run check
```

Expected: both pass. If lint complains, run `bun run fix` and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/owner/computeInitials.ts src/core/services/owner/__tests__/computeInitials.test.ts src/core/services/owner/index.ts
git commit -m "$(cat <<'EOF'
feat(core): add computeInitials owner helper

Computes shortest unique-prefix labels across a list of names. Used by
the expense list to render the Owners column compactly.
EOF
)"
```

---

## Task 2: Migrate `TableSelect` to typed cell objects

Widens `TableSelect`'s row cell type from `string` to `{ text: string; color?: string }`. This is a breaking signature change; the only consumer (`ExpenseList.tsx`, two call sites) is migrated in the same commit so type-check stays green. No visual change in this task.

**Files:**
- Modify: `src/tui/components/molecules/TableSelect.tsx`
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Replace `TableSelect.tsx` with the typed-cell implementation**

Overwrite `src/tui/components/molecules/TableSelect.tsx` with:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { VerticalSelect } from "../atoms/VerticalSelect";

export interface TableCell {
	text: string;
	color?: string;
}

interface TableSelectProps {
	headers: string[];
	rows: TableCell[][];
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
			(max, row) => Math.max(max, (row[i]?.text ?? "").length),
			0,
		);
		return Math.max(h.length, maxData) + 2;
	});

	const padCell = (text: string, i: number): string =>
		text.padEnd(colWidths[i] ?? 0);

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold>
					{"  "}
					{headers.map((h, i) => padCell(h, i)).join("")}
				</Text>
			</Box>

			<VerticalSelect
				rowCount={rows.length}
				renderRow={(rowIdx, selected) => {
					const row = rows[rowIdx] ?? [];
					return (
						<Box>
							<Text inverse={selected}>{selected ? "> " : "  "}</Text>
							{headers.map((_, colIdx) => {
								const cell = row[colIdx] ?? { text: "" };
								const padded = padCell(cell.text, colIdx);
								return (
									<Text
										key={colIdx}
										inverse={selected}
										{...(cell.color ? { color: cell.color } : {})}
									>
										{padded}
									</Text>
								);
							})}
						</Box>
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

Note on `exactOptionalPropertyTypes`: the conditional spread `{...(cell.color ? { color: cell.color } : {})}` avoids passing `color: undefined` to Ink's `Text`, which would fail the strict optional check.

- [ ] **Step 2: Migrate `ExpenseList.tsx` row-build call sites to typed cells**

In `src/tui/screens/ExpenseList.tsx`, replace the `rows` builder (currently around lines 97-108) with:

```tsx
const headers = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
const rows = trip.expenses.map((e) => {
	const account = trip.accounts.find((a) => a.id === e.accountId);
	return [
		{ text: e.date },
		{ text: account?.name ?? e.accountId },
		{ text: e.payee },
		{ text: e.category },
		{ text: `${e.amount} ${e.currency}` },
		{ text: e.tags.length > 0 ? String(e.tags.length) : "" },
	];
});
```

No other lines in `ExpenseList.tsx` need to change in this task.

- [ ] **Step 3: Verify type-check and lint**

```bash
bun run check:type
bun run check
```

Expected: both pass. Run `bun run fix` if lint reports formatting issues.

- [ ] **Step 4: Smoke test the table renders**

```bash
bun test
```

Expected: existing test suite still passes (no new test in this task).

Manual: optional — launch `bun run start` on a trip with expenses, confirm the table renders identically to before (6 columns, same content). Skip if subagent-execution.

- [ ] **Step 5: Commit**

```bash
git add src/tui/components/molecules/TableSelect.tsx src/tui/screens/ExpenseList.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): widen TableSelect cells to typed objects

Cells now carry { text, color? } so individual cells can be colored.
ExpenseList is the only consumer and is migrated in the same commit.
No visual change.
EOF
)"
```

---

## Task 3: Add Owners, Rate, and THB columns with finance formatting

Adds the three new columns and applies the finance format rule (right-aligned 2-decimal thousand-sep numbers + currency suffix) to the Amount and THB columns. Uses `computeInitials` from Task 1 and the typed cell shape from Task 2. The same row data feeds both default and `selectMode === "duplicate"` views.

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Add imports for `computeInitials` and `convertToTHB`**

In `src/tui/screens/ExpenseList.tsx`, update the imports near the top:

```tsx
import { convertToTHB } from "../../core/services/currency";
import { removeExpense } from "../../core/services/expense";
import { computeInitials } from "../../core/services/owner";
```

(`removeExpense` import already exists — keep it. Add the two new ones alongside.)

- [ ] **Step 2: Add finance-format helpers above the component**

In `src/tui/screens/ExpenseList.tsx`, insert these module-level helpers just above `export function ExpenseList(): JSX.Element {`:

```tsx
import type { Expense, Trip } from "../../core/models";
import type { TableCell } from "../components/molecules/TableSelect";

function formatFinanceNumber(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function resolveRate(expense: Expense, trip: Trip): number | null {
	if (expense.currency === "THB") return null;
	if (expense.exchangeRate !== undefined) return expense.exchangeRate;
	const tripRate = trip.settings.currencies[expense.currency]?.exchangeRate;
	return tripRate ?? null;
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
```

The two `import type` lines go at the top of the file with the other imports — keep this snippet's body (the three functions) above the component.

- [ ] **Step 3: Replace the row builder with the nine-column version**

In `src/tui/screens/ExpenseList.tsx`, replace the `headers` and `rows` block from Task 2 with:

```tsx
const headers = [
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

const initialsMap = computeInitials(trip.owners.map((o) => o.name));

// First pass: compute raw numeric strings per row for the Amount and THB columns.
const numericData = trip.expenses.map((e) => {
	const amountNum = formatFinanceNumber(e.amount);

	const rate = resolveRate(e, trip);
	let thbNum: string;
	let thbMissing = false;
	if (e.currency === "THB") {
		thbNum = formatFinanceNumber(e.amount);
	} else if (rate !== null) {
		thbNum = formatFinanceNumber(convertToTHB(e.amount, e.currency, rate));
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

const rows: TableCell[][] = trip.expenses.map((e, i) => {
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
```

- [ ] **Step 4: Verify type-check and lint**

```bash
bun run check:type
bun run check
```

Expected: both pass. If lint reports issues, run `bun run fix` and re-verify.

- [ ] **Step 5: Run the test suite**

```bash
bun test
```

Expected: all tests pass — `computeInitials` (8 tests) plus the existing suite. No screen-level test added.

- [ ] **Step 6: Manual TUI verification**

Start the app and open a trip with at least:
- One THB expense.
- One non-THB expense with a per-expense rate.
- One non-THB expense with no per-expense rate but a trip-level fallback (set in trip settings → currencies).
- One non-THB expense with neither per-expense nor trip-level rate.
- Two owners whose names share a first letter (e.g. `Net`, `Nid`), with at least one expense that lists both.

```bash
bun run start
```

Verify in the expense list:
1. Column order is `Date | Account | Owners | Payee | Category | Amount | Rate | THB | Tags`.
2. Amount column right-aligns numbers; currency codes line up in a vertical column on the right of the numbers.
3. THB column right-aligns numbers; `THB` suffix on resolved rows.
4. Rate column shows `33.50`-style values, blank for THB rows, red `?` for rows with no resolvable rate.
5. THB column shows a red `?` (right-aligned within the column) for rows with no resolvable rate.
6. Owners cell shows e.g. `Ne, Ni` when both `Net` and `Nid` are on the expense.
7. ↑↓ navigation, Enter (edit), Tab, q/esc, and `[d] Duplicate` mode all still work; the duplicate-select view shows the same nine columns.

Report any deviation. If everything matches, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add Owners, Rate, THB columns to expense list

Adds smart unique-prefix owner initials, resolved exchange rate, and
THB-converted amount columns. Monetary cells use finance format
(right-aligned 2-decimal thousand-sep number with currency suffix).
Missing-rate cells render a red question mark.
EOF
)"
```

---

## Done criteria

- `bun test` green, including the 8 new `computeInitials` tests.
- `bun run check:type` clean.
- `bun run check` clean (no lint or format errors).
- ExpenseList table shows 9 columns in both the default and `selectMode === "duplicate"` views.
- Manual checks in Task 3 Step 6 all pass.
