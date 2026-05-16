# Form.tsx Strategy Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/tui/components/organisms/Form.tsx` (~450 lines) from a file with field-type discrimination in 6 places + display-type branching in 9 places into an orchestrator that delegates to per-field-type strategy modules. Replace the standalone `DisplayFormField` type with a uniform `editable?: boolean` property on `FormFieldBase` that any field type can carry.

**Architecture:** Each editable field type (`text`, `select`, `boolean`, `date`, `multiselect`) gets a strategy module in `molecules/` that owns its own `isFilled`, `hasUserValue`, `normalizeForSubmit`, `getDisplay`, `getPreview`, `onEnterPress`, and `Editor`. `Form.tsx` keeps state/keyboard/orchestration only, with a single registry lookup `getStrategy(field)`. Non-editability is handled by Form.tsx checking `field.editable !== false` — same property check regardless of field type, no `field.type === "display"` branches anywhere.

**Tech Stack:** React + Ink (terminal UI), TypeScript with `exactOptionalPropertyTypes`, Bun runtime. No new tests added (spec excludes them — no existing Ink test harness in this repo). Verification = `bun run check:type` + `bun run check` + manual smoke per consumer screen.

**Spec:** `docs/superpowers/specs/2026-05-16-form-strategy-refactor-design.md`

---

## Background context for the worker

Read these before starting:

- `src/tui/components/organisms/Form.tsx` — current implementation (~450 lines, the file being refactored)
- `src/tui/models/index.ts` — `FormFieldConfig` union, `FieldValue`, `TextFormField`, `SelectFormField`, `BooleanFormField`, `DateFormField`, `MultiSelectFormField`, `DisplayFormField` (the last is being removed)
- `src/tui/components/atoms/TextInput.tsx`, `SelectInput.tsx`, `CheckboxInput.tsx`, `DateInput.tsx` — the atoms each Editor will wrap
- `src/tui/components/molecules/FormField.tsx` — existing molecule, **do not touch** (used elsewhere, unrelated)
- `src/tui/screens/TripSettings.tsx` — the sole consumer of `DisplayFormField` (will be migrated in Task 7)
- `CLAUDE.md` — naming conventions, TUI conventions (no `index.ts` re-exports in TUI; PascalCase for TUI files)

Key behavior invariants to preserve exactly:

