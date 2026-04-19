# Form Component Design Spec

## Overview

Replace multi-step sequential input flows with a single Form component that shows all fields at once. The user navigates fields in view mode and presses Enter to edit individual fields. This applies to 5 input flows: ExpenseForm, Create Trip, Duplicate Trip, Add Owner, Add Account. Additionally, remove the confirm prompt on owner removal (immediate delete).

## Form Component

### Location

`src/tui/components/organisms/Form.tsx`

### Field Types

```ts
type FormFieldBase = {
  key: string;
  label: string;
  required?: boolean;
};

type TextFormField = FormFieldBase & {
  type: "text";
  defaultValue?: string;
  placeholder?: string;
};

type SelectFormField = FormFieldBase & {
  type: "select";
  options: SelectOption[];
  defaultValue?: string;
};

type DateFormField = FormFieldBase & {
  type: "date";
  defaultValue?: string;
};

type FormField = TextFormField | SelectFormField | DateFormField;
```

### Form Props

```ts
interface FormProps {
  fields: FormField[];
  onSubmit: (values: Record<string, string>) => void;
  submitLabel?: string;   // default: "Save"
  submitKey?: string;     // shortcut key in view mode, default: "s"
}
```

The `fields` array can change dynamically between renders (e.g., to hide/show the exchangeRate field based on current currency value). The Form component handles fields appearing/disappearing gracefully — cursor position clamped to valid range, removed field values dropped from internal state.

### Visual Layout

All fields rendered vertically. Each field is one line (except dropdown select in edit mode).

```
Label: value                    ← completed field (dimmed)
Label:              (default)   ← empty with placeholder (placeholder dimmed)
Label:                          ← empty, no placeholder
> Label:                        ← cursor row (highlighted/inverse)

[s] Save                        ← submit row at bottom
```

- Completed fields: `Label: value` — label and value dimmed
- Empty with placeholder: `Label:` followed by `(placeholder)` dimmed
- Empty no placeholder: `Label:` dimmed
- Cursor row: highlighted (e.g., inverse text or `>` prefix)
- Submit row: `[submitKey] submitLabel` — navigable as the last item in the cursor list. Only activatable when all required fields have values.

### Interaction: View Mode

The form is in view mode by default. Focus zone is `"main"` — global shortcuts work.

| Key | Action |
|---|---|
| `[up]` | Move cursor up |
| `[down]` | Move cursor down |
| `[enter]` | Edit selected field (or submit if on submit row) |
| `[s]` (or submitKey) | Submit form (if all required fields filled) |
| `[q]` | Go back (global handler) |
| `[esc]` | Exit program (global handler) |

Cursor wraps: down from submit row goes to first field, up from first field goes to submit row.

### Interaction: Edit Mode

When Enter is pressed on a field, the form enters edit mode. Calls `useFocus().setFocus("input")` to disable global shortcuts.

| Key | Action |
|---|---|
| `[enter]` | Confirm value, return to view mode on same field |
| `[esc]` | Discard changes, return to view mode (keeps previous value) |

On confirm or cancel, calls `useFocus().setFocus("main")` to restore view mode.

### Edit Mode by Field Type

**Text field:**
Inline text input replaces the value area on the cursor row. Uses the existing `TextInput` atom. Enter confirms, Esc discards.

**Date field:**
Date picker replaces the value area. Uses the existing `DateInput` atom. Enter confirms, Esc discards.

**Select field (≤3 options) — inline cycling:**
Value area shows `< current option >` with left/right arrows to cycle. Enter confirms, Esc discards. Renders on the same line as the label.

**Select field (>3 options) — dropdown:**
A vertical list of options appears below the field row, pushing subsequent fields down. Up/down to navigate, Enter confirms, Esc discards. Uses a pattern similar to `VerticalSelect` but scoped to the edit area.

### Submit Behavior

Submit is available via:
1. Navigate cursor to the submit row and press Enter
2. Press the shortcut key (default `[s]`) from view mode

Both only work when all required fields have non-empty values. When requirements are not met, the submit row shows dimmed and the shortcut key is ignored.

On submit, the component calls `onSubmit` with a `Record<string, string>` mapping each field's `key` to its current value. Fields left empty (with placeholders) submit the placeholder value.

### Internal State

- `values: Record<string, string>` — current value per field key
- `cursor: number` — index into fields array + 1 (for submit row)
- `editing: boolean` — whether a field is in edit mode
- `editDraft: string` — draft value while editing (discarded on Esc)

When `fields` array changes (e.g., exchangeRate removed), the form:
- Removes values for keys no longer in the fields array
- Clamps cursor to valid range

## Screen Integration

### ExpenseForm

Fields (dynamic based on currency):
- `account` — select, required. Options from `trip.accounts`.
- `date` — date, required. Placeholder: today's date.
- `payee` — text, required.
- `category` — select, required. Options from `trip.settings.categories`.
- `amount` — text, required.
- `currency` — select, required. Options: THB + trip currency keys. Placeholder: "THB".
- `exchangeRate` — text, not required. Only included when currency !== "THB". Placeholder: trip-level rate if available.
- `owners` — text, not required. Placeholder: all owner IDs comma-separated.
- `description` — text, not required.
- `tags` — text, not required.

When editing an existing expense: all fields pre-filled as actual values (not placeholders).

On submit: construct Expense object, call addExpense or updateExpense, reloadTrip, goBack.

### TripList — Create Trip

Fields:
- `name` — text, required.
- `startDate` — date, required. Placeholder: today.
- `endDate` — date, required. Placeholder: startDate + 1 day (dynamic — updates when startDate changes).

On submit: createTrip with default settings, goTo "/trips/menu".

### TripList — Duplicate Trip

Fields:
- `newName` — text, required.

Context: the source trip name should be visible (in the title or as a label above the form).

On submit: duplicateTrip, refresh trip list, return to list mode.

### OwnerList — Add Owner

Fields:
- `id` — text, required. Placeholder: "e.g. alice".
- `name` — text, required. Placeholder: "e.g. Alice".

On submit: addOwner, reloadTrip, return to list mode with focus on menu.

### AccountList — Add Account

Fields:
- `id` — text, required. Placeholder: "e.g. alice-credit".
- `name` — text, required. Placeholder: "e.g. Alice's Visa".
- `type` — select, required. 2 options: Credit, Debit. (≤3 so inline cycling)
- `owners` — text, required. Placeholder: "e.g. alice,bob".

On submit: addAccount, reloadTrip, return to list mode with focus on menu.

### OwnerList — Remove Owner

Remove the `ConfirmPrompt` flow. When the remove menu action fires, immediately call `removeOwner` and `reloadTrip`. No mode change, no confirm prompt.

## Shared Types

Add `FormField` type variants to `src/tui/models/index.ts` if used across multiple files. If only the Form component uses them, keep them inline.

## Component Dependencies

The Form organism uses:
- `TextInput` atom — for text field editing
- `DateInput` atom — for date field editing
- `useFocus()` — to toggle between main and input focus zones
- `SelectOption` from models — for select field options

The Form does NOT use `useLayout()` or `useNavigation()` — it's a pure UI component. Screens handle the context integration.
