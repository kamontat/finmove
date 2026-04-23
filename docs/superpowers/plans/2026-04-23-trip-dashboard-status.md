# Trip Dashboard Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-line summary on TripMenu with a rich multi-section dashboard showing trip phase, progress, spend totals, top categories, per-owner net balance, counts, and warnings.

**Architecture:** A pure `getTripStatus(trip, today)` derivation in `core/services/trip/` returns a `TripStatus` struct. A presentational `TripDashboard` organism in `tui/components/organisms/` renders the struct. TripMenu wires them together. Core is unit-tested with `bun:test`; UI is validated manually.

**Tech Stack:** TypeScript, Bun, React, Ink. Test runner: `bun:test`.

**Reference spec:** `docs/superpowers/specs/2026-04-23-trip-dashboard-status-design.md`

---

## Pre-flight

- [ ] **Step P.1: Verify baseline is green**

Run from repo root:
```bash
bun run check:type && bun run check && bun test
```
Expected: typecheck passes, biome reports no fixes, 66 tests pass.

---

## Task 1: `daysBetween` date helper

Computes the non-inclusive day count between two `YYYY-MM-DD` strings.

**Files:**
- Create: `src/core/services/date/daysBetween.ts`
- Create: `src/core/services/date/__tests__/daysBetween.test.ts`
- Modify: `src/core/services/date/index.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `src/core/services/date/__tests__/daysBetween.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { daysBetween } from "../daysBetween";