1. `isFilled` for boolean returns `true` when `defaultValue !== undefined`, even without user input.
2. `canSubmit` requires at least one user-touched field (`hasUserValue` over the field set), not just defaults. Non-editable fields don't count toward either side.
3. Select with `field.onEdit` set must NOT enter inline edit mode on Enter — it must call `field.onEdit()`.
4. Multiselect always calls `field.onEdit()` on Enter (it's a required prop).
5. Text placeholder function receives only string values, filtered from `values`.
6. Date editor defaults to `"2026-01-01"` when neither current value nor `defaultValue` is set.
7. Conditional prop spreading is required for optional Ink props (`exactOptionalPropertyTypes` is on).
8. Non-editable rows: dim, no cursor caret, cursor `↑↓` skips them, excluded from submit, no `(optional)` suffix, no preview brackets.

---

## Task 1: Add `editable?: boolean` + FormFieldStrategy types to `src/tui/models/index.ts`

**Files:**
- Modify: `src/tui/models/index.ts`

This task is purely additive — `DisplayFormField` stays in the union for now (removed in Task 7).

- [ ] **Step 1: Add `editable?: boolean` to `FormFieldBase`**

Find the `FormFieldBase` interface (around line 241). Modify it to add `editable?: boolean`:

```ts
interface FormFieldBase {
	key: string;
	label: string;
	required?: boolean;
	editable?: boolean;
}
```

All field type variants (`TextFormField`, `SelectFormField`, `BooleanFormField`, `DateFormField`, `MultiSelectFormField`, `DisplayFormField`) inherit this via intersection — no other changes to the type variants are needed.

- [ ] **Step 2: Append the strategy interface at the end of the file**

After the existing `getBoolean` function, append:

```ts
// --- Form field strategies ---

export interface FormFieldStrategyEditorProps<F extends FormFieldConfig> {
	field: F;
	value: FieldValue;
	allValues: Record<string, FieldValue>;
	onSubmit: (value: FieldValue) => void;
	onCancel: () => void;
}

export interface FormFieldStrategy<
	F extends FormFieldConfig = FormFieldConfig,
> {
	emptyValue: FieldValue;
	hasUserValue(value: FieldValue): boolean;
	isFilled(field: F, value: FieldValue): boolean;
	normalizeForSubmit(field: F, value: FieldValue): FieldValue;
	getDisplay(
		field: F,
		value: FieldValue,
		allValues: Record<string, FieldValue>,
	): string;
	getPreview(
		field: F,
		allValues: Record<string, FieldValue>,
	): string | undefined;
	// Returns "edit" to enter inline edit mode, or a function to invoke externally
	// (used by select with onEdit, and multiselect). The strategy encapsulates the
	// onEdit lookup so Form.tsx never branches on field.type.
	onEnterPress(field: F): "edit" | (() => void);
	Editor: (
		props: FormFieldStrategyEditorProps<F>,
	) => import("react").JSX.Element;
}
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: PASS (additive change — `editable` is optional, strategy types are new exports, no existing usages need updating yet)

- [ ] **Step 4: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "$(cat <<'EOF'
feat(tui): add editable flag and FormFieldStrategy interface

Adds editable?: boolean to FormFieldBase (default true) so any field type
can be marked read-only. Adds FormFieldStrategy / FormFieldStrategyEditorProps
interfaces for the upcoming per-type strategy modules.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `FormFieldText` strategy

**Files:**
- Create: `src/tui/components/molecules/FormFieldText.tsx`

- [ ] **Step 1: Write the file**

Create `src/tui/components/molecules/FormFieldText.tsx` with this exact contents:

```tsx
import type { JSX } from "react";
import type {
	FieldValue,
	FormFieldStrategy,
	TextFormField,
} from "../../models";
import { TextInput } from "../atoms/TextInput";

function stringValuesOnly(
	values: Record<string, FieldValue>,
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(values)) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}

function resolvePlaceholder(
	field: TextFormField,
	allValues: Record<string, FieldValue>,
): string | undefined {
	if (field.placeholder === undefined) return undefined;
	return typeof field.placeholder === "function"
		? field.placeholder(stringValuesOnly(allValues))
		: field.placeholder;
}

export const FormFieldText: FormFieldStrategy<TextFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "string" && value !== "";
	},

	isFilled(field, value) {
		if (typeof value === "string" && value !== "") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "string" && value !== "") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return "";
	},

	getDisplay(_field, value) {
		return typeof value === "string" ? value : "";
	},

	getPreview(field, allValues) {
		if (field.defaultValue !== undefined) return field.defaultValue;
		return resolvePlaceholder(field, allValues);
	},

	onEnterPress() {
		return "edit";
	},

	Editor({ field, value, allValues, onSubmit, onCancel }): JSX.Element {
		const placeholder = resolvePlaceholder(field, allValues);
		const currentString = typeof value === "string" ? value : "";
		const defaultValue =
			currentString !== "" ? currentString : field.defaultValue;
		return (
			<TextInput
				{...(placeholder !== undefined ? { placeholder } : {})}
				{...(defaultValue !== undefined ? { defaultValue } : {})}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		);
	},
};
```

Notes:
- `onSubmit` typed as `(v: FieldValue) => void` is assignable to TextInput's `onSubmit: (v: string) => void` via TypeScript's contravariant function parameters.
- Conditional spreading of `placeholder` and `defaultValue` is required because of `exactOptionalPropertyTypes`.
- For non-editable text fields (handled by Form.tsx in Task 7), `getDisplay` is called with `field.defaultValue ?? ""` — it returns that string directly, which is exactly what the dim row needs.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS (not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/FormFieldText.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add FormFieldText strategy module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `FormFieldSelect` strategy

**Files:**
- Create: `src/tui/components/molecules/FormFieldSelect.tsx`

- [ ] **Step 1: Write the file**

Create `src/tui/components/molecules/FormFieldSelect.tsx` with this exact contents:

```tsx
import type { JSX } from "react";
import type {
	FormFieldStrategy,
	SelectFormField,
} from "../../models";
import { SelectInput } from "../atoms/SelectInput";

