# Optional Trip-Level Exchange Rate + Currency Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CurrencyConfig.exchangeRate` optional and allow renaming a currency code on the Edit screen, with rename blocked when any expense references the old code.

**Architecture:** Pure-core changes first (model + new reference-finder service + tests), then TUI changes screen-by-screen. The conversion path already tolerates a missing trip rate, so no service logic changes there. Rename rejection lives in the `CurrencyEdit` submit handler and uses the Form organism's existing inline-error display (thrown errors are caught and rendered).

**Tech Stack:** TypeScript, Bun runtime, Bun's built-in test runner (`bun:test`), React + Ink (TUI), `yaml` library for persistence.

**Spec:** `docs/superpowers/specs/2026-05-14-optional-trip-exchange-rate-design.md`

---

## File Inventory

**New files:**

- `src/core/services/currency/findCurrencyReferences.ts` — service that returns expenses referencing a given currency code.
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts` — tests for the new service.

**Modified files:**

- `src/core/models/settings.ts` — `CurrencyConfig.exchangeRate` becomes optional.
- `src/core/services/currency/index.ts` — re-export the new service.
- `src/tui/screens/CurrencyCreate.tsx` — rate field becomes optional.
- `src/tui/screens/CurrencyEdit.tsx` — adds editable `code` field; rate becomes optional; rename validation.
- `src/tui/screens/CurrencyList.tsx` — renders `"rate: (not set)"` when rate is absent.
- `src/tui/screens/CurrencyDelete.tsx` — same display change.
- `src/core/services/trip/__tests__/updateSettings.test.ts` — round-trip test for absent `exchangeRate`.
- `src/core/services/trip/__tests__/getTripStatus.test.ts` — explicit case: currency entry exists with no rate AND expense has no rate.
- `src/core/services/export/__tests__/exportCsv.test.ts` — assertion that export still throws when both rates are missing.

---

## Task 1: Add `findCurrencyReferences` service (TDD)

**Files:**
- Create: `src/core/services/currency/findCurrencyReferences.ts`
- Create: `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
- Modify: `src/core/services/currency/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
import { findCurrencyReferences } from "../findCurrencyReferences";

function makeTrip(expenses: Trip["expenses"]): Trip {
	return {
		dirPath: "/tmp/trip",
		settings: {
			name: "T",
			startDate: "2026-05-01",
			endDate: "2026-05-07",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "./expenses.csv",
		},
		owners: [],
		accounts: [],
		expenses,
	};
}

function expense(id: string, currency: string): Trip["expenses"][number] {
	return {
		id,
		accountId: "a",
		date: "2026-05-02",
		payee: "X",
		category: "Food",
		amount: 100,
		currency,
		description: "",
		tags: [],
	};
}

describe("findCurrencyReferences", () => {
	test("returns empty when no expenses use the code", () => {
		const trip = makeTrip([expense("e1", "THB"), expense("e2", "USD")]);
		expect(findCurrencyReferences(trip, "JPY")).toEqual({ expenses: [] });
	});

	test("returns expenses that use the code", () => {
		const e1 = expense("e1", "JPY");
		const e2 = expense("e2", "THB");
		const e3 = expense("e3", "JPY");
		const trip = makeTrip([e1, e2, e3]);
		expect(findCurrencyReferences(trip, "JPY")).toEqual({
			expenses: [e1, e3],
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
Expected: FAIL — cannot import `findCurrencyReferences` (module does not exist).

- [ ] **Step 3: Implement the service**

Create `src/core/services/currency/findCurrencyReferences.ts`:

```ts
import type { Expense, Trip } from "../../models";

export interface CurrencyReferences {
	expenses: Expense[];
}

export function findCurrencyReferences(
	trip: Trip,
	code: string,
): CurrencyReferences {
	return { expenses: trip.expenses.filter((e) => e.currency === code) };
}
```

- [ ] **Step 4: Add to barrel export**

Modify `src/core/services/currency/index.ts`:

```ts
export { convertToTHB } from "./convertToThb";
export type { CurrencyReferences } from "./findCurrencyReferences";
export { findCurrencyReferences } from "./findCurrencyReferences";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run type check and linter**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/currency/findCurrencyReferences.ts \
        src/core/services/currency/__tests__/findCurrencyReferences.test.ts \
        src/core/services/currency/index.ts
