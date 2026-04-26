# Multi-Select Sub-Pages and Default-Tag Revert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll back the auto-default-tag and Zvent features, then convert every comma-separated multi-value form field to a dedicated sub-page with space-toggle multi-select (or, for `Countries` on TripCreate, an add/remove list page operating on a draft form buffer).

**Architecture:** Phase 1 deletes Zvent code and the `addExpense` merge. Phase 2 introduces a tiny pure `FormBufferStore` class to hold in-progress form values, a thin React adapter (`FormBufferProvider` + `useFormBuffer`), a new `multiselect` field type on the `Form` organism, a shared `MultiSelectList` organism for the picker UI, and four new screens that read/write the buffer. List screens clear stale buffers on mount so abandoned drafts don't bleed across visits.

**Tech Stack:** Bun runtime, TypeScript with `exactOptionalPropertyTypes: true`, React + Ink, Bun test runner, Biome lint/format, YAML data files.

**Spec:** `docs/superpowers/specs/2026-04-26-multi-select-sub-pages-design.md`

---

## File Structure

**Deleted:**
- `src/core/services/trip/buildZventTag.ts`
- `src/core/services/trip/nextZventId.ts`
- `src/core/services/trip/parseZventId.ts`
- `src/core/services/trip/__tests__/zventService.test.ts`
- `src/core/constants/zvent.ts`

**Created:**
- `src/tui/states/formBufferStore.ts` — pure observable map class
- `src/tui/states/__tests__/formBufferStore.test.ts` — bun:test cases
- `src/tui/states/formBuffer.tsx` — React provider + `useFormBuffer` hook
- `src/tui/components/organisms/MultiSelectList.tsx`
- `src/tui/screens/OwnerSelect.tsx`
- `src/tui/screens/TagSelect.tsx`
- `src/tui/screens/TripCreateCountryList.tsx`
- `src/tui/screens/TripCreateCountryAdd.tsx`

**Modified:**
- `src/core/services/trip/index.ts` — drop 3 Zvent service exports
- `src/core/constants/index.ts` — drop 5 Zvent constant exports
- `src/core/services/expense/addExpense.ts` — revert merge block
- `src/core/services/expense/__tests__/expenseService.test.ts` — drop 4 merge tests
- `src/tui/screens/TripCreate.tsx` — drop Zvent; countries → multiselect
- `src/tui/screens/TripDuplicate.tsx` — drop all Zvent code
- `src/tui/screens/ExpenseForm.tsx` — restore Tags label; owners + tags → multiselect
- `src/tui/screens/AccountCreate.tsx` — owners → multiselect
- `src/tui/screens/AccountEdit.tsx` — owners → multiselect
- `src/tui/screens/TripList.tsx` — clear `trip-` buffers on mount
- `src/tui/screens/AccountList.tsx` — clear `account-` buffers on mount
- `src/tui/screens/ExpenseList.tsx` — clear `expense-` buffers on mount
- `src/tui/screens/TripDuplicate.tsx` — adopt `getString` helper
- `src/tui/screens/TripSettings.tsx` — adopt `getString` helper
- `src/tui/screens/CountryCreate.tsx`, `CountryEdit.tsx`, `TagCreate.tsx`, `TagEdit.tsx`, `CategoryCreate.tsx`, `CategoryEdit.tsx`, `CurrencyCreate.tsx`, `CurrencyEdit.tsx`, `OwnerCreate.tsx`, `OwnerEdit.tsx`, `Export.tsx` — adopt `getString` helper
- `src/tui/components/organisms/Form.tsx` — multiselect type + optional `formId` integration; `onSubmit` payload widens
- `src/tui/models/index.ts` — add `FieldValue`, `MultiSelectFormField`, `getString`, `getStringArray`; add 6 RouteParams entries
- `src/tui/router.ts` — register 6 new routes
- `src/tui/App.tsx` — wrap in `<FormBufferProvider>`

---

# Phase 1 — Reverts

## Task 1: Revert addExpense merge

**Files:**
- Modify: `src/core/services/expense/addExpense.ts`
- Modify: `src/core/services/expense/__tests__/expenseService.test.ts`

- [ ] **Step 1: Replace `src/core/services/expense/addExpense.ts` contents**

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

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
	data.expenses.push(expense);
	writeFileSync(filePath, stringify(data));
	trip.expenses.push(expense);
}
```

- [ ] **Step 2: Delete the four default-tag tests in `expenseService.test.ts`**

Open `src/core/services/expense/__tests__/expenseService.test.ts`. Inside the `describe("addExpense", () => { ... })` block, delete these four tests:
- `"merges trip default tags into new expense"`
- `"dedupes user tags that match a default tag"`
- `"leaves expense.tags untouched when settings.tags is empty"`
- `"preserves order: defaults first, then user tags"`

Keep all other tests untouched.

- [ ] **Step 3: Run tests**

Run: `bun test src/core/services/expense/__tests__/expenseService.test.ts`
Expected: PASS — only the original addExpense/updateExpense/getExpenses/removeExpense tests run.

- [ ] **Step 4: Run full suite + checks**

Run: `bun test && bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/expense/addExpense.ts src/core/services/expense/__tests__/expenseService.test.ts
git commit -m "revert(core): addExpense no longer merges trip default tags"
```

---

## Task 2: ExpenseForm — restore plain Tags label

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Drop the dynamic label**

In `src/tui/screens/ExpenseForm.tsx`, locate the `useMemo` building `fields`. Remove these lines from inside the `useMemo` body (added by the previous spec):

```ts
const defaults = trip.settings.tags;
const tagsLabel =
	defaults.length > 0
		? `Tags (auto-adds: ${defaults.join(", ")})`
		: "Tags";
```

Then change the tags field's `label: tagsLabel` back to `label: "Tags"`:

```ts
{
	key: "tags",
	label: "Tags",
	type: "text",
	placeholder: "comma-separated",
},
```

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "revert(tui): drop ExpenseForm Tags auto-adds hint"
```

---

## Task 3: TripCreate — remove Zvent code

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Replace the file with the de-Zvent version**

Replace `src/tui/screens/TripCreate.tsx` with:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_TRIP_SETTINGS } from "../../core/constants";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

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
		{
			key: "countries",
			label: "Countries (comma-separated)",
			type: "text",
			required: false,
			placeholder: "e.g. Japan, Korea",
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

					const countriesStr = values["countries"] ?? "";
					const countries = countriesStr
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s !== "");

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
						...DEFAULT_TRIP_SETTINGS,
						name,
						startDate,
						endDate,
						countries,
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