describe("daysBetween", () => {
	test("returns 0 for the same date", () => {
		expect(daysBetween("2026-04-20", "2026-04-20")).toBe(0);
	});

	test("returns positive difference for end after start", () => {
		expect(daysBetween("2026-04-20", "2026-04-25")).toBe(5);
	});

	test("returns negative difference when end is before start", () => {
		expect(daysBetween("2026-04-25", "2026-04-20")).toBe(-5);
	});

	test("handles month boundary", () => {
		expect(daysBetween("2026-04-29", "2026-05-02")).toBe(3);
	});

	test("handles year boundary", () => {
		expect(daysBetween("2025-12-30", "2026-01-02")).toBe(3);
	});
});
```

- [ ] **Step 1.2: Run the tests and verify they fail**

```bash
bun test src/core/services/date/__tests__/daysBetween.test.ts
```
Expected: tests fail (module not found).

- [ ] **Step 1.3: Implement `daysBetween`**

Create `src/core/services/date/daysBetween.ts`:

```ts
export function daysBetween(startDate: string, endDate: string): number {
	const start = new Date(`${startDate}T00:00:00`).getTime();
	const end = new Date(`${endDate}T00:00:00`).getTime();
	return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 1.4: Add the barrel export**

Edit `src/core/services/date/index.ts` — append:

```ts
export { daysBetween } from "./daysBetween";
```

- [ ] **Step 1.5: Run the tests and verify they pass**

```bash
bun test src/core/services/date/__tests__/daysBetween.test.ts
bun run check:type && bun run check
```
Expected: 5 tests pass, typecheck and lint clean.

- [ ] **Step 1.6: Commit**

```bash
git add src/core/services/date/daysBetween.ts src/core/services/date/__tests__/daysBetween.test.ts src/core/services/date/index.ts
git commit -m "feat(core): add daysBetween date helper"
```

---

## Task 2: `getTripStatus` — type + timeline derivation

Introduces the `TripStatus` shape and the phase/days portion. Other sections stay as zero/empty until later tasks fill them in.

**Files:**
- Create: `src/core/services/trip/getTripStatus.ts`
- Create: `src/core/services/trip/__tests__/getTripStatus.test.ts`

Helper for test fixtures (used across all `getTripStatus` tests):

```ts
import type { Trip } from "../../../models";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
	return {
		dirPath: "/tmp/trip",
		settings: {
			name: "Test Trip",
			startDate: "2026-04-15",
			endDate: "2026-04-30",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "./expenses.csv",
		},
		owners: [],
		accounts: [],
		expenses: [],
		...overrides,
	};
}
```

- [ ] **Step 2.1: Write failing timeline tests**

Create `src/core/services/trip/__tests__/getTripStatus.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
import { getTripStatus } from "../getTripStatus";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
	return {
		dirPath: "/tmp/trip",
		settings: {
			name: "Test Trip",
			startDate: "2026-04-15",
			endDate: "2026-04-30",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "./expenses.csv",
		},
		owners: [],
		accounts: [],
		expenses: [],
		...overrides,
	};
}

describe("getTripStatus — timeline", () => {
	test("upcoming when today is before start", () => {
		const s = getTripStatus(makeTrip(), "2026-04-10");
		expect(s.phase).toBe("upcoming");
		expect(s.totalDays).toBe(16);
		expect(s.elapsedDays).toBe(0);
		expect(s.remainingDays).toBe(16);
	});

	test("ongoing when today equals start", () => {
		const s = getTripStatus(makeTrip(), "2026-04-15");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(1);
		expect(s.remainingDays).toBe(15);
	});

	test("ongoing when today is between start and end", () => {
		const s = getTripStatus(makeTrip(), "2026-04-23");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(9);
		expect(s.remainingDays).toBe(7);
	});

	test("ongoing when today equals end", () => {
		const s = getTripStatus(makeTrip(), "2026-04-30");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(16);
		expect(s.remainingDays).toBe(0);
	});

	test("ended when today is after end", () => {
		const s = getTripStatus(makeTrip(), "2026-05-01");
		expect(s.phase).toBe("ended");
		expect(s.elapsedDays).toBe(16);
		expect(s.remainingDays).toBe(0);
	});

	test("single-day trip", () => {
		const s = getTripStatus(
			makeTrip({
				settings: {
					...makeTrip().settings,
					startDate: "2026-04-15",
					endDate: "2026-04-15",
				},
			}),
			"2026-04-15",
		);
		expect(s.phase).toBe("ongoing");
		expect(s.totalDays).toBe(1);
		expect(s.elapsedDays).toBe(1);
		expect(s.remainingDays).toBe(0);
	});

	test("propagates startDate, endDate, and countries", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				countries: ["Japan", "Korea"],
			},
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.startDate).toBe("2026-04-15");
		expect(s.endDate).toBe("2026-04-30");
		expect(s.countries).toEqual(["Japan", "Korea"]);
	});
});
```

- [ ] **Step 2.2: Run tests, verify they fail**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
```
Expected: fail (module not found).

- [ ] **Step 2.3: Implement timeline-only `getTripStatus`**

Create `src/core/services/trip/getTripStatus.ts`:

```ts
import type { Trip } from "../../models";
import { daysBetween } from "../date";

export interface TripStatus {
	phase: "upcoming" | "ongoing" | "ended";
	startDate: string;
	endDate: string;
	countries: string[];
	totalDays: number;
	elapsedDays: number;
	remainingDays: number;

	totalSpendThb: number;
	avgPerDayThb: number;
	expenseCount: number;
	byCurrency: { currency: string; amount: number }[];

	topCategories: { category: string; amountThb: number }[];
	categoryCount: { used: number; total: number };
	tagCount: { used: number; total: number };

	ownerBalances: { ownerId: string; name: string; balanceThb: number }[];
	accountCount: number;

	warnings: string[];
}

export function getTripStatus(trip: Trip, today: string): TripStatus {
	const { settings } = trip;
	const totalDays = daysBetween(settings.startDate, settings.endDate) + 1;

	let phase: TripStatus["phase"];
	let elapsedDays: number;
	if (today < settings.startDate) {
		phase = "upcoming";
		elapsedDays = 0;
	} else if (today > settings.endDate) {
		phase = "ended";
		elapsedDays = totalDays;
	} else {
		phase = "ongoing";
		elapsedDays = daysBetween(settings.startDate, today) + 1;
	}
	const remainingDays = totalDays - elapsedDays;

	return {
		phase,
		startDate: settings.startDate,
		endDate: settings.endDate,
		countries: settings.countries,
		totalDays,
		elapsedDays,
		remainingDays,
		totalSpendThb: 0,
		avgPerDayThb: 0,
		expenseCount: 0,
		byCurrency: [],
		topCategories: [],
		categoryCount: { used: 0, total: settings.categories.length },
		tagCount: { used: 0, total: settings.tags.length },
		ownerBalances: [],
		accountCount: trip.accounts.length,
		warnings: [],
	};
}
```

- [ ] **Step 2.4: Run tests, verify they pass**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
bun run check:type && bun run check
```
Expected: 7 timeline tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): add getTripStatus with timeline derivation"
```

---

## Task 3: Spend totals, byCurrency, missing-rate warning

**Files:**
- Modify: `src/core/services/trip/getTripStatus.ts`
- Modify: `src/core/services/trip/__tests__/getTripStatus.test.ts`

- [ ] **Step 3.1: Add failing spend tests**

Append to `src/core/services/trip/__tests__/getTripStatus.test.ts`:

```ts
describe("getTripStatus — spend", () => {
	test("sums THB expenses for total", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a",
						date: "2026-04-17",
						payee: "Y",
						category: "Food",
						amount: 750,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.totalSpendThb).toBe(1250);
		expect(s.expenseCount).toBe(2);
	});

	test("converts non-THB using expense exchangeRate", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 1000,
						currency: "JPY",
						exchangeRate: 0.23,
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.totalSpendThb).toBe(230);
	});

	test("falls back to trip-level exchange rate", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				currencies: { JPY: { exchangeRate: 0.25 } },
			},
			expenses: [
				{
					id: "e1",
					accountId: "a",
					date: "2026-04-16",
					payee: "X",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.totalSpendThb).toBe(250);
	});

	test("excludes expenses with missing rate and emits warning", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a",
						date: "2026-04-17",
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
		expect(s.totalSpendThb).toBe(500);
		expect(s.expenseCount).toBe(2);
		expect(s.warnings).toContain(
			"1 expense missing THB rate (excluded from totals)",
		);
	});

	test("pluralizes missing-rate warning", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "JPY",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a",
						date: "2026-04-17",
						payee: "Y",
						category: "Food",
						amount: 200,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.warnings).toContain(
			"2 expenses missing THB rate (excluded from totals)",
		);
	});

	test("computes avgPerDayThb on elapsed days, not total", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 900,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-23", // 9 elapsed days
		);
		expect(s.avgPerDayThb).toBe(100);
	});

	test("avgPerDayThb is 0 when upcoming", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-10",
		);
		expect(s.avgPerDayThb).toBe(0);
	});

	test("byCurrency aggregates original amounts, sorted desc", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				currencies: {
					JPY: { exchangeRate: 0.25 },
					KRW: { exchangeRate: 0.027 },
				},
			},
			expenses: [
				{
					id: "e1",
					accountId: "a",
					date: "2026-04-16",
					payee: "X",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
				{
					id: "e2",
					accountId: "a",
					date: "2026-04-16",
					payee: "Y",
					category: "Food",
					amount: 500,
					currency: "JPY",
					description: "",
					tags: [],
				},
				{
					id: "e3",
					accountId: "a",
					date: "2026-04-16",
					payee: "Z",
					category: "Food",
					amount: 10000,
					currency: "KRW",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.byCurrency).toEqual([
			{ currency: "KRW", amount: 10000 },
			{ currency: "JPY", amount: 1500 },
		]);
	});

	test("byCurrency still includes expenses with missing rate", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
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
		expect(s.byCurrency).toEqual([{ currency: "JPY", amount: 1000 }]);
	});
});
```

- [ ] **Step 3.2: Run tests, verify they fail**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
```
Expected: spend-related tests fail; timeline tests still pass.