git commit -m "feat(core): add findCurrencyReferences service"
```

---

## Task 2: Make `CurrencyConfig.exchangeRate` optional

**Files:**
- Modify: `src/core/models/settings.ts`
- Modify: `src/core/services/trip/__tests__/updateSettings.test.ts`

- [ ] **Step 1: Write the failing round-trip test**

Add this `test` block at the end of the `describe("updateSettings", ...)` block in `src/core/services/trip/__tests__/updateSettings.test.ts` (before the closing `});`):

```ts
test("round-trips currency config without exchangeRate", () => {
    const tripDir = createFixture();
    updateSettings(tripDir, {
        currencies: {
            JPY: { exchangeRate: 0.23 },
            USD: {},
        },
    });

    const trip = loadTrip(tripDir);
    expect(trip.settings.currencies).toEqual({
        JPY: { exchangeRate: 0.23 },
        USD: {},
    });
    expect(trip.settings.currencies.USD?.exchangeRate).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/updateSettings.test.ts -t "round-trips currency config"`
Expected: FAIL — TypeScript error on `USD: {}` because `CurrencyConfig` requires `exchangeRate`. (If you run the test file unchanged from disk, the failure surfaces at type check; if not, at the `toEqual` assertion.)

- [ ] **Step 3: Make `exchangeRate` optional in the model**

Modify `src/core/models/settings.ts`:

```ts
export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: string[];
	tags: string[];
	exportPath: string;
}
```

(Only line 2 changes — `exchangeRate: number;` → `exchangeRate?: number;`.)

- [ ] **Step 4: Run the new test to verify it passes**

Run: `bun test src/core/services/trip/__tests__/updateSettings.test.ts -t "round-trips currency config"`
Expected: PASS.

- [ ] **Step 5: Run the full type check**

Run: `bun run check:type`
Expected: clean. (If any UI screen breaks because it indexes `exchangeRate` without optional-chaining, that's caught later — but the model change alone should not break the existing screens, all of which already use `config.exchangeRate` after destructuring and will still type-check at the read site. Verify before proceeding.)

- [ ] **Step 6: Run the full test suite**

Run: `bun test`
Expected: all existing tests still pass — none of them assert the *absence* of `exchangeRate`, so making it optional is backward-compatible.

- [ ] **Step 7: Commit**

```bash
git add src/core/models/settings.ts \
        src/core/services/trip/__tests__/updateSettings.test.ts
git commit -m "feat(core): make CurrencyConfig.exchangeRate optional"
```

---

## Task 3: Confirm conversion path tolerates missing trip rate (explicit tests)

**Files:**
- Modify: `src/core/services/trip/__tests__/getTripStatus.test.ts`
- Modify: `src/core/services/export/__tests__/exportCsv.test.ts`

This task pins down the behavior promised by the spec — that the conversion path is unchanged but a currency entry without a rate is a real, supported state.

- [ ] **Step 1: Write the failing tripStatus test**

Add this `test` block at the end of the `describe("getTripStatus — spend", ...)` (or wherever the "excludes expenses with missing rate" test lives — same describe block) in `src/core/services/trip/__tests__/getTripStatus.test.ts`:

```ts
test("currency entry present without rate falls through to missing-rate warning", () => {
    const trip = makeTrip({
        settings: {
            ...makeTrip().settings,
            currencies: { JPY: {} },
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
    expect(s.totalSpendThb).toBe(0);
    expect(s.warnings).toContain(
        "1 expense missing THB rate (excluded from totals)",
    );
});
```

- [ ] **Step 2: Run test to verify it passes (no impl change needed)**

Run: `bun test src/core/services/trip/__tests__/getTripStatus.test.ts -t "currency entry present without rate"`
Expected: PASS. (`getTripStatus` already uses `settings.currencies[expense.currency]?.exchangeRate`, which yields `undefined` whether the key is missing or the rate is absent.)

- [ ] **Step 3: Write the failing exportCsv test**

Add this `test` block at the end of the `describe("exportCSV", ...)` block in `src/core/services/export/__tests__/exportCsv.test.ts` (before the closing `});`):

```ts
test("throws when expense has no rate and trip rate is absent", () => {
    const trip = makeTripFixture();
    trip.settings.currencies = { JPY: {} };
    trip.expenses = [
        {
            id: "e1",
            accountId: "a1",
            date: "2026-05-02",
            payee: "Shop",
            category: "Eating",
            amount: 1000,
            currency: "JPY",
            description: "",
            tags: [],
            owners: ["alice"],
        },
    ];
    expect(() => exportCSV(trip)).toThrow(
        "No exchange rate available for JPY",
    );
});
```

- [ ] **Step 4: Run test to verify it passes (no impl change needed)**

Run: `bun test src/core/services/export/__tests__/exportCsv.test.ts -t "throws when expense has no rate"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `bun test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/__tests__/getTripStatus.test.ts \
        src/core/services/export/__tests__/exportCsv.test.ts
git commit -m "test(core): cover currency entry with no exchangeRate"
```

---

## Task 4: Make rate field optional in `CurrencyCreate`

**Files:**
- Modify: `src/tui/screens/CurrencyCreate.tsx`

This screen is not under unit-test coverage; verification is manual + type check.

- [ ] **Step 1: Update field definition and submit handler**

Replace the entire contents of `src/tui/screens/CurrencyCreate.tsx` with:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "code",
		label: "Currency Code",
		type: "text",
		required: true,
		placeholder: "e.g. JPY",
	},
	{
		key: "exchangeRate",
		label: "Exchange Rate (to THB)",
		type: "text",
		required: false,
		placeholder: "e.g. 0.23",
	},
];

