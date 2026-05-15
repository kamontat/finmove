# Default Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `default: boolean` field to settings tags so that new expenses are pre-tagged with the tags marked default.

**Architecture:** Promote `Settings.tags` from `string[]` to `Tag[] = { value: string; default: boolean }[]`. Normalize legacy YAML on load (rewrite file once). `Expense.tags: string[]` stays unchanged. `ExpenseForm` seeds the tags buffer with default-tag names only on brand-new expenses (edit and duplicate keep current behavior).

**Tech Stack:** TypeScript, Bun runtime + test runner, React+Ink TUI, YAML for storage.

**Spec:** `docs/superpowers/specs/2026-05-15-default-tags-design.md`

---

## File Structure

**New files:**
- `src/core/models/tag.ts` — `Tag` interface
- `src/core/validators/tag.ts` — `validateTag` function
- `src/core/validators/__tests__/tag.test.ts` — validator unit tests
- `src/core/services/trip/__tests__/loadTrip.test.ts` — normalization tests

**Modified files:**
- `src/core/models/settings.ts` — `tags: Tag[]`
- `src/core/models/index.ts` — re-export `Tag`
- `src/core/validators/index.ts` — re-export `validateTag`
- `src/core/services/trip/loadTrip.ts` — normalize + rewrite settings.yaml on legacy load
- `src/tui/screens/TagCreate.tsx` — Default field + uniqueness validation
- `src/tui/screens/TagEdit.tsx` — Default field + uniqueness validation
- `src/tui/screens/TagList.tsx` — suffix marker, work with `Tag[]`
- `src/tui/screens/TagDelete.tsx` — work with `Tag[]`
- `src/tui/screens/TagSelect.tsx` — work with `Tag[]`
- `src/tui/screens/ExpenseForm.tsx` — seed defaults on new expenses

**Test fixtures to update (Settings only, not Expense):**
- `src/core/services/account/__tests__/accountService.test.ts:24`
- `src/core/services/owner/__tests__/ownerService.test.ts:23`
- `src/core/services/trip/__tests__/tripService.test.ts:29,130`
- `src/core/services/trip/__tests__/sortTrips.test.ts:14`
- `src/core/services/trip/__tests__/getTripStatus.test.ts` (lines 17, 515 are settings; many `tags: []` in expense fixtures stay as `string[]`)
- `src/core/services/trip/__tests__/updateSettings.test.ts:19`
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts:16`
- `src/core/validators/__tests__/validators.test.ts:16`

---

## Task 1: Add Tag model

**Files:**
- Create: `src/core/models/tag.ts`
- Modify: `src/core/models/index.ts`

- [ ] **Step 1: Create the Tag interface**

Create `src/core/models/tag.ts`:

```ts
export interface Tag {
	value: string;
	default: boolean;
}
```

- [ ] **Step 2: Re-export from models barrel**

Edit `src/core/models/index.ts` — add the re-export. The file currently contains:

```ts
export type { Account } from "./account";
export { AccountType } from "./account";
export type { Expense, ExpenseOwnerSplit } from "./expense";
export { SplitType } from "./expense";
export type { Owner } from "./owner";
export type { CurrencyConfig, Settings } from "./settings";
export type { Trip } from "./trip";
```

Add a line after the Owner export:

```ts
export type { Tag } from "./tag";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run check:type`
Expected: PASS (no usage of `Tag` yet, so no errors).

- [ ] **Step 4: Commit**

```bash
git add src/core/models/tag.ts src/core/models/index.ts
git commit -m "feat(core): add Tag model"
```

---

## Task 2: Add validateTag

**Files:**
- Create: `src/core/validators/tag.ts`
- Create: `src/core/validators/__tests__/tag.test.ts`
- Modify: `src/core/validators/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/validators/__tests__/tag.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Tag } from "../../models";
import { validateTag } from "../tag";

const existing: Tag[] = [
	{ value: "business", default: false },
	{ value: "personal", default: true },
];