export const FormFieldSelect: FormFieldStrategy<SelectFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "string" && value !== "";
	},

	isFilled(field, value) {
		if (typeof value === "string" && value !== "") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "string" && value !== "") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return "";
	},

	getDisplay(field, value) {
		if (typeof value !== "string" || value === "") return "";
		const found = field.options.find((o) => o.value === value);
		return found?.label ?? value;
	},

	getPreview(field) {
		if (field.defaultValue === undefined) return undefined;
		const found = field.options.find((o) => o.value === field.defaultValue);
		return found?.label ?? field.defaultValue;
	},

	onEnterPress(field) {
		return field.onEdit ?? "edit";
	},

	Editor({ field, value, onSubmit, onCancel }): JSX.Element {
		const target =
			typeof value === "string" && value !== ""
				? value
				: field.defaultValue;
		const initialIndex = Math.max(
			0,
			field.options.findIndex((o) => o.value === target),
		);
		return (
			<SelectInput
				options={field.options}
				isActive={true}
				initialIndex={initialIndex}
				onChange={onSubmit}
				onCancel={onCancel}
			/>
		);
	},
};
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/FormFieldSelect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add FormFieldSelect strategy module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `FormFieldBoolean` strategy

**Files:**
- Create: `src/tui/components/molecules/FormFieldBoolean.tsx`

- [ ] **Step 1: Write the file**

Create `src/tui/components/molecules/FormFieldBoolean.tsx` with this exact contents:

```tsx
import type { JSX } from "react";
import type {
	BooleanFormField,
	FormFieldStrategy,
} from "../../models";
import { CheckboxInput } from "../atoms/CheckboxInput";

function labelFor(field: BooleanFormField, value: boolean): string {
	return value ? (field.trueLabel ?? "Yes") : (field.falseLabel ?? "No");
}

export const FormFieldBoolean: FormFieldStrategy<BooleanFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "boolean";
	},

	isFilled(field, value) {
		if (typeof value === "boolean") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "boolean") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return false;
	},

	getDisplay(field, value) {
		if (typeof value !== "boolean") return "";
		return labelFor(field, value);
	},

	getPreview(field) {
		if (field.defaultValue === undefined) return undefined;
		return labelFor(field, field.defaultValue);
	},

	onEnterPress() {
		return "edit";
	},

	Editor({ field, value, onSubmit, onCancel }): JSX.Element {
		const defaultValue =
			typeof value === "boolean" ? value : (field.defaultValue ?? false);
		return (
			<CheckboxInput
				defaultValue={defaultValue}
				{...(field.trueLabel !== undefined
					? { trueLabel: field.trueLabel }
					: {})}
				{...(field.falseLabel !== undefined
					? { falseLabel: field.falseLabel }
					: {})}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		);
	},
};
```

Notes:
- `emptyValue` is `""` (string) — boolean fields stay as empty string until the user toggles, matching the current Form's `useState` init that uses `""` for everything except multiselect.
- `onSubmit` typed `(v: FieldValue) => void` is assignable to `CheckboxInput.onSubmit: (v: boolean) => void` via contravariance.

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/FormFieldBoolean.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add FormFieldBoolean strategy module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create `FormFieldDate` strategy

**Files:**
- Create: `src/tui/components/molecules/FormFieldDate.tsx`

- [ ] **Step 1: Write the file**

Create `src/tui/components/molecules/FormFieldDate.tsx` with this exact contents:

```tsx
import type { JSX } from "react";
import type {
	DateFormField,
	FormFieldStrategy,
} from "../../models";
import { DateInput } from "../atoms/DateInput";

export const FormFieldDate: FormFieldStrategy<DateFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "string" && value !== "";
	},

	isFilled(field, value) {
		if (typeof value === "string" && value !== "") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "string" && value !== "") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return "";
	},

	getDisplay(_field, value) {
		return typeof value === "string" ? value : "";
	},

	getPreview(field) {
		return field.defaultValue;
	},

	onEnterPress() {
		return "edit";
	},

	Editor({ field, value, onSubmit, onCancel }): JSX.Element {
		const defaultValue =
			typeof value === "string" && value !== ""
				? value
				: (field.defaultValue ?? "2026-01-01");
		return (
			<DateInput
				defaultValue={defaultValue}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		);
	},
};
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/FormFieldDate.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add FormFieldDate strategy module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `FormFieldMultiselect` strategy

**Files:**
- Create: `src/tui/components/molecules/FormFieldMultiselect.tsx`

- [ ] **Step 1: Write the file**

Create `src/tui/components/molecules/FormFieldMultiselect.tsx` with this exact contents:

```tsx
import { Box } from "ink";
import type { JSX } from "react";
import type {
	FormFieldStrategy,
	MultiSelectFormField,
} from "../../models";

export const FormFieldMultiselect: FormFieldStrategy<MultiSelectFormField> = {
	emptyValue: [],

	hasUserValue(value) {
		return Array.isArray(value) && value.length > 0;
	},

	isFilled(_field, value) {
		return Array.isArray(value) && value.length > 0;
	},

	normalizeForSubmit(_field, value) {
		return Array.isArray(value) ? value : [];
	},

	getDisplay(field, value) {
		const arr = Array.isArray(value) ? value : (field.defaultValue ?? []);
		if (field.display) return field.display(arr);
		return arr.length === 0 ? "(none)" : arr.join(", ");
	},

	getPreview() {
		return undefined;
	},

	onEnterPress(field) {
		return field.onEdit;
	},

	Editor(): JSX.Element {
		// Never rendered: onEnterPress always returns a function, so Form skips
		// the editor block for multiselect. This placeholder satisfies the
		// FormFieldStrategy interface.
		return <Box />;
	},
};
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/FormFieldMultiselect.tsx
git commit -m "$(cat <<'EOF'
feat(tui): add FormFieldMultiselect strategy module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Atomic cutover — migrate TripSettings, rewrite Form.tsx, remove DisplayFormField

This task is **one atomic commit** that simultaneously:
1. Migrates `TripSettings.tsx` from `type: "display"` to `type: "text", editable: false`.
2. Rewrites `Form.tsx` to use the strategy registry and treat `field.editable !== false` as the editability gate.
3. Removes `DisplayFormField` from `FormFieldConfig` in `src/tui/models/index.ts`.

These must happen together because the type system only validates the final state — between any pair of these changes the code would not compile.

**Files:**
- Modify: `src/tui/screens/TripSettings.tsx`
- Modify: `src/tui/components/organisms/Form.tsx` (full rewrite)
- Modify: `src/tui/models/index.ts` (remove `DisplayFormField` type and from the union)

- [ ] **Step 1: Update `src/tui/screens/TripSettings.tsx`**

Find the field config that uses `type: "display"` (around line 80-85):

```tsx
{
    key: "dirName",
    label: "Directory",
    type: "display",
    value: basename(trip.dirPath),
},
```

Replace it with:

```tsx
{
    key: "dirName",
    label: "Directory",
    type: "text",
    editable: false,
    defaultValue: basename(trip.dirPath),
},
```

Leave the rest of the file unchanged.

- [ ] **Step 2: Replace the contents of `src/tui/components/organisms/Form.tsx`**

Overwrite the entire file with:

```tsx
import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type {
	FieldValue,
	FormFieldConfig,
	FormFieldStrategy,
} from "../../models";
import { useFocus } from "../../states/focus";
import { useFormBuffer } from "../../states/formBuffer";
import { FormFieldBoolean } from "../molecules/FormFieldBoolean";
import { FormFieldDate } from "../molecules/FormFieldDate";
import { FormFieldMultiselect } from "../molecules/FormFieldMultiselect";
import { FormFieldSelect } from "../molecules/FormFieldSelect";
import { FormFieldText } from "../molecules/FormFieldText";

interface FormProps {
	fields: FormFieldConfig[];
	onSubmit: (values: Record<string, FieldValue>) => void;
	submitLabel?: string;
	submitKey?: string;
	formId?: string;
}

const STRATEGIES = {
	text: FormFieldText,
	select: FormFieldSelect,
	boolean: FormFieldBoolean,
	date: FormFieldDate,
	multiselect: FormFieldMultiselect,
} as const;

function getStrategy(field: FormFieldConfig): FormFieldStrategy {
	return STRATEGIES[field.type] as FormFieldStrategy;
}

function isEditable(field: FormFieldConfig): boolean {
	return field.editable !== false;
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
				if (!isEditable(field)) continue;
				initial[field.key] = getStrategy(field).emptyValue;
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

	const [cursor, setCursor] = useState(() => {
		const idx = fields.findIndex(isEditable);
		return idx === -1 ? fields.length : idx;
	});
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSubmit = useMemo(() => {
		const allRequiredFilled = fields.every((field) => {
			if (!isEditable(field)) return true;
			if (!field.required) return true;
			return getStrategy(field).isFilled(field, values[field.key]);
		});
		const hasAnyUserValue = fields.some((field) => {
			if (!isEditable(field)) return false;
			return getStrategy(field).hasUserValue(values[field.key]);
		});
		return allRequiredFilled && hasAnyUserValue;
	}, [fields, values]);

	const totalItems = canSubmit ? fields.length + 1 : fields.length;

	if (cursor >= totalItems) {
		setCursor(totalItems - 1);
	}

	const handleSubmit = useCallback(() => {
		if (!canSubmit) return;
		const result: Record<string, FieldValue> = {};
		for (const field of fields) {
			if (!isEditable(field)) continue;
			result[field.key] = getStrategy(field).normalizeForSubmit(
				field,
				values[field.key],
			);
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

	const handleFieldSubmit = useCallback(
		(key: string, value: FieldValue) => {
			setValue(key, value);
			exitEdit();
		},
		[setValue, exitEdit],
	);

	const isStop = useCallback(
		(index: number): boolean => {
			if (index === fields.length) return true; // submit row
			const field = fields[index];
			return !!field && isEditable(field);
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
					if (!field || !isEditable(field)) return;
					const action = getStrategy(field).onEnterPress(field);
					if (action === "edit") {
						enterEdit();
					} else {
						action();
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
				const strategy = getStrategy(field);

				if (!isEditable(field)) {
					const display = strategy.getDisplay(
						field,
						field.defaultValue ?? strategy.emptyValue,
						values,
					);
					return (
						<Box key={field.key} flexDirection="column">
							<Text dimColor>
								{"  "}
								{field.label}: {display}
							</Text>
						</Box>
					);
				}

				const isCursor = cursor === index;
				const currentValue = values[field.key];
				const action = strategy.onEnterPress(field);
				const isEditingThisRow = editing && isCursor && action === "edit";

				const display = strategy.getDisplay(field, currentValue, values);
				const preview = strategy.getPreview(field, values);
				const optionalSuffix = !field.required ? " (optional)" : "";

				const labelTail =
					display !== ""
						? display
						: preview !== undefined
							? `(${preview})`
							: "";

				const labelText = (
					<>
						{field.label}
						{optionalSuffix}: {labelTail}
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

						{isEditingThisRow && (
							<Box marginLeft={4}>
								<strategy.Editor
									field={field}
									value={currentValue}
									allValues={values}
									onSubmit={(val) => handleFieldSubmit(field.key, val)}
									onCancel={exitEdit}
								/>
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
```