- [ ] **Step 3.3: Implement spend derivation**

Replace the body of `getTripStatus` in `src/core/services/trip/getTripStatus.ts`. Full file:

```ts
import type { Expense, Settings, Trip } from "../../models";
import { convertToTHB } from "../currency";
import { daysBetween } from "../date";

export interface TripStatus {
	phase: "upcoming" | "ongoing" | "ended";
	startDate: string;
	endDate: string;
	countries: string[];
	totalDays: number;
	elapsedDays: number;
	remainingDays: number;

	totalSpendThb: number;
	avgPerDayThb: number;
	expenseCount: number;
	byCurrency: { currency: string; amount: number }[];

	topCategories: { category: string; amountThb: number }[];
	categoryCount: { used: number; total: number };
	tagCount: { used: number; total: number };

	ownerBalances: { ownerId: string; name: string; balanceThb: number }[];
	accountCount: number;

	warnings: string[];
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function tryConvertToTHB(expense: Expense, settings: Settings): number | null {
	try {
		const tripRate = settings.currencies[expense.currency]?.exchangeRate;
		return convertToTHB(
			expense.amount,
			expense.currency,
			expense.exchangeRate,
			tripRate,
		);
	} catch {
		return null;
	}
}

export function getTripStatus(trip: Trip, today: string): TripStatus {
	const { settings } = trip;
	const warnings: string[] = [];

	// --- Timeline ---
	const totalDays = daysBetween(settings.startDate, settings.endDate) + 1;
	let phase: TripStatus["phase"];
	let elapsedDays: number;
	if (today < settings.startDate) {
		phase = "upcoming";
		elapsedDays = 0;
	} else if (today > settings.endDate) {
		phase = "ended";
		elapsedDays = totalDays;
	} else {
		phase = "ongoing";
		elapsedDays = daysBetween(settings.startDate, today) + 1;
	}
	const remainingDays = totalDays - elapsedDays;

	// --- Spend ---
	let totalSpendThb = 0;
	let missingRateCount = 0;
	const currencyTotals = new Map<string, number>();

	for (const expense of trip.expenses) {
		currencyTotals.set(
			expense.currency,
			(currencyTotals.get(expense.currency) ?? 0) + expense.amount,
		);
		const thb = tryConvertToTHB(expense, settings);
		if (thb === null) {
			missingRateCount += 1;
		} else {
			totalSpendThb += thb;
		}
	}
	totalSpendThb = round2(totalSpendThb);

	const avgPerDayThb =
		elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;

	const byCurrency = [...currencyTotals.entries()]
		.map(([currency, amount]) => ({ currency, amount: round2(amount) }))
		.sort((a, b) => b.amount - a.amount);

	if (missingRateCount > 0) {
		warnings.push(
			`${missingRateCount} ${missingRateCount === 1 ? "expense" : "expenses"} missing THB rate (excluded from totals)`,
		);
	}

	return {
		phase,
		startDate: settings.startDate,
		endDate: settings.endDate,
		countries: settings.countries,
		totalDays,
		elapsedDays,
		remainingDays,
		totalSpendThb,
		avgPerDayThb,
		expenseCount: trip.expenses.length,
		byCurrency,
		topCategories: [],
		categoryCount: { used: 0, total: settings.categories.length },
		tagCount: { used: 0, total: settings.tags.length },
		ownerBalances: [],
		accountCount: trip.accounts.length,
		warnings,
	};
}
```

