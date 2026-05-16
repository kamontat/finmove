# Form.tsx Strategy Refactor — Design

**Date:** 2026-05-16
**Status:** Approved — ready for implementation plan
**Type:** Internal refactor (no behavior change)

## Problem

`src/tui/components/organisms/Form.tsx` is ~450 lines and mixes too many concerns:

- Local + buffered value state, cursor state, edit state, error state
- `canSubmit` derivation
- Submit normalization
- Keyboard handling (`useInput`)
- Per-field row rendering (label + display + preview)
- Per-field-type editor rendering
- Cursor-skip logic for non-focusable rows

Each field type (`text`, `select`, `boolean`, `date`, `multiselect`) requires branches in **six** different places:

1. `isFilled`
2. `canSubmit` (the "has any user value" check)
3. `handleSubmit` (normalization)
4. Row display-value computation
5. Row preview computation
6. Editor JSX block

On top of that, the `display` field type (added recently for read-only rows like the trip directory on `TripSettings`) adds **nine more** branches of `field.type === "display"` for cursor-skip, initial-values, isFilled, canSubmit, handleSubmit, isStop, Enter handler, and row rendering. The display field is fundamentally "a non-editable row" — a property that any field type could have — so it does not deserve its own type-tag branching everywhere.

Adding or modifying a field type forces edits scattered across the file. The if/else density obscures the actual orchestration (cursor, focus, submit).

## Goals

- Eliminate field-type discrimination outside a single registry lookup.
- Co-locate everything a field type needs to know (display, editor, validation, submit normalization) in one module.
- Replace `DisplayFormField` with a uniform `editable?: boolean` property on `FormFieldBase` — any field type can be marked read-only.
- Keep Form's public API (`FormProps`) unchanged — all editable-only consumer screens compile without edits. Only `TripSettings` (the sole `DisplayFormField` consumer) needs migration.
- Preserve exact runtime behavior — no user-visible change.

## Non-Goals

- Adding tests for Form (no existing tests; not introducing an Ink test harness here).
- Adding new field types.
- Touching consumer screens beyond the one `type: "display"` migration in `TripSettings`.
- Touching `useFormBuffer` or the focus/help/layout contexts.

## Architecture

### File layout

```
src/tui/components/molecules/
  FormFieldText.tsx           # strategy for text fields
  FormFieldSelect.tsx         # strategy for select fields
  FormFieldBoolean.tsx        # strategy for boolean fields
  FormFieldDate.tsx           # strategy for date fields
  FormFieldMultiselect.tsx    # strategy for multiselect fields

src/tui/components/organisms/
  Form.tsx                    # orchestrator + strategy registry (smaller, focused)

src/tui/models/index.ts
  - DisplayFormField type (removed)
  + editable?: boolean on FormFieldBase
  + FormFieldStrategy<F>
  + FormFieldStrategyEditorProps<F>
```

All five strategy modules live in `molecules/` (one consistent location, matching the existing `FormField.tsx` molecule). Each composes existing atoms (`TextInput`, `SelectInput`, `CheckboxInput`, `DateInput`) inside its `Editor`. Flat layout — matches existing molecules convention. No `index.ts` barrel exports.

**No `FormFieldDisplay` strategy.** Read-only rows are expressed as any existing field type with `editable: false`, not as a separate type. The strategy interface stays focused on input mechanics; non-editability is handled by Form.tsx checking `field.editable !== false` directly.

### Model changes

```ts
// FormFieldBase gains `editable?: boolean` (default true)
interface FormFieldBase {
  key: string;
  label: string;
  required?: boolean;
  editable?: boolean;     // ← new; when false, row is read-only, cursor skips it
}

// DisplayFormField is removed from FormFieldConfig union.
// TextFormField, SelectFormField, BooleanFormField, DateFormField,
// MultiSelectFormField inherit `editable` via FormFieldBase. All field types
// can be marked editable: false.
```

For non-editable fields, `defaultValue` serves as the displayed value. (The existing `DisplayFormField.value` semantic is migrated to `defaultValue` for consistency — every variant already has `defaultValue?: ...` of the right shape.)

### Strategy interface (in `src/tui/models/index.ts`)

```ts
export interface FormFieldStrategyEditorProps<F extends FormFieldConfig> {
  field: F;
  value: FieldValue;
  allValues: Record<string, FieldValue>;
  onSubmit: (value: FieldValue) => void;
  onCancel: () => void;
}

export interface FormFieldStrategy<F extends FormFieldConfig = FormFieldConfig> {
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
  // (used by select with onEdit, and multiselect). This eliminates the need for
  // any field.type branching in Form.tsx.
  onEnterPress(field: F): "edit" | (() => void);
  Editor: (props: FormFieldStrategyEditorProps<F>) => JSX.Element;
}
```

Each strategy module exports a constant typed as `FormFieldStrategy<SpecificFieldType>` (e.g. `FormFieldText: FormFieldStrategy<TextFormField>`).

### Registry (in `Form.tsx`)

```ts
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
```

This is the only place that maps field type → strategy. Cast is needed because each strategy is typed for its specific field subtype; the registry exposes them through the union.

