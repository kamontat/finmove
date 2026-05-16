# Settings: Non-Editable Directory Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show trip directory name (basename of `trip.dirPath`) on the trip settings page as a non-editable Form field.

**Architecture:** Add a new `display` field type to the `Form` organism so it can render read-only rows alongside editable ones. Cursor navigation skips display rows; `onSubmit` ignores them. `TripSettings` prepends a Directory display field.

**Tech Stack:** TypeScript, React, Ink, Bun. Linting via Biome.

**Spec:** `docs/superpowers/specs/2026-05-16-settings-directory-display-design.md`

---

## File Structure

- **Modify** `src/tui/models/index.ts` — extend the `FormFieldConfig` union with a `DisplayFormField` variant.
- **Modify** `src/tui/components/organisms/Form.tsx` — render display rows, skip them in cursor navigation, exclude them from submit/required logic.
- **Modify** `src/tui/screens/TripSettings.tsx` — prepend a Directory display field showing `basename(trip.dirPath)`.

No new files. No tests added (per approved spec — Form has no existing unit tests, and Ink component testing is not established in this repo). Verification is via `bun run check:type`, `bun run check`, and manual TUI testing.

---

### Task 1: Add `DisplayFormField` type

**Files:**
- Modify: `src/tui/models/index.ts:239-276`

- [ ] **Step 1: Add the new field type and extend the union**

Edit `src/tui/models/index.ts`. After the existing `MultiSelectFormField` definition (around line 265-270), add the new `DisplayFormField` type and include it in the union.

Find this block:

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

Replace with:

```ts
export type MultiSelectFormField = FormFieldBase & {
	type: "multiselect";
	defaultValue?: string[];
	onEdit: () => void;
	display?: (selected: string[]) => string;
};

export type DisplayFormField = FormFieldBase & {
	type: "display";
	value: string;
};

export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| DateFormField
	| MultiSelectFormField
	| DisplayFormField;
```

- [ ] **Step 2: Verify type-check still passes**

