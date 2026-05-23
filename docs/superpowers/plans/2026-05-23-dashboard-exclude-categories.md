# Dashboard Exclude Categories + Per-Person Averages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `Settings.categories` from `string[]` to `Category[]` (with `excluded` flag) and surface 4 new dashboard fields: total/avg-per-day excluding flagged categories, plus per-person variants of avg-per-day.

**Architecture:** Schema bump v1 → v2 with auto migration. Boolean `excluded` per category drives a second total in `TripStatus`. `SpendBlock` conditionally renders extra rows. Category create/edit forms gain a boolean field; list shows `[✓]`/`[ ]` marker.

**Tech Stack:** TypeScript, Bun test runner, React + Ink TUI, zod schemas.

**Spec:** `docs/superpowers/specs/2026-05-23-dashboard-exclude-categories-design.md`

---

## File Structure

**New:**
- `src/core/models/category.ts` — `Category` type
- `src/core/configs/trip/schemas/v2.ts` — v2 zod + `TripV2` interface
- `src/core/configs/trip/migrations/v1_to_v2.ts` — string → Category migration
- `src/core/validators/category.ts` — uniqueness validator

**Modified (code):**
- `src/core/models/index.ts` — re-export Category
- `src/core/models/settings.ts` — `version: 2`, `categories: Category[]`
- `src/core/constants/defaults.ts` — defaults as Category[]; version 2
- `src/core/configs/trip/definition.ts` — register v2
- `src/core/configs/trip/index.ts` — re-export `TripV2`, `tripV2Schema`
- `src/core/services/trip/getTripStatus.ts` — 4 new TripStatus fields + compute
- `src/core/validators/index.ts` — export `validateCategory`
- `src/tui/components/organisms/TripDashboard.tsx` — SpendBlock new rows
- `src/tui/screens/CategoryList.tsx` — `[✓]`/`[ ]` marker, `.value` access
- `src/tui/screens/CategoryCreate.tsx` — `excluded` field, validation
- `src/tui/screens/CategoryEdit.tsx` — `excluded` field, load original, validation
- `src/tui/screens/CategoryDelete.tsx` — `.value` access
- `src/tui/screens/CategorySelect.tsx` — `.value` access
- `src/tui/screens/ExpenseForm.tsx` — category options use `.value`

**Modified (test fixtures):**
- `src/core/services/trip/__tests__/getTripStatus.test.ts`
- `src/core/services/trip/__tests__/updateSettings.test.ts`
- `src/core/services/trip/__tests__/loadTrip.test.ts`
- `src/core/services/trip/__tests__/tripService.test.ts`
- `src/core/services/trip/__tests__/sortTrips.test.ts`
- `src/core/services/trip/__tests__/backupTrip.test.ts`
- `src/core/services/expense/__tests__/expenseService.test.ts`
- `src/core/services/expense/__tests__/sortExpenses.test.ts`
- `src/core/services/expense/__tests__/nextExpenseId.test.ts`
- `src/core/services/owner/__tests__/ownerService.test.ts`
- `src/core/services/account/__tests__/accountService.test.ts`
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
- `src/core/services/export/__tests__/exportCsv.test.ts`
- `src/core/validators/__tests__/validators.test.ts`
- `src/core/configs/__tests__/trip.test.ts`

Pattern for fixtures: `categories: ["Food"]` → `categories: [{ value: "Food", excluded: false }]`. Also bump `version: 2` where present.

---

## Task 1: Create `Category` model + re-export

**Files:**
- Create: `src/core/models/category.ts`
- Modify: `src/core/models/index.ts`

- [ ] **Step 1: Write the new model file**

```ts
// src/core/models/category.ts
export interface Category {
	value: string;
	excluded: boolean;
}
```

- [ ] **Step 2: Re-export from models index**

Append to `src/core/models/index.ts` (alphabetical placement, before `Expense` import):

```ts
export type { Category } from "./category";
```

- [ ] **Step 3: Commit**

```bash
git add src/core/models/category.ts src/core/models/index.ts
git commit -m "feat(core): add Category model"
```

---

## Task 2: Update `Settings` type for v2