Key changes from the original:
- No `field.type` branches anywhere — registry lookup only.
- No `field.type === "display"` branches anywhere — replaced by `isEditable(field)` (= `field.editable !== false`).
- `localValues` init skips non-editable fields and uses `strategy.emptyValue` for editable ones.
- Initial cursor lands on first editable field via `fields.findIndex(isEditable)`.
- `canSubmit`, `handleSubmit`, the Enter handler, and `isStop` all guard with `isEditable`.
- Row rendering has one early-return branch for non-editable rows (renders dim label + `strategy.getDisplay(field, field.defaultValue ?? emptyValue, values)`).
- The editable row's `display`-or-`(preview)` rendering is unified — `labelTail` defaults to the display string when present, falls back to `(preview)`, then to empty.
- `stringValuesOnly` helper moved into `FormFieldText.tsx`.

- [ ] **Step 3: Remove `DisplayFormField` from `src/tui/models/index.ts`**

Find the `DisplayFormField` type definition (around line 279-282):

```ts
export type DisplayFormField = FormFieldBase & {
	type: "display";
	value: string;
};
```

**Delete it entirely.**

Then find the `FormFieldConfig` union (around line 284-290):

```ts
export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| BooleanFormField
	| DateFormField
	| MultiSelectFormField
	| DisplayFormField;
```

Remove the `| DisplayFormField` line so it reads:

```ts
export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| BooleanFormField
	| DateFormField
	| MultiSelectFormField;
```

- [ ] **Step 4: Type check**

Run: `bun run check:type`
Expected: PASS

If TypeScript complains about variance between `(v: FieldValue) => void` and the atom's narrower `onSubmit` signature in any strategy Editor, wrap with a closure: `onSubmit={(v) => onSubmit(v)}`. Strict-mode contravariance should make direct passing work, but the closure is a safe fallback.

If TypeScript complains that `field.defaultValue` doesn't exist on `FormFieldConfig`, double-check that all five remaining variants have `defaultValue?: ...` of some type — they should. The intersection narrows to `string | boolean | string[] | undefined`, which is compatible with `FieldValue | undefined`.

- [ ] **Step 5: Lint**

Run: `bun run check`
Expected: PASS. If formatting differs, run `bun run fix` and re-stage modified files.

- [ ] **Step 6: Run existing tests**

