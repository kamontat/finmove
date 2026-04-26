# Trip Countries, Zvent Auto-Tag, and Default Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add countries input to TripCreate, auto-generate a per-trip `Zvent: <id> <name> (<MMM> <YYYY>)` tag at trip creation/duplication, and make `settings.tags` act as default tags applied to every new expense.

**Architecture:** New `src/core/constants/` directory holds trip defaults and Zvent constants. New core services in `src/core/services/trip/` build/parse/auto-increment Zvent ids. The `addExpense` core service is the single enforcement point for the default-tag domain rule. TUI screens (TripCreate, TripDuplicate, ExpenseForm) consume the new constants/services without re-implementing logic.

**Tech Stack:** TypeScript with `exactOptionalPropertyTypes`, Bun runtime, Bun test runner, React + Ink, Biome lint/format, YAML data files.

**Spec:** `docs/superpowers/specs/2026-04-26-trip-countries-default-tags-design.md`

---

## File Structure

**Created:**
- `src/core/constants/defaults.ts` — `DEFAULT_TRIP_SETTINGS`, `DEFAULT_CATEGORIES`, `DEFAULT_EXPORT_PATH`, `DEFAULT_BASE_CURRENCY`
- `src/core/constants/zvent.ts` — `ZVENT_TAG_PREFIX`, `ZVENT_ID_PATTERN`, `ZVENT_DEFAULT_ID`, `ZVENT_TAG_REGEX`, `ZVENT_MONTHS`
- `src/core/constants/index.ts` — barrel
- `src/core/services/trip/parseZventId.ts`
- `src/core/services/trip/buildZventTag.ts`
- `src/core/services/trip/nextZventId.ts`
- `src/core/services/trip/__tests__/zventService.test.ts` — covers parse + build + nextId

**Modified:**
- `src/core/services/trip/index.ts` — export new services
- `src/core/services/expense/addExpense.ts` — merge `trip.settings.tags` into expense tags
- `src/core/services/expense/__tests__/expenseService.test.ts` — new addExpense default-tags cases
- `src/tui/screens/TripCreate.tsx` — import constants, add countries + zventId fields, build Zvent tag on submit
- `src/tui/screens/TripDuplicate.tsx` — add zventId field, rebuild Zvent tag post-duplicate
- `src/tui/screens/ExpenseForm.tsx` — dynamic Tags label hint

---

## Task 1: Create core/constants directory

**Files:**
- Create: `src/core/constants/defaults.ts`
- Create: `src/core/constants/zvent.ts`
- Create: `src/core/constants/index.ts`

- [ ] **Step 1: Write `src/core/constants/defaults.ts`**

```ts
import type { Settings } from "../models";

export const DEFAULT_BASE_CURRENCY = "THB" as const;

export const DEFAULT_EXPORT_PATH = "./expenses.csv";

export const DEFAULT_CATEGORIES: readonly string[] = [
	"Flight",
	"Hotels",
	"Transportation",
	"Shopping",
	"Eating",
	"Activities",
];

export const DEFAULT_TRIP_SETTINGS: Omit<
	Settings,
	"name" | "startDate" | "endDate"
> = {
	countries: [],
	baseCurrency: DEFAULT_BASE_CURRENCY,
	currencies: {},
	categories: [...DEFAULT_CATEGORIES],
	tags: [],
	exportPath: DEFAULT_EXPORT_PATH,
};
```

- [ ] **Step 2: Write `src/core/constants/zvent.ts`**

```ts
export const ZVENT_TAG_PREFIX = "Zvent" as const;

export const ZVENT_ID_PATTERN = /^\d{3}$/;

export const ZVENT_DEFAULT_ID = "001";

export const ZVENT_TAG_REGEX = /^Zvent: (\d{3}) /;

export const ZVENT_MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;
```

- [ ] **Step 3: Write `src/core/constants/index.ts`**