**Files:**
- Modify: `src/core/models/settings.ts`

- [ ] **Step 1: Replace contents with**

```ts
import type { Category } from "./category";
import type { Tag } from "./tag";

export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	version: 2;
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: Category[];
	tags: Tag[];
	exportPath: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/models/settings.ts
git commit -m "feat(core): bump Settings to v2 with Category[]"
```

(Build will fail until later tasks land — that's expected.)

---

## Task 3: Update defaults to v2 + Category[]

**Files:**
- Modify: `src/core/constants/defaults.ts`

- [ ] **Step 1: Replace contents with**

```ts
import type { Category, Settings } from "../models";

export const DEFAULT_BASE_CURRENCY = "THB" as const;

export const DEFAULT_EXPORT_PATH = "./expenses.csv";

export const DEFAULT_CATEGORIES: readonly Category[] = [
	{ value: "Flight", excluded: false },
	{ value: "Hotels", excluded: false },
	{ value: "Transportation", excluded: false },
	{ value: "Shopping", excluded: false },
	{ value: "Food", excluded: false },
	{ value: "Beverages", excluded: false },
	{ value: "Activities", excluded: false },
];

export const DEFAULT_TRIP_SETTINGS: Omit<
	Settings,
	"name" | "startDate" | "endDate"
> = {
	version: 2,
	countries: [],
	baseCurrency: DEFAULT_BASE_CURRENCY,
	currencies: {},
	categories: [...DEFAULT_CATEGORIES],
	tags: [],
	exportPath: DEFAULT_EXPORT_PATH,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/core/constants/defaults.ts
git commit -m "feat(core): default categories to Category[] for v2"
```

---

## Task 4: Create v2 zod schema

**Files:**
- Create: `src/core/configs/trip/schemas/v2.ts`

- [ ] **Step 1: Write file**

```ts
import { z } from "zod";
import type { Account, Expense, Owner, Settings } from "../../../models";

const tagSchema = z.object({
	value: z.string(),
	default: z.boolean(),
});

const categorySchema = z.object({
	value: z.string(),
	excluded: z.boolean(),
});

const currencyConfigSchema = z.object({
	exchangeRate: z.number().optional(),
});

const settingsSchemaV2 = z.object({
	version: z.literal(2),
	name: z.string().min(1),
	startDate: z.string(),
	endDate: z.string(),
	countries: z.array(z.string()),
	baseCurrency: z.literal("THB"),
	currencies: z.record(z.string(), currencyConfigSchema),
	categories: z.array(categorySchema),
	tags: z.array(tagSchema),
	exportPath: z.string(),
});

const ownerSchema = z.object({
	id: z.string(),
	name: z.string(),
});

const accountSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(["Credit", "Debit"]),
	owners: z.array(z.string()),
});

const expenseOwnerSplitSchema = z.object({
	id: z.string(),
	split: z.union([z.string(), z.number()]).optional(),
});

const expenseSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	date: z.string(),
	payee: z.string(),
	category: z.string(),
	amount: z.number(),
	currency: z.string(),
	exchangeRate: z.number().optional(),
	owners: z
		.union([z.array(z.string()), z.array(expenseOwnerSplitSchema)])
		.optional(),
	description: z.string(),
	tags: z.array(z.string()),
});

export interface TripV2 {
	settings: Settings;
	owners: Owner[];
	accounts: Account[];
	expenses: Expense[];
}

export const tripV2Schema: z.ZodTypeAny = z.object({
	settings: settingsSchemaV2,
	owners: z.array(ownerSchema),
	accounts: z.array(accountSchema),
	expenses: z.array(expenseSchema),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/core/configs/trip/schemas/v2.ts
git commit -m "feat(core): add v2 zod schema with Category"
```

---

## Task 5: Create v1 → v2 migration + tests

**Files:**
- Create: `src/core/configs/trip/migrations/v1_to_v2.ts`
- Modify: `src/core/configs/__tests__/trip.test.ts`

- [ ] **Step 1: Update v1 schema to expose TripV1 interface (no behavior change)**

Verify `src/core/configs/trip/schemas/v1.ts` already exports `TripV1` interface. (It does — see existing definition.)

- [ ] **Step 2: Write migration**

```ts
// src/core/configs/trip/migrations/v1_to_v2.ts
import type { TripV1 } from "../schemas/v1";
import type { TripV2 } from "../schemas/v2";

export function tripV1ToV2(input: TripV1): TripV2 {
	return {
		settings: {
			...input.settings,
			version: 2,
			categories: input.settings.categories.map((c) =>
				typeof c === "string" ? { value: c, excluded: false } : c,
			),
		},
		owners: input.owners,
		accounts: input.accounts,
		expenses: input.expenses,
	};
}
```

Note: TripV1's `categories` is `Category[]` after the Task 2 change. The runtime cast handles a YAML file written under the old v1 layout (raw strings). Cast input from `any` is fine because the zod `tripV1Schema` will need a permissive override — see Step 3.

- [ ] **Step 3: Soften v1 schema to accept legacy `string[]` for categories during migration**

Modify `src/core/configs/trip/schemas/v1.ts`. Change the line:

```ts
categories: z.array(z.string()),
```

to:

```ts
categories: z.array(
	z.union([
		z.string(),
		z.object({ value: z.string(), excluded: z.boolean() }),
	]),
),
```

And update `TripV1` interface to:

```ts
export interface TripV1 {
	settings: Omit<Settings, "version" | "categories"> & {
		version: 1;
		categories: Array<string | { value: string; excluded: boolean }>;
	};
	owners: Owner[];
	accounts: Account[];
	expenses: Expense[];
}
```

(Mirrors how v0 handles tags as `tagOrStringSchema`.)

- [ ] **Step 4: Write failing migration tests**

Append to `src/core/configs/__tests__/trip.test.ts` (after the existing `tripV0ToV1 migration` block, before the IO `describe`):

```ts
import { tripV1ToV2 } from "../trip/migrations/v1_to_v2";
import { tripV2Schema } from "../trip/schemas/v2";

const baseV1Settings = {
	version: 1 as const,
	name: "Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB" as const,
	currencies: {},
	tags: [],
	exportPath: "./expenses.csv",
};

describe("tripV1ToV2 migration", () => {
	test("stamps version: 2 and normalizes string categories", () => {
		const input = tripV1Schema.parse({
			settings: { ...baseV1Settings, categories: ["Food", "Hotels"] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.version).toBe(2);
		expect(out.settings.categories).toEqual([
			{ value: "Food", excluded: false },
			{ value: "Hotels", excluded: false },
		]);
		expect(() => tripV2Schema.parse(out)).not.toThrow();
	});

	test("passes through already-normalized Category objects", () => {
		const input = tripV1Schema.parse({
			settings: {
				...baseV1Settings,
				categories: [{ value: "Food", excluded: true }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.categories).toEqual([
			{ value: "Food", excluded: true },
		]);
	});

	test("handles empty categories", () => {
		const input = tripV1Schema.parse({
			settings: { ...baseV1Settings, categories: [] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.categories).toEqual([]);
		expect(out.settings.version).toBe(2);
	});
});
```

- [ ] **Step 5: Commit**

```bash
git add src/core/configs/trip/migrations/v1_to_v2.ts src/core/configs/trip/schemas/v1.ts src/core/configs/__tests__/trip.test.ts
git commit -m "feat(core): migrate v1 categories to Category[] in v2"
```

---

## Task 6: Wire v2 into trip config definition

**Files:**
- Modify: `src/core/configs/trip/definition.ts`
- Modify: `src/core/configs/trip/index.ts`

- [ ] **Step 1: Update definition**

Replace `src/core/configs/trip/definition.ts` contents with:

```ts
import type { z } from "zod";
import { defineConfig } from "../kernel";
import type { ConfigDefinition } from "../types";
import { readTripConfig, readTripConfigVersion, writeTripConfig } from "./io";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { tripV1ToV2 } from "./migrations/v1_to_v2";
import { tripV0Schema } from "./schemas/v0";
import { tripV1Schema } from "./schemas/v1";
import type { TripV2 } from "./schemas/v2";
import { tripV2Schema } from "./schemas/v2";

type TripSchemas = {
	0: z.ZodTypeAny;
	1: z.ZodTypeAny;
	2: z.ZodType<TripV2>;
};

export const tripConfig: ConfigDefinition<"trip", TripSchemas, 2> =
	defineConfig({
		name: "trip",
		latestVersion: 2,
		schemas: {
			0: { schema: tripV0Schema, migrations: { 1: tripV0ToV1 } },
			1: { schema: tripV1Schema, migrations: { 2: tripV1ToV2 } },
			2: { schema: tripV2Schema },
		},
		readConfig: readTripConfig,
		writeConfig: writeTripConfig,
		parseVersion: readTripConfigVersion,
	} as ConfigDefinition<"trip", TripSchemas, 2>);
```

- [ ] **Step 2: Update index re-exports**

Replace `src/core/configs/trip/index.ts` with:

```ts
export { tripConfig } from "./definition";
export type { TripV2 } from "./schemas/v2";
export { tripV2Schema } from "./schemas/v2";
```

- [ ] **Step 3: Run config tests**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: all tests pass including new v1→v2 cases.

- [ ] **Step 4: Commit**

```bash
git add src/core/configs/trip/definition.ts src/core/configs/trip/index.ts
git commit -m "feat(core): register v2 schema in tripConfig"
```

---

## Task 7: Add `validateCategory` mirror of `validateTag`

**Files:**
- Create: `src/core/validators/category.ts`
- Modify: `src/core/validators/index.ts`

- [ ] **Step 1: Write validator**

```ts
// src/core/validators/category.ts
import type { Category } from "../models";

export function validateCategory(
	value: string,
	existing: Category[],
	originalValue?: string,
): string[] {
	const errors: string[] = [];
	const trimmed = value.trim();
	if (!trimmed) {
		errors.push("Category is required");
		return errors;
	}
	const collision = existing.some(
		(c) => c.value === trimmed && c.value !== originalValue,
	);
	if (collision) errors.push(`Category "${trimmed}" already exists`);
	return errors;
}
```

- [ ] **Step 2: Re-export**

Append to `src/core/validators/index.ts`:

```ts
export { validateCategory } from "./category";
```

- [ ] **Step 3: Commit**

```bash
git add src/core/validators/category.ts src/core/validators/index.ts
git commit -m "feat(core): validateCategory for unique names"
```

---

## Task 8: Extend `getTripStatus` with exclusion totals + per-person averages

**Files:**
- Modify: `src/core/services/trip/getTripStatus.ts`
- Modify: `src/core/services/trip/__tests__/getTripStatus.test.ts`

- [ ] **Step 1: Update `TripStatus` interface**

In `src/core/services/trip/getTripStatus.ts`, modify the `TripStatus` interface to insert these fields right after `avgPerDayThb: number;`:

```ts
	avgPerDayExcludedThb: number;
	avgPerDayPerPersonThb: number;
	avgPerDayPerPersonExcludedThb: number;
	hasExcludedCategories: boolean;
	totalSpendExcludedThb: number;
```

Final shape of the spend block:

```ts
	totalSpendThb: number;
	totalSpendExcludedThb: number;
	avgPerDayThb: number;
	avgPerDayExcludedThb: number;
	avgPerDayPerPersonThb: number;
	avgPerDayPerPersonExcludedThb: number;
	hasExcludedCategories: boolean;
	expenseCount: number;
	byCurrency: { currency: string; amount: number }[];
```

- [ ] **Step 2: Update compute logic**

Inside `getTripStatus`, near the top of the "Spend + Categories + Tags" section, before the loop, add:

```ts
const excludedCategorySet = new Set(
	settings.categories.filter((c) => c.excluded).map((c) => c.value),
);
let totalSpendExcludedThb = 0;
```

In the expense loop, immediately after the existing line `totalSpendThb += thb;`, add:

```ts
				if (!excludedCategorySet.has(expense.category)) {
					totalSpendExcludedThb += thb;
				}
```

After the loop, replace:

```ts
totalSpendThb = round2(totalSpendThb);

const avgPerDayThb =
	elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;
```

with:

```ts
totalSpendThb = round2(totalSpendThb);
totalSpendExcludedThb = round2(totalSpendExcludedThb);

const ownerCount = trip.owners.length;
const avgPerDayThb =
	elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;
const avgPerDayExcludedThb =
	elapsedDays > 0 ? round2(totalSpendExcludedThb / elapsedDays) : 0;
const avgPerDayPerPersonThb =
	elapsedDays > 0 && ownerCount > 0
		? round2(totalSpendThb / elapsedDays / ownerCount)
		: 0;
const avgPerDayPerPersonExcludedThb =
	elapsedDays > 0 && ownerCount > 0
		? round2(totalSpendExcludedThb / elapsedDays / ownerCount)
		: 0;
const hasExcludedCategories = excludedCategorySet.size > 0;
```

In the return statement, insert the new fields after `avgPerDayThb,`:

```ts
		totalSpendExcludedThb,
		avgPerDayThb,
		avgPerDayExcludedThb,
		avgPerDayPerPersonThb,
		avgPerDayPerPersonExcludedThb,
		hasExcludedCategories,
```

- [ ] **Step 3: Update existing test fixtures in this file**

In `src/core/services/trip/__tests__/getTripStatus.test.ts`:

- The `makeTrip` fixture (around line 16) has `categories: []` — leave as is.
- The test at line ~358-407 uses `categories: ["Food", "Transport", "Lodging"]`. Replace with `categories: [{ value: "Food", excluded: false }, { value: "Transport", excluded: false }, { value: "Lodging", excluded: false }]`.
- Any other inline `categories: ["..."]` in this file — convert to Category[] shape, all `excluded: false`.

Run a grep to confirm:

```bash
grep -n 'categories:' src/core/services/trip/__tests__/getTripStatus.test.ts
```

Convert each match.

- [ ] **Step 4: Add new test block**

Append after the final `describe(...)` block in that file:

```ts
describe("getTripStatus — exclusion totals and per-person", () => {
	test("totalSpendExcludedThb equals totalSpendThb when no categories excluded", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: [{ value: "Food", excluded: false }],
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
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.totalSpendThb).toBe(500);
		expect(s.totalSpendExcludedThb).toBe(500);
		expect(s.hasExcludedCategories).toBe(false);
	});

	test("excludes flagged category amounts from totalSpendExcludedThb", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: [
					{ value: "Food", excluded: false },
					{ value: "Shopping", excluded: true },
				],
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
					category: "Shopping",
					amount: 2000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.totalSpendThb).toBe(2500);
		expect(s.totalSpendExcludedThb).toBe(500);
		expect(s.hasExcludedCategories).toBe(true);
	});

	test("avgPerDay variants compute against correct totals", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: [
					{ value: "Food", excluded: false },
					{ value: "Shopping", excluded: true },
				],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Food",
					amount: 400,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Shopping",
					amount: 1600,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		// today=end → elapsedDays = 16
		const s = getTripStatus(trip, "2026-04-30");
		expect(s.avgPerDayThb).toBe(125); // 2000 / 16
		expect(s.avgPerDayExcludedThb).toBe(25); // 400 / 16
	});

	test("per-person averages divide by owner count", () => {
		const trip = makeTrip({
			owners: [
				{ id: "o1", name: "A" },
				{ id: "o2", name: "B" },
			],
			settings: {
				...makeTrip().settings,
				categories: [
					{ value: "Food", excluded: false },
					{ value: "Shopping", excluded: true },
				],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Food",
					amount: 400,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Shopping",
					amount: 1600,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-30");
		// 16 elapsed days, 2 owners
		expect(s.avgPerDayPerPersonThb).toBe(62.5); // 2000 / 16 / 2
		expect(s.avgPerDayPerPersonExcludedThb).toBe(12.5); // 400 / 16 / 2
	});

	test("per-person fields are 0 when no owners", () => {
		const trip = makeTrip({
			owners: [],
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-30");
		expect(s.avgPerDayPerPersonThb).toBe(0);
		expect(s.avgPerDayPerPersonExcludedThb).toBe(0);
	});

	test("averages are 0 before trip starts", () => {
		const s = getTripStatus(makeTrip(), "2026-04-10");
		expect(s.avgPerDayThb).toBe(0);
		expect(s.avgPerDayExcludedThb).toBe(0);
		expect(s.avgPerDayPerPersonThb).toBe(0);
		expect(s.avgPerDayPerPersonExcludedThb).toBe(0);
	});

	test("missing-rate expenses do not affect excluded total", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: [{ value: "Food", excluded: true }],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-15",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "JPY", // no rate
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-30");
		expect(s.totalSpendThb).toBe(0);
		expect(s.totalSpendExcludedThb).toBe(0);
	});
});
```

- [ ] **Step 5: Run tests**

Run: `bun test src/core/services/trip/__tests__/getTripStatus.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/getTripStatus.ts src/core/services/trip/__tests__/getTripStatus.test.ts
git commit -m "feat(core): compute excluded total and per-person averages"
```

---

## Task 9: Update SpendBlock with new conditional rows

**Files:**
- Modify: `src/tui/components/organisms/TripDashboard.tsx`

- [ ] **Step 1: Replace `SpendBlock` function**

Find `function SpendBlock({ status }: Props): JSX.Element` and replace its body. The new version computes a wider `labelWidth` (longest label is `"Avg/day/person excl."` = 20 chars) and conditionally renders extra rows:

```tsx
function SpendBlock({ status }: Props): JSX.Element {
	const hasExcluded = status.hasExcludedCategories;
	const hasOwners = status.ownerBalances.length > 0;
	const labelWidth = "Avg/day/person excl.".length;
	return (
		<Box flexDirection="column" width={46}>
			<SectionHeader label="Spend" />
			<Box>
				<Text dimColor>{"Total".padEnd(labelWidth)}</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.totalSpendThb)}</Text>
			</Box>
			{hasExcluded && (
				<Box>
					<Text dimColor>{"Excl.".padEnd(labelWidth)}</Text>
					<Text>{"  "}</Text>
					<Text bold>{formatThb(status.totalSpendExcludedThb)}</Text>
				</Box>
			)}
			<Box>
				<Text dimColor>{"Avg/day".padEnd(labelWidth)}</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.avgPerDayThb)}</Text>
			</Box>
			{hasExcluded && (
				<Box>
					<Text dimColor>{"Avg/day excl.".padEnd(labelWidth)}</Text>
					<Text>{"  "}</Text>
					<Text bold>{formatThb(status.avgPerDayExcludedThb)}</Text>
				</Box>
			)}
			{hasOwners && (
				<Box>
					<Text dimColor>{"Avg/day/person".padEnd(labelWidth)}</Text>
					<Text>{"  "}</Text>
					<Text bold>{formatThb(status.avgPerDayPerPersonThb)}</Text>
				</Box>
			)}
			{hasOwners && hasExcluded && (
				<Box>
					<Text dimColor>{"Avg/day/person excl.".padEnd(labelWidth)}</Text>
					<Text>{"  "}</Text>
					<Text bold>{formatThb(status.avgPerDayPerPersonExcludedThb)}</Text>
				</Box>
			)}
			{status.byCurrency.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text dimColor>{"By currency".padEnd(labelWidth)}</Text>
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
							<Text>{" ".repeat(labelWidth + 2)}</Text>
							<Text>{formatOriginal(c.currency, c.amount)}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx
git commit -m "feat(tui): show excluded total and per-person averages in SpendBlock"
```

---

## Task 10: Update CategoryList — render markers + `.value` access

**Files:**
- Modify: `src/tui/screens/CategoryList.tsx`

- [ ] **Step 1: Update file**

Replace the `categories` block and the `ListSelect` block:

The variable `categories` (line 32) stays `trip.settings.categories` (now `Category[]`).

Change the `mainAction.onConfirm` body to read `target.value`:

```ts
mainAction: {
	confirmCount: 2,
	onConfirm: (i: number) => {
		const target = categories[i];
		if (target === undefined) return;
		const remaining = categories.filter((c) => c.value !== target.value);
		updateSettings(trip.dirPath, { categories: remaining });
		reloadTrip();
		if (remaining.length === 0) {
			goBack();
		}
	},
},
```

Replace the empty-state message text — leave as is.

Replace the `ListSelect` invocation:

```tsx
return (
	<ListSelect
		options={categories.map((c) => ({
			label: `${c.excluded ? "[ ]" : "[✓]"} ${c.value}`,
			value: c.value,
		}))}
		onChange={(value) => {
			goTo("/trips/settings/categories/edit", {
				props: {
					tripDirPath: trip.dirPath,
					tripName: trip.settings.name,
					value,
				},
			});
		}}
		onHighlight={(_, i) => setActiveIndex(i)}
		armedRowIndex={armed?.index ?? null}
		isActive={focus === "main"}
	/>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/screens/CategoryList.tsx
git commit -m "feat(tui): mark excluded categories in CategoryList"
```

---

## Task 11: Update CategoryCreate with `excluded` boolean field

**Files:**
- Modify: `src/tui/screens/CategoryCreate.tsx`

- [ ] **Step 1: Replace file contents with**

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateCategory } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import {
	type FormFieldConfig,
	getBoolean,
	getString,
} from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Category",
		type: "text",
		required: true,
		placeholder: "e.g. Flight",
	},
	{
		key: "excluded",
		label: "Exclude from total",
		type: "boolean",
		required: true,
		defaultValue: false,
	},
];

