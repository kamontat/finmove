# Select Fields as Sub-Pages

## Problem

`Form` currently renders `select` fields with one of two inline UIs based
on option count:

- ≤ 3 options → `InlineSelect` (radio-style row)
- > 3 options → `DropdownSelect` (inline dropdown overlay)

The dropdown overlay collides visually with the form layout when option
lists grow, and the two-way split duplicates UI logic. Recent multi-value
fields already use a dedicated sub-page pattern (`MultiSelectList` +
`OwnerSelect` / `TagSelect` / `TripCreateCountryList`); single-select
should follow the same pattern for consistency.

## Decisions

### D1 — All `select` fields open as sub-pages

Drop the option-count threshold. Every `select` field navigates to a
dedicated sub-page on Enter. AccountType (Credit/Debit, 2 options) opens
a sub-page just like Account (potentially many options). One UI pattern
for all selects, one keystroke pattern for users to learn.

### D2 — `SelectFormField` gains a required `onEdit`

Mirror `MultiSelectFormField`. The host wires `onEdit` to a `goTo(...)`
for the relevant sub-page route. `Form` calls `field.onEdit()` when the
user presses Enter on a select row; no inline editor opens.

### D3 — Per-domain sub-page screens (not generic)

One screen per domain (`AccountSelect`, `CategorySelect`,
`CurrencySelect`, `AccountTypeSelect`), reading options from the
appropriate source (`trip.accounts`, `trip.settings.categories`,
trip currencies, hardcoded). Mirrors the multiselect pattern; avoids
serializing option lists through route props.

### D4 — `SingleSelectList` organism

New organism parallel to `MultiSelectList`. Single-select keymap (no
space-toggle), cursor pre-positioned on the current value, Enter
confirms and emits the chosen value, Esc cancels.

### D5 — Delete `InlineSelect` and `DropdownSelect` atoms

Both atoms become dead code once Form stops rendering them. Remove
them from the codebase.

## Architecture

### File layout

```
DELETE:
- src/tui/components/atoms/InlineSelect.tsx
- src/tui/components/atoms/DropdownSelect.tsx

CREATE:
- src/tui/components/organisms/SingleSelectList.tsx
- src/tui/screens/AccountSelect.tsx
- src/tui/screens/CategorySelect.tsx
- src/tui/screens/CurrencySelect.tsx
- src/tui/screens/AccountTypeSelect.tsx

MODIFY:
- src/tui/components/organisms/Form.tsx     (drop inline select rendering;
                                              call field.onEdit on Enter)
- src/tui/models/index.ts                   (SelectFormField += onEdit;
                                              5 new RouteParams entries)
- src/tui/router.ts                         (5 new route registrations)
- src/tui/screens/ExpenseForm.tsx           (account/category/currency get onEdit)
- src/tui/screens/AccountCreate.tsx         (type field gets onEdit)
- src/tui/screens/AccountEdit.tsx           (type field gets onEdit;
                                              seed buffer with current type)
```

### `SingleSelectList` organism

```ts
interface SingleSelectListProps {
  options: SelectOption[];
  initialValue: string | undefined;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}
```

Internal state: `cursor: number`. Initialized to the index of
`initialValue` if found, else 0.

Keys handled via `useInput`:
- `↑` — `cursor = (cursor > 0 ? cursor - 1 : options.length - 1)` (wrap)
- `↓` — `cursor = (cursor < options.length - 1 ? cursor + 1 : 0)` (wrap)
- `Enter` — `onConfirm(options[cursor].value)`
- `Esc` — `onCancel()`

Rendering: one `<Text>` per option. The cursor row is `inverse` and
prefixed with `> `; non-cursor rows are prefixed with `  ` (two
spaces). Empty options array renders dim text "No options available."

### `Form` organism changes

Drop the entire inline-select block. The `select` branch in the edit
row is removed. The cursor-Enter dispatcher in `useInput` adds a select
case parallel to multiselect:

```ts
} else if (key.return) {
  if (cursor === fields.length) {
    handleSubmit();
  } else {
    const field = fields[cursor];
    if (!field) return;
    if (field.type === "multiselect" || field.type === "select") {
      field.onEdit();
    } else {
      enterEdit();
    }
  }
}
```

The `<InlineSelect>` and `<DropdownSelect>` JSX branches are removed
from the editing-row block. The `INLINE_SELECT_THRESHOLD` constant goes
away. The `select` display row continues to look up the matching option
label as today.

### `SelectFormField` change

```ts
export type SelectFormField = FormFieldBase & {
  type: "select";
  options: SelectOption[];
  defaultValue?: string;
  onEdit: () => void;            // NEW
};
```

Required, not optional. Every existing `select` field gets `onEdit`
wired in the same commit.

### Sub-page screens

All four follow this skeleton (`AccountSelect` shown):

