# Settings: Show Directory Name as Non-Editable Field

**Date:** 2026-05-16
**Status:** Approved
**Scope:** `src/tui/screens/TripSettings.tsx`, `src/tui/components/organisms/Form.tsx`, `src/tui/models/index.ts`

## Goal

Display the trip's directory name (the slug-based basename of `trip.dirPath`) on the trip settings page so users can see the on-disk directory used for the trip. The field is informational only — not editable.

## Motivation

Trip directory names are auto-generated from trip name + year as a slug (a-z, 0-9, hyphens only). Currently, users see the editable trip name in settings but have no visibility into the actual directory on disk. Surfacing the directory name helps users locate the trip's YAML files and understand the relationship between display name and disk slug.

## Design

### 1. New `display` field type

Add `DisplayFormField` to the `FormFieldConfig` union in `src/tui/models/index.ts`:

```ts
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

`required` from `FormFieldBase` is allowed by the type but ignored for display fields (cosmetic only).

### 2. Form component updates (`src/tui/components/organisms/Form.tsx`)

Display fields are rendered alongside other fields but are unreachable by the cursor:

- **Cursor initialization:** when the cursor would land on a display field, advance to the next editable field. The initial render starts the cursor at the first editable field (index 0 if no display fields precede it).
- **Up/down navigation:** when arrow keys would move the cursor onto a display field, skip past it to the next/previous editable field. If all fields are display, the cursor only ever sits on the submit row.
- **Enter key:** if the cursor index points to a display field (defensive case), do nothing.
- **Render:** display fields render as a single dim text line `  Label: value`. No `>` cursor indicator, no `(default)` preview branch, no edit affordance.
- **`canSubmit` / `isFilled`:** ignore display fields. They do not count as "required" gating submit, and they do not count toward `hasAnyChange`.
- **`handleSubmit`:** the result object passed to `onSubmit` omits display field keys (consumers don't need them).

### 3. TripSettings screen (`src/tui/screens/TripSettings.tsx`)

Prepend a Directory display field to the existing `fields` array:

```ts
import { basename } from "node:path";

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
    // ...existing fields unchanged
];
```

The `onSubmit` handler is unchanged — it only reads `name`, `startDate`, `endDate`, `exportPath`.

## Visual

```
  Directory: bali-trip-2026
> Name: My Bali Trip
  Start Date: 2026-05-16
  End Date: 2026-05-20
  Export Path: ./out
────────────────────
  [s] Submit
```

## Testing

The `Form` organism has no existing unit tests in the repository. To stay consistent with the codebase convention, no tests are added for the new field type. Manual verification:

1. Open a trip → Settings. Confirm Directory row appears at the top, dim.
2. Press `↑/↓` repeatedly. Cursor cycles through editable fields and submit; never lands on Directory.
3. Press `Enter` on each editable field — edits work as before.
4. Submit the form — values persist; no `dirName` key written to settings.

## Non-Goals

- Renaming the directory on disk via the settings page (out of scope).
- Showing the full absolute `dirPath` (basename only — cleaner and matches what the user types in trip selection).
- Generalizing display fields for use outside `Form` (only this screen uses it today).
