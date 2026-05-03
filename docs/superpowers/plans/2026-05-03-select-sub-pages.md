# Select Fields as Sub-Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every `select` form field to open as a dedicated sub-page (mirroring the existing multi-select pattern), and delete the now-unused `InlineSelect` and `DropdownSelect` atoms.

**Architecture:** A new `SingleSelectList` organism (parallel to `MultiSelectList`) handles the picker UI. Four new domain screens (`AccountSelect`, `CategorySelect`, `CurrencySelect`, `AccountTypeSelect`) read options from `trip` data and read/write the form buffer. `SelectFormField` gains a required `onEdit` callback; `Form` calls it on Enter for both `select` and `multiselect` fields, removing the inline editor branches entirely.

**Tech Stack:** Bun runtime, TypeScript with `exactOptionalPropertyTypes: true`, React + Ink, Bun test runner, Biome lint/format.

**Spec:** `docs/superpowers/specs/2026-05-03-select-sub-pages-design.md`

---

## File Structure

**Created:**
- `src/tui/components/organisms/SingleSelectList.tsx`
- `src/tui/screens/AccountSelect.tsx`
- `src/tui/screens/CategorySelect.tsx`
- `src/tui/screens/CurrencySelect.tsx`
- `src/tui/screens/AccountTypeSelect.tsx`

**Modified:**
- `src/tui/models/index.ts` — `SelectFormField` gains required `onEdit`; 5 new `RouteParams` entries.
- `src/tui/router.ts` — register 5 new routes.
- `src/tui/components/organisms/Form.tsx` — drop inline select rendering; dispatch select Enter to `field.onEdit`.
- `src/tui/screens/ExpenseForm.tsx` — `account`, `category`, `currency` fields gain `onEdit`.
- `src/tui/screens/AccountCreate.tsx` — `type` field gains `onEdit`.
- `src/tui/screens/AccountEdit.tsx` — `type` field gains `onEdit`; seeding effect for `type`.

**Deleted:**
- `src/tui/components/atoms/InlineSelect.tsx`
- `src/tui/components/atoms/DropdownSelect.tsx`

---

## Task 1: SingleSelectList organism

**Files:**
- Create: `src/tui/components/organisms/SingleSelectList.tsx`

- [ ] **Step 1: Write the component**

Create `src/tui/components/organisms/SingleSelectList.tsx` with EXACTLY this content:

```tsx
import { Box, Text, useInput } from "ink";
import { type JSX, useState } from "react";
import type { SelectOption } from "../../models";

interface SingleSelectListProps {
	options: SelectOption[];
	initialValue: string | undefined;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function SingleSelectList({
	options,
	initialValue,
	onConfirm,
	onCancel,
}: SingleSelectListProps): JSX.Element {
	const [cursor, setCursor] = useState(() => {
		if (initialValue === undefined) return 0;
		const found = options.findIndex((o) => o.value === initialValue);
		return found >= 0 ? found : 0;
	});

	useInput((_input, key) => {
		if (key.upArrow) {
			setCursor((c) => (c > 0 ? c - 1 : Math.max(0, options.length - 1)));
		} else if (key.downArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (key.return) {
			const opt = options[cursor];
			if (opt) onConfirm(opt.value);
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
				return (
					<Text key={option.value} inverse={isCursor}>
						{isCursor ? "> " : "  "}
						{option.label}
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
Expected: all 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/organisms/SingleSelectList.tsx
git commit -m "feat(tui): add SingleSelectList organism (single-select sub-page UI)"
```

---

## Task 2: Add RouteParams + 4 screens + route registrations

This task lands the new routes and their screens atomically. The screens compile because their `useRouteProps` paths exist in `RouteParams`. The screens are unreachable at runtime (no host navigates to them yet) until Task 3 wires the hosts.