- [ ] **Step 3.4: Run tests, verify they pass**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
bun run check:type && bun run check
```
Expected: all spend + timeline tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): add spend totals and byCurrency to getTripStatus"
```

---

## Task 4: Top categories + category/tag counts

**Files:**
- Modify: `src/core/services/trip/getTripStatus.ts`
- Modify: `src/core/services/trip/__tests__/getTripStatus.test.ts`

- [ ] **Step 4.1: Add failing category tests**

Append to `src/core/services/trip/__tests__/getTripStatus.test.ts`:

```ts
describe("getTripStatus — categories and tags", () => {
	test("top categories sorted desc by THB amount", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: ["Food", "Transport", "Lodging"],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Transport",
					amount: 800,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "3",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Lodging",
					amount: 200,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.topCategories).toEqual([
			{ category: "Transport", amountThb: 800 },
			{ category: "Food", amountThb: 500 },
			{ category: "Lodging", amountThb: 200 },
		]);
	});

	test("collapses overflow into Other row", () => {
		const expenses = ["A", "B", "C", "D", "E", "F", "G"].map((cat, i) => ({
			id: `${i}`,
			accountId: "a",
			date: "2026-04-16",
			payee: "",
			category: cat,
			amount: 100 - i, // A=100, B=99, ... G=94
			currency: "THB" as const,
			description: "",
			tags: [] as string[],
		}));
		const s = getTripStatus(makeTrip({ expenses }), "2026-04-20");
		expect(s.topCategories).toHaveLength(6); // top 5 + Other
		expect(s.topCategories.at(-1)).toEqual({
			category: "Other",
			amountThb: 94 + 95, // F + G
		});
	});

	test("no Other row when five or fewer categories", () => {
		const expenses = ["A", "B", "C"].map((cat, i) => ({
			id: `${i}`,
			accountId: "a",
			date: "2026-04-16",
			payee: "",
			category: cat,
			amount: 100,
			currency: "THB" as const,
			description: "",
			tags: [] as string[],
		}));
		const s = getTripStatus(makeTrip({ expenses }), "2026-04-20");
		expect(s.topCategories.map((c) => c.category)).not.toContain("Other");
	});

	test("topCategories skips expenses with missing rate", () => {
		const trip = makeTrip({
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Mystery",
					amount: 9999,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.topCategories).toEqual([{ category: "Food", amountThb: 500 }]);
	});

	test("categoryCount tracks used vs total", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: ["Food", "Transport", "Lodging"],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 200,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.categoryCount).toEqual({ used: 1, total: 3 });
	});

	test("tagCount tracks distinct tags on expenses", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				tags: ["biz", "fun", "family"],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: ["biz", "fun"],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 200,
					currency: "THB",
					description: "",
					tags: ["fun"],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.tagCount).toEqual({ used: 2, total: 3 });
	});
});
```