export function CurrencyCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Currencies > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const code = getString(values, "code").trim().toUpperCase();
				if (!code) {
					goBack();
					return;
				}
				const rateStr = getString(values, "exchangeRate").trim();
				const rate = rateStr === "" ? Number.NaN : Number.parseFloat(rateStr);
				const config: CurrencyConfig = Number.isFinite(rate)
					? { exchangeRate: rate }
					: {};
				const updated: Record<string, CurrencyConfig> = {
					...trip.settings.currencies,
					[code]: config,
				};
				updateSettings(trip.dirPath, { currencies: updated });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

Diff vs. current:
1. `exchangeRate` field has `required: false` (was `true`). Form auto-appends "(optional)" to the label.
2. Submit handler parses `rate` and stores `{}` when blank or non-numeric, `{ exchangeRate: rate }` otherwise. The early-return when `code` is empty replaces the old `code && !Number.isNaN(rate)` guard (rate is no longer required).

- [ ] **Step 2: Run type check and linter**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/CurrencyCreate.tsx
git commit -m "feat(tui): currency create rate field is optional"
```

---

## Task 5: List and Delete screens show "(not set)" when rate is absent

**Files:**
- Modify: `src/tui/screens/CurrencyList.tsx`
- Modify: `src/tui/screens/CurrencyDelete.tsx`

- [ ] **Step 1: Update `CurrencyList.tsx` detail rendering**

In `src/tui/screens/CurrencyList.tsx`, replace this block (around line 59-63):

```tsx
options={entries.map(([code, config]) => ({
    label: code,
    value: code,
    detail: `rate: ${config.exchangeRate}`,
}))}
```

with:

```tsx
options={entries.map(([code, config]) => ({
    label: code,
    value: code,
    detail:
        config.exchangeRate !== undefined
            ? `rate: ${config.exchangeRate}`
            : "rate: (not set)",
}))}
```

- [ ] **Step 2: Update `CurrencyDelete.tsx` detail rendering**

In `src/tui/screens/CurrencyDelete.tsx`, replace this block (around line 40-44):

```tsx
options={entries.map(([code, config]) => ({
    label: code,
    value: code,
    detail: `rate: ${config.exchangeRate}`,
}))}
```

with:

```tsx
options={entries.map(([code, config]) => ({
    label: code,
    value: code,
    detail:
        config.exchangeRate !== undefined
            ? `rate: ${config.exchangeRate}`
            : "rate: (not set)",
}))}
```

- [ ] **Step 3: Run type check and linter**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/CurrencyList.tsx src/tui/screens/CurrencyDelete.tsx
git commit -m "feat(tui): show '(not set)' for currencies without exchange rate"
```

---

## Task 6: Editable code + optional rate + rename validation in `CurrencyEdit`

**Files:**
- Modify: `src/tui/screens/CurrencyEdit.tsx`

Verification is manual (no TUI unit tests in this repo).

- [ ] **Step 1: Replace `CurrencyEdit.tsx`**

