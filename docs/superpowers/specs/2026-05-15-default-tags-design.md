# Default tags

## Goal

Let users mark tags as "default" so new expenses are pre-tagged with those defaults when the form opens.

## Background

Today tags are plain strings:

```ts
// src/core/models/settings.ts
interface Settings {
  // ...
  tags: string[];
}
```

`Expense.tags: string[]` stores the tag names that were applied. The settings catalog is the only place a tag's metadata lives, and right now there is no metadata — just the name.

`ExpenseForm` seeds the form buffer from an existing or duplicate-source expense. For brand-new expenses, the `tags` field starts empty.

## Data model changes

A new `Tag` type:

```ts
// src/core/models/tag.ts
export interface Tag {
  value: string;
  default: boolean;
}
```

`Settings.tags` becomes `Tag[]`. `Expense.tags: string[]` is unchanged — expenses keep storing plain tag names, since the `default` flag is a property of the catalog entry, not of any applied tag.

Re-export `Tag` from `src/core/models/index.ts`.

## Migration

Existing trips have `tags: string[]` in `settings.yaml`. Normalize immediately on load.

In `src/core/services/trip/loadTrip.ts`, after parsing settings:

1. If `settings.tags` contains any string entries, map each string `s` to `{ value: s, default: false }`.
2. If any conversion happened, write `settings.yaml` back with the normalized shape via `yaml.stringify`.

Once normalized, all downstream code works with `Tag[]` only — no union types leak past the loader.

## ExpenseForm: seeding defaults

In `src/tui/screens/ExpenseForm.tsx`, the buffer-seed `useEffect` at line ~61 currently seeds `owners` and `tags` only when there's an existing or duplicate source. Add a new-expense branch:

```ts
if (!source && buffer.values["tags"] === undefined) {
  buffer.setField(
    "tags",
    trip.settings.tags.filter(t => t.default).map(t => t.value),
  );
}
```

This applies only when:
- No existing expense (not edit mode)
- No duplicate source (not duplicate mode)
- Buffer hasn't already been seeded (the user hasn't navigated away and back)

Edit and duplicate keep current behavior: tags come from the source expense.

## CRUD screens

### TagCreate (`src/tui/screens/TagCreate.tsx`)

Add a second form field `default` (inline select Yes/No, defaults to No):

```ts
const FIELDS: FormFieldConfig[] = [
  { key: "value", label: "Tag", type: "text", required: true, placeholder: "e.g. business" },
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
```

On submit, run `validateTag(value, settings.tags)` (see Validation). If errors, `throw new Error(errors[0])` — the Form organism catches and displays it inline. On success, push `{ value: trimmed, default: values.default === "true" }` into `settings.tags`.

### TagEdit (`src/tui/screens/TagEdit.tsx`)

Look up the original `Tag` by `value` from route props. Add the same `default` field, pre-filled with the current tag's `default` value as `"true"` or `"false"`. On submit, run `validateTag(newValue, settings.tags, originalValue)` and throw on errors. Otherwise replace the matching tag in `settings.tags` with the updated `{ value, default }`.

### TagList (`src/tui/screens/TagList.tsx`)

Render options as:

```ts
options={tags.map(t => ({
  label: t.default ? `${t.value} [default]` : t.value,
  value: t.value,
}))}
```

Delete handler filters by `t.value !== target.value`. Pass `value` as the route prop to edit so the edit screen can look the tag up.

### TagDelete (`src/tui/screens/TagDelete.tsx`)

Same suffix-marker treatment as TagList. Filter by `t.value !== value` on confirm.

### TagSelect (`src/tui/screens/TagSelect.tsx`)

Used inside ExpenseForm to pick tags for an expense. Render options without the marker (the picker is about selection, not catalog management):

```ts
const options = trip.settings.tags.map(t => ({ label: t.value, value: t.value }));
```

## Validation

Add `src/core/validators/tag.ts`:

```ts
export function validateTag(
  value: string,
  existing: Tag[],
  originalValue?: string,
): string[] {
  const errors: string[] = [];
  const trimmed = value.trim();
  if (!trimmed) errors.push("Tag is required");
  const collision = existing.some(
    t => t.value === trimmed && t.value !== originalValue,
  );
  if (collision) errors.push(`Tag "${trimmed}" already exists`);
  return errors;
}
```

Wire into TagCreate and TagEdit (call before `updateSettings`; if errors, throw — Form's catch displays the message). Today these screens silently skip on empty; this tightens that and adds uniqueness.

## Touched files

**New:**
- `src/core/models/tag.ts`
- `src/core/validators/tag.ts` (+ test)
- `src/core/services/trip/__tests__/loadTrip.test.ts` (if not already covering normalization, add it; otherwise extend existing)

**Updated:**
- `src/core/models/settings.ts` — `tags: Tag[]`
- `src/core/models/index.ts` — re-export `Tag`
- `src/core/services/trip/loadTrip.ts` — normalize + rewrite on first load
- `src/tui/screens/TagList.tsx`
- `src/tui/screens/TagCreate.tsx`
- `src/tui/screens/TagEdit.tsx`
- `src/tui/screens/TagDelete.tsx`
- `src/tui/screens/TagSelect.tsx`
- `src/tui/screens/ExpenseForm.tsx` — seed defaults on new

**No change required:**
- `src/core/models/expense.ts` — `tags: string[]` stays
- `src/core/services/export/exportCsv.ts` — joins `expense.tags`, still strings
- `src/tui/screens/expenseListRow.ts` — counts `expense.tags`
- `src/core/constants/defaults.ts` — `tags: []` is valid for `Tag[]`

## Tests

- `loadTrip` normalization: load a fixture with string tags, assert returned `settings.tags` is `Tag[]` with `default: false`, assert `settings.yaml` on disk is rewritten.
- `loadTrip` no-op: load a fixture already in the new shape, assert no rewrite happens.
- `validateTag`: empty, duplicate, duplicate-of-self-allowed.
- `ExpenseForm` seeding: when settings has `[{value:"work", default:true}, {value:"personal", default:false}]` and a new expense is opened, the tags buffer is seeded with `["work"]`. When opened in edit or duplicate mode, seeding follows source expense (no merge with defaults).

## Out of scope

- Migrating expense.tags (no change needed — they remain strings).
- Bulk-edit of defaults from a single screen — toggling is done per tag via Edit.
- Reordering tags or sorting defaults first in selection UIs.