- [ ] **Step 4.2: Run tests, verify they fail**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
```

- [ ] **Step 4.3: Implement category/tag aggregation**

In `src/core/services/trip/getTripStatus.ts`, insert the category accumulators into the main expense loop and compute `topCategories` + counts after the loop. Replace the existing expense loop and the post-loop section with:

```ts
	// --- Spend + Categories + Tags ---
	let totalSpendThb = 0;
	let missingRateCount = 0;
	const currencyTotals = new Map<string, number>();
	const categoryTotals = new Map<string, number>();
	const usedCategories = new Set<string>();
	const usedTags = new Set<string>();

	for (const expense of trip.expenses) {
		currencyTotals.set(
			expense.currency,
			(currencyTotals.get(expense.currency) ?? 0) + expense.amount,
		);
		usedCategories.add(expense.category);
		for (const tag of expense.tags) {
			usedTags.add(tag);
		}

		const thb = tryConvertToTHB(expense, settings);
		if (thb === null) {
			missingRateCount += 1;
		} else {
			totalSpendThb += thb;
			categoryTotals.set(
				expense.category,
				(categoryTotals.get(expense.category) ?? 0) + thb,
			);
		}
	}
	totalSpendThb = round2(totalSpendThb);

	const avgPerDayThb =
		elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;

	const byCurrency = [...currencyTotals.entries()]
		.map(([currency, amount]) => ({ currency, amount: round2(amount) }))
		.sort((a, b) => b.amount - a.amount);

	const sortedCategories = [...categoryTotals.entries()]
		.map(([category, amountThb]) => ({ category, amountThb: round2(amountThb) }))
		.sort((a, b) => b.amountThb - a.amountThb);

	const topCategories =
		sortedCategories.length <= 5
			? sortedCategories
			: [
					...sortedCategories.slice(0, 5),
					{
						category: "Other",
						amountThb: round2(
							sortedCategories
								.slice(5)
								.reduce((sum, c) => sum + c.amountThb, 0),
						),
					},
				];

	if (missingRateCount > 0) {
		warnings.push(
			`${missingRateCount} ${missingRateCount === 1 ? "expense" : "expenses"} missing THB rate (excluded from totals)`,
		);
	}
```

And update the returned object:
```ts
		topCategories,
		categoryCount: { used: usedCategories.size, total: settings.categories.length },
		tagCount: { used: usedTags.size, total: settings.tags.length },
```

- [ ] **Step 4.4: Run tests, verify they pass**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
bun run check:type && bun run check
```

- [ ] **Step 4.5: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): aggregate top categories and category/tag counts"
```

---

## Task 5: Owner balances + account warnings

Paid amount is split equally among the account's owners. Share comes from `calculateSplits`. Balance = paid − share.

**Files:**
- Modify: `src/core/services/trip/getTripStatus.ts`
- Modify: `src/core/services/trip/__tests__/getTripStatus.test.ts`

- [ ] **Step 5.1: Add failing owner-balance tests**

Append to `src/core/services/trip/__tests__/getTripStatus.test.ts`:

```ts
import { AccountType } from "../../../models";