**Files:**
- Modify: `src/tui/models/index.ts` (5 new RouteParams entries)
- Create: `src/tui/screens/AccountSelect.tsx`
- Create: `src/tui/screens/CategorySelect.tsx`
- Create: `src/tui/screens/CurrencySelect.tsx`
- Create: `src/tui/screens/AccountTypeSelect.tsx`
- Modify: `src/tui/router.ts` (5 new route registrations)

- [ ] **Step 1: Add 5 RouteParams entries to `src/tui/models/index.ts`**

Inside the existing `RouteParams` interface body (placement is flexible — append at the end of the interface block, or group near related routes — choose what reads cleanest), add:

```ts
"/trips/expenses/form/account": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/expenses/form/category": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/expenses/form/currency": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/accounts/new/type": {
	tripDirPath: string;
	formId: string;
	fieldKey: string;
};
"/trips/accounts/edit/type": {
	tripDirPath: string;
	accountId: string;
	formId: string;
	fieldKey: string;
};
```

- [ ] **Step 2: Create `src/tui/screens/AccountSelect.tsx`**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function AccountSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/account");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Account");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	const options = trip.accounts.map((a) => ({
		label: `${a.name} (${a.type})`,
		value: a.id,
	}));

	return (
		<SingleSelectList
			options={options}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

- [ ] **Step 3: Create `src/tui/screens/CategorySelect.tsx`**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function CategorySelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/category");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Category");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	const options = trip.settings.categories.map((c) => ({
		label: c,
		value: c,
	}));

	return (
		<SingleSelectList
			options={options}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

- [ ] **Step 4: Create `src/tui/screens/CurrencySelect.tsx`**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function CurrencySelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/currency");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Currency");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	const codes = ["THB", ...Object.keys(trip.settings.currencies)];
	const options = codes.map((c) => ({ label: c, value: c }));

	return (
		<SingleSelectList
			options={options}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

- [ ] **Step 5: Create `src/tui/screens/AccountTypeSelect.tsx`**

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint, SelectOption } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

const OPTIONS: SelectOption[] = [
	{ label: "Credit", value: "Credit" },
	{ label: "Debit", value: "Debit" },
];