Run: `bun run check:type`
Expected: exits with code 0 — no errors. (Form.tsx uses chained `if (field.type === "...")` branches that are not exhaustive, so adding a new variant won't break compilation. Display fields will render with an empty value until Task 2.)

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat(tui): add DisplayFormField type for read-only form rows"
```

---

### Task 2: Render display fields in `Form` and skip them in navigation

**Files:**
- Modify: `src/tui/components/organisms/Form.tsx`

This task changes five pieces of logic in `Form.tsx`. Apply them in order; commit at the end.

- [ ] **Step 1: Skip display fields when seeding `localValues`**

In `Form.tsx`, find this `useState` initializer (around lines 34-42):

```ts
const [localValues, setLocalValues] = useState<Record<string, FieldValue>>(
	() => {
		const initial: Record<string, FieldValue> = {};
		for (const field of fields) {
			initial[field.key] = field.type === "multiselect" ? [] : "";
		}
		return initial;
	},
);
```

Replace with:

```ts
const [localValues, setLocalValues] = useState<Record<string, FieldValue>>(
	() => {
		const initial: Record<string, FieldValue> = {};
		for (const field of fields) {
			if (field.type === "display") continue;
			initial[field.key] = field.type === "multiselect" ? [] : "";
		}
		return initial;
	},
);
```

- [ ] **Step 2: Exclude display fields from `canSubmit` checks**

Find the `canSubmit` `useMemo` block (around lines 74-87):

```ts
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
```

Replace with:

```ts
const canSubmit = useMemo(() => {
	const allRequiredFilled = fields.every((field) => {
		if (field.type === "display") return true;
		if (!field.required) return true;
		return isFilled(field);
	});
	const hasAnyChange = fields.some((field) => {
		if (field.type === "display") return false;
		const v = values[field.key];
		if (field.type === "multiselect") {
			return Array.isArray(v) && v.length > 0;
		}
		return typeof v === "string" && v !== "";
	});
	return allRequiredFilled && hasAnyChange;
}, [fields, values, isFilled]);
```

- [ ] **Step 3: Exclude display fields from the submitted result**

Find the `handleSubmit` callback (around lines 95-116):

```ts
const handleSubmit = useCallback(() => {
	if (!canSubmit) return;
	const result: Record<string, FieldValue> = {};
	for (const field of fields) {
		const v = values[field.key];
		if (field.type === "multiselect") {
			result[field.key] = Array.isArray(v) ? v : [];
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
```

Replace with:

```ts
const handleSubmit = useCallback(() => {
	if (!canSubmit) return;
	const result: Record<string, FieldValue> = {};
	for (const field of fields) {
		if (field.type === "display") continue;
		const v = values[field.key];
		if (field.type === "multiselect") {
			result[field.key] = Array.isArray(v) ? v : [];
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
```

- [ ] **Step 4: Add navigation helpers and update arrow/Enter handlers to skip display fields**

Find the `useInput` block (around lines 141-170):

```ts
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
				} else if (field.type === "select") {
					if (field.onEdit) {
						field.onEdit();
					} else {
						enterEdit();
					}
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
```

Replace with:

```ts
const isStop = useCallback(
	(index: number): boolean => {
		if (index === fields.length) return true; // submit row
		const field = fields[index];
		return !!field && field.type !== "display";
	},
	[fields],
);

const moveCursor = useCallback(
	(from: number, direction: 1 | -1): number => {
		let next = from;
		for (let i = 0; i < totalItems; i++) {
			next =
				direction === 1
					? next < totalItems - 1
						? next + 1
						: 0
					: next > 0
						? next - 1
						: totalItems - 1;
			if (isStop(next)) return next;
		}
		return from;
	},
	[isStop, totalItems],
);

useInput(
	(input, key) => {
		if (key.upArrow) {
			setCursor((c) => moveCursor(c, -1));
		} else if (key.downArrow) {
			setCursor((c) => moveCursor(c, 1));
		} else if (key.return) {
			if (cursor === fields.length) {
				handleSubmit();
			} else {
				const field = fields[cursor];
				if (!field || field.type === "display") return;
				if (field.type === "multiselect") {
					field.onEdit();
				} else if (field.type === "select") {
					if (field.onEdit) {
						field.onEdit();
					} else {
						enterEdit();
					}
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
```

- [ ] **Step 5: Initialize cursor on the first editable field**

Find the cursor state declaration (around line 58):

```ts
const [cursor, setCursor] = useState(0);
```

Replace with:

```ts
const initialCursor = useMemo(() => {
	const idx = fields.findIndex((f) => f.type !== "display");
	return idx === -1 ? fields.length : idx;
}, [fields]);

const [cursor, setCursor] = useState(initialCursor);
```

Note: `useMemo` is already imported at the top of the file (line 2: `import { type JSX, useCallback, useEffect, useMemo, useState } from "react";`), so no import changes needed.

- [ ] **Step 6: Render display fields as dim read-only rows**

In the render loop (around lines 174-309), the current code computes `displayValue` from `values[field.key]`. For display fields we want to use `field.value` directly and skip all the cursor/edit branches.

Find this block at the top of the `.map` callback (around lines 174-204):

```ts
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
```

Insert a display-field short-circuit before the existing logic. Replace with:

```ts
{fields.map((field, index) => {
	if (field.type === "display") {
		return (
			<Box key={field.key} flexDirection="column">
				<Text dimColor>
					{"  "}
					{field.label}: {field.value}
				</Text>
			</Box>
		);
	}

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
```

- [ ] **Step 7: Run type check and lint**

Run: `bun run check:type`
Expected: exits with code 0 — no errors.

Run: `bun run check`
Expected: exits with code 0 — no Biome errors.

- [ ] **Step 8: Commit**

```bash
git add src/tui/components/organisms/Form.tsx
git commit -m "feat(tui): support display fields in Form component"
```

---

### Task 3: Add Directory display field to TripSettings

**Files:**
- Modify: `src/tui/screens/TripSettings.tsx`

- [ ] **Step 1: Import `basename` from `node:path`**

At the top of `src/tui/screens/TripSettings.tsx`, find:

```ts
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
```

Replace with:

```ts
import { Text } from "ink";
import { basename } from "node:path";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
```

(Biome's import sorter expects alphabetical order; if it complains, run `bun run fix`.)

- [ ] **Step 2: Prepend the Directory field**

Find the `fields` array (around lines 78-106):

```ts
const fields: FormFieldConfig[] = [
	{
		key: "name",
		label: "Name",
		type: "text",
		required: true,
		defaultValue: settings.name,
	},
	{
		key: "startDate",
		label: "Start Date",
		type: "date",
		required: true,
		defaultValue: settings.startDate,
	},
	{
		key: "endDate",
		label: "End Date",
		type: "date",
		required: true,
		defaultValue: settings.endDate,
	},
	{
		key: "exportPath",
		label: "Export Path",
		type: "text",
		defaultValue: settings.exportPath,
	},
];
```

Replace with:

```ts
const fields: FormFieldConfig[] = [
	{
		key: "dirName",
		label: "Directory",
		type: "display",
		value: basename(trip.dirPath),
	},
	{
		key: "name",
		label: "Name",
		type: "text",
		required: true,
		defaultValue: settings.name,
	},
	{
		key: "startDate",
		label: "Start Date",
		type: "date",
		required: true,
		defaultValue: settings.startDate,
	},
	{
		key: "endDate",
		label: "End Date",
		type: "date",
		required: true,
		defaultValue: settings.endDate,
	},
	{
		key: "exportPath",
		label: "Export Path",
		type: "text",
		defaultValue: settings.exportPath,
	},
];
```

- [ ] **Step 3: Run type check and lint**

Run: `bun run check:type`
Expected: exits with code 0.

Run: `bun run check`
Expected: exits with code 0. If imports were not auto-sorted, run `bun run fix` and re-run `bun run check`.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripSettings.tsx
git commit -m "feat(tui): show directory name on trip settings page"
```

---

### Task 4: Manual verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the existing test suite**

Run: `bun test`
Expected: all tests pass. (No new tests were added; this confirms nothing regressed.)

- [ ] **Step 2: Launch the app and open Trip Settings**

Run: `bun run start`
Action: Select an existing trip → Settings menu (whichever route the menu uses to land on `/trips/settings`).

Expected: the form shows five rows in order:
1. `  Directory: <slug-name>` (dim, no `>` cursor possible)
2. `> Name: <name>` (cursor starts here)
3. `  Start Date: <date>`
4. `  End Date: <date>`
5. `  Export Path: <path>`

Followed by `────` and `  [s] Submit`.

- [ ] **Step 3: Verify cursor navigation skips Directory**

Action: Press `↑` repeatedly. The cursor should cycle through Submit → Export Path → End Date → Start Date → Name → Submit, never landing on Directory.
Action: Press `↓` repeatedly. The cursor should cycle the opposite way, also skipping Directory.

- [ ] **Step 4: Verify submit ignores Directory**

Action: With the form unmodified (just defaults), press `s` to submit.
Expected: settings save and the screen navigates back. Open the trip's `settings.yaml` and confirm no new `dirName` key was written.

- [ ] **Step 5: Verify edit flow still works**

Action: Navigate to Name with `↓`, press Enter, modify the name, press Enter to confirm. Press `s`.
Expected: name updates persist. Directory row continues to show the unchanged slug (renaming the directory is not in scope).

- [ ] **Step 6: Final commit (if any fix-ups were needed)**

If any of the above surfaced bugs and they were fixed, commit those fixes with descriptive messages. Otherwise, no commit needed for this task.