describe("getTripStatus — owner balances", () => {
	test("single owner account + equal split", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "Alice's card",
					type: AccountType.Credit,
					owners: ["alice"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					// no owners → equal split among all
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		const bob = s.ownerBalances.find((o) => o.ownerId === "bob");
		expect(alice?.balanceThb).toBe(500); // paid 1000, share 500
		expect(bob?.balanceThb).toBe(-500); // paid 0, share 500
	});

	test("multi-owner account splits paid equally", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "Shared",
					type: AccountType.Credit,
					owners: ["alice", "bob"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["alice"], // full share to alice
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		const bob = s.ownerBalances.find((o) => o.ownerId === "bob");
		expect(alice?.balanceThb).toBe(-500); // paid 500, share 1000
		expect(bob?.balanceThb).toBe(500); // paid 500, share 0
	});

	test("balances preserved in owners list order", () => {
		const trip = makeTrip({
			owners: [
				{ id: "carol", name: "Carol" },
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "X",
					type: AccountType.Credit,
					owners: ["carol"],
				},
			],
			expenses: [],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.ownerBalances.map((o) => o.ownerId)).toEqual([
			"carol",
			"alice",
			"bob",
		]);
	});

	test("zero-owner account emits warning and excludes expense from paid", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "bad",
					name: "Orphan",
					type: AccountType.Credit,
					owners: [],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "bad",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"Account 'Orphan' has no owners — expenses not attributed",
		);
		// paid = 0 for both; share = 500 each
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		expect(alice?.balanceThb).toBe(-500);
	});

	test("expenses with missing rate are excluded from balance", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "acc1",
					name: "X",
					type: AccountType.Credit,
					owners: ["alice"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.ownerBalances[0]?.balanceThb).toBe(0);
	});

	test("empty owners list produces no balances", () => {
		const s = getTripStatus(makeTrip(), "2026-04-20");
		expect(s.ownerBalances).toEqual([]);
	});

	test("missing account reference is ignored for paid", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [],
			expenses: [
				{
					id: "e1",
					accountId: "ghost",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		// share still computed; paid is 0
		expect(s.ownerBalances[0]?.balanceThb).toBe(-1000);
	});
});
```

- [ ] **Step 5.2: Run tests, verify they fail**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
```

- [ ] **Step 5.3: Implement owner-balance logic**

In `src/core/services/trip/getTripStatus.ts`:

1. Add import at the top:
```ts
import { calculateSplits } from "../expense";
```

2. Inside the expense loop (after the null-check block), when `thb !== null`, also accumulate paid and share. Replace the `if (thb === null) … else … ` block with the extended version below, and declare the maps before the loop:

```ts
	// Owner balance accumulators
	const paid = new Map<string, number>();
	const share = new Map<string, number>();
	const orphanAccounts = new Set<string>();
```

Inside the loop, replace:
```ts
		} else {
			totalSpendThb += thb;
			categoryTotals.set(
				expense.category,
				(categoryTotals.get(expense.category) ?? 0) + thb,
			);
		}
```
with:
```ts
		} else {
			totalSpendThb += thb;
			categoryTotals.set(
				expense.category,
				(categoryTotals.get(expense.category) ?? 0) + thb,
			);

			const account = trip.accounts.find((a) => a.id === expense.accountId);
			if (account) {
				if (account.owners.length === 0) {
					orphanAccounts.add(account.name);
				} else {
					const paidShare = thb / account.owners.length;
					for (const ownerId of account.owners) {
						paid.set(ownerId, (paid.get(ownerId) ?? 0) + paidShare);
					}
				}
			}

			for (const { ownerId, amount } of calculateSplits(
				thb,
				expense.owners,
				trip.owners,
			)) {
				share.set(ownerId, (share.get(ownerId) ?? 0) + amount);
			}
		}
```

3. After the loop, compute balances and push account warnings:

```ts
	const ownerBalances = trip.owners.map((o) => ({
		ownerId: o.id,
		name: o.name,
		balanceThb: round2((paid.get(o.id) ?? 0) - (share.get(o.id) ?? 0)),
	}));

	for (const name of orphanAccounts) {
		warnings.push(`Account '${name}' has no owners — expenses not attributed`);
	}
```

4. Update the returned object's `ownerBalances`:
```ts
		ownerBalances,
```

- [ ] **Step 5.4: Run tests, verify they pass**

```bash
bun test src/core/services/trip/__tests__/getTripStatus.test.ts
bun run check:type && bun run check
```