Run: `bun test`
Expected: PASS (no Form tests exist; confirms unrelated code paths in `src/core/` aren't affected).

- [ ] **Step 7: Commit atomically**

```bash
git add src/tui/models/index.ts src/tui/components/organisms/Form.tsx src/tui/screens/TripSettings.tsx
git commit -m "$(cat <<'EOF'
refactor(tui): replace Form.tsx if-else chains with strategy registry

Form.tsx now delegates per-field-type behavior to strategy modules in
molecules/ (text, select, boolean, date, multiselect). Six places of
field.type branching collapse into a single registry lookup.

Non-editability is unified under field.editable !== false. The
DisplayFormField type is removed; TripSettings migrates its directory
row to type: "text", editable: false. Nine places of "display"-type
branching collapse into checks of a uniform property.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Manual smoke verification

Run the app and verify each field type still works end-to-end. The other 16 consumer screens do not need code edits — Form's public API is unchanged.

- [ ] **Step 1: Start the app**

Run: `bun run start`

Use a fresh data dir if helpful: `bun run start --data-dir ./scratch-data`

- [ ] **Step 2: Text fields**

Navigate to `Trips → New Trip` (uses text fields).

Verify:
- Each text field shows `(placeholder)` as preview when empty.
- Pressing `[Enter]` on a field enters edit mode; typed value appears.
- `[Esc]` discards and exits edit mode.
- `[s]` submits successfully when all required fields have values.

Repeat with an owner/category/tag/country create flow as time allows.

- [ ] **Step 3: Select with `onEdit` (modal selectors)**

Navigate to `Trips → [trip] → Expenses → New Expense`.

Verify on the `Currency`, `Account`, `Category` fields:
- Pressing `[Enter]` navigates to a sub-screen (does NOT enter inline edit).
- Selecting in the sub-screen returns to the form with the chosen value populated.
- Pressing `[s]` to submit works.

- [ ] **Step 4: Multiselect**

In the same expense form, focus the `Owners` and `Tags` fields.

Verify:
- Empty display shows `(none)`.
- `[Enter]` navigates to the sub-screen.
- Returning shows joined values or `field.display(...)` output.

- [ ] **Step 5: Boolean**

Navigate to `Trips → [trip] → Settings → Tags → New Tag`.

Verify:
- `[Enter]` enters edit mode showing `CheckboxInput`.
- `[Space]` toggles, `[Enter]` confirms, `[Esc]` cancels.
- Preview shows `(Yes)` / `(No)` (or custom labels) when defaultValue is set.

- [ ] **Step 6: Date**

In `New Expense`, focus the date field.

Verify:
- `[Enter]` shows the date editor (default `2026-01-01` or current value).
- `←/→` switches between year/month/day segments.
- `↑/↓` changes the active segment.
- `[Enter]` confirms; `[Esc]` cancels.

- [ ] **Step 7: Non-editable text (TripSettings directory row)**

Navigate to `Trips → [trip] → Settings`.

Verify:
- The `Directory:` row appears dim with the directory basename visible (e.g., `my-trip-2026`).
- Pressing `↑/↓` cycles between the OTHER fields and the submit row but never lands on `Directory`.
- Pressing `[s]` submits the form; the submit result does NOT contain `dirName`.
- After submission, the form behaves normally.

- [ ] **Step 8: Keyboard behaviors**

In any form:
- `[Tab]` switches focus between main and menu (when a menu is registered).
- `[?]` toggles help bar (when help hints are registered).
- `[q]` goes back from the form.
- Cursor wraps at top and bottom with `↑/↓`, skipping non-editable rows.
- After all required fields are filled, the `[s] Submit` row appears and is reachable via cursor.

- [ ] **Step 9: Buffer (formId) integration**

In `New Expense` (which uses `formId`):
- Enter a value in the description.
- Navigate to currency sub-screen, pick a currency, return.
- Verify the description is still populated AND the currency now shows the picked value.
- Repeat for account / category.

- [ ] **Step 10: Submit error path**

Trigger a validation error from a consumer screen (e.g. duplicate trip name in `New Trip`).

Verify:
- The error message renders in red below the submit row.
- After fixing the value and resubmitting, the error clears.

- [ ] **Step 11: If anything regresses**

Fix the strategy module responsible (most regressions will be in display/preview/normalize) or `Form.tsx`. Run `bun run check:type` + `bun run check` after each fix. Commit fixes individually:

```bash
git commit -m "$(cat <<'EOF'
fix(tui): <specific bug> in <strategy module or Form>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 12: Final verification**

Run all of:
- `bun run check:type` → PASS
- `bun run check` → PASS
- `bun test` → PASS

If all pass and smoke succeeded, refactor is complete.

---

## File summary (after plan executes)

**New:**
- `src/tui/components/molecules/FormFieldText.tsx` (~70 lines)
- `src/tui/components/molecules/FormFieldSelect.tsx` (~65 lines)
- `src/tui/components/molecules/FormFieldBoolean.tsx` (~70 lines)
- `src/tui/components/molecules/FormFieldDate.tsx` (~55 lines)
- `src/tui/components/molecules/FormFieldMultiselect.tsx` (~45 lines)

**Modified:**
- `src/tui/models/index.ts` — add `editable?: boolean` to `FormFieldBase`, add `FormFieldStrategy` interface, remove `DisplayFormField`.
- `src/tui/components/organisms/Form.tsx` — full rewrite, ~180 lines (down from ~450).
- `src/tui/screens/TripSettings.tsx` — single field config migrated from `type: "display"` to `type: "text", editable: false`.

**Untouched:**
- All other 16 consumer screens.
- `src/tui/components/molecules/FormField.tsx` (separate, unrelated molecule).
- `useFormBuffer`, focus/help/layout contexts.
- `src/core/` (zero dependency on TUI).