This restores the post-Task-7-pre-Task-8 state — countries text field still present, but no `zventId` field, no `ZVENT_ID_PATTERN` import, no `buildZventTag`/`nextZventId` imports, no Zvent tag generation. The `settings.tags` defaults to `[]` from `DEFAULT_TRIP_SETTINGS`.

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripCreate.tsx
git commit -m "revert(tui): TripCreate no longer generates Zvent tag"
```

---

## Task 4: TripDuplicate — remove Zvent code

**Files:**
- Modify: `src/tui/screens/TripDuplicate.tsx`

- [ ] **Step 1: Replace the file with the de-Zvent version**

Replace `src/tui/screens/TripDuplicate.tsx` with:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { duplicateTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDuplicate(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const {
		dataDir = "./data",
		sourceDirPath,
		sourceName,
		sourceStartDate,
	} = useRouteProps("/trips/duplicate");

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(`Duplicate: ${sourceName}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, sourceName]);

	const fields: FormFieldConfig[] = [
		{
			key: "newName",
			label: "New Trip Name",
			type: "text",
			required: true,
			placeholder: `e.g. ${sourceName} v2`,
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
					const name = values["newName"] ?? "";
					const dirName = toDirName(name, sourceStartDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);
					duplicateTrip(dataDir, sourceDirPath, dirName, name);
					goBack();
					goBack();
				}}
			/>
		</Box>
	);
}
```

This is the original pre-Zvent TripDuplicate.

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripDuplicate.tsx
git commit -m "revert(tui): TripDuplicate no longer rebuilds Zvent tag"
```

---

## Task 5: Delete Zvent core code

After Tasks 3 and 4, no consumer of the Zvent helpers remains. Now we delete them.

**Files:**
- Delete: `src/core/services/trip/buildZventTag.ts`
- Delete: `src/core/services/trip/nextZventId.ts`
- Delete: `src/core/services/trip/parseZventId.ts`
- Delete: `src/core/services/trip/__tests__/zventService.test.ts`
- Delete: `src/core/constants/zvent.ts`
- Modify: `src/core/services/trip/index.ts` — drop 3 exports
- Modify: `src/core/constants/index.ts` — drop 5 exports

- [ ] **Step 1: Delete the five files**

```bash
rm src/core/services/trip/buildZventTag.ts
rm src/core/services/trip/nextZventId.ts
rm src/core/services/trip/parseZventId.ts
rm src/core/services/trip/__tests__/zventService.test.ts
rm src/core/constants/zvent.ts
```

- [ ] **Step 2: Update `src/core/services/trip/index.ts`**

Replace its contents with:

```ts
export { createTrip } from "./createTrip";
export { deleteTrip } from "./deleteTrip";
export { duplicateTrip } from "./duplicateTrip";
export type { TripStatus } from "./getTripStatus";
export { getTripStatus } from "./getTripStatus";
export { listTrips } from "./listTrips";
export { loadTrip } from "./loadTrip";
export { toDirName } from "./toDirName";
export { updateSettings } from "./updateSettings";
```

- [ ] **Step 3: Update `src/core/constants/index.ts`**

Replace its contents with:

```ts
export {
	DEFAULT_BASE_CURRENCY,
	DEFAULT_CATEGORIES,
	DEFAULT_EXPORT_PATH,
	DEFAULT_TRIP_SETTINGS,
} from "./defaults";
```

- [ ] **Step 4: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: all pass (Zvent test file is gone; expense + trip suites remain).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "revert(core): delete Zvent services, constants, and tests"
```

---

# Phase 2 — Multi-Select Sub-Pages

## Task 6: FormBufferStore (pure class) + tests

**Files:**
- Create: `src/tui/states/formBufferStore.ts`
- Create: `src/tui/states/__tests__/formBufferStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tui/states/__tests__/formBufferStore.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { FormBufferStore } from "../formBufferStore";

describe("FormBufferStore", () => {
	test("get returns undefined for unknown form id", () => {
		const store = new FormBufferStore();
		expect(store.get("missing")).toBeUndefined();
	});

	test("setField creates a buffer when the form id is new", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		expect(store.get("trip-new")).toEqual({ name: "Japan" });
	});

	test("setField updates an existing field without dropping siblings", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("trip-new", "countries", ["Japan", "Korea"]);
		expect(store.get("trip-new")).toEqual({
			name: "Japan",
			countries: ["Japan", "Korea"],
		});
	});

	test("setValues replaces the entire buffer", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setValues("trip-new", { name: "Korea", countries: ["Korea"] });
		expect(store.get("trip-new")).toEqual({
			name: "Korea",
			countries: ["Korea"],
		});
	});

	test("clear removes only the named buffer", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("expense-new", "payee", "Ramen");
		store.clear("trip-new");
		expect(store.get("trip-new")).toBeUndefined();
		expect(store.get("expense-new")).toEqual({ payee: "Ramen" });
	});

	test("clearByPrefix removes matching ids and leaves others", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("expense-new", "payee", "Ramen");
		store.setField("expense-edit-e1", "payee", "Sushi");
		store.clearByPrefix("expense-");
		expect(store.get("trip-new")).toEqual({ name: "Japan" });
		expect(store.get("expense-new")).toBeUndefined();
		expect(store.get("expense-edit-e1")).toBeUndefined();
	});

	test("subscribe fires on every mutation", () => {
		const store = new FormBufferStore();
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls += 1;
		});
		store.setField("a", "k", "v");
		store.setField("a", "k", "v2");
		store.setValues("b", { x: "y" });
		store.clear("a");
		store.clearByPrefix("b");
		expect(calls).toBe(5);
		unsub();
		store.setField("c", "k", "v");
		expect(calls).toBe(5);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tui/states/__tests__/formBufferStore.test.ts`
Expected: FAIL — `Cannot find module '../formBufferStore'`.

- [ ] **Step 3: Write the implementation**

Create `src/tui/states/formBufferStore.ts`:

```ts
export type FieldValue = string | string[];
export type FormValues = Record<string, FieldValue>;

export class FormBufferStore {
	private buffers = new Map<string, FormValues>();
	private listeners = new Set<() => void>();

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	get(formId: string): FormValues | undefined {
		return this.buffers.get(formId);
	}

	setField(formId: string, key: string, value: FieldValue): void {
		const existing = this.buffers.get(formId) ?? {};
		this.buffers.set(formId, { ...existing, [key]: value });
		this.emit();
	}

	setValues(formId: string, values: FormValues): void {
		this.buffers.set(formId, { ...values });
		this.emit();
	}

	clear(formId: string): void {
		this.buffers.delete(formId);
		this.emit();
	}

	clearByPrefix(prefix: string): void {
		for (const id of [...this.buffers.keys()]) {
			if (id.startsWith(prefix)) {
				this.buffers.delete(id);
			}
		}
		this.emit();
	}