- [ ] **Step 5.5: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): compute per-owner net balance with account warnings"
```

---

## Task 6: Barrel export + full-suite verification

**Files:**
- Modify: `src/core/services/trip/index.ts`

- [ ] **Step 6.1: Add exports**

Edit `src/core/services/trip/index.ts` — append:

```ts
export { getTripStatus } from "./getTripStatus";
export type { TripStatus } from "./getTripStatus";
```

- [ ] **Step 6.2: Run the full test suite and gates**

```bash
bun test
bun run check:type
bun run check
```
Expected: all tests pass (previous 66 + new getTripStatus + new daysBetween tests); typecheck and lint clean.

- [ ] **Step 6.3: Commit**

```bash
git add src/core/services/trip/index.ts
git commit -m "feat(core): re-export getTripStatus from trip barrel"
```

---

## Task 7: `TripDashboard` presentational component

Renders the full layout from a `TripStatus`. No unit tests — verified visually via TripMenu in Task 9.

**Files:**
- Create: `src/tui/components/organisms/TripDashboard.tsx`

- [ ] **Step 7.1: Create the component**

Create `src/tui/components/organisms/TripDashboard.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import type { TripStatus } from "../../../core/services/trip";

interface Props {
	status: TripStatus;
}

const PHASE_COLOR: Record<TripStatus["phase"], string> = {
	upcoming: "blue",
	ongoing: "green",
	ended: "gray",
};

const PHASE_LABEL: Record<TripStatus["phase"], string> = {
	upcoming: "Upcoming",
	ongoing: "Ongoing",
	ended: "Ended",
};