```tsx
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

`HINTS` is `[↑↓ Navigate, Enter Confirm, q/esc Cancel]`.

`CategorySelect` differs only in the options source
(`trip.settings.categories.map(c => ({ label: c, value: c }))`) and
title suffix.

`CurrencySelect` options:
`["THB", ...Object.keys(trip.settings.currencies)].map(c => ({ label: c, value: c }))`.

`AccountTypeSelect` is registered against two routes; uses the
array-form `useRouteProps` introduced for `OwnerSelect`:

```tsx
const props = useRouteProps([
  "/trips/accounts/new/type",
  "/trips/accounts/edit/type",
] as const);
const formId = props.formId;
const fieldKey = props.fieldKey;
```

Options hardcoded:
```ts
const options = [
  { label: "Credit", value: "Credit" },
  { label: "Debit", value: "Debit" },
];
```

### Routes

5 new `RouteParams` entries:

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

`router.ts` registers each, all with `defaultFocus: "main"`. Title is
`"Select <Domain>"` (Account, Category, Currency, Type).

### Host wiring

**`ExpenseForm.tsx`** — three `select` fields each get `onEdit`:

```ts
{
  key: "account",
  label: "Account",
  type: "select",
  required: true,
  options: trip.accounts.map(...),
  onEdit: () => goTo("/trips/expenses/form/account", {
    props: { tripDirPath, formId, fieldKey: "account" },
  }),
  ...(existingExpense ? { defaultValue: existingExpense.accountId } : {}),
},
// same shape for category and currency
```

The existing `defaultValue` and `options` properties stay (Form uses
`options` to display the selected option's label). The `onEdit` adds
the navigation behavior.

**`AccountCreate.tsx`** — `type` field gains:
```ts
onEdit: () => goTo("/trips/accounts/new/type", {
  props: { tripDirPath, formId: FORM_ID, fieldKey: "type" },
}),
```

**`AccountEdit.tsx`** — `type` field gains:
```ts
onEdit: () => goTo("/trips/accounts/edit/type", {
  props: { tripDirPath, accountId, formId, fieldKey: "type" },
}),
```

Plus a seeding effect (mirroring the `owners` seeding):
```ts
useEffect(() => {
  if (account && buffer.values["type"] === undefined) {
    buffer.setField("type", account.type);
  }
}, [account, buffer]);
```

This ensures `AccountTypeSelect` opens with the cursor on the existing
type when entering AccountEdit's sub-page for the first time.

## Data flow

### Picking an account in ExpenseForm

```
User on ExpenseForm, cursor on Account row
Presses Enter
  → field.onEdit() runs
  → goTo("/trips/expenses/form/account", { props: {...} })
ExpenseForm unmounts; AccountSelect mounts
  → reads buffer.values["account"] → e.g., "alice-visa" (or undefined)
  → renders SingleSelectList with cursor on that account
User cursors to "bob-mastercard", Enter
  → onConfirm("bob-mastercard")
  → buffer.setField("account", "bob-mastercard")
  → goBack()
ExpenseForm remounts
  → Form merges buffer values: values["account"] = "bob-mastercard"
  → display row shows the matching option label
User submits
  → handleSubmit reads getString(values, "account") = "bob-mastercard"
  → addExpense / updateExpense persists with the new account id
```

### Cancelling without changes

```
User opens AccountSelect, sees initial cursor on current account
Presses Esc
  → onCancel() → goBack()
ExpenseForm remounts; buffer unchanged
  → values["account"] still the prior value
```

## Testing

### New tests

None at the unit level. Pure UI/state composition with no isolated logic
worth pinning.

### Existing tests

All 140 tests must continue to pass. None of the changed surfaces touch
core business logic.

### Manual verification

1. Open ExpenseForm (new), cursor to Account → Enter. Sub-page opens
   with no initial cursor (no value yet). Pick one, confirm. Form
   shows the picked account.
2. Cursor to Category → Enter. Sub-page opens. Cancel via Esc. Form
   unchanged.
3. Cursor to Currency → Enter. Sub-page opens with cursor on "THB"
   (default). Pick another, confirm. Form shows new currency.
4. Edit an existing expense. Sub-pages open with cursor on the
   expense's existing values for account/category/currency.
5. Open AccountCreate, cursor to Account Type → Enter. Sub-page shows
   Credit/Debit, cursor on Credit (default). Pick Debit, confirm.
6. Edit an existing account. Cursor to Account Type → Enter. Sub-page
   opens with cursor on the account's current type.
7. Verify InlineSelect and DropdownSelect files no longer exist:
   `ls src/tui/components/atoms/{InlineSelect,DropdownSelect}.tsx`
   should report neither.

## Out of scope

- Generic options-via-route-props pattern. Per-domain screens stay.
- Search/filter on long option lists. If account count grows beyond
  ~20, consider a future enhancement (typed prefix filter on the
  sub-page).
- Multi-route hosting that requires two different RouteParams shapes
  beyond what `useRouteProps`'s array form already supports.

## Risks

- **Type-cascade across hosts.** Adding required `onEdit` to
  `SelectFormField` is a breaking change. Every `select` field config
  in the codebase (5 instances across 3 hosts) must add `onEdit` in
  the same commit batch as the model change, or the type checker
  fails. Mitigated by bundling the model change with the host wirings
  in adjacent commits, finishing with `bun run check:type` green at
  HEAD before splitting tasks.

- **`AccountEdit` seeding effect**. If the user has already seeded
  `type` once, the effect's `=== undefined` guard prevents reseeding
  on remount. Same pattern as `owners` seeding, already verified
  there.