export function CategoryCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitle(settingsTitle(trip, "Categories", "New"));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = getString(values, "value").trim();
				const errors = validateCategory(value, trip.settings.categories);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const excluded = getBoolean(values, "excluded");
				updateSettings(trip.dirPath, {
					categories: [
						...trip.settings.categories,
						{ value, excluded },
					],
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/screens/CategoryCreate.tsx
git commit -m "feat(tui): add exclude toggle to CategoryCreate"
```

---

## Task 12: Update CategoryEdit with `excluded` field + load original

**Files:**
- Modify: `src/tui/screens/CategoryEdit.tsx`

- [ ] **Step 1: Replace file contents with**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateCategory } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import {
	type FormFieldConfig,
	getBoolean,
	getString,
} from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function CategoryEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	const { value: originalValue } = useRouteProps(
		"/trips/settings/categories/edit",
	);

	useEffect(() => {
		setTitle(settingsTitle(trip, "Categories", originalValue));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const original = trip.settings.categories.find(
		(c) => c.value === originalValue,
	);
	if (!original) return <Text dimColor>Category not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Category",
			type: "text",
			required: true,
			defaultValue: original.value,
		},
		{
			key: "excluded",
			label: "Exclude from total",
			type: "boolean",
			required: true,
			defaultValue: original.excluded,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = getString(values, "value").trim();
				const errors = validateCategory(
					next,
					trip.settings.categories,
					originalValue,
				);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const excluded = getBoolean(values, "excluded");
				updateSettings(trip.dirPath, {
					categories: trip.settings.categories.map((c) =>
						c.value === originalValue ? { value: next, excluded } : c,
					),
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/screens/CategoryEdit.tsx
git commit -m "feat(tui): add exclude toggle to CategoryEdit"
```

---

## Task 13: Update CategoryDelete + CategorySelect + ExpenseForm

**Files:**
- Modify: `src/tui/screens/CategoryDelete.tsx`
- Modify: `src/tui/screens/CategorySelect.tsx`
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: CategoryDelete — adapt to Category[]**

In `src/tui/screens/CategoryDelete.tsx`, replace the `<RemoveSelector ...>` block:

```tsx
return (
	<RemoveSelector
		options={categories.map((c) => ({ label: c.value, value: c.value }))}
		onConfirm={(value) => {
			const remaining = categories.filter((c) => c.value !== value);
			updateSettings(trip.dirPath, { categories: remaining });
			reloadTrip();
			if (remaining.length === 0) {
				goBack();
			}
		}}
	/>
);
```

- [ ] **Step 2: CategorySelect — adapt options**

In `src/tui/screens/CategorySelect.tsx`, replace:

```tsx
const options = trip.settings.categories.map((c) => ({
	label: c,
	value: c,
}));
```

with:

```tsx
const options = trip.settings.categories.map((c) => ({
	label: c.value,
	value: c.value,
}));
```

- [ ] **Step 3: ExpenseForm — adapt category options**

In `src/tui/screens/ExpenseForm.tsx` near line 143, find:

```tsx
options: trip.settings.categories.map((c) => ({
```

Replace with:

```tsx
options: trip.settings.categories.map((c) => ({
	label: c.value,
	value: c.value,
})),
```

(Read the existing block first to preserve any other option fields.)

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/CategoryDelete.tsx src/tui/screens/CategorySelect.tsx src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): adapt category readers to Category[]"
```

---

## Task 14: Convert remaining test fixtures to Category[]

**Files (all `__tests__/`):**
- `src/core/services/trip/__tests__/updateSettings.test.ts`
- `src/core/services/trip/__tests__/loadTrip.test.ts`
- `src/core/services/trip/__tests__/tripService.test.ts`
- `src/core/services/trip/__tests__/sortTrips.test.ts`
- `src/core/services/trip/__tests__/backupTrip.test.ts`
- `src/core/services/expense/__tests__/expenseService.test.ts`
- `src/core/services/expense/__tests__/sortExpenses.test.ts`
- `src/core/services/expense/__tests__/nextExpenseId.test.ts`
- `src/core/services/owner/__tests__/ownerService.test.ts`
- `src/core/services/account/__tests__/accountService.test.ts`
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
- `src/core/services/export/__tests__/exportCsv.test.ts`
- `src/core/validators/__tests__/validators.test.ts`

- [ ] **Step 1: Replace each `categories: ["X","Y"]` with Category objects**

For each file, run this conversion mentally:
- `categories: []` → `categories: []` (unchanged)
- `categories: ["Food"]` → `categories: [{ value: "Food", excluded: false }]`
- `categories: ["A", "B"]` → `categories: [{ value: "A", excluded: false }, { value: "B", excluded: false }]`

Also: where the settings literal includes `version: 1`, change to `version: 2`. Where `version` is absent (fixture relied on type omission), leave it absent — these are partial fixtures, do not add `version` unless TypeScript complains.

Confirm by running:

```bash
grep -rn 'categories:' src/core/services src/core/validators src/core/configs --include="*.test.ts"
```

Every remaining occurrence should be either `categories: []` or `categories: [{ value: "...", excluded: false }, ...]`.

- [ ] **Step 2: Update `tripService.test.ts` line 173**

The string `categories: ["Food", "Transport"]` may appear in an `updateSettings` call argument or test assertion. Treat it the same as fixture data: convert to Category[].

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/services src/core/validators src/core/configs
git commit -m "test(core): migrate fixtures to Category[]"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 2: Run lint**

Run: `bun run check`
Expected: no errors. If formatting violations appear, run `bun run fix` and re-check.

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Manual smoke (optional)**

Run: `bun run start --trip <existing>` (if any local trip data exists).
Walk through: Settings → Categories. Confirm `[✓]`/`[ ]` markers render. Toggle one excluded via Edit. Back to Trip Overview, confirm SpendBlock shows extra rows.

- [ ] **Step 5: Final commit (if any leftover changes)**

If lint/format produced any changes:

```bash
git add -A
git commit -m "chore: lint/format after category migration"
```

---

## Self-Review

Spec coverage:
- Schema v2 + migration → Tasks 4, 5, 6 ✓
- Category model → Task 1 ✓
- Settings update → Tasks 2, 3 ✓
- `totalSpendExcludedThb` + averages → Task 8 ✓
- `hasExcludedCategories` gate → Task 8 ✓
- Per-person averages with owner divisor → Task 8 ✓
- SpendBlock conditional rows → Task 9 ✓
- CategoryList markers → Task 10 ✓
- Create/Edit `excluded` field → Tasks 11, 12 ✓
- Validator (uniqueness) → Task 7 ✓
- All `.categories` readers updated → Tasks 10, 11, 12, 13 ✓
- Test fixtures migrated → Tasks 8, 14 ✓

Placeholders: none. Every code step has full code.

Type consistency: `Category = { value: string; excluded: boolean }` used uniformly. `TripStatus` field names match across getTripStatus.ts and TripDashboard.tsx.