	private emit(): void {
		for (const fn of this.listeners) {
			fn();
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/tui/states/__tests__/formBufferStore.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Type check + lint + full suite**

Run: `bun run check:type && bun run check && bun test`
Expected: clean; full suite passes.

- [ ] **Step 6: Commit**

```bash
git add src/tui/states/formBufferStore.ts src/tui/states/__tests__/formBufferStore.test.ts
git commit -m "feat(tui): add FormBufferStore for cross-page form state"
```

---

## Task 7: FormBufferProvider + useFormBuffer + wire into App

**Files:**
- Create: `src/tui/states/formBuffer.tsx`
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Write `src/tui/states/formBuffer.tsx`**

```tsx
import {
	createContext,
	type JSX,
	type ReactNode,
	useContext,
	useMemo,
	useSyncExternalStore,
} from "react";
import {
	type FieldValue,
	FormBufferStore,
	type FormValues,
} from "./formBufferStore";

const FormBufferContext = createContext<FormBufferStore | null>(null);

const EMPTY: FormValues = Object.freeze({}) as FormValues;

interface FormBufferProviderProps {
	children: ReactNode;
}

export function FormBufferProvider({
	children,
}: FormBufferProviderProps): JSX.Element {
	const store = useMemo(() => new FormBufferStore(), []);
	return (
		<FormBufferContext.Provider value={store}>
			{children}
		</FormBufferContext.Provider>
	);
}

function useStore(): FormBufferStore {
	const store = useContext(FormBufferContext);
	if (!store) {
		throw new Error("FormBufferProvider missing");
	}
	return store;
}

interface UseFormBufferResult {
	values: FormValues;
	setField: (key: string, value: FieldValue) => void;
	setValues: (values: FormValues) => void;
	clear: () => void;
}

export function useFormBuffer(formId: string): UseFormBufferResult {
	const store = useStore();
	const values = useSyncExternalStore(
		(fn) => store.subscribe(fn),
		() => store.get(formId) ?? EMPTY,
		() => store.get(formId) ?? EMPTY,
	);
	return {
		values,
		setField: (key, value) => store.setField(formId, key, value),
		setValues: (v) => store.setValues(formId, v),
		clear: () => store.clear(formId),
	};
}

interface UseFormBufferAdminResult {
	clearByPrefix: (prefix: string) => void;
}

export function useFormBufferAdmin(): UseFormBufferAdminResult {
	const store = useStore();
	return {
		clearByPrefix: (prefix) => store.clearByPrefix(prefix),
	};
}
```

- [ ] **Step 2: Wire `FormBufferProvider` into `App.tsx`**

In `src/tui/App.tsx`, add the import:

```ts
import { FormBufferProvider } from "./states/formBuffer";
```

Wrap the existing provider tree (innermost-to-outermost shouldn't matter, but place it inside `LayoutProvider` and outside `NavigationProvider` so navigation hooks haven't yet been used):

Replace the `App` body return value:

```tsx
return (
	<DataProvider>
		<FocusProvider>
			<HelpProvider>
				<LayoutProvider>
					<FormBufferProvider>
						<NavigationProvider initial={initial}>
							<Router />
						</NavigationProvider>
					</FormBufferProvider>
				</LayoutProvider>
			</HelpProvider>
		</FocusProvider>
	</DataProvider>
);
```

- [ ] **Step 3: Type check + lint + tests**

Run: `bun run check:type && bun run check && bun test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/tui/states/formBuffer.tsx src/tui/App.tsx
git commit -m "feat(tui): add FormBufferProvider and useFormBuffer hook"
```

---

## Task 8: Models — FieldValue, MultiSelectFormField, helpers, route params

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 1: Open `src/tui/models/index.ts`**

The file currently exports `FocusZone`, `RouteParams`, `RouteEntry`, `RouteConfig`, `Routes`, `SelectOption`, `HelpHint`, `VerticalOption`, and the existing form field types (`TextFormField`, `SelectFormField`, `DateFormField`, `FormFieldConfig`).

- [ ] **Step 2: Add `FieldValue` type alias near the top of the file**

After the existing `FocusZone` export and before `RouteParams`, add:

```ts
export type FieldValue = string | string[];
```

- [ ] **Step 3: Add 6 new entries to the `RouteParams` interface**

Inside the existing `RouteParams` interface, add (alphabetically grouped under their parent route block, but appending at the bottom of the block is also fine):

```ts
"/trips/new/countries": {
	dataDir?: string;
	selectMode?: "remove";
};
"/trips/new/countries/new": {
	dataDir?: string;
};

"/trips/accounts/new/owners": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/accounts/edit/owners": {
	tripDirPath: string;
	accountId: string;
	formId: string;
	fieldKey: string;
};

"/trips/expenses/form/owners": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/expenses/form/tags": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
```

- [ ] **Step 4: Add `MultiSelectFormField` and update the `FormFieldConfig` union**

At the bottom of the file, add the new field type and update the union:

```ts
export type MultiSelectFormField = FormFieldBase & {
	type: "multiselect";
	defaultValue?: string[];
	onEdit: () => void;
	display?: (selected: string[]) => string;
};

export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| DateFormField
	| MultiSelectFormField;
```

(Replace the existing `FormFieldConfig` union accordingly.)

- [ ] **Step 5: Add helper functions**

At the very end of the file, append:

```ts
export function getString(
	values: Record<string, FieldValue>,
	key: string,
): string {
	const v = values[key];
	return typeof v === "string" ? v : "";
}

export function getStringArray(
	values: Record<string, FieldValue>,
	key: string,
): string[] {
	const v = values[key];
	return Array.isArray(v) ? v : [];
}
```

- [ ] **Step 6: Type check**

Run: `bun run check:type`

The new helpers and field type compile cleanly. The new RouteParams entries are typed but no router entry registers components yet, so TypeScript allows them. Expected: no errors.

- [ ] **Step 7: Lint + tests**

Run: `bun run check && bun test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat(tui): add FieldValue, MultiSelectFormField, value helpers, sub-page routes"
```

---

## Task 9: Migrate existing forms to use getString helper

This task is mechanical. We replace every `values["key"] ?? ""` (and a couple of `(values["key"] ?? "").trim()` variations) inside `onSubmit` handlers with `getString(values, "key")`. After Task 10 widens `Form.onSubmit`'s payload type, these forms will continue compiling because `getString` accepts the wider type.

**Files (all in `src/tui/screens/`):**
- `TripDuplicate.tsx`
- `TripCreate.tsx`
- `TripSettings.tsx`
- `AccountCreate.tsx`
- `AccountEdit.tsx`
- `ExpenseForm.tsx`
- `CountryCreate.tsx`
- `CountryEdit.tsx`
- `TagCreate.tsx`
- `TagEdit.tsx`
- `CategoryCreate.tsx`
- `CategoryEdit.tsx`
- `CurrencyCreate.tsx`
- `CurrencyEdit.tsx`
- `OwnerCreate.tsx`
- `OwnerEdit.tsx`
- `Export.tsx`

For each file, follow this pattern.

- [ ] **Step 1: Open the file and add the import**

Add at the top, alongside the other `../models` imports:

```ts
import { getString } from "../models";
```

(If `../models` is already imported as `import type { … } from "../models";`, add a separate value import line for `getString`.)

- [ ] **Step 2: Replace value reads inside `onSubmit`**

Replace each occurrence of `values["key"] ?? ""` with `getString(values, "key")`. Replace `(values["key"] ?? "").trim()` with `getString(values, "key").trim()`. Leave existing fallback logic intact (e.g., `values["startDate"] ?? today()` becomes `getString(values, "startDate") || today()` — note: `getString` returns `""` for missing values, so `||` is the right combinator if we want the fallback when empty).

**Important:** the helper returns `""` when the value is missing or wrong-typed. Where the existing code passed an empty string downstream, behavior is unchanged. Where the existing code passed `today()` etc. as a fallback, change `??` to `||` so empty string also falls back.

Concrete examples for the largest files:

`TripCreate.tsx` onSubmit body — replace each pattern:

```ts
// before:
const name = values["name"] ?? "";
const startDate = values["startDate"] ?? today();
const endDate = values["endDate"] ?? addDays(today(), 1);
const explicitDirName = (values["dirName"] ?? "").trim();
const countriesStr = values["countries"] ?? "";

// after:
const name = getString(values, "name");
const startDate = getString(values, "startDate") || today();
const endDate = getString(values, "endDate") || addDays(today(), 1);
const explicitDirName = getString(values, "dirName").trim();
const countriesStr = getString(values, "countries");
```

`TripDuplicate.tsx`:

```ts
// before:
const name = values["newName"] ?? "";
// after:
const name = getString(values, "newName");
```

`TripSettings.tsx`:

```ts
// before:
updateSettings(trip.dirPath, {
	name: values["name"] ?? settings.name,
	startDate: values["startDate"] ?? settings.startDate,
	endDate: values["endDate"] ?? settings.endDate,
	exportPath: values["exportPath"] ?? settings.exportPath,
});
// after:
updateSettings(trip.dirPath, {
	name: getString(values, "name") || settings.name,
	startDate: getString(values, "startDate") || settings.startDate,
	endDate: getString(values, "endDate") || settings.endDate,
	exportPath: getString(values, "exportPath") || settings.exportPath,
});
```

`AccountCreate.tsx`:

```ts
// before:
const name = values["name"] ?? "";
const explicitId = (values["id"] ?? "").trim();
const ownersStr = values["owners"] ?? "";
// after:
const name = getString(values, "name");
const explicitId = getString(values, "id").trim();
const ownersStr = getString(values, "owners");
```

(And `(values["type"] ?? "Credit") as AccountType` becomes `(getString(values, "type") || "Credit") as AccountType`.)

`AccountEdit.tsx`:

```ts
// before:
const name = values["name"] ?? account.name;
const typeStr = values["type"] ?? account.type;
const ownersStr = values["owners"] ?? account.owners.join(", ");
// after:
const name = getString(values, "name") || account.name;
const typeStr = getString(values, "type") || account.type;
const ownersStr = getString(values, "owners") || account.owners.join(", ");
```

`ExpenseForm.tsx` — there are many; replace every `values["key"] ?? "..."` with `getString(values, "key") || "..."` (or just `getString(values, "key")` if no fallback). Also replace `Number.parseFloat(values["amount"] ?? "0")` with `Number.parseFloat(getString(values, "amount") || "0")`.

For each of `CountryCreate.tsx`, `CountryEdit.tsx`, `TagCreate.tsx`, `TagEdit.tsx`, `CategoryCreate.tsx`, `CategoryEdit.tsx`, `OwnerCreate.tsx`, `OwnerEdit.tsx`: only one or two `values["…"]` reads. Replace with `getString(values, "…")`.

For `CurrencyCreate.tsx`, `CurrencyEdit.tsx`, `Export.tsx`: skim and convert each read.

- [ ] **Step 3: Type check after each batch (or all at once)**

Run: `bun run check:type`
Expected: no errors. (`getString` accepts `Record<string, string>` since `string` is assignable to `string | string[]`.)

- [ ] **Step 4: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: all pass (no behavior change).

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/
git commit -m "refactor(tui): adopt getString helper across form onSubmit handlers"
```

---

## Task 10: Update Form organism — multiselect support + optional formId

**Files:**
- Modify: `src/tui/components/organisms/Form.tsx`

- [ ] **Step 1: Replace `src/tui/components/organisms/Form.tsx` with the updated version**

Replace its entire contents with:

```tsx
import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValue, FormFieldConfig } from "../../models";
import { useFormBuffer } from "../../states/formBuffer";
import { useFocus } from "../../states/focus";
import { DateInput } from "../atoms/DateInput";
import { DropdownSelect } from "../atoms/DropdownSelect";
import { InlineSelect } from "../atoms/InlineSelect";
import { TextInput } from "../atoms/TextInput";

const INLINE_SELECT_THRESHOLD = 3;

interface FormProps {
	fields: FormFieldConfig[];
	onSubmit: (values: Record<string, FieldValue>) => void;
	submitLabel?: string;
	submitKey?: string;
	formId?: string;
}

export function Form({
	fields,
	onSubmit,
	submitLabel = "Submit",
	submitKey = "s",
	formId,
}: FormProps): JSX.Element {
	const { setFocus } = useFocus();

	useEffect(() => {
		setFocus("main");
	}, [setFocus]);

	const buffer = useFormBuffer(formId ?? "__unused__");
	const usingBuffer = formId !== undefined;

	const [localValues, setLocalValues] = useState<Record<string, FieldValue>>(
		() => {
			const initial: Record<string, FieldValue> = {};
			for (const field of fields) {
				initial[field.key] = field.type === "multiselect" ? [] : "";
			}
			return initial;
		},
	);

	const values: Record<string, FieldValue> = usingBuffer
		? { ...localValues, ...buffer.values }
		: localValues;

	const setValue = useCallback(
		(key: string, value: FieldValue) => {
			setLocalValues((prev) => ({ ...prev, [key]: value }));
			if (usingBuffer) {
				buffer.setField(key, value);
			}
		},
		[usingBuffer, buffer],
	);

	const [cursor, setCursor] = useState(0);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isFilled = useCallback(
		(field: FormFieldConfig): boolean => {
			const v = values[field.key];
			if (field.type === "multiselect") {
				return Array.isArray(v) && v.length > 0;
			}
			if (typeof v === "string" && v !== "") return true;
			return field.defaultValue !== undefined;
		},
		[values],
	);

	const canSubmit = useMemo(() => {
		const allRequiredFilled = fields.every((field) => {
			if (!field.required) return true;
			return isFilled(field);
		});
		const hasAnyChange = fields.some((field) => {
			const v = values[field.key];
			if (field.type === "multiselect") {
				return Array.isArray(v) && v.length > 0;
			}
			return typeof v === "string" && v !== "";
		});
		return allRequiredFilled && hasAnyChange;
	}, [fields, values, isFilled]);

	const totalItems = canSubmit ? fields.length + 1 : fields.length;

	if (cursor >= totalItems) {
		setCursor(totalItems - 1);
	}

	const handleSubmit = useCallback(() => {
		if (!canSubmit) return;
		const result: Record<string, FieldValue> = {};
		for (const field of fields) {
			const v = values[field.key];
			if (field.type === "multiselect") {
				const arr = Array.isArray(v) ? v : [];
				result[field.key] = arr.length > 0
					? arr
					: (field.defaultValue ?? []);
			} else if (typeof v === "string" && v !== "") {
				result[field.key] = v;
			} else if (field.defaultValue !== undefined) {
				result[field.key] = field.defaultValue;
			} else {
				result[field.key] = "";
			}
		}
		try {
			onSubmit(result);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, [canSubmit, fields, values, onSubmit]);

	const enterEdit = useCallback(() => {
		setError(null);
		setEditing(true);
		setFocus("input");
	}, [setFocus]);

	const exitEdit = useCallback(() => {
		setEditing(false);
		setFocus("main");
	}, [setFocus]);

	const setStringValue = useCallback(
		(key: string, value: string) => {
			setValue(key, value);
			exitEdit();
		},
		[setValue, exitEdit],
	);

	const cancelEdit = useCallback(() => {
		exitEdit();
	}, [exitEdit]);

	useInput(
		(input, key) => {
			if (key.upArrow) {
				setCursor((c) => (c > 0 ? c - 1 : totalItems - 1));
			} else if (key.downArrow) {
				setCursor((c) => (c < totalItems - 1 ? c + 1 : 0));
			} else if (key.return) {
				if (cursor === fields.length) {
					handleSubmit();
				} else {
					const field = fields[cursor];
					if (!field) return;
					if (field.type === "multiselect") {
						field.onEdit();
					} else {
						enterEdit();
					}
				}
			} else if (input === submitKey && canSubmit) {
				handleSubmit();
			}
		},
		{ isActive: !editing },
	);

	return (
		<Box flexDirection="column">
			{fields.map((field, index) => {
				const isCursor = cursor === index;
				const currentValue = values[field.key];
				const isEditing = editing && isCursor;

				let displayValue = "";
				if (field.type === "multiselect") {
					const arr = Array.isArray(currentValue)
						? currentValue
						: (field.defaultValue ?? []);
					displayValue = field.display
						? field.display(arr)
						: arr.length === 0
							? "(none)"
							: arr.join(", ");
				} else if (
					field.type === "select" &&
					typeof currentValue === "string" &&
					currentValue !== ""
				) {
					const found = field.options.find((o) => o.value === currentValue);
					displayValue = found?.label ?? currentValue;
				} else if (typeof currentValue === "string") {
					displayValue = currentValue;
				}

				const hasValue =
					field.type === "multiselect"
						? Array.isArray(currentValue) && currentValue.length > 0
						: typeof currentValue === "string" && currentValue !== "";
				const optionalSuffix = !field.required ? " (optional)" : "";

				let preview: string | undefined;
				if (field.type === "multiselect") {
					preview = undefined; // multiselect always shows displayValue
				} else if (field.defaultValue !== undefined) {
					if (field.type === "select") {
						const found = field.options.find(
							(o) => o.value === field.defaultValue,
						);
						preview = found?.label ?? (field.defaultValue as string);
					} else {
						preview = field.defaultValue as string;
					}
				} else if (field.type === "text" && field.placeholder !== undefined) {
					const stringValues: Record<string, string> = {};
					for (const [k, v] of Object.entries(values)) {
						if (typeof v === "string") stringValues[k] = v;
					}
					preview =
						typeof field.placeholder === "function"
							? field.placeholder(stringValues)
							: field.placeholder;
				}

				const labelText = (
					<>
						{field.label}
						{optionalSuffix}:{" "}
						{field.type === "multiselect"
							? displayValue
							: hasValue
								? displayValue
								: preview !== undefined
									? `(${preview})`
									: ""}
					</>
				);

				return (
					<Box key={field.key} flexDirection="column">
						<Text>
							{isCursor ? (
								<Text color="cyan" bold>
									{">"} {labelText}
								</Text>
							) : (
								<Text dimColor>
									{"  "}
									{labelText}
								</Text>
							)}
						</Text>

						{isEditing && field.type !== "multiselect" && (
							<Box marginLeft={4}>
								{field.type === "text" && (
									<TextInput
										{...(field.placeholder !== undefined
											? {
													placeholder:
														typeof field.placeholder === "function"
															? field.placeholder(
																	stringValuesOnly(values),
																)
															: field.placeholder,
												}
											: {})}
										{...(typeof currentValue === "string" && currentValue !== ""
											? { defaultValue: currentValue }
											: field.defaultValue !== undefined
												? { defaultValue: field.defaultValue }
												: {})}
										onSubmit={(val) => setStringValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "date" && (
									<DateInput
										defaultValue={
											typeof currentValue === "string" && currentValue !== ""
												? currentValue
												: (field.defaultValue ?? "2026-01-01")
										}
										onSubmit={(val) => setStringValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "select" &&
									field.options.length <= INLINE_SELECT_THRESHOLD && (
										<InlineSelect
											options={field.options}
											{...(typeof currentValue === "string" &&
											currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setStringValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
								{field.type === "select" &&
									field.options.length > INLINE_SELECT_THRESHOLD && (
										<DropdownSelect
											options={field.options}
											{...(typeof currentValue === "string" &&
											currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setStringValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
							</Box>
						)}
					</Box>
				);
			})}

			<Box marginTop={1}>
				<Text dimColor>{"─".repeat(20)}</Text>
			</Box>

			<Box>
				{cursor === fields.length ? (
					<Text
						bold
						inverse={canSubmit}
						{...(canSubmit ? { color: "green" } : {})}
						dimColor={!canSubmit}
					>
						{"  "}[{submitKey}] {submitLabel}
						{"  "}
					</Text>
				) : (
					<Text dimColor={!canSubmit}>
						{"  "}[{submitKey}] {submitLabel}
					</Text>
				)}
			</Box>

			{error && (
				<Box marginTop={1}>
					<Text color="red">⚠ {error}</Text>
				</Box>
			)}
		</Box>
	);
}

function stringValuesOnly(
	values: Record<string, FieldValue>,
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(values)) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}
```

Notes:
- `formId` is optional. When omitted, the local state is the only source. When provided, the buffer is read for initial values and written on every change (the local state is kept as a fallback for fields not yet touched).
- The `useFormBuffer("__unused__")` call when no `formId` is provided is a harmless throwaway buffer; the hook still needs to be called unconditionally to satisfy hook rules. The `usingBuffer` flag gates whether its values are read.
- Multiselect fields: pressing Enter calls `field.onEdit()`. They never enter inline edit mode.
- The `placeholder` callback for text fields still receives only `Record<string, string>` (other-fields' string values), via `stringValuesOnly`. Multi-select values are filtered out for legacy callbacks.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 4: Tests + manual smoke**

Run: `bun test`
Expected: all pass.

Quick smoke run: `bun run start --data-dir ./tmp-data` — open any existing form (e.g., `[c]` to create a trip) and verify the form renders, fields are editable, submit works. Quit.

```bash
rm -rf tmp-data
```

- [ ] **Step 5: Commit**

```bash
git add src/tui/components/organisms/Form.tsx
git commit -m "feat(tui): Form supports multiselect field type and optional buffer-backed values"
```

---

## Task 11: MultiSelectList organism

**Files:**
- Create: `src/tui/components/organisms/MultiSelectList.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Box, Text, useInput } from "ink";
import { type JSX, useState } from "react";
import type { SelectOption } from "../../models";

interface MultiSelectListProps {
	options: SelectOption[];
	initialSelected: string[];
	onConfirm: (selected: string[]) => void;
	onCancel: () => void;
}

export function MultiSelectList({
	options,
	initialSelected,
	onConfirm,
	onCancel,
}: MultiSelectListProps): JSX.Element {
	const [cursor, setCursor] = useState(0);
	const [selected, setSelected] = useState<string[]>(() => [...initialSelected]);

	useInput((input, key) => {
		if (key.upArrow) {
			setCursor((c) => (c > 0 ? c - 1 : Math.max(0, options.length - 1)));
		} else if (key.downArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (input === " ") {
			const option = options[cursor];
			if (!option) return;
			setSelected((prev) =>
				prev.includes(option.value)
					? prev.filter((v) => v !== option.value)
					: [...prev, option.value],
			);
		} else if (key.return) {
			onConfirm(selected);
		} else if (key.escape) {
			onCancel();
		}
	});

	if (options.length === 0) {
		return <Text dimColor>No options available.</Text>;
	}

	return (
		<Box flexDirection="column">
			{options.map((option, index) => {
				const isCursor = cursor === index;
				const isSelected = selected.includes(option.value);
				const checkbox = isSelected ? "[x]" : "[ ]";
				return (
					<Text key={option.value}>
						{isCursor ? (
							<Text color="cyan" bold>
								{">"} {checkbox} {option.label}
							</Text>
						) : (
							<Text>
								{"  "}
								{checkbox} {option.label}
							</Text>
						)}
					</Text>
				);
			})}
		</Box>
	);
}
```

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/organisms/MultiSelectList.tsx
git commit -m "feat(tui): add MultiSelectList organism (space-toggle multi-select)"
```

---

## Task 12: OwnerSelect + TagSelect screens

**Files:**
- Create: `src/tui/screens/OwnerSelect.tsx`
- Create: `src/tui/screens/TagSelect.tsx`

- [ ] **Step 1: Write `OwnerSelect.tsx`**

Create `src/tui/screens/OwnerSelect.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { MultiSelectList } from "../components/organisms/MultiSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Space", label: "Toggle" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function OwnerSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const props = useRouteProps("/trips/expenses/form/owners");
	const formId = props.formId;
	const fieldKey = props.fieldKey;

	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Owners");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialSelected = Array.isArray(initialRaw) ? initialRaw : [];

	const options = trip.owners.map((o) => ({ label: o.name, value: o.id }));

	return (
		<MultiSelectList
			options={options}
			initialSelected={initialSelected}
			onConfirm={(selected) => {
				buffer.setField(fieldKey, selected);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

`useRouteProps` is parameterized over the route path; the screen is registered against three different routes (`/trips/expenses/form/owners`, `/trips/accounts/new/owners`, `/trips/accounts/edit/owners`) which all share `formId` and `fieldKey`. We pick one path for the type. The other routes' props are a structural superset (they include `tripDirPath` and possibly `accountId`); accessing `formId`/`fieldKey` is safe at runtime.

- [ ] **Step 2: Write `TagSelect.tsx`**

Create `src/tui/screens/TagSelect.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { MultiSelectList } from "../components/organisms/MultiSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Space", label: "Toggle" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function TagSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/tags");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Tags");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialSelected = Array.isArray(initialRaw) ? initialRaw : [];

	const options = trip.settings.tags.map((t) => ({ label: t, value: t }));

	return (
		<MultiSelectList
			options={options}
			initialSelected={initialSelected}
			onConfirm={(selected) => {
				buffer.setField(fieldKey, selected);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

- [ ] **Step 3: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean. (These screens are not yet routed; type system allows orphan exports.)

- [ ] **Step 4: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/OwnerSelect.tsx src/tui/screens/TagSelect.tsx
git commit -m "feat(tui): add OwnerSelect and TagSelect screens"
```

---

## Task 13: TripCreateCountryList + TripCreateCountryAdd screens

**Files:**
- Create: `src/tui/screens/TripCreateCountryList.tsx`
- Create: `src/tui/screens/TripCreateCountryAdd.tsx`

- [ ] **Step 1: Write `TripCreateCountryList.tsx`**

Create `src/tui/screens/TripCreateCountryList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryList(): JSX.Element {
	const { focus } = useFocus();
	const { goTo, goBack } = useNavigation();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const { dataDir = "./data", selectMode } = useRouteProps(
		"/trips/new/countries",
	);

	const buffer = useFormBuffer("trip-new");
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setTitleSuffix("Countries");
		const hasItems = countries.length > 0;

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
				...(hasItems ? [{ label: "Delete", value: "delete", key: "d" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/new/countries/new", { props: { dataDir } });
				} else if (value === "delete" && hasItems) {
					goTo("/trips/new/countries", {
						props: { dataDir, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		dataDir,
		selectMode,
		countries.length,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (selectMode === "remove") {
		if (countries.length === 0) {
			return <Text dimColor>No countries.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a country to remove:"
				options={countries.map((c) => ({ label: c, value: c }))}
				onConfirm={(value) => {
					const remaining = countries.filter((c) => c !== value);
					buffer.setField("countries", remaining);
					if (remaining.length === 0) {
						goBack();
					}
				}}
			/>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet. Press [a] to add one.</Text>;
	}

	return (
		<ListSelect
			options={countries.map((c) => ({ label: c, value: c }))}
			onChange={() => {
				/* read-only navigation; edit is via Delete + Add */
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 2: Write `TripCreateCountryAdd.tsx`**

Create `src/tui/screens/TripCreateCountryAdd.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Country",
		type: "text",
		required: true,
		placeholder: "e.g. Japan",
	},
];

export function TripCreateCountryAdd(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const buffer = useFormBuffer("trip-new");
	const raw = buffer.values["countries"];
	const current = Array.isArray(raw) ? raw : [];

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix("Countries > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={FIELDS}
				onSubmit={(values) => {
					const value = getString(values, "value").trim();
					if (value === "") {
						setError("Country name cannot be empty.");
						return;
					}
					if (current.includes(value)) {
						setError(`"${value}" is already in the list.`);
						return;
					}
					buffer.setField("countries", [...current, value]);
					goBack();
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 3: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 4: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/TripCreateCountryList.tsx src/tui/screens/TripCreateCountryAdd.tsx
git commit -m "feat(tui): add TripCreateCountryList and TripCreateCountryAdd screens"
```

---

## Task 14: Register 6 new routes

**Files:**
- Modify: `src/tui/router.ts`

- [ ] **Step 1: Add imports for the four new screens**

At the top of `src/tui/router.ts`, add:

```ts
import { OwnerSelect } from "./screens/OwnerSelect";
import { TagSelect } from "./screens/TagSelect";
import { TripCreateCountryAdd } from "./screens/TripCreateCountryAdd";
import { TripCreateCountryList } from "./screens/TripCreateCountryList";
```

- [ ] **Step 2: Add 6 entries to the `routes` map**

Add the following entries inside the `routes` object (location-wise, group near the existing related routes for readability — but ordering doesn't matter):

```ts
"/trips/new/countries": {
	component: TripCreateCountryList as unknown as ComponentType,
	title: "Countries",
	defaultFocus: "menu",
},
"/trips/new/countries/new": {
	component: TripCreateCountryAdd as unknown as ComponentType,
	title: "New Country",
	defaultFocus: "main",
},
"/trips/accounts/new/owners": {
	component: OwnerSelect as unknown as ComponentType,
	title: "Select Owners",
	defaultFocus: "main",
},
"/trips/accounts/edit/owners": {
	component: OwnerSelect as unknown as ComponentType,
	title: "Select Owners",
	defaultFocus: "main",
},
"/trips/expenses/form/owners": {
	component: OwnerSelect as unknown as ComponentType,
	title: "Select Owners",
	defaultFocus: "main",
},
"/trips/expenses/form/tags": {
	component: TagSelect as unknown as ComponentType,
	title: "Select Tags",
	defaultFocus: "main",
},
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: clean. The `Routes` derived type ensures every `RouteParams` key is covered.

- [ ] **Step 4: Lint + tests**

Run: `bun run check && bun test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/tui/router.ts
git commit -m "feat(tui): register 6 sub-page routes for multi-select flows"
```

---

## Task 15: AccountCreate + AccountEdit — owners multiselect

**Files:**
- Modify: `src/tui/screens/AccountCreate.tsx`
- Modify: `src/tui/screens/AccountEdit.tsx`

- [ ] **Step 1: Replace `AccountCreate.tsx`**

Replace its contents with:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import {
	type FormFieldConfig,
	getString,
	getStringArray,
} from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FORM_ID = "account-new";

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();
	const buffer = useFormBuffer(FORM_ID);

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	const tripDirPath = trip.dirPath;
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
			label: "Owners",
			type: "multiselect",
			required: true,
			onEdit: () =>
				goTo("/trips/accounts/new/owners", {
					props: { tripDirPath, formId: FORM_ID, fieldKey: "owners" },
				}),
		},
	];

	return (
		<Form
			formId={FORM_ID}
			fields={fields}
			onSubmit={(values) => {
				const name = getString(values, "name");
				const explicitId = getString(values, "id").trim();
				const id = explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Account ID "${id}" already exists.`);
				}

				const owners = getStringArray(values, "owners");

				addAccount(trip, {
					id,
					name,
					type: (getString(values, "type") || "Credit") as AccountType,
					owners,
				});
				reloadTrip();
				buffer.clear();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 2: Replace `AccountEdit.tsx`**

Replace its contents with:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { updateAccount } from "../../core/services/account";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import {
	type FormFieldConfig,
	getString,
	getStringArray,
} from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { accountId } = useRouteProps("/trips/accounts/edit");
	const account = trip?.accounts.find((a) => a.id === accountId);

	const formId = `account-edit-${accountId}`;
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix(account?.name ?? accountId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, account, accountId]);

	// Seed the buffer with the account's current owners on first mount, so the
	// OwnerSelect sub-page opens with the correct initial selection.
	useEffect(() => {
		if (account && buffer.values["owners"] === undefined) {
			buffer.setField("owners", account.owners);
		}
	}, [account, buffer]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!account) return <Text dimColor>Account "{accountId}" not found.</Text>;

	const tripDirPath = trip.dirPath;

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice's Visa",
			defaultValue: account.name,
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
			defaultValue: account.type,
		},
		{
			key: "owners",
			label: "Owners",
			type: "multiselect",
			required: true,
			defaultValue: account.owners,
			onEdit: () =>
				goTo("/trips/accounts/edit/owners", {
					props: {
						tripDirPath,
						accountId,
						formId,
						fieldKey: "owners",
					},
				}),
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {account.id}</Text>
			<Form
				formId={formId}
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name") || account.name;
					const typeStr = getString(values, "type") || account.type;
					const owners = getStringArray(values, "owners");
					updateAccount(trip, account.id, {
						name,
						type: typeStr as AccountType,
						owners,
					});
					reloadTrip();
					buffer.clear();
					goBack();
				}}
			/>
		</Box>
	);
}
```

The seeding effect populates the buffer once per `account` identity change. Once seeded, the buffer's `owners` value is the canonical source — the picker reads from it, the Form's display row shows it, and submit reads from it.

- [ ] **Step 3: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 4: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/screens/AccountCreate.tsx src/tui/screens/AccountEdit.tsx
git commit -m "feat(tui): AccountCreate/Edit owners use multiselect sub-page"
```

---

## Task 16: TripCreate — countries multiselect

**Files:**
- Modify: `src/tui/screens/TripCreate.tsx`

- [ ] **Step 1: Replace `TripCreate.tsx`**

Replace its contents with:

```tsx
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_TRIP_SETTINGS } from "../../core/constants";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import {
	type FormFieldConfig,
	getString,
	getStringArray,
} from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const FORM_ID = "trip-new";

export function TripCreate(): JSX.Element {
	const { goTo } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();
	const buffer = useFormBuffer(FORM_ID);

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
		{
			key: "countries",
			label: "Countries",
			type: "multiselect",
			required: false,
			onEdit: () =>
				goTo("/trips/new/countries", { props: { dataDir } }),
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
				formId={FORM_ID}
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name");
					const startDate = getString(values, "startDate") || today();
					const endDate = getString(values, "endDate") || addDays(today(), 1);
					const explicitDirName = getString(values, "dirName").trim();
					const dirName =
						explicitDirName === ""
							? toDirName(name, startDate)
							: explicitDirName;

					const countries = getStringArray(values, "countries");

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
						...DEFAULT_TRIP_SETTINGS,
						name,
						startDate,
						endDate,
						countries,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
					buffer.clear();
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

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripCreate.tsx
git commit -m "feat(tui): TripCreate countries use multiselect sub-page"
```

---

## Task 17: ExpenseForm — owners + tags multiselect

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Replace `ExpenseForm.tsx`**

Replace its contents with:

```tsx
import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import type { Expense } from "../../core/models";
import { today } from "../../core/services/date";
import {
	addExpense,
	nextExpenseId,
	updateExpense,
} from "../../core/services/expense";
import { Form } from "../components/organisms/Form";
import {
	type FormFieldConfig,
	getString,
	getStringArray,
} from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function ExpenseForm(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goTo, goBack } = useNavigation();
	const { setFocus } = useFocus();
	const { setHints } = useLayout();

	const { expenseId, tripDirPath } = useRouteProps("/trips/expenses/form");
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);

	const formId = expenseId
		? `expense-edit-${expenseId}`
		: "expense-new";
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit field" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setHints]);

	// Seed buffer with existing expense's owners + tags on mount (edit mode only)
	useEffect(() => {
		if (!existingExpense) return;
		if (buffer.values["owners"] === undefined) {
			const ownerIds = Array.isArray(existingExpense.owners)
				? existingExpense.owners.map((o) =>
						typeof o === "string" ? o : o.id,
					)
				: [];
			buffer.setField("owners", ownerIds);
		}
		if (buffer.values["tags"] === undefined) {
			buffer.setField("tags", existingExpense.tags);
		}
	}, [existingExpense, buffer]);

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

	if (!trip) {
		return <Box />;
	}

	const handleSubmit = (values: Record<string, string | string[]>) => {
		const tags = getStringArray(values, "tags");
		const ownerList = getStringArray(values, "owners");

		const currency = getString(values, "currency") || "THB";
		const exchangeRateStr = getString(values, "exchangeRate");

		const id =
			existingExpense?.id ??
			nextExpenseId(trip, getString(values, "date") || today());

		const expense: Expense = {
			id,
			accountId: getString(values, "account"),
			date: getString(values, "date"),
			payee: getString(values, "payee"),
			category: getString(values, "category"),
			amount: Number.parseFloat(getString(values, "amount") || "0"),
			currency,
			...(exchangeRateStr && currency !== "THB"
				? { exchangeRate: Number.parseFloat(exchangeRateStr) }
				: {}),
			...(ownerList.length > 0 ? { owners: ownerList } : {}),
			description: getString(values, "description"),
			tags,
		};

		if (existingExpense) {
			updateExpense(trip, expense);
		} else {
			addExpense(trip, expense);
		}

		reloadTrip();
		buffer.clear();
		setFocus("menu");
		goBack();
	};

	return <Form formId={formId} fields={fields} onSubmit={handleSubmit} />;
}
```

- [ ] **Step 2: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 3: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat(tui): ExpenseForm owners and tags use multiselect sub-pages"
```

---

## Task 18: List screens — clearByPrefix on mount

**Files:**
- Modify: `src/tui/screens/TripList.tsx`
- Modify: `src/tui/screens/AccountList.tsx`
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: TripList — add cleanup effect**

In `src/tui/screens/TripList.tsx`, add the import:

```ts
import { useFormBufferAdmin } from "../states/formBuffer";
```

Inside the `TripList` function body, near the top (right after the `useState`), add:

```ts
const { clearByPrefix } = useFormBufferAdmin();
useEffect(() => {
	clearByPrefix("trip-");
}, [clearByPrefix]);
```

- [ ] **Step 2: AccountList — add cleanup effect**

In `src/tui/screens/AccountList.tsx`, add the import:

```ts
import { useFormBufferAdmin } from "../states/formBuffer";
```

Inside the `AccountList` function body, near the top (right after the destructuring of `useRouteProps`), add:

```ts
const { clearByPrefix } = useFormBufferAdmin();
useEffect(() => {
	clearByPrefix("account-");
}, [clearByPrefix]);
```

- [ ] **Step 3: ExpenseList — add cleanup effect**

In `src/tui/screens/ExpenseList.tsx`, add the import:

```ts
import { useFormBufferAdmin } from "../states/formBuffer";
```

Inside the `ExpenseList` function body, near the top, add:

```ts
const { clearByPrefix } = useFormBufferAdmin();
useEffect(() => {
	clearByPrefix("expense-");
}, [clearByPrefix]);
```

- [ ] **Step 4: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean.

- [ ] **Step 5: Tests**

Run: `bun test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/tui/screens/TripList.tsx src/tui/screens/AccountList.tsx src/tui/screens/ExpenseList.tsx
git commit -m "feat(tui): list screens clear stale form buffers on mount"
```

---

## Task 19: Final verification

- [ ] **Step 1: Full test suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 4: End-to-end manual walkthrough**

Run: `bun run start --data-dir ./tmp-data`

Walk through:

1. Press `[c]` from the trip list → TripCreate.
2. Type a trip name (e.g., `Japan`).
3. ↓ to Countries field. Press Enter → TripCreateCountryList opens.
4. Press `[a]` → TripCreateCountryAdd. Type `Japan`, submit. Lands back on TripCreateCountryList; list shows `Japan`.
5. Press `[a]` again → add `Korea`. Press `[q]` to return to TripCreate.
6. Verify Countries row reads `Japan, Korea`.
7. ↓ to Submit, press `[s]`. Lands on TripOverview.
8. Inspect `tmp-data/japan-2026/settings.yaml`: `countries: [Japan, Korea]`, `tags: []`.
9. Add an Owner (existing flow): Trip > Owners > Add `alice`.
10. Add an Account: Accounts > Add. Fill fields, ↓ to Owners → multiselect opens with no selection. Press space on `alice`, Enter. Submit account.
11. Add a Tag: Settings > Tags > Add `food`.
12. Add an Expense: Expenses > Add. Fill fields. ↓ to Owners → multiselect opens. Pick `alice`. ↓ to Tags → multiselect opens with options `food`. Pick it. Submit.
13. Inspect `expenses.yaml`: expense's `tags: [food]`, `owners: [alice]`.
14. Re-open the expense. Edit Tags → MultiSelectList opens with `food` already ticked. Untick, confirm. Submit. Verify `tags: []` in YAML.
15. Test buffer cleanup: Open new-expense form, type a payee, press `[q]` back to expense list, then re-enter new-expense form. Payee field is empty (buffer cleared by ExpenseList mount).
16. Sub-page state preservation: Open new-expense form, type a payee, navigate to Tags select, pick something, return. Payee text is still there.

- [ ] **Step 5: Cleanup**

```bash
rm -rf tmp-data
```

No commit — verification only.