```ts
export {
	DEFAULT_BASE_CURRENCY,
	DEFAULT_CATEGORIES,
	DEFAULT_EXPORT_PATH,
	DEFAULT_TRIP_SETTINGS,
} from "./defaults";
export {
	ZVENT_DEFAULT_ID,
	ZVENT_ID_PATTERN,
	ZVENT_MONTHS,
	ZVENT_TAG_PREFIX,
	ZVENT_TAG_REGEX,
} from "./zvent";
```

- [ ] **Step 4: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/constants/
git commit -m "feat(core): add constants directory with trip defaults and Zvent constants"
```

---

## Task 2: Refactor TripCreate to use DEFAULT_TRIP_SETTINGS

This is a no-behavior-change refactor. Verifies the new constants are consumable from the TUI before adding new logic on top.

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Replace inline `DEFAULT_SETTINGS` with import**

Open `src/tui/screens/TripCreate.tsx`. Delete lines 16–30 (the inlined `DEFAULT_SETTINGS` constant). Add this import near the top, alongside the other core imports:

```ts
import { DEFAULT_TRIP_SETTINGS } from "../../core/constants";
```

- [ ] **Step 2: Update the spread in `onSubmit`**

In the `onSubmit` handler, change `...DEFAULT_SETTINGS` to `...DEFAULT_TRIP_SETTINGS`:

```ts
const settings: Settings = {
	...DEFAULT_TRIP_SETTINGS,
	name,
	startDate,
	endDate,
};
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: all pass (no behavior change).

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/TripCreate.tsx
git commit -m "refactor(tui): TripCreate consumes DEFAULT_TRIP_SETTINGS from core/constants"
```

---

## Task 3: parseZventId service

**Files:**
- Create: `src/core/services/trip/parseZventId.ts`
- Test: `src/core/services/trip/__tests__/zventService.test.ts`

- [ ] **Step 1: Write the failing test (start the new test file)**

```ts
import { describe, expect, test } from "bun:test";
import { parseZventId } from "../parseZventId";