export function AccountTypeSelect(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setMenu, setBorderColor, setTitleSuffix } = useLayout();

	const props = useRouteProps([
		"/trips/accounts/new/type",
		"/trips/accounts/edit/type",
	] as const);
	const formId = props.formId;
	const fieldKey = props.fieldKey;

	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Account Type");
		setBorderColor(null);
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setBorderColor, setTitleSuffix]);

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	return (
		<SingleSelectList
			options={OPTIONS}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
```

- [ ] **Step 6: Register the 5 routes in `src/tui/router.ts`**

Add the imports near the other screen imports (alphabetical):

```ts
import { AccountSelect } from "./screens/AccountSelect";
import { AccountTypeSelect } from "./screens/AccountTypeSelect";
import { CategorySelect } from "./screens/CategorySelect";
import { CurrencySelect } from "./screens/CurrencySelect";
```

Inside the `routes` object, add 5 new entries (group near related routes for readability):

```ts
"/trips/expenses/form/account": {
	component: AccountSelect as unknown as ComponentType,
	title: "Select Account",
	defaultFocus: "main",
},
"/trips/expenses/form/category": {
	component: CategorySelect as unknown as ComponentType,
	title: "Select Category",
	defaultFocus: "main",
},
"/trips/expenses/form/currency": {
	component: CurrencySelect as unknown as ComponentType,
	title: "Select Currency",
	defaultFocus: "main",
},
"/trips/accounts/new/type": {
	component: AccountTypeSelect as unknown as ComponentType,
	title: "Select Account Type",
	defaultFocus: "main",
},
"/trips/accounts/edit/type": {
	component: AccountTypeSelect as unknown as ComponentType,
	title: "Select Account Type",
	defaultFocus: "main",
},
```

- [ ] **Step 7: Type check + lint**

Run: `bun run check:type && bun run check`
Expected: clean. (The new screens' `useRouteProps` paths now exist in RouteParams; the `Routes` derived type is satisfied because every key has a registered component.)

- [ ] **Step 8: Run tests**

Run: `bun test`
Expected: all 140 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/tui/models/index.ts src/tui/router.ts src/tui/screens/AccountSelect.tsx src/tui/screens/CategorySelect.tsx src/tui/screens/CurrencySelect.tsx src/tui/screens/AccountTypeSelect.tsx
git commit -m "feat(tui): add single-select sub-page screens and routes"
```

---

## Task 3: Convert select to navigation (Form + hosts + cleanup)

This task makes `SelectFormField.onEdit` required, updates `Form` to navigate on select Enter (instead of opening an inline editor), wires the three host screens to provide `onEdit`, and deletes the inline atoms. The whole bundle must commit atomically because the model change cascades.

**Files:**
- Modify: `src/tui/models/index.ts` (`SelectFormField.onEdit` becomes required)
- Modify: `src/tui/components/organisms/Form.tsx` (drop inline select branches; dispatch Enter to `field.onEdit`)
- Modify: `src/tui/screens/ExpenseForm.tsx` (account/category/currency get `onEdit`)
- Modify: `src/tui/screens/AccountCreate.tsx` (type gets `onEdit`)
- Modify: `src/tui/screens/AccountEdit.tsx` (type gets `onEdit`; seeding effect)
- Delete: `src/tui/components/atoms/InlineSelect.tsx`
- Delete: `src/tui/components/atoms/DropdownSelect.tsx`

- [ ] **Step 1: Update `SelectFormField` in `src/tui/models/index.ts`**

Find the existing `SelectFormField` definition. It currently looks like:

```ts
export type SelectFormField = FormFieldBase & {
	type: "select";
	options: SelectOption[];
	defaultValue?: string;
};
```

Replace it with:

```ts
export type SelectFormField = FormFieldBase & {
	type: "select";
	options: SelectOption[];
	defaultValue?: string;
	onEdit: () => void;
};
```

- [ ] **Step 2: Update `src/tui/components/organisms/Form.tsx`**

Two changes inside `Form.tsx`:

**Change A — Dispatch Enter to `onEdit` for both `multiselect` and `select`:**

Find the existing `useInput` block where the multiselect dispatch lives. It currently looks like:

```ts
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
}
```

Replace the inner `if/else` with:

```ts
if (field.type === "multiselect" || field.type === "select") {
	field.onEdit();
} else {
	enterEdit();
}
```

**Change B — Remove the inline select editor branches:**

Find the editing-row JSX block. It currently has branches like:

```tsx
{field.type === "select" &&
	field.options.length <= INLINE_SELECT_THRESHOLD && (
		<InlineSelect ... />
	)}
{field.type === "select" &&
	field.options.length > INLINE_SELECT_THRESHOLD && (
		<DropdownSelect ... />
	)}
```

Delete BOTH branches entirely. Also delete:

- The `INLINE_SELECT_THRESHOLD` constant declaration near the top of the file.
- The `import { InlineSelect } from "../atoms/InlineSelect";` line.
- The `import { DropdownSelect } from "../atoms/DropdownSelect";` line.

After this change, the editing-row JSX inside `{isEditing && field.type !== "multiselect" && (...)}` only contains the `text` and `date` branches.

The rendering check should also exclude `select` from inline editing. Update the wrapping condition from:

```tsx
{isEditing && field.type !== "multiselect" && (
```

to:

```tsx
{isEditing &&
	field.type !== "multiselect" &&
	field.type !== "select" && (
```

(This prevents an empty `<Box>` from rendering when the user somehow lands in editing mode on a select field — which shouldn't happen anymore since the dispatcher now calls `onEdit` instead of `enterEdit` for selects, but the guard is defensive.)

- [ ] **Step 3: Update `src/tui/screens/ExpenseForm.tsx`**

Find the `fields` array inside the `useMemo`. The three `select` field configs (`account`, `category`, `currency`) need an `onEdit` property.

For the `account` field, change:

```ts
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
```

to:

```ts
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
```

For `category`:

```ts
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
```

For `currency`:

```ts
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
```

- [ ] **Step 4: Update `src/tui/screens/AccountCreate.tsx`**

The `type` field config currently looks like:

```ts
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
```

Replace it with:

```ts
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
	onEdit: () =>
		goTo("/trips/accounts/new/type", {
			props: { tripDirPath, formId: FORM_ID, fieldKey: "type" },
		}),
},
```

- [ ] **Step 5: Update `src/tui/screens/AccountEdit.tsx`**

Two changes here:

**Change A — `type` field gets `onEdit`:**

Replace the existing `type` field config:

```ts
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
```

with:

```ts
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
	onEdit: () =>
		goTo("/trips/accounts/edit/type", {
			props: {
				tripDirPath,
				accountId,
				formId,
				fieldKey: "type",
			},
		}),
},
```

**Change B — Add a seeding effect for `type`:**

Find the existing seeding effect for `owners`:

```ts
useEffect(() => {
	if (account && buffer.values["owners"] === undefined) {
		buffer.setField("owners", account.owners);
	}
}, [account, buffer]);
```

Add a parallel effect immediately after it for `type`:

```ts
useEffect(() => {
	if (account && buffer.values["type"] === undefined) {
		buffer.setField("type", account.type);
	}
}, [account, buffer]);
```

This ensures `AccountTypeSelect` opens with the cursor on the existing account type the first time the user navigates there.

- [ ] **Step 6: Delete the inline atom files**

```bash
rm src/tui/components/atoms/InlineSelect.tsx
rm src/tui/components/atoms/DropdownSelect.tsx
```

- [ ] **Step 7: Type check**

Run: `bun run check:type`
Expected: clean. (Every existing `select` field now has `onEdit` set; Form's removed branches no longer reference the deleted atoms.)

- [ ] **Step 8: Lint**

Run: `bun run check`
Expected: clean. Run `bun run fix` if Biome wants any auto-format.

- [ ] **Step 9: Run tests**

Run: `bun test`
Expected: all 140 tests pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(tui): select fields navigate to sub-pages instead of inline editors"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full test suite**

Run: `bun test`
Expected: 140/140 pass.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `bun run check`
Expected: clean.

- [ ] **Step 4: Confirm deleted files are gone**

Run:
```bash
ls src/tui/components/atoms/InlineSelect.tsx 2>&1 || echo "InlineSelect: gone"
ls src/tui/components/atoms/DropdownSelect.tsx 2>&1 || echo "DropdownSelect: gone"
```
Expected: both report "gone".

- [ ] **Step 5: End-to-end manual walkthrough**

Run: `bun run start --data-dir ./tmp-data`

Walk through:

1. From the trip list, create a trip (use the existing flow). Add at least one Owner, one Account.
2. Open the new-expense form. Cursor to `Account` → press Enter. Verify a sub-page opens with `Select Account` in the title and the account list. Press Enter to confirm; verify return to ExpenseForm with the chosen account shown.
3. Cursor to `Category` → press Enter. Verify the category sub-page lists the trip's categories (default 6). Pick one. Verify return.
4. Cursor to `Currency` → press Enter. Verify the currency sub-page lists `THB` plus any added currencies. Cursor starts on `THB` (default). Pick one and confirm.
5. Press `[s]` to submit. Verify the expense is saved.
6. Edit the same expense. Cursor to `Account` → Enter. Verify cursor is on the previously-chosen account. Press Esc; verify form unchanged.
7. From the trip list, navigate Accounts → Add. In the create form, cursor to `Account Type` → Enter. Verify the sub-page opens with `Credit`/`Debit`, cursor on `Credit` (default). Pick `Debit`. Submit.
8. Edit the just-created account. Cursor to `Account Type` → Enter. Verify cursor is on `Debit`. Esc to cancel.

- [ ] **Step 6: Cleanup**

```bash
rm -rf tmp-data
```

No commit — verification only.