function formatThb(amount: number): string {
	return `฿${amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatOriginal(currency: string, amount: number): string {
	return `${currency} ${amount.toLocaleString("en-US")}`;
}

function StatusHeader({ status }: Props): JSX.Element {
	return (
		<Box>
			<Text bold color={PHASE_COLOR[status.phase]}>
				[{PHASE_LABEL[status.phase]}]
			</Text>
			<Text>
				{"  "}
				{status.startDate} — {status.endDate}
			</Text>
			{status.countries.length > 0 && (
				<Text dimColor>{`  |  ${status.countries.join(", ")}`}</Text>
			)}
		</Box>
	);
}

function ProgressBar({ status }: Props): JSX.Element {
	const width = 20;
	const filled = Math.max(
		0,
		Math.min(
			width,
			Math.round((status.elapsedDays / Math.max(status.totalDays, 1)) * width),
		),
	);
	const empty = width - filled;
	return (
		<Box>
			<Text>[</Text>
			<Text color="green">{"█".repeat(filled)}</Text>
			<Text dimColor>{"░".repeat(empty)}</Text>
			<Text>] </Text>
			<Text>
				{status.elapsedDays}/{status.totalDays} days ({status.remainingDays}{" "}
				left)
			</Text>
		</Box>
	);
}

function SectionHeader({ label }: { label: string }): JSX.Element {
	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{label}
			</Text>
			<Text dimColor>{"─".repeat(label.length)}</Text>
		</Box>
	);
}

function SpendBlock({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column" width={38}>
			<SectionHeader label="Spend" />
			<Box>
				<Text dimColor>Total</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.totalSpendThb)}</Text>
			</Box>
			<Box>
				<Text dimColor>Avg/day</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.avgPerDayThb)}</Text>
			</Box>
			<Box>
				<Text dimColor>Expenses</Text>
				<Text>{"  "}</Text>
				<Text bold>{status.expenseCount}</Text>
			</Box>
			{status.byCurrency.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text dimColor>By currency</Text>
						<Text>{"  "}</Text>
						{status.byCurrency[0] && (
							<Text>
								{formatOriginal(
									status.byCurrency[0].currency,
									status.byCurrency[0].amount,
								)}
							</Text>
						)}
					</Box>
					{status.byCurrency.slice(1).map((c) => (
						<Box key={c.currency}>
							<Text>{"             "}</Text>
							<Text>{formatOriginal(c.currency, c.amount)}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}

function CategoriesBlock({ status }: Props): JSX.Element {
	const max = Math.max(1, ...status.topCategories.map((c) => c.amountThb));
	const barWidth = 8;
	return (
		<Box flexDirection="column">
			<SectionHeader label="Top categories" />
			{status.topCategories.length === 0 ? (
				<Text dimColor>—</Text>
			) : (
				status.topCategories.map((c) => {
					const cells = Math.max(
						1,
						Math.round((c.amountThb / max) * barWidth),
					);
					return (
						<Box key={c.category}>
							<Text>{c.category.padEnd(12)}</Text>
							<Text bold>{formatThb(c.amountThb).padStart(10)}</Text>
							<Text>{"  "}</Text>
							<Text color="cyan">{"█".repeat(cells)}</Text>
						</Box>
					);
				})
			)}
		</Box>
	);
}

function formatSigned(amount: number): string {
	if (amount === 0) return formatThb(0);
	const sign = amount > 0 ? "+" : "−";
	return `${sign}${formatThb(Math.abs(amount))}`;
}

function OwnersBlock({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column" width={38}>
			<SectionHeader label="Owners" />
			{status.ownerBalances.map((o) => {
				const color =
					o.balanceThb > 0 ? "green" : o.balanceThb < 0 ? "red" : undefined;
				return (
					<Box key={o.ownerId}>
						<Text>{o.name.padEnd(14)}</Text>
						<Text bold {...(color ? { color } : { dimColor: true })}>
							{formatSigned(o.balanceThb)}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}

function CountsBlock({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column">
			<SectionHeader label="Counts" />
			<Box>
				<Text dimColor>Accounts</Text>
				<Text>{"    "}</Text>
				<Text bold>{status.accountCount}</Text>
			</Box>
			<Box>
				<Text dimColor>Categories</Text>
				<Text>{"  "}</Text>
				<Text bold>
					{status.categoryCount.used} used / {status.categoryCount.total} total
				</Text>
			</Box>
			<Box>
				<Text dimColor>Tags</Text>
				<Text>{"        "}</Text>
				<Text bold>
					{status.tagCount.used} used / {status.tagCount.total} total
				</Text>
			</Box>
		</Box>
	);
}

function WarningList({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column">
			{status.warnings.map((w) => (
				<Text key={w} color="yellow">
					⚠ {w}
				</Text>
			))}
		</Box>
	);
}

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

- [ ] **Step 7.2: Verify the file compiles and lints**

```bash
bun run check:type
bun run check
```
Expected: clean.

- [ ] **Step 7.3: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx
git commit -m "feat(tui): add TripDashboard organism"
```

---

## Task 8: Wire `TripDashboard` into `TripMenu`

Replace the one-line summary. Keep menu, hints, focus as-is.

**Files:**
- Modify: `src/tui/screens/TripMenu.tsx`

- [ ] **Step 8.1: Update TripMenu**

Read `src/tui/screens/TripMenu.tsx`. Replace the imports block so it reads:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { getTripStatus } from "../../core/services/trip";
import { today } from "../../core/services/date";
import { TripDashboard } from "../components/organisms/TripDashboard";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";
```

Replace the final `return (...)` block (currently the `<Text dimColor>{startDate}…</Text>` line) with:

```tsx
	return <TripDashboard status={getTripStatus(trip, today())} />;
```

Also remove the now-unused `const { settings } = trip;` line just above that return (`trip` is used directly).

- [ ] **Step 8.2: Run gates**

```bash
bun test
bun run check:type
bun run check
```
Expected: clean; 66 pre-existing tests + getTripStatus/daysBetween tests all pass.

- [ ] **Step 8.3: Manual verification**

Run the app:
```bash
bun run start --trip <existing-trip-slug>
```

Check:
- TripMenu renders the new dashboard (phase badge, progress bar, spend, categories, owners, counts).
- Arrow/shortcut keys still navigate the bottom menu (Owners, Accounts, Expenses, Settings).
- `q`/`esc` still returns to trip list.
- If the trip has an expense with no exchange rate, a yellow `⚠ N expense(s) missing THB rate …` line appears.

- [ ] **Step 8.4: Commit**

```bash
git add src/tui/screens/TripMenu.tsx
git commit -m "feat(tui): replace TripMenu summary with TripDashboard"
```

---

## Done

Final check:
```bash
bun test && bun run check:type && bun run check
git log --oneline -n 10
```
Expected: clean pipeline, ~8 new commits.