## Form.tsx Responsibilities (Post-Refactor)

Form.tsx treats the `editable` flag uniformly. Wherever the current code branches on `field.type === "display"` (nine places), the new code checks `field.editable !== false` — exactly one property check, same form regardless of field type. There is no `field.type` switching anywhere outside the strategy registry lookup.

1. **State management** — `localValues` initialized using `strategy.emptyValue` per editable field (non-editable fields are skipped). Optional `useFormBuffer` integration, `cursor`, `editing`, `error`. Otherwise unchanged.
2. **Strategy lookup** — `getStrategy(field)` only. No `field.type` switches anywhere else.
3. **Cursor** — initial cursor lands on the first editable field. `moveCursor`/`isStop` skips non-editable rows. Cursor never stops on `field.editable === false`.
4. **Derive `canSubmit`** — among editable fields only: all required have `strategy.isFilled` AND at least one has `strategy.hasUserValue`. Non-editable fields ignored.
5. **Submit** — iterates editable fields only, calls `strategy.normalizeForSubmit(field, value)`, builds result. Non-editable fields excluded from result. `try/catch` around `onSubmit`.
6. **Keyboard** — `useInput` for `↑↓`, `Enter`, `submitKey`. Enter on a field row dispatches via `strategy.onEnterPress(field)`:
   - returns `"edit"` → enters edit mode, focus = `"input"`
   - returns a function → invokes it (select with `onEdit`, multiselect)
   The Enter path is unreachable for non-editable rows because the cursor never lands on them.
7. **Row rendering** — maps fields:
   - **Non-editable row** (`field.editable === false`): renders `<Text dimColor>  {label}: {strategy.getDisplay(field, field.defaultValue ?? strategy.emptyValue, values)}</Text>`. No cursor caret, no editor, no preview brackets, no `(optional)` suffix.
   - **Editable row**: as before — cursor caret when focused, label + display-or-`(preview)` tail, `<strategy.Editor />` when actively editing.

Expected size: ~150-180 lines (down from ~450). The non-editable handling adds a single early-return branch in render and ~5 `field.editable !== false` guards in state/cursor/submit logic, but all share the same property check rather than branching on type tags.

## Per-Strategy Behavior

All strategies define `emptyValue` — used by Form for `useState` initialization. Text/select/boolean/date use `""`; multiselect uses `[]`.

### `FormFieldText` (`molecules/FormFieldText.tsx`)

- `emptyValue` — `""`
- `hasUserValue(v)` — `typeof v === "string" && v !== ""`
- `isFilled(field, v)` — user value OR `field.defaultValue !== undefined`
- `normalizeForSubmit(field, v)` — user value, else default, else `""`
- `getDisplay(field, v)` — the string value if set
- `getPreview(field, allValues)` — `defaultValue` if set, else `field.placeholder` (resolving function form with string-only values via local helper)
- `onEnterPress()` — always returns `"edit"`
- `Editor` — wraps `TextInput` with conditional `placeholder` / `defaultValue` spread for `exactOptionalPropertyTypes`
- Owns `stringValuesOnly` helper (moved out of Form.tsx)

### `FormFieldSelect` (`molecules/FormFieldSelect.tsx`)

- `emptyValue` — `""`
- `hasUserValue(v)` — `typeof v === "string" && v !== ""`
- `isFilled` / `normalizeForSubmit` — same shape as text
- `getDisplay(field, v)` — resolves `v` → option label via `field.options.find`
- `getPreview(field)` — if `defaultValue` set, resolves to option label; falls back to raw value string
- `onEnterPress(field)` — `field.onEdit` if set, else `"edit"`
- `Editor` — wraps `SelectInput` with `initialIndex` computed from current value or default

### `FormFieldBoolean` (`molecules/FormFieldBoolean.tsx`)

- `emptyValue` — `""` (stays empty string until user toggles, matching current Form initialization)
- `hasUserValue(v)` — `typeof v === "boolean"`
- `isFilled(field, v)` — `typeof v === "boolean"` OR `field.defaultValue !== undefined` (preserves current behavior)
- `normalizeForSubmit(field, v)` — boolean if set, else `defaultValue ?? false`
- `getDisplay(field, v)` — if boolean, returns `trueLabel ?? "Yes"` or `falseLabel ?? "No"`
- `getPreview(field)` — if `defaultValue` set, returns matching label
- `onEnterPress()` — always returns `"edit"`
- `Editor` — wraps `CheckboxInput`, conditionally spreads `trueLabel` / `falseLabel`

### `FormFieldDate` (`molecules/FormFieldDate.tsx`)

- `emptyValue` — `""`
- `hasUserValue` / `isFilled` / `normalizeForSubmit` — same shape as text
- `getDisplay(field, v)` — string value
- `getPreview(field)` — `defaultValue` if set
- `onEnterPress()` — always returns `"edit"`
- `Editor` — wraps `DateInput` with `"2026-01-01"` fallback (preserves current behavior)

### `FormFieldMultiselect` (`molecules/FormFieldMultiselect.tsx`)