describe("parseZventId", () => {
	test("returns id for well-formed Zvent tag", () => {
		expect(parseZventId("Zvent: 042 Foo (Jan 2026)")).toBe("042");
	});

	test("returns null for 1-digit id", () => {
		expect(parseZventId("Zvent: 5 Foo")).toBeNull();
	});

	test("returns null for 4-digit id", () => {
		expect(parseZventId("Zvent: 0001 Foo")).toBeNull();
	});

	test("returns null for non-Zvent tag", () => {
		expect(parseZventId("food")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(parseZventId("")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: FAIL — `Cannot find module '../parseZventId'`.

- [ ] **Step 3: Write the implementation**

Create `src/core/services/trip/parseZventId.ts`:

```ts
import { ZVENT_TAG_REGEX } from "../../constants";

export function parseZventId(tag: string): string | null {
	return tag.match(ZVENT_TAG_REGEX)?.[1] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/parseZventId.ts src/core/services/trip/__tests__/zventService.test.ts
git commit -m "feat(core): add parseZventId service"
```

---

## Task 4: buildZventTag service

**Files:**
- Create: `src/core/services/trip/buildZventTag.ts`
- Modify: `src/core/services/trip/__tests__/zventService.test.ts`

- [ ] **Step 1: Append failing tests to `zventService.test.ts`**

At the bottom of `src/core/services/trip/__tests__/zventService.test.ts`, add:

```ts
import { buildZventTag } from "../buildZventTag";

describe("buildZventTag", () => {
	test("formats id, name, month, year", () => {
		expect(buildZventTag("003", "Japan", "2026-05-12")).toBe(
			"Zvent: 003 Japan (May 2026)",
		);
	});

	test("uses Jan for January", () => {
		expect(buildZventTag("001", "Foo", "2026-01-01")).toBe(
			"Zvent: 001 Foo (Jan 2026)",
		);
	});

	test("uses Dec for December", () => {
		expect(buildZventTag("999", "Bar", "2025-12-31")).toBe(
			"Zvent: 999 Bar (Dec 2025)",
		);
	});

	test("preserves spaces and unicode in trip name", () => {
		expect(buildZventTag("050", "ทริปญี่ปุ่น", "2026-06-15")).toBe(
			"Zvent: 050 ทริปญี่ปุ่น (Jun 2026)",
		);
	});
});
```

Move the import to the top of the file (alongside `parseZventId` import) so all imports are grouped:

```ts
import { describe, expect, test } from "bun:test";
import { buildZventTag } from "../buildZventTag";
import { parseZventId } from "../parseZventId";
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: FAIL — `Cannot find module '../buildZventTag'`.

- [ ] **Step 3: Write the implementation**

Create `src/core/services/trip/buildZventTag.ts`:

```ts
import { ZVENT_MONTHS } from "../../constants";

export function buildZventTag(
	id: string,
	name: string,
	endDate: string,
): string {
	const date = new Date(endDate);
	const month = ZVENT_MONTHS[date.getUTCMonth()];
	const year = date.getUTCFullYear();
	return `Zvent: ${id} ${name} (${month} ${year})`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: PASS — 9 tests pass.

- [ ] **Step 5: Type check**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/buildZventTag.ts src/core/services/trip/__tests__/zventService.test.ts
git commit -m "feat(core): add buildZventTag service"
```

---

## Task 5: nextZventId service

**Files:**
- Create: `src/core/services/trip/nextZventId.ts`
- Modify: `src/core/services/trip/__tests__/zventService.test.ts`

- [ ] **Step 1: Append failing tests to `zventService.test.ts`**

First, consolidate the imports at the top of the file. The full import block should now be:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { buildZventTag } from "../buildZventTag";
import { nextZventId } from "../nextZventId";
import { parseZventId } from "../parseZventId";
```

Then append a new `describe` block at the bottom of the file:

```ts

const TEST_DIR = join(import.meta.dir, "__fixtures__");

function makeTrip(dirName: string, tags: string[]) {
	const tripDir = join(TEST_DIR, dirName);
	mkdirSync(tripDir, { recursive: true });
	const settings: Settings = {
		name: dirName,
		startDate: "2026-01-01",
		endDate: "2026-01-07",
		countries: [],
		baseCurrency: "THB",
		currencies: {},
		categories: [],
		tags,
		exportPath: "./expenses.csv",
	};
	writeFileSync(join(tripDir, "settings.yaml"), stringify(settings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
}

describe("nextZventId", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	test("returns 001 for empty data dir", () => {
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("returns 001 when no trip has a Zvent tag", () => {
		makeTrip("trip-a", ["food", "hotel"]);
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("returns max + 1 across multiple trips", () => {
		makeTrip("trip-a", ["Zvent: 005 A (Jan 2026)"]);
		makeTrip("trip-b", ["Zvent: 012 B (Feb 2026)"]);
		makeTrip("trip-c", ["Zvent: 003 C (Mar 2026)"]);
		expect(nextZventId(TEST_DIR)).toBe("013");
	});

	test("ignores malformed Zvent-like tags", () => {
		makeTrip("trip-a", ["Zvent: 5 A", "Zvent: 0001 A"]);
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("clamps at 999", () => {
		makeTrip("trip-a", ["Zvent: 999 A (Jan 2026)"]);
		expect(nextZventId(TEST_DIR)).toBe("999");
	});

	test("returns 001 when data dir does not exist", () => {
		expect(nextZventId(join(TEST_DIR, "missing"))).toBe("001");
	});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: FAIL — `Cannot find module '../nextZventId'`.

- [ ] **Step 3: Write the implementation**

Create `src/core/services/trip/nextZventId.ts`:

```ts
import { ZVENT_DEFAULT_ID } from "../../constants";
import { listTrips } from "./listTrips";
import { parseZventId } from "./parseZventId";

const MAX_ZVENT_ID = 999;

export function nextZventId(dataDir: string): string {
	const trips = listTrips(dataDir);
	let max = 0;
	for (const trip of trips) {
		for (const tag of trip.settings.tags) {
			const parsed = parseZventId(tag);
			if (parsed === null) continue;
			const n = Number.parseInt(parsed, 10);
			if (n > max) max = n;
		}
	}
	if (max === 0) return ZVENT_DEFAULT_ID;
	const next = Math.min(max + 1, MAX_ZVENT_ID);
	return String(next).padStart(3, "0");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/core/services/trip/__tests__/zventService.test.ts`
Expected: PASS — 15 tests pass total.

- [ ] **Step 5: Export new services from the trip barrel**

Modify `src/core/services/trip/index.ts`. Add exports between existing lines, alphabetically:

```ts
export { buildZventTag } from "./buildZventTag";
export { createTrip } from "./createTrip";
export { deleteTrip } from "./deleteTrip";
export { duplicateTrip } from "./duplicateTrip";
export type { TripStatus } from "./getTripStatus";
export { getTripStatus } from "./getTripStatus";
export { listTrips } from "./listTrips";
export { loadTrip } from "./loadTrip";
export { nextZventId } from "./nextZventId";
export { parseZventId } from "./parseZventId";
export { toDirName } from "./toDirName";
export { updateSettings } from "./updateSettings";
```

- [ ] **Step 6: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/trip/nextZventId.ts src/core/services/trip/index.ts src/core/services/trip/__tests__/zventService.test.ts
git commit -m "feat(core): add nextZventId service that auto-increments across trips"
```

---

## Task 6: addExpense merges trip default tags

**Files:**
- Modify: `src/core/services/expense/addExpense.ts`
- Modify: `src/core/services/expense/__tests__/expenseService.test.ts`

- [ ] **Step 1: Add failing tests to `expenseService.test.ts`**

In the existing `describe("addExpense", () => { … })` block (starts around line 72), append the following tests *inside* the block, after the last existing test:

```ts
	test("merges trip default tags into new expense", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		trip.settings.tags = ["Zvent: 001 Test (Jan 2026)", "team-lunch"];
		addExpense(trip, sampleExpense);

		const reloaded = loadTrip(tripDir);
		expect(reloaded.expenses[0].tags).toEqual([
			"Zvent: 001 Test (Jan 2026)",
			"team-lunch",
			"food",
		]);
	});

	test("dedupes user tags that match a default tag", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		trip.settings.tags = ["food", "Zvent: 001 Test (Jan 2026)"];
		addExpense(trip, sampleExpense);

		const reloaded = loadTrip(tripDir);
		expect(reloaded.expenses[0].tags).toEqual([
			"food",
			"Zvent: 001 Test (Jan 2026)",
		]);
	});

	test("leaves expense.tags untouched when settings.tags is empty", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		// settings.tags defaults to [] in sampleSettings
		addExpense(trip, sampleExpense);

		const reloaded = loadTrip(tripDir);
		expect(reloaded.expenses[0].tags).toEqual(["food"]);
	});

	test("preserves order: defaults first, then user tags", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		trip.settings.tags = ["a", "b"];
		addExpense(trip, { ...sampleExpense, tags: ["x", "y"] });

		const reloaded = loadTrip(tripDir);
		expect(reloaded.expenses[0].tags).toEqual(["a", "b", "x", "y"]);
	});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/core/services/expense/__tests__/expenseService.test.ts`
Expected: FAIL on the four new tests (existing tests still pass; the merge logic doesn't exist yet).

- [ ] **Step 3: Modify `addExpense.ts`**

Open `src/core/services/expense/addExpense.ts`. Replace the file contents with:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Expense, Trip } from "../../models";

export function addExpense(trip: Trip, expense: Expense): void {
	const existing = trip.expenses.find((e) => e.id === expense.id);
	if (existing) {
		throw new Error(`Expense with id "${expense.id}" already exists`);
	}

	if (!trip.accounts.some((a) => a.id === expense.accountId)) {
		throw new Error(`Account "${expense.accountId}" not found`);
	}

	if (expense.owners && expense.owners.length > 0) {
		for (const ref of expense.owners) {
			const ownerId = typeof ref === "string" ? ref : ref.id;
			if (!trip.owners.some((o) => o.id === ownerId)) {
				throw new Error(`Owner "${ownerId}" not found`);
			}
		}
	}

	const merged: string[] = [...trip.settings.tags];
	for (const tag of expense.tags) {
		if (!merged.includes(tag)) merged.push(tag);
	}
	const expenseToWrite: Expense = { ...expense, tags: merged };

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
	data.expenses.push(expenseToWrite);
	writeFileSync(filePath, stringify(data));
	trip.expenses.push(expenseToWrite);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/core/services/expense/__tests__/expenseService.test.ts`
Expected: PASS — all addExpense tests (existing + 4 new) pass.

- [ ] **Step 5: Run full test suite**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 6: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/expense/addExpense.ts src/core/services/expense/__tests__/expenseService.test.ts
git commit -m "feat(core): addExpense merges trip default tags into new expenses"
```

---

## Task 7: TripCreate adds countries field

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Add the countries field to the form fields list**

Open `src/tui/screens/TripCreate.tsx`. The `fields` array currently ends with the `endDate` entry. Append a new field after `endDate`:

```ts
		{
			key: "endDate",
			label: "End Date",
			type: "date",
			required: true,
			defaultValue: addDays(today(), 1),
		},
		{
			key: "countries",
			label: "Countries (comma-separated)",
			type: "text",
			required: false,
			placeholder: "e.g. Japan, Korea",
		},
```

- [ ] **Step 2: Parse countries on submit**

In the `onSubmit` handler, after the existing `endDate` extraction and before the `explicitDirName` line, parse the countries input:

```ts
const countriesStr = values["countries"] ?? "";
const countries = countriesStr
	.split(",")
	.map((s) => s.trim())
	.filter((s) => s !== "");
```

Then update the `settings` object to include them:

```ts
const settings: Settings = {
	...DEFAULT_TRIP_SETTINGS,
	name,
	startDate,
	endDate,
	countries,
};
```

- [ ] **Step 3: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 4: Manual verification**

Run: `bun run start --data-dir ./tmp-data`
Steps:
- Press `[n]` (or whatever the "New" menu key is) to start TripCreate.
- Fill name = `Japan Test`, leave countries blank → submit → check `tmp-data/japan-test-2026/settings.yaml` → `countries: []`.
- Create another trip with countries = `Japan, Korea, Taiwan` → settings.yaml shows `countries: [Japan, Korea, Taiwan]`.
- Quit (`[esc]`).

- [ ] **Step 5: Clean up tmp data and commit**

```bash
rm -rf tmp-data
git add src/tui/screens/TripCreate.tsx
git commit -m "feat(tui): TripCreate accepts countries (comma-separated)"
```

---

## Task 8: TripCreate adds zventId field and generates Zvent tag

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Import the new helpers + constants**

At the top of `src/tui/screens/TripCreate.tsx`, update imports:

```ts
import { DEFAULT_TRIP_SETTINGS, ZVENT_ID_PATTERN } from "../../core/constants";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import {
	buildZventTag,
	createTrip,
	nextZventId,
	toDirName,
} from "../../core/services/trip";
```

- [ ] **Step 2: Add the zventId field**

After the `countries` field added in Task 7, append:

```ts
		{
			key: "zventId",
			label: "Zvent ID (3 digits, blank for auto)",
			type: "text",
			required: false,
			placeholder: () => nextZventId(dataDir),
		},
```

The `placeholder` is a function so the auto-id preview is computed when the form renders.

- [ ] **Step 3: Resolve and validate zventId on submit**

In the `onSubmit` handler, *before* the `if (!isValidSlug(dirName))` check, add:

```ts
const rawZventId = (values["zventId"] ?? "").trim();
let zventId: string;
if (rawZventId === "") {
	zventId = nextZventId(dataDir);
} else if (ZVENT_ID_PATTERN.test(rawZventId)) {
	zventId = rawZventId;
} else {
	setError(`Zvent ID "${rawZventId}" must be exactly 3 digits.`);
	return;
}
```

- [ ] **Step 4: Build the Zvent tag and add it to settings.tags**

Replace the `settings` construction (the one updated in Task 7) with:

```ts
const zventTag = buildZventTag(zventId, name, endDate);
const settings: Settings = {
	...DEFAULT_TRIP_SETTINGS,
	name,
	startDate,
	endDate,
	countries,
	tags: [zventTag],
};
```

- [ ] **Step 5: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 6: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 7: Manual verification**

Run: `bun run start --data-dir ./tmp-data`
Steps:
- Create a trip with name `First`, end date `2026-04-15`, blank zventId. Inspect `tmp-data/first-2026/settings.yaml` → `tags: ["Zvent: 001 First (Apr 2026)"]`.
- Create a second trip with blank zventId. Inspect → tag id is `002`.
- Create a third trip with explicit zventId `050`. Inspect → tag id is `050`.
- Create a fourth trip with zventId `abc` → expect inline red error "Zvent ID "abc" must be exactly 3 digits.", form does not submit.
- Quit and cleanup.

- [ ] **Step 8: Commit**

```bash
rm -rf tmp-data
git add src/tui/screens/TripCreate.tsx
git commit -m "feat(tui): TripCreate generates per-trip Zvent tag with auto/manual id"
```

---

## Task 9: TripDuplicate adds zventId field and rebuilds Zvent tag

**Files:**
- Modify: `src/tui/screens/TripDuplicate.tsx`

- [ ] **Step 1: Update imports**

At the top of `src/tui/screens/TripDuplicate.tsx`, add to the existing core imports:

```ts
import { ZVENT_ID_PATTERN, ZVENT_TAG_REGEX } from "../../core/constants";
import {
	buildZventTag,
	duplicateTrip,
	nextZventId,
	toDirName,
	updateSettings,
} from "../../core/services/trip";
```

- [ ] **Step 2: Add the zventId field**

Update the `fields` array. Replace:

```ts
const fields: FormFieldConfig[] = [
	{
		key: "newName",
		label: "New Trip Name",
		type: "text",
		required: true,
		placeholder: `e.g. ${sourceName} v2`,
	},
];
```

with:

```ts
const fields: FormFieldConfig[] = [
	{
		key: "newName",
		label: "New Trip Name",
		type: "text",
		required: true,
		placeholder: `e.g. ${sourceName} v2`,
	},
	{
		key: "zventId",
		label: "Zvent ID (3 digits, blank for auto)",
		type: "text",
		required: false,
		placeholder: () => nextZventId(dataDir),
	},
];
```

- [ ] **Step 3: Replace the onSubmit handler**

Replace the entire `onSubmit` callback with:

```ts
onSubmit={(values) => {
	const name = values["newName"] ?? "";

	const rawZventId = (values["zventId"] ?? "").trim();
	let zventId: string;
	if (rawZventId === "") {
		zventId = nextZventId(dataDir);
	} else if (ZVENT_ID_PATTERN.test(rawZventId)) {
		zventId = rawZventId;
	} else {
		setError(`Zvent ID "${rawZventId}" must be exactly 3 digits.`);
		return;
	}

	const dirName = toDirName(name, sourceStartDate);
	const tripPath = join(dataDir, dirName);
	if (existsSync(tripPath)) {
		setError(`Trip "${name}" already exists (${dirName})`);
		return;
	}
	setError(null);

	const newTrip = duplicateTrip(dataDir, sourceDirPath, dirName, name);
	const tagsWithoutOldZvent = newTrip.settings.tags.filter(
		(t) => !ZVENT_TAG_REGEX.test(t),
	);
	const newZventTag = buildZventTag(
		zventId,
		name,
		newTrip.settings.endDate,
	);
	updateSettings(newTrip.dirPath, {
		tags: [newZventTag, ...tagsWithoutOldZvent],
	});

	// Pop the form AND the duplicate-selector entry so the user
	// lands back on the normal trip list after a successful duplicate.
	goBack();
	goBack();
}}
```

- [ ] **Step 4: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 6: Manual verification**

Run: `bun run start --data-dir ./tmp-data`
Steps:
- Create a trip `First` (auto zventId → 001).
- From the trips list, press `[d]` (or whatever the duplicate menu key is) and pick `First`. Provide new name `First Copy`, blank zventId. Inspect `tmp-data/first-copy-2026/settings.yaml`:
  - `tags[0]` matches `^Zvent: 002 First Copy \(...\)`
  - The original `Zvent: 001 First …` is no longer present.
- Duplicate again with explicit zventId `099` → tag is `Zvent: 099 …`.
- Duplicate with `xx` → inline error.
- Quit and cleanup.

- [ ] **Step 7: Commit**

```bash
rm -rf tmp-data
git add src/tui/screens/TripDuplicate.tsx
git commit -m "feat(tui): TripDuplicate rebuilds Zvent tag with new id and name"
```

---

## Task 10: ExpenseForm shows default-tag hint in label

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Compute the dynamic Tags label**

Open `src/tui/screens/ExpenseForm.tsx`. The `fields` array is built inside a `useMemo` (around line 36). Inside that `useMemo`, before the `return [` line, add:

```ts
const defaults = trip.settings.tags;
const tagsLabel =
	defaults.length > 0
		? `Tags (auto-adds: ${defaults.join(", ")})`
		: "Tags";
```

- [ ] **Step 2: Use the computed label**

In the same `fields` array, find the existing tags field:

```ts
{
	key: "tags",
	label: "Tags",
	type: "text",
	placeholder: "comma-separated",
},
```

Replace `label: "Tags"` with `label: tagsLabel`:

```ts
{
	key: "tags",
	label: tagsLabel,
	type: "text",
	placeholder: "comma-separated",
},
```

- [ ] **Step 3: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 4: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Manual verification**

Run: `bun run start --data-dir ./tmp-data`
Steps:
- Create a trip (auto-generates a Zvent tag in `settings.tags`).
- Add an account and an owner to the trip (existing flows).
- Open the new-expense form. The Tags row label should read:
  `Tags (auto-adds: Zvent: 001 ...)`
- Submit an expense with user tags `food, drinks`. Open `expenses.yaml`. The expense's `tags` array should be `[Zvent: 001 ..., food, drinks]`.
- Add a second tag to settings via Settings > Tags (e.g., `team-lunch`). Re-open the new-expense form. The label should now read:
  `Tags (auto-adds: Zvent: 001 ..., team-lunch)`
- Quit and cleanup.

- [ ] **Step 6: Commit**

```bash
rm -rf tmp-data
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): ExpenseForm Tags label shows trip default tags"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 4: End-to-end manual run**

Run: `bun run start --data-dir ./tmp-data`
Walk through:
1. Create trip A (countries `Japan, Korea`, blank zventId) → settings.yaml: `countries: [Japan, Korea]`, `tags: [Zvent: 001 A (... ...)]`.
2. Create trip B (blank zventId) → tags: `[Zvent: 002 B (...)]`.
3. Duplicate trip A to `A Copy` (blank zventId) → tags: `[Zvent: 003 A Copy (...)]`.
4. In trip A, add owner + account, then create an expense. Saved expense's `tags` includes the Zvent tag plus any user-typed tags.
5. Edit the expense — saved tags do **not** re-apply defaults if user removes one.
6. In Settings > Tags, add a new tag `team-lunch`. Create a new expense in trip A. New expense includes `Zvent: 001 ...` AND `team-lunch`.

- [ ] **Step 5: Cleanup**

```bash
rm -rf tmp-data
```

No commit — verification only.
