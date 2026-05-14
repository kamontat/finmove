# Spend Per Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-account spend breakdown block to the trip dashboard and reflow the dashboard's block grid using `flexWrap` so blocks adapt to terminal width.

**Architecture:** Extend the existing pure `getTripStatus` aggregator with a sorted `byAccount` array, then render it in a new `AccountsBlock` inside `TripDashboard.tsx`. The bottom of the dashboard becomes a single `flexWrap` row that holds all five blocks (Spend, Owners, Top categories, Accounts, Counts) at a fixed `width={38}` each.

**Tech Stack:** TypeScript, Bun test runner, React + Ink TUI.

**Spec:** `docs/superpowers/specs/2026-05-15-spend-per-account-design.md`

---

## File Structure

- **Modify:** `src/core/services/trip/getTripStatus.ts` — extend `TripStatus` with `byAccount`, accumulate per-account totals + counts in the existing expense loop.
- **Modify:** `src/core/services/trip/__tests__/getTripStatus.test.ts` — add a `describe("getTripStatus — byAccount", …)` block.
- **Modify:** `src/tui/components/organisms/TripDashboard.tsx` — add `AccountsBlock`, set explicit `width={38}` on `CategoriesBlock` and `CountsBlock`, replace the two row containers at the bottom with one `flexWrap` container.

No new files. No models, validators, or screen changes.

---

## Task 1: Extend `getTripStatus` with per-account aggregation

**Files:**
- Modify: `src/core/services/trip/getTripStatus.ts`
- Test: `src/core/services/trip/__tests__/getTripStatus.test.ts`

- [ ] **Step 1: Add the failing test block**

Append this new `describe` block to the end of `src/core/services/trip/__tests__/getTripStatus.test.ts` (before the final closing of the file — append after the last `describe(...)` block; do not nest):

```ts
describe("getTripStatus — byAccount", () => {
	const baseAccounts = [
		{ id: "acc-hsbc", name: "HSBC Credit", type: AccountType.Credit, owners: [] },
		{ id: "acc-bkk", name: "Bangkok Bank", type: AccountType.Debit, owners: [] },
	];

	test("sums totalThb and expenseCount per account, sorted desc by totalThb", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: baseAccounts,
				expenses: [
					{
						id: "e1",
						accountId: "acc-bkk",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 200,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "acc-hsbc",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e3",
						accountId: "acc-hsbc",
						date: "2026-04-17",
						payee: "Z",
						category: "Food",
						amount: 300,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "acc-hsbc",
				name: "HSBC Credit",
				type: AccountType.Credit,
				totalThb: 800,
				expenseCount: 2,
			},
			{
				accountId: "acc-bkk",
				name: "Bangkok Bank",
				type: AccountType.Debit,
				totalThb: 200,
				expenseCount: 1,
			},
		]);
	});

	test("breaks ties by name ascending", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Zeta", type: AccountType.Debit, owners: [] },
					{ id: "a2", name: "Alpha", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a2",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount.map((a) => a.name)).toEqual(["Alpha", "Zeta"]);
	});

	test("excludes configured accounts with zero spend", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Used", type: AccountType.Debit, owners: [] },
					{ id: "a2", name: "Unused", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount.map((a) => a.accountId)).toEqual(["a1"]);
	});

	test("excludes expenses referencing an unknown accountId", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Known", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "ghost",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 999,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Known",
				type: AccountType.Debit,
				totalThb: 100,
				expenseCount: 1,
			},
		]);
	});

	test("excludes expenses missing a usable THB rate", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Acc", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a1",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 1000,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Acc",
				type: AccountType.Debit,
				totalThb: 100,
				expenseCount: 1,
			},
		]);
	});

	test("byAccount is empty when there are no qualifying expenses", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Acc", type: AccountType.Debit, owners: [] },
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `bun test src/core/services/trip/__tests__/getTripStatus.test.ts`

Expected: 6 failures in the new "byAccount" describe block. The TypeScript compiler will also complain that `byAccount` does not exist on `TripStatus`.

- [ ] **Step 3: Update `TripStatus` and aggregation in `getTripStatus.ts`**

Open `src/core/services/trip/getTripStatus.ts`. Make three edits:

**Edit A — extend the imports** (top of file). Change:

```ts
import type { Expense, Settings, Trip } from "../../models";
```

to:

```ts
import type { AccountType, Expense, Settings, Trip } from "../../models";
```

**Edit B — extend the `TripStatus` interface.** Add the `byAccount` field after `accountCount`:

```ts
	ownerBalances: { ownerId: string; name: string; balanceThb: number }[];
	accountCount: number;
	byAccount: {
		accountId: string;
		name: string;
		type: AccountType;
		totalThb: number;
		expenseCount: number;
	}[];

	warnings: string[];