Replace the entire contents of `src/tui/screens/CurrencyEdit.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { findCurrencyReferences } from "../../core/services/currency";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function CurrencyEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { currencyCode: code } = useRouteProps(
		"/trips/settings/currencies/edit",
	);

	useEffect(() => {
		setTitleSuffix(`Settings > Currencies > ${code}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, code]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const existing = trip.settings.currencies[code];
	if (!existing) {
		return <Text dimColor>Currency "{code}" not found.</Text>;
	}

	const fields: FormFieldConfig[] = [
		{
			key: "code",
			label: "Currency Code",
			type: "text",
			required: true,
			defaultValue: code,
		},
		{
			key: "exchangeRate",
			label: `Exchange Rate for ${code}`,
			type: "text",
			required: false,
			...(existing.exchangeRate !== undefined
				? { defaultValue: String(existing.exchangeRate) }
				: {}),
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const newCode = getString(values, "code").trim().toUpperCase();
				if (!newCode) {
					throw new Error("Currency code is required");
				}

				const rateStr = getString(values, "exchangeRate").trim();
				const rate =
					rateStr === "" ? Number.NaN : Number.parseFloat(rateStr);
				const config: CurrencyConfig = Number.isFinite(rate)
					? { exchangeRate: rate }
					: {};

				if (newCode === code) {
					const updated: Record<string, CurrencyConfig> = {
						...trip.settings.currencies,
						[code]: config,
					};
					updateSettings(trip.dirPath, { currencies: updated });
					reloadTrip();
					goBack();
					return;
				}

				if (trip.settings.currencies[newCode] !== undefined) {
					throw new Error(`Currency '${newCode}' already exists`);
				}

				const refs = findCurrencyReferences(trip, code);
				if (refs.expenses.length > 0) {
					throw new Error(
						`Cannot rename: ${refs.expenses.length} expense(s) reference '${code}'`,
					);
				}

				const { [code]: _removed, ...rest } = trip.settings.currencies;
				const updated: Record<string, CurrencyConfig> = {
					...rest,
					[newCode]: config,
				};
				updateSettings(trip.dirPath, { currencies: updated });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

Diff vs. current:
1. Two fields instead of one: `code` (required, defaultValue = current code) + `exchangeRate` (optional, defaultValue only set when defined).
2. The submit handler now branches: same-code → just update the config; different-code → validate uniqueness, validate references via `findCurrencyReferences`, then move the entry to the new key.
3. Thrown errors are caught by the `Form` and rendered inline (see `Form.tsx` lines 109–114, 310–313).
4. Imports `findCurrencyReferences` from the currency barrel.

- [ ] **Step 2: Run type check and linter**

Run: `bun run check:type && bun run check`
Expected: clean. The conditional spread `...(existing.exchangeRate !== undefined ? { defaultValue: ... } : {})` is required because `tsconfig` has `exactOptionalPropertyTypes: true`.

- [ ] **Step 3: Run the full test suite**

Run: `bun test`
Expected: all green. (No tests target this screen directly, but type-checking it exercises the model + service signatures.)

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/CurrencyEdit.tsx
git commit -m "feat(tui): editable currency code with rename validation"
```

---

## Task 7: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run all checks together**

Run: `bun run check:type && bun run check && bun test`
Expected: all clean / green.

- [ ] **Step 2: Manual UI verification**

Start the app with a scratch data directory:

```bash
bun run start --data-dir /tmp/finmove-rate-test
```

Walk through these flows:

1. Create a trip if none exists; navigate to **Settings → Currencies → Add**.
2. **Add a currency without a rate** (e.g., code `EUR`, leave rate blank). Submit. Confirm the list shows `EUR — rate: (not set)`.
3. **Edit `EUR`**, give it a rate (e.g., `38.5`). Confirm list now shows `EUR — rate: 38.5`.
4. **Edit `EUR` again, change the code to `EURO`** with no expenses using it. Confirm settings show `EURO` instead of `EUR`.
5. Add an expense in currency `EURO`. **Edit `EURO`, try to rename to `EUR`**. Confirm inline error `Cannot rename: 1 expense(s) reference 'EURO'` appears; settings unchanged.
6. Add a second currency `USD` with rate `35`. **Edit `EURO` and try to rename to `USD`**. Confirm inline error `Currency 'USD' already exists`; settings unchanged.
7. **Edit `EURO`, confirm the code (press Enter to keep it), then clear the rate and submit.** Confirm list shows `EURO — rate: (not set)`.

- [ ] **Step 3: Confirm completion**

Report back with a one-line summary of the verification and the commit range, e.g.:

> "All checks pass and manual flows verified. Commits `<first-sha>..<last-sha>` ready for review."

---

## Self-Review Checklist (already run by the planner)

- **Spec coverage:** Tasks 1–6 cover every "In scope" item. Manual verification in Task 7 covers each scenario listed in the spec's "Verification" section.
- **Placeholders:** none.
- **Type consistency:** `CurrencyConfig`, `CurrencyReferences`, `findCurrencyReferences(trip, code)` signatures match across tasks. `Number.parseFloat` + `Number.isFinite` is used uniformly to validate blank / non-numeric input.
- **Behavior consistency:** Create handles blank rate as `{}`; Edit handles blank rate the same way. Same `code.trim().toUpperCase()` normalization in both Create and Edit. Same parsing logic in both.