- `emptyValue` — `[]`
- `hasUserValue(v)` — `Array.isArray(v) && v.length > 0`
- `isFilled(field, v)` — `Array.isArray(v) && v.length > 0`
- `normalizeForSubmit(_, v)` — `Array.isArray(v) ? v : []`
- `getDisplay(field, v)` — uses `field.display(arr)` if provided, else joins with `", "`, else `"(none)"`
- `getPreview` — always `undefined`
- `onEnterPress(field)` — always returns `field.onEdit`
- `Editor` — placeholder/unused; Form skips editor render block when `onEnterPress` returns a function

## Data Flow

### Enter pressed in view mode

```
useInput catches Enter
  → cursor === fields.length? → handleSubmit()
  → cursor is field row → strategy = getStrategy(field)
     → action = strategy.onEnterPress(field)
        → action is a function → action() (no edit-mode transition)
        → action === "edit"    → enterEdit() → focus = "input", editing = true
                                → row renders strategy.Editor
                                → user confirms → onSubmit(newValue) → setValue + exitEdit
                                → user cancels  → onCancel() → exitEdit
```

### Submit

```
handleSubmit
  → canSubmit? (all required have isFilled && at least one hasUserValue)
  → for each field: result[key] = strategy.normalizeForSubmit(field, value)
  → try { onSubmit(result); setError(null) }
  → catch { setError(err.message) }
```

## Migration & Verification

### Implementation order

Each step is independently committable; the codebase compiles after every step.

1. **Models (additive)**: in `src/tui/models/index.ts`, add `editable?: boolean` to `FormFieldBase` and add `FormFieldStrategy` + `FormFieldStrategyEditorProps`. **Do not** remove `DisplayFormField` yet — old `Form.tsx` still references it. (Compiles ✓; no behavior change.)
2. Create `molecules/FormFieldText.tsx`. (Compiles ✓; unused.)
3. Create `molecules/FormFieldSelect.tsx`.
4. Create `molecules/FormFieldBoolean.tsx`.
5. Create `molecules/FormFieldDate.tsx`.
6. Create `molecules/FormFieldMultiselect.tsx`.
7. **Atomic cutover**: in one commit:
   - Migrate `TripSettings.tsx`: `{ type: "display", value: basename(...) }` → `{ type: "text", editable: false, defaultValue: basename(...) }`.
   - Rewrite `Form.tsx` to use the strategy registry and treat `field.editable === false` as non-editable.
   - Remove `DisplayFormField` from the `FormFieldConfig` union in `src/tui/models/index.ts`.
   - Form.tsx no longer references `DisplayFormField`. The build must pass at this commit.
8. Run `bun run check:type` and `bun run check` after each step.

### Verification

No tests exist for `Form.tsx`. Verification will be:

- `bun run check:type`
- `bun run check`
- Manual smoke per type:
  - **Text** — `OwnerCreate`, `OwnerEdit`, `CategoryCreate`/`Edit`, `TagCreate`/`Edit`, `CountryCreate`/`Edit`, `CurrencyCreate`/`Edit`
  - **Select with `onEdit`** — `ExpenseForm` (currency, account, category), `AccountCreate`/`Edit` (type)
  - **Multiselect** — `AccountCreate`/`Edit` (owners), `ExpenseForm` (tags, owners)
  - **Boolean** — `TagCreate`, `TagEdit`
  - **Date** — `ExpenseForm` (date)
  - **Non-editable text (`editable: false`)** — `TripSettings` directory row. Confirm: row renders dim with directory name visible, cursor cannot land on it (`↑↓` skips it), it does not appear in submit result, `[s]` still submits the rest of the form.
  - **Keyboard** — `[s]` submit shortcut, `[Enter]` in view mode, `[Enter]` / `[Esc]` in edit mode, `[Tab]` to menu
  - **`formId` buffer** — navigate from `ExpenseForm` into currency/account/category sub-screens, return, confirm value is populated

### Behavior invariants to verify

- `isFilled` for boolean fields returns `true` when `defaultValue !== undefined`, even with no user input.
- `canSubmit` requires at least one user-touched field (not just defaults). Non-editable fields don't count.
- Select with `onEdit` does not enter inline edit mode on Enter.
- Multiselect always defers to `field.onEdit()`.
- Text placeholder function receives only string values from `values`.
- Date editor defaults to `"2026-01-01"` when no value/default.
- Submit `try/catch` surfaces errors via `setError`.
- `exactOptionalPropertyTypes` — conditional prop spreading preserved in each `Editor`.
- Non-editable rows: dim, no cursor, no editor, no `(optional)` suffix, excluded from submit, cursor skips them on `↑↓`.

## Risk

Medium. Six places of field-type discrimination plus nine places of `display`-type branching collapse into one registry plus per-type modules plus a uniform `editable` property. A regression in any strategy module breaks one or more consumer screens.

Mitigation: implement strategies one type at a time; after each, run type-check + a manual smoke of one consumer screen for that type before moving on. The `TripSettings` migration to `editable: false` happens in its own commit before the Form.tsx rewrite, so a regression there is bisectable.