describe("validateTag", () => {
	test("passes for a new unique value", () => {
		expect(validateTag("travel", existing)).toEqual([]);
	});

	test("fails when value is empty", () => {
		expect(validateTag("", existing)).toContain("Tag is required");
	});

	test("fails when value is whitespace only", () => {
		expect(validateTag("   ", existing)).toContain("Tag is required");
	});

	test("fails when value duplicates another tag", () => {
		expect(validateTag("business", existing)).toContain(
			'Tag "business" already exists',
		);
	});

	test("allows the same value when editing that tag (originalValue match)", () => {
		expect(validateTag("business", existing, "business")).toEqual([]);
	});

	test("still rejects renaming onto another tag", () => {
		expect(validateTag("personal", existing, "business")).toContain(
			'Tag "personal" already exists',
		);
	});
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun test src/core/validators/__tests__/tag.test.ts`
Expected: FAIL — `Cannot find module '../tag'`.

- [ ] **Step 3: Implement validateTag**

Create `src/core/validators/tag.ts`:

```ts
import type { Tag } from "../models";

export function validateTag(
	value: string,
	existing: Tag[],
	originalValue?: string,
): string[] {
	const errors: string[] = [];
	const trimmed = value.trim();
	if (!trimmed) {
		errors.push("Tag is required");
		return errors;
	}
	const collision = existing.some(
		(t) => t.value === trimmed && t.value !== originalValue,
	);
	if (collision) errors.push(`Tag "${trimmed}" already exists`);
	return errors;
}
```

- [ ] **Step 4: Re-export from validators barrel**

Edit `src/core/validators/index.ts` — append:

```ts
export { validateTag } from "./tag";
```

- [ ] **Step 5: Run tests and verify pass**

Run: `bun test src/core/validators/__tests__/tag.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/core/validators/tag.ts src/core/validators/__tests__/tag.test.ts src/core/validators/index.ts
git commit -m "feat(core): add validateTag validator"
```

---

## Task 3: Migrate Settings.tags type and update fixtures

This task is a pure type cascade. After changing `Settings.tags`, every Settings test fixture that uses `tags: ["..."]` becomes a type error. Fix them all in one commit so the tree stays green.

**Files:**
- Modify: `src/core/models/settings.ts`
- Modify: 8 test files (Settings fixtures only)

- [ ] **Step 1: Change Settings.tags to Tag[]**

Edit `src/core/models/settings.ts`. Current content:

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

Add a `Tag` import and change the `tags` line:

```ts
import type { Tag } from "./tag";

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
	tags: Tag[];
	exportPath: string;
}
```

- [ ] **Step 2: Run typecheck to surface all callers**

Run: `bun run check:type`
Expected: FAIL with errors in the 8 fixture files listed below. Use the error output to confirm exact lines.

- [ ] **Step 3: Update fixture in `accountService.test.ts`**

In `src/core/services/account/__tests__/accountService.test.ts`, find the `Settings`-typed object (around line 18-25). Change:

```ts
	tags: [],
```

(no change — empty array is assignable to `Tag[]`). If TS still complains because of inference widening (e.g. `[] as string[]`), change to `tags: [] as Tag[],`. Otherwise leave it.

Note: Lines 155 and 189 in this file are `Expense.tags` — leave them as `string[]`.

- [ ] **Step 4: Update fixture in `ownerService.test.ts`**

Same as Step 3 for `src/core/services/owner/__tests__/ownerService.test.ts`. The `Settings`-typed object near line 17-24 has `tags: []`. Confirm typecheck error and adjust only if needed.

Lines 134, 163, 212, 236, 262 are `Expense.tags` — leave as `string[]`.

- [ ] **Step 5: Update fixture in `tripService.test.ts`**

`src/core/services/trip/__tests__/tripService.test.ts:29`:

```ts
	tags: ["test"],
```

Change to:

```ts
	tags: [{ value: "test", default: false }],
```

Line 130:

```ts
			tags: ["business"],
```

Change to:

```ts
			tags: [{ value: "business", default: false }],
```

- [ ] **Step 6: Update fixture in `sortTrips.test.ts`**

`src/core/services/trip/__tests__/sortTrips.test.ts:14` is `tags: []` inside a Settings object. Likely no change needed; confirm via typecheck.

- [ ] **Step 7: Update fixture in `updateSettings.test.ts`**

`src/core/services/trip/__tests__/updateSettings.test.ts:19`:

```ts
	tags: ["test"],
```

Change to:

```ts
	tags: [{ value: "test", default: false }],
```

This file also calls `updateSettings(tripDir, { tags: ... })` — search the file for any other `tags:` callers and update consistently with `Tag[]` shape.

- [ ] **Step 8: Update fixture in `getTripStatus.test.ts`**

`src/core/services/trip/__tests__/getTripStatus.test.ts` has many `tags: []` occurrences. Most are inside `Expense` objects — leave those alone. The settings fixture at line ~17 is `tags: []` (empty — likely fine; confirm via typecheck).

Line 515 is a Settings fixture with `tags: ["biz", "fun", "family"]`. Change to:

```ts
					tags: [
						{ value: "biz", default: false },
						{ value: "fun", default: false },
						{ value: "family", default: false },
					],
```

Lines 527 and 538 are `Expense.tags` (`["biz", "fun"]` and `["fun"]`) — leave as `string[]`.

- [ ] **Step 9: Update fixture in `findCurrencyReferences.test.ts`**

`src/core/services/currency/__tests__/findCurrencyReferences.test.ts:16` is `tags: []` in Settings — likely no change. Line 35 is Expense — leave alone.

- [ ] **Step 10: Update fixture in `validators.test.ts`**

`src/core/validators/__tests__/validators.test.ts:16` is `tags: []` in `validSettings`. Likely no change. Lines 85, 101, 118 are Expense objects — leave alone.

- [ ] **Step 11: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

If any file still errors, the diagnostic will name the file and line — apply the same pattern (Settings → `Tag[]`, Expense → `string[]`).

- [ ] **Step 12: Run full test suite**

Run: `bun test`
Expected: PASS (all tests still green — only types changed, runtime values are still empty arrays or now-correct `Tag` objects).

- [ ] **Step 13: Commit**

```bash
git add src/core/models/settings.ts \
  src/core/services/account/__tests__/accountService.test.ts \
  src/core/services/owner/__tests__/ownerService.test.ts \
  src/core/services/trip/__tests__/tripService.test.ts \
  src/core/services/trip/__tests__/sortTrips.test.ts \
  src/core/services/trip/__tests__/updateSettings.test.ts \
  src/core/services/trip/__tests__/getTripStatus.test.ts \
  src/core/services/currency/__tests__/findCurrencyReferences.test.ts \
  src/core/validators/__tests__/validators.test.ts
git commit -m "refactor(core): change Settings.tags to Tag[]"
```

If `bun run check:type` flags fixtures that aren't in the list above, include them too — the grep at planning time may have missed some.

---

## Task 4: loadTrip normalization

**Files:**
- Create: `src/core/services/trip/__tests__/loadTrip.test.ts`
- Create: `src/core/services/trip/__tests__/__fixtures__/` (created by test)
- Modify: `src/core/services/trip/loadTrip.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/services/trip/__tests__/loadTrip.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { loadTrip } from "../loadTrip";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

function writeTrip(tripDir: string, settings: unknown): void {
	mkdirSync(tripDir, { recursive: true });
	writeFileSync(join(tripDir, "settings.yaml"), stringify(settings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
}

const baseSettings = {
	name: "Test Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: {},
	categories: ["Food"],
	exportPath: "./expenses.csv",
};

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loadTrip — tag normalization", () => {
	test("converts legacy string tags to Tag objects in memory", () => {
		const tripDir = join(TEST_DIR, "legacy");
		writeTrip(tripDir, { ...baseSettings, tags: ["business", "personal"] });

		const trip = loadTrip(tripDir);

		expect(trip.settings.tags).toEqual([
			{ value: "business", default: false },
			{ value: "personal", default: false },
		]);
	});

	test("rewrites settings.yaml when legacy tags are normalized", () => {
		const tripDir = join(TEST_DIR, "legacy-rewrite");
		writeTrip(tripDir, { ...baseSettings, tags: ["biz"] });

		loadTrip(tripDir);

		const reparsed = parse(readFileSync(join(tripDir, "settings.yaml"), "utf-8"));
		expect(reparsed.tags).toEqual([{ value: "biz", default: false }]);
	});

	test("leaves settings.yaml untouched when tags are already in the new shape", () => {
		const tripDir = join(TEST_DIR, "modern");
		const modernTags = [{ value: "biz", default: true }];
		writeTrip(tripDir, { ...baseSettings, tags: modernTags });

		const before = readFileSync(join(tripDir, "settings.yaml"), "utf-8");
		const trip = loadTrip(tripDir);
		const after = readFileSync(join(tripDir, "settings.yaml"), "utf-8");

		expect(trip.settings.tags).toEqual(modernTags);
		expect(after).toBe(before);
	});

	test("handles empty tag arrays without rewriting", () => {
		const tripDir = join(TEST_DIR, "empty");
		writeTrip(tripDir, { ...baseSettings, tags: [] });

		const before = readFileSync(join(tripDir, "settings.yaml"), "utf-8");
		const trip = loadTrip(tripDir);
		const after = readFileSync(join(tripDir, "settings.yaml"), "utf-8");

		expect(trip.settings.tags).toEqual([]);
		expect(after).toBe(before);
	});
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun test src/core/services/trip/__tests__/loadTrip.test.ts`
Expected: FAIL — first test expects normalized objects but `loadTrip` returns the raw strings.

- [ ] **Step 3: Implement normalization**

Replace the contents of `src/core/services/trip/loadTrip.ts` with:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Account, Expense, Owner, Settings, Tag } from "../../models";

export function loadTrip(tripPath: string): Trip {
	const settingsPath = join(tripPath, "settings.yaml");
	const settingsRaw = readFileSync(settingsPath, "utf-8");
	const ownersRaw = readFileSync(join(tripPath, "owners.yaml"), "utf-8");
	const accountsRaw = readFileSync(join(tripPath, "accounts.yaml"), "utf-8");
	const expensesRaw = readFileSync(join(tripPath, "expenses.yaml"), "utf-8");

	const parsedSettings = parse(settingsRaw) as Omit<Settings, "tags"> & {
		tags?: Array<string | Tag>;
	};

	const { tags: normalizedTags, didNormalize } = normalizeTags(
		parsedSettings.tags ?? [],
	);

	const settings: Settings = { ...parsedSettings, tags: normalizedTags };

	if (didNormalize) {
		writeFileSync(settingsPath, stringify(settings));
	}

	const owners: Owner[] = parse(ownersRaw)?.owners ?? [];
	const accounts: Account[] = parse(accountsRaw)?.accounts ?? [];
	const expenses: Expense[] = parse(expensesRaw)?.expenses ?? [];

	return { dirPath: tripPath, settings, owners, accounts, expenses };
}

function normalizeTags(
	raw: Array<string | Tag>,
): { tags: Tag[]; didNormalize: boolean } {
	let didNormalize = false;
	const tags: Tag[] = raw.map((entry) => {
		if (typeof entry === "string") {
			didNormalize = true;
			return { value: entry, default: false };
		}
		return entry;
	});
	return { tags, didNormalize };
}

import type { Trip } from "../../models";
```

Move the `Trip` import up next to the others — the inline import at the bottom of the snippet above is just to make this code block self-contained. The final file should have all type imports at the top:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Account, Expense, Owner, Settings, Tag, Trip } from "../../models";

export function loadTrip(tripPath: string): Trip {
	const settingsPath = join(tripPath, "settings.yaml");
	const settingsRaw = readFileSync(settingsPath, "utf-8");
	const ownersRaw = readFileSync(join(tripPath, "owners.yaml"), "utf-8");
	const accountsRaw = readFileSync(join(tripPath, "accounts.yaml"), "utf-8");
	const expensesRaw = readFileSync(join(tripPath, "expenses.yaml"), "utf-8");

	const parsedSettings = parse(settingsRaw) as Omit<Settings, "tags"> & {
		tags?: Array<string | Tag>;
	};

	const { tags: normalizedTags, didNormalize } = normalizeTags(
		parsedSettings.tags ?? [],
	);

	const settings: Settings = { ...parsedSettings, tags: normalizedTags };

	if (didNormalize) {
		writeFileSync(settingsPath, stringify(settings));
	}

	const owners: Owner[] = parse(ownersRaw)?.owners ?? [];
	const accounts: Account[] = parse(accountsRaw)?.accounts ?? [];
	const expenses: Expense[] = parse(expensesRaw)?.expenses ?? [];

	return { dirPath: tripPath, settings, owners, accounts, expenses };
}

function normalizeTags(
	raw: Array<string | Tag>,
): { tags: Tag[]; didNormalize: boolean } {
	let didNormalize = false;
	const tags: Tag[] = raw.map((entry) => {
		if (typeof entry === "string") {
			didNormalize = true;
			return { value: entry, default: false };
		}
		return entry;
	});
	return { tags, didNormalize };
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `bun test src/core/services/trip/__tests__/loadTrip.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Run full test suite**

Run: `bun test`
Expected: PASS — no regressions in other suites.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/trip/loadTrip.ts src/core/services/trip/__tests__/loadTrip.test.ts
git commit -m "feat(core): normalize legacy string tags on load"
```

---

## Task 5: TagCreate — Default field + validation

**Files:**
- Modify: `src/tui/screens/TagCreate.tsx`

- [ ] **Step 1: Update the component**

Replace `src/tui/screens/TagCreate.tsx` with:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { validateTag } from "../../core/validators";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Tag",
		type: "text",
		required: true,
		placeholder: "e.g. business",
	},
	{
		key: "default",
		label: "Default",
		type: "select",
		required: true,
		options: [
			{ label: "No", value: "false" },
			{ label: "Yes", value: "true" },
		],
		defaultValue: "false",
	},
];

export function TagCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = getString(values, "value").trim();
				const errors = validateTag(value, trip.settings.tags);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const isDefault = getString(values, "default") === "true";
				updateSettings(trip.dirPath, {
					tags: [...trip.settings.tags, { value, default: isDefault }],
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Smoke-test interactively**

Run: `bun run start --trip <existing-test-trip>` (or create a throwaway trip first), navigate to Settings → Tags → Add. Confirm:
- Both fields show
- Default defaults to "No"
- Submitting an empty tag surfaces "Tag is required"
- Submitting a duplicate name surfaces 'Tag "x" already exists'
- Submitting "work" with Default=Yes adds it and the YAML now has `{value: "work", default: true}`

If you can't run interactively, skip and rely on Task 9's end-to-end check.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TagCreate.tsx
git commit -m "feat(tui): add Default field to tag create form"
```

---

## Task 6: TagEdit — Default field + validation

**Files:**
- Modify: `src/tui/screens/TagEdit.tsx`

- [ ] **Step 1: Update the component**

Replace `src/tui/screens/TagEdit.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { validateTag } from "../../core/validators";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TagEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { value: originalValue } = useRouteProps("/trips/settings/tags/edit");

	useEffect(() => {
		setTitleSuffix(`Settings > Tags > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const originalTag = trip.settings.tags.find((t) => t.value === originalValue);
	if (!originalTag) return <Text dimColor>Tag not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Tag",
			type: "text",
			required: true,
			defaultValue: originalTag.value,
		},
		{
			key: "default",
			label: "Default",
			type: "select",
			required: true,
			options: [
				{ label: "No", value: "false" },
				{ label: "Yes", value: "true" },
			],
			defaultValue: originalTag.default ? "true" : "false",
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = getString(values, "value").trim();
				const errors = validateTag(next, trip.settings.tags, originalValue);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const isDefault = getString(values, "default") === "true";
				updateSettings(trip.dirPath, {
					tags: trip.settings.tags.map((t) =>
						t.value === originalValue ? { value: next, default: isDefault } : t,
					),
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TagEdit.tsx
git commit -m "feat(tui): add Default field to tag edit form"
```

---

## Task 7: TagList — suffix marker

**Files:**
- Modify: `src/tui/screens/TagList.tsx`

- [ ] **Step 1: Update the screen**

Edit `src/tui/screens/TagList.tsx`. Three things change:

1. The `delete` mainAction handler currently does:
   ```ts
   const target = tags[i];
   if (target === undefined) return;
   const remaining = tags.filter((t) => t !== target);
   ```
   Update to compare on `value`:
   ```ts
   const target = tags[i];
   if (target === undefined) return;
   const remaining = tags.filter((t) => t.value !== target.value);
   ```

2. The empty-check `if (tags.length === 0)` stays the same.

3. The options mapping currently:
   ```tsx
   options={tags.map((t) => ({ label: t, value: t }))}
   ```
   Change to:
   ```tsx
   options={tags.map((t) => ({
   	label: t.default ? `${t.value} [default]` : t.value,
   	value: t.value,
   }))}
   ```

4. The edit-navigation `onChange` already passes `value` — leave the body the same (`value` is the tag's `value` string from the option).

Full updated file:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function TagList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags");
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const tags = trip.settings.tags;
		const hasItems = tags.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									onConfirm: (i: number) => {
										const target = tags[i];
										if (target === undefined) return;
										const remaining = tags.filter(
											(t) => t.value !== target.value,
										);
										updateSettings(trip.dirPath, { tags: remaining });
										reloadTrip();
										if (remaining.length === 0) {
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
					goTo("/trips/settings/tags/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/tags/delete", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		reloadTrip,
		setMenu,
		setHints,
		setColor,
		setTitleSuffix,
		goTo,
		goBack,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<ListSelect
			options={tags.map((t) => ({
				label: t.default ? `${t.value} [default]` : t.value,
				value: t.value,
			}))}
			onChange={(value) => {
				goTo("/trips/settings/tags/edit", {
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
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TagList.tsx
git commit -m "feat(tui): mark default tags in tag list"
```

---

## Task 8: TagDelete — work with Tag[]

**Files:**
- Modify: `src/tui/screens/TagDelete.tsx`

- [ ] **Step 1: Update the screen**

Edit the options mapping and the filter in `src/tui/screens/TagDelete.tsx`. Replace the JSX block at the bottom:

```tsx
		return (
			<RemoveSelector
				options={tags.map((t) => ({ label: t, value: t }))}
				onConfirm={(value) => {
					const remaining = tags.filter((t) => t !== value);
					updateSettings(trip.dirPath, { tags: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
			/>
		);
```

With:

```tsx
		return (
			<RemoveSelector
				options={tags.map((t) => ({
					label: t.default ? `${t.value} [default]` : t.value,
					value: t.value,
				}))}
				onConfirm={(value) => {
					const remaining = tags.filter((t) => t.value !== value);
					updateSettings(trip.dirPath, { tags: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
			/>
		);
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TagDelete.tsx
git commit -m "refactor(tui): adapt tag delete to Tag[] shape"
```

---

## Task 9: TagSelect — work with Tag[]

**Files:**
- Modify: `src/tui/screens/TagSelect.tsx`

- [ ] **Step 1: Update the options mapping**

In `src/tui/screens/TagSelect.tsx`, change line 42:

```ts
	const options = trip.settings.tags.map((t) => ({ label: t, value: t }));
```

To:

```ts
	const options = trip.settings.tags.map((t) => ({
		label: t.value,
		value: t.value,
	}));
```

No default marker here — this picker is about selecting tags to apply to the expense, not managing the catalog.

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TagSelect.tsx
git commit -m "refactor(tui): adapt tag select to Tag[] shape"
```

---

## Task 10: ExpenseForm — seed defaults on new expenses

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Update the buffer-seed effect**

The existing effect at lines 61-73 currently is:

```tsx
	// Seed buffer with existing expense's owners + tags on mount (edit mode only)
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

Replace it with:

```tsx
	useEffect(() => {
		const source = existingExpense ?? duplicateSource;
		if (source) {
			if (buffer.values["owners"] === undefined) {
				const ownerIds = Array.isArray(source.owners)
					? source.owners.map((o) => (typeof o === "string" ? o : o.id))
					: [];
				buffer.setField("owners", ownerIds);
			}
			if (buffer.values["tags"] === undefined) {
				buffer.setField("tags", source.tags);
			}
			return;
		}
		if (!trip) return;
		if (buffer.values["tags"] === undefined) {
			const defaults = trip.settings.tags
				.filter((t) => t.default)
				.map((t) => t.value);
			if (defaults.length > 0) {
				buffer.setField("tags", defaults);
			}
		}
	}, [existingExpense, duplicateSource, trip, buffer]);
```

Behavior:
- Edit (`existingExpense`) or duplicate (`duplicateSource`): unchanged — seed from source.
- New (no source): seed `tags` with default tag values if any exist.
- All branches respect `buffer.values["tags"] === undefined` so the user's own edits aren't clobbered.

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: PASS — no regressions.

- [ ] **Step 4: Run lint check**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: End-to-end smoke test**

Run: `bun run start --trip <test-trip>`.

In Settings → Tags:
- Add a tag "work" with Default=Yes.
- Add a tag "personal" with Default=No.
- Confirm the list shows `work [default]` and `personal`.

In Expenses → New:
- Open the form. Confirm the Tags field shows `work` already selected (and only `work`).

In Expenses → pick an existing expense → Edit:
- Confirm tags are the original tags, not augmented with `work`.

In Expenses → pick an existing expense → Duplicate:
- Confirm tags match the source expense, not augmented with `work`.

Inspect `data/<trip>/settings.yaml` and confirm tags are stored as `{value, default}` objects.

If you started this work on a trip with legacy string tags, opening it once via `loadTrip` should have rewritten the file to the new shape — verify by running `cat data/<that-trip>/settings.yaml`.

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): seed default tags on new expenses"
```

---

## Done

All ten tasks complete. The user can now mark any tag as default, and new expense forms will start with those default tags pre-selected. Legacy `string[]` tag YAML is silently migrated to the new shape on first load.