```

**Edit C — accumulate per-account aggregates in the existing expense loop and emit them.**

Just above the existing `for (const expense of trip.expenses) {` line, add a new map next to the other accumulators (this lives alongside `paid`, `share`, `orphanAccounts`, etc.):

```ts
	const accountAggregates = new Map<
		string,
		{ name: string; type: AccountType; totalThb: number; expenseCount: number }
	>();
```

Inside the loop, modify the existing `if (account)` block to also update the aggregates map. The full replacement for the `if (account)` block is:

```ts
				const account = trip.accounts.find((a) => a.id === expense.accountId);
				if (account) {
					const existing = accountAggregates.get(account.id);
					if (existing) {
						existing.totalThb += thb;
						existing.expenseCount += 1;
					} else {
						accountAggregates.set(account.id, {
							name: account.name,
							type: account.type,
							totalThb: thb,
							expenseCount: 1,
						});
					}
					if (account.owners.length === 0) {
						orphanAccounts.set(account.id, account.name);
					} else {
						const paidShare = thb / account.owners.length;
						for (const ownerId of account.owners) {
							if (knownOwnerIds.has(ownerId)) {
								paid.set(ownerId, (paid.get(ownerId) ?? 0) + paidShare);
							} else {
								unknownOwnerIds.add(ownerId);
							}
						}
					}
				}
```

After the loop, before the `return { ... }` statement, build the sorted array:

```ts
	const byAccount = [...accountAggregates.entries()]
		.map(([accountId, agg]) => ({
			accountId,
			name: agg.name,
			type: agg.type,
			totalThb: round2(agg.totalThb),
			expenseCount: agg.expenseCount,
		}))
		.sort((a, b) => {
			if (b.totalThb !== a.totalThb) return b.totalThb - a.totalThb;
			return a.name.localeCompare(b.name);
		});
```

Add `byAccount` to the returned object (place it next to `accountCount`):

```ts
		ownerBalances,
		accountCount: trip.accounts.length,
		byAccount,
		warnings,
```

- [ ] **Step 4: Run the full trip status test file and verify all tests pass**

Run: `bun test src/core/services/trip/__tests__/getTripStatus.test.ts`

Expected: all tests pass, including the 6 new `byAccount` tests and all pre-existing tests.

- [ ] **Step 5: Run typecheck**

Run: `bun run check:type`

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): compute per-account spend totals in getTripStatus"
```

---

## Task 2: Add `AccountsBlock` to `TripDashboard.tsx`

**Files:**
- Modify: `src/tui/components/organisms/TripDashboard.tsx`

This task only adds the component function; the dashboard composition is changed in Task 3. There is no `__tests__` directory for TUI components in this project — testing stays on the core derivation, matching project convention.

- [ ] **Step 1: Add the import for `AccountType`**

Open `src/tui/components/organisms/TripDashboard.tsx`. The current top of file is:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import type { TripStatus } from "../../../core/services/trip";
```

Add an `AccountType` import below the existing imports:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { AccountType } from "../../../core/models";
import type { TripStatus } from "../../../core/services/trip";
```

`AccountType` must be a regular (not type-only) import because it is used at runtime for `=== AccountType.Credit` comparison.

- [ ] **Step 2: Add the `AccountsBlock` component**

Add a new component function below `OwnersBlock` and above `CountsBlock`:

```tsx
function formatAccountName(name: string): string {
	if (name.length <= 12) return name.padEnd(12);
	return `${name.slice(0, 11)}…`;
}

function typeAbbrev(type: AccountType): string {
	return type === AccountType.Credit ? "Cr" : "Db";
}

function AccountsBlock({ status }: Props): JSX.Element {
	const max = Math.max(1, ...status.byAccount.map((a) => a.totalThb));
	const barWidth = 6;
	return (
		<Box flexDirection="column" width={38}>
			<SectionHeader label="Accounts" />
			{status.byAccount.length === 0 ? (
				<Text dimColor>—</Text>
			) : (
				status.byAccount.map((a) => {
					const cells = Math.max(
						1,
						Math.round((a.totalThb / max) * barWidth),
					);
					const countStr = `×${a.expenseCount}`.padStart(4);
					return (
						<Box key={a.accountId}>
							<Text>{formatAccountName(a.name)}</Text>
							<Text>{" "}</Text>
							<Text dimColor>({typeAbbrev(a.type)})</Text>
							<Text>{" "}</Text>
							<Text dimColor>{countStr}</Text>
							<Text>{" "}</Text>
							<Text bold>{formatThb(a.totalThb).padStart(10)}</Text>
							<Text>{" "}</Text>
							<Text color="magenta">{"█".repeat(cells)}</Text>
						</Box>
					);
				})
			)}
		</Box>
	);
}
```

- [ ] **Step 3: Run typecheck**

Run: `bun run check:type`

Expected: zero errors. (The component is defined but not yet rendered — that's fine.)

- [ ] **Step 4: Run lint**

Run: `bun run check`

Expected: zero errors. If a "function is unused" warning fires for `AccountsBlock`, it'll be cleared in Task 3 when we render it.

- [ ] **Step 5: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx
git commit -m "feat(tui): add AccountsBlock to trip dashboard"
```

---

## Task 3: Reflow dashboard with `flexWrap` and place all five blocks

**Files:**
- Modify: `src/tui/components/organisms/TripDashboard.tsx`

- [ ] **Step 1: Give `CategoriesBlock` and `CountsBlock` an explicit `width={38}`**

In `src/tui/components/organisms/TripDashboard.tsx`:

Find the start of `CategoriesBlock`:

```tsx
	return (
		<Box flexDirection="column">
			<SectionHeader label="Top categories" />
```

Replace with:

```tsx
	return (
		<Box flexDirection="column" width={38}>
			<SectionHeader label="Top categories" />
```

Find the start of `CountsBlock`:

```tsx
	return (
		<Box flexDirection="column">
			<SectionHeader label="Counts" />
```

Replace with:

```tsx
	return (
		<Box flexDirection="column" width={38}>
			<SectionHeader label="Counts" />
```

- [ ] **Step 2: Replace the two row containers with one `flexWrap` container**

Find the current dashboard composition at the bottom of the file:

```tsx
export function TripDashboard({ status }: Props): JSX.Element {
	const hasOwners = status.ownerBalances.length > 0;
	return (
		<Box flexDirection="column" gap={1}>
			<StatusHeader status={status} />
			<ProgressBar status={status} />

			<Box flexDirection="row" gap={2}>
				<SpendBlock status={status} />
				<CategoriesBlock status={status} />
			</Box>

			<Box flexDirection="row" gap={2}>
				{hasOwners && <OwnersBlock status={status} />}
				<CountsBlock status={status} />
			</Box>

			{status.warnings.length > 0 && <WarningList status={status} />}
		</Box>
	);
}
```

Replace with:

```tsx
export function TripDashboard({ status }: Props): JSX.Element {
	const hasOwners = status.ownerBalances.length > 0;
	const hasAccountSpend = status.byAccount.length > 0;
	return (
		<Box flexDirection="column" gap={1}>
			<StatusHeader status={status} />
			<ProgressBar status={status} />

			<Box flexDirection="row" flexWrap="wrap" gap={2}>
				<SpendBlock status={status} />
				{hasOwners && <OwnersBlock status={status} />}
				<CategoriesBlock status={status} />
				{hasAccountSpend && <AccountsBlock status={status} />}
				<CountsBlock status={status} />
			</Box>

			{status.warnings.length > 0 && <WarningList status={status} />}
		</Box>
	);
}
```

- [ ] **Step 3: Run typecheck**

Run: `bun run check:type`

Expected: zero errors.

- [ ] **Step 4: Run lint and tests**

Run: `bun run check && bun test`

Expected: zero lint errors, all tests pass.

- [ ] **Step 5: Smoke-test in the TUI**

Run the app against an existing data dir that has accounts and expenses:

```bash
bun run start
```

In the TUI, select a trip that has accounts and expenses, then verify on the trip overview:
- The "Accounts" block appears with one row per account that has spend.
- Rows are sorted by total THB descending.
- Each row shows: name (left-aligned, padded/truncated to 12), `(Cr)`/`(Db)`, `×N` count, THB total right-aligned, magenta bar.
- Resize the terminal: at narrow widths blocks wrap onto more rows; at wide widths up to four blocks sit side-by-side.

If anything looks off (column drift, bar not appearing, ordering wrong), stop and report — do not "fix" by tweaking widths without re-reading the spec.

- [ ] **Step 6: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx
git commit -m "feat(tui): reflow trip dashboard and surface per-account spend"
```

---

## Self-Review Notes

- **Spec coverage:** all six spec test cases map to Task 1 Step 1 (sorted desc, tie-break, zero-spend exclusion, orphan exclusion, missing-rate exclusion, empty case). The UI block matches the spec's column widths, type abbreviation, count format, amount alignment, bar color (magenta), and empty-state em-dash. The dashboard composition matches the spec's source order Spend → Owners → Top categories → Accounts → Counts.
- **Placeholders:** none. Each step shows exact code.
- **Type consistency:** `TripStatus.byAccount` shape matches between Task 1 (definition + tests) and Task 2 (consumption in `AccountsBlock`). `AccountType` is imported as a type in Task 1 Edit A and not separately re-imported in `TripDashboard.tsx` since the block consumes the `type` field via the `TripStatus["byAccount"][number]["type"]` indexed access.
