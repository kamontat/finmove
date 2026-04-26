# Multi-Select Sub-Pages and Default-Tag Revert

## Problem

Two related shifts in form UX:

1. **The auto-default-tag and auto-Zvent features overshot.** Tags listed
   in `settings.tags` should be a *vocabulary* that the user picks from
   when filing an expense — not values automatically merged into every
   new expense. The Zvent auto-tag feature is removed entirely.
2. **Comma-separated text input is wrong for multi-value fields.** The
   four spots that ask the user to type comma-separated lists
   (Countries on TripCreate, Owners on Account Create/Edit, Owners and
   Tags on ExpenseForm) should instead open a dedicated sub-page with
   space-toggle multi-select.

## Decisions

### D1 — Revert default-tag merge in `addExpense`

`addExpense` no longer reads `trip.settings.tags`. It writes the
incoming `expense.tags` verbatim. Editing semantics are unchanged.

### D2 — Delete Zvent feature entirely

The Zvent helpers (`buildZventTag`, `nextZventId`, `parseZventId`),
constants (`ZVENT_*`), tests (`zventService.test.ts`), and all
TripCreate / TripDuplicate code that produced or stripped Zvent tags
are deleted. `settings.tags` for new trips initializes to `[]`. Trips
created during the Zvent feature window keep whatever `Zvent: …`
strings they have in `settings.tags`; those become ordinary tags
(pickable in the new TagSelect sub-page).

### D3 — `settings.tags` is a vocabulary list

`settings.tags` defines what tags can be applied to expenses in a
trip. The Settings > Tags screens (already CRUD pages) remain the
single editor. The Tags sub-page on ExpenseForm is **pick-only**: to
introduce a new tag, the user goes to Settings > Tags first.

### D4 — Owners sub-pages are pick-only

Same as D3 for owners. To add a brand-new owner, the user goes to
Trip > Owners. The OwnerSelect sub-page never adds to `trip.owners`.

### D5 — Countries on TripCreate uses a draft-mode CRUD list

There is no canonical country list in the codebase, so Countries
remains a per-trip user-managed list. During TripCreate, the trip
doesn't exist yet, so the CRUD operates on a form-buffer entry
instead of `trip.settings.countries`. The UX mirrors the existing
Settings > Countries pattern (list + `[a]` Add + `[d]` Delete).

### D6 — Form buffer survives sub-page navigation

A new `<FormBufferProvider>` context holds in-progress form values
keyed by a stable `formId`. The host screen reads/writes through the
buffer; sub-pages read/write the same buffer. Buffers are cleared
when the user returns to the list screen above the form (never on
sub-page navigation).

## Architecture

### File layout

```
DELETE:
- src/core/services/trip/buildZventTag.ts
- src/core/services/trip/nextZventId.ts
- src/core/services/trip/parseZventId.ts
- src/core/services/trip/__tests__/zventService.test.ts
- src/core/constants/zvent.ts

MODIFY:
- src/core/services/trip/index.ts          (drop 3 Zvent exports)
- src/core/constants/index.ts              (drop 5 Zvent constant exports)
- src/core/services/expense/addExpense.ts  (revert merge block)
- src/core/services/expense/__tests__/expenseService.test.ts
                                           (delete the 4 default-tag tests)
- src/tui/screens/TripCreate.tsx           (drop Zvent; countries -> multiselect)
- src/tui/screens/TripDuplicate.tsx        (drop Zvent block entirely)
- src/tui/screens/ExpenseForm.tsx          (restore Tags label; owners + tags -> multiselect)
- src/tui/screens/AccountCreate.tsx        (owners -> multiselect)
- src/tui/screens/AccountEdit.tsx          (owners -> multiselect)
- src/tui/screens/TripList.tsx             (clear trip- buffers on mount)
- src/tui/screens/AccountList.tsx          (clear account- buffers on mount)
- src/tui/screens/ExpenseList.tsx          (clear expense- buffers on mount)
- src/tui/components/organisms/Form.tsx    (multiselect field type, optional formId)
- src/tui/models/index.ts                  (RouteParams additions; MultiSelectFormField; getString/getStringArray helpers)
- src/tui/router.ts                        (register 6 new routes)
- src/tui/App.tsx                          (wrap in FormBufferProvider)

CREATE:
- src/tui/states/formBufferStore.ts        (pure module; testable in isolation)
- src/tui/states/formBuffer.tsx            (React context wrapping the store)
- src/tui/components/organisms/MultiSelectList.tsx
- src/tui/screens/OwnerSelect.tsx          (3 routes consume this one screen)
- src/tui/screens/TagSelect.tsx
- src/tui/screens/TripCreateCountryList.tsx
- src/tui/screens/TripCreateCountryAdd.tsx
- src/tui/states/__tests__/formBufferStore.test.ts
```

### `formBufferStore.ts` (pure, testable)

```ts
export type FieldValue = string | string[];
export type FormValues = Record<string, FieldValue>;

export class FormBufferStore {
  private buffers = new Map<string, FormValues>();
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void { ... }
  get(formId: string): FormValues | undefined { ... }
  setField(formId: string, key: string, value: FieldValue): void { ... }
  setValues(formId: string, values: FormValues): void { ... }
  clear(formId: string): void { ... }
  clearByPrefix(prefix: string): void { ... }
}
```

The store is mutable + observable via subscribe so the React layer
can re-render reactively (`useSyncExternalStore`). Keeping this in a
pure module makes it directly testable without React.

### `formBuffer.tsx` (React adapter)

```ts
const FormBufferContext = createContext<FormBufferStore | null>(null);

export function FormBufferProvider({ children }) {
  const [store] = useState(() => new FormBufferStore());
  return <FormBufferContext.Provider value={store}>{children}</FormBufferContext.Provider>;
}

export function useFormBuffer(formId: string) {
  const store = useContext(FormBufferContext);
  if (!store) throw new Error("FormBufferProvider missing");
  const values = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.get(formId) ?? EMPTY,
  );
  return {
    values,
    setField: (key: string, value: FieldValue) => store.setField(formId, key, value),
    setValues: (v: FormValues) => store.setValues(formId, v),
    clear: () => store.clear(formId),
  };
}

export function useFormBufferAdmin() {
  const store = useContext(FormBufferContext);
  if (!store) throw new Error(...);
  return {
    clearByPrefix: (p: string) => store.clearByPrefix(p),
  };
}
```

`EMPTY` is a stable empty `{}` reference to avoid render churn.

### `MultiSelectFormField` field type

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

### `Form` organism changes

- Internal `values` widens to `Record<string, FieldValue>`.
- New optional prop: `formId?: string`. When provided, Form mirrors
  `values` to/from the buffer:
  - On mount: seed local state from `useFormBuffer(formId).values`,
    overlaying field defaults for missing keys.
  - On every `setValues` call: also call `setField(...)` on the
    buffer.
  - Submit reads from the buffer first, falling back to local state.
- Multiselect field rendering:
  - Label row: `{label}: {field.display?.(arr) ?? arr.join(", ") || "(none)"}`.
  - Pressing `Enter` on a multiselect field calls `field.onEdit()`.
  - No inline editor renders.
  - Multiselect fields participate in the same ↑↓ cursor flow.
- `canSubmit`: a required multiselect counts as "filled" iff its
  array length > 0. Unrequired multiselect always passes.
- `onSubmit` payload type widens to `Record<string, FieldValue>`.
  Existing string-only consumers (e.g., TripDuplicate) continue
  working because they never read multiselect keys.

### `MultiSelectList` organism

```ts
interface MultiSelectListProps {
  options: SelectOption[];
  initialSelected: string[];
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
}
```

- Uses local state `selected: string[]` initialized from
  `initialSelected`.
- Renders one `<Box>` per option:
  `[x] label` (selected) or `[ ] label` (unselected). Cursor row is
  cyan + bold like `ListSelect`.
- `useInput` handlers (active when this component is mounted):
  - `↑`/`↓` — move cursor (wraps).
  - `space` — toggle the option at cursor in `selected`.
  - `Enter` — `onConfirm(selected)`.
  - `Esc` — `onCancel()`.
- Empty options: render dim text "No options available." Pressing
  Enter still calls `onConfirm([])` so consumer can decide.

### Sub-page screens

**`OwnerSelect`** — used by 3 routes:
- Route props: `formId, fieldKey, tripDirPath` (+ `accountId` on the
  edit-account variant, ignored by this screen but typed).
- Reads `trip.owners` via `useData()`. Options:
  `trip.owners.map(o => ({ label: o.name, value: o.id }))`.
- `useFormBuffer(formId).values[fieldKey]` provides
  `initialSelected` (default `[]`).
- `onConfirm(selected)` → `setField(fieldKey, selected); goBack();`
- `onCancel` → `goBack();`
- `useLayout` registers titleSuffix=`"Select Owners"`, hints
  `[↑↓ Navigate, Space Toggle, Enter Confirm, Esc Cancel]`, no menu.

**`TagSelect`** — same shape as OwnerSelect; options come from
`trip.settings.tags`. titleSuffix=`"Select Tags"`.

**`TripCreateCountryList`** — `/trips/new/countries`:
- formId="trip-new", fieldKey="countries".
- Reads countries: `(useFormBuffer("trip-new").values["countries"] as string[] | undefined) ?? []`.
- `selectMode` route prop drives normal vs remove mode (mirroring
  existing CountryList).
- Normal mode menu: `[a] Add` →
  `goTo("/trips/new/countries/new", { props: { dataDir } })`;
  `[d] Delete` (when non-empty) →
  `goTo("/trips/new/countries", { props: { dataDir, selectMode: "remove" } })`.
- Remove mode renders `RemoveSelector`; on confirm,
  `setField("countries", remaining)`. If `remaining` is empty, also
  `goBack()` to exit remove mode (matches the existing pattern).

**`TripCreateCountryAdd`** — `/trips/new/countries/new`:
- A `Form` with one text field. No `formId` (its values are
  one-shot).
- On submit:
  - Trim the input. Reject empty (inline error). Reject duplicate
    (case-sensitive exact, against the current buffer countries —
    inline error).
  - Else: append to the buffer's countries array via
    `setField("countries", [...current, trimmed])`, then `goBack()`.

### Host screen wiring

**`TripCreate`** — converts the `countries` text field to multiselect.
The form gets `formId="trip-new"`. countries field:

```ts
{
  key: "countries",
  label: "Countries",
  type: "multiselect",
  onEdit: () => goTo("/trips/new/countries", { props: { dataDir } }),
}
```

Submit handler reads `values["countries"] as string[]`, builds the
Settings, calls `createTrip`, then `clear()` on the form buffer
before `goTo("/trips/overview", ...)`.

**`AccountCreate`** — `formId="account-new"`. Owners field:

```ts
{
  key: "owners",
  label: "Owners",
  type: "multiselect",
  onEdit: () => goTo("/trips/accounts/new/owners", {
    props: { tripDirPath, formId: "account-new", fieldKey: "owners" },
  }),
}
```

Submit reads `values["owners"] as string[]`, calls `addAccount`,
clear, goBack.

**`AccountEdit`** — `formId=`account-edit-${accountId}``. Otherwise
mirrors AccountCreate. The route params for the OwnerSelect screen
include `accountId` so the back-stack restores the correct edit.

**`ExpenseForm`** — `formId=`expense-new`` or
`expense-edit-${expenseId}``. Owners and Tags fields both become
multiselect:

```ts
{
  key: "owners",
  label: "Owners",
  type: "multiselect",
  onEdit: () => goTo("/trips/expenses/form/owners", {
    props: { tripDirPath, formId, fieldKey: "owners" },
  }),
},
{
  key: "tags",
  label: "Tags",
  type: "multiselect",
  onEdit: () => goTo("/trips/expenses/form/tags", {
    props: { tripDirPath, formId, fieldKey: "tags" },
  }),
}
```

Submit reads owners + tags as `string[]`, builds the Expense, calls
`addExpense` or `updateExpense`, clear, goBack.

The Expense type's `owners` field accepts `string[] | ExpenseOwnerSplit[]`.
The new flow always emits `string[]`. Splits remain a separate
future concern (out of scope).

**`TripDuplicate`** — unchanged, no multiselect fields. No formId;
no buffer integration.

### Buffer cleanup

Each list screen calls `clearByPrefix` on mount via a one-shot
`useEffect`:

- `TripList`: `clearByPrefix("trip-")` → wipes any abandoned
  `"trip-new"` draft.
- `AccountList`: `clearByPrefix("account-")` → wipes
  `"account-new"` and any stale `"account-edit-*"` drafts.
- `ExpenseList`: `clearByPrefix("expense-")` → wipes
  `"expense-new"` and any stale `"expense-edit-*"` drafts.

Why this works:
- Sub-page navigation pushes the sub-route on top of the host. The
  list screen above the host is not re-mounted; cleanup doesn't run.
- `[q]` on the host pops to the list, which re-mounts and triggers
  cleanup. The host's locally-held values (in the form's local
  state) are gone with the unmount; the buffer entry now goes too.
- Submit-driven navigation calls `clear(formId)` before navigating,
  pre-empting the cleanup. (Belt-and-suspenders; either alone would
  suffice.)

### Routes

Six new entries in `RouteParams`:

```ts
"/trips/new/countries": { dataDir?: string; selectMode?: "remove" };
"/trips/new/countries/new": { dataDir?: string };
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

Each `router.ts` entry reuses the parent screen's `borderColor` and
sets `defaultFocus="main"`. Title callbacks include the sub-page
context (e.g., `"Select Owners"`, `"Countries"`).

## Data flow

### Creating a trip with two countries

```
User on TripList → goTo /trips/new
TripCreate mounts, formId="trip-new", buffer empty
User edits Trip Name (text), buffer.values = { name: "Japan" }
User cursors to Countries (multiselect), Enter
  → onEdit() → goTo /trips/new/countries
TripCreate unmounts, TripCreateCountryList mounts
  reads buffer.values["countries"] → [] (defaulted)
  list shows empty
User: [a] → goTo /trips/new/countries/new
TripCreateCountryAdd mounts, single text field
User types "Japan", submits
  → setField("countries", ["Japan"]); goBack()
Back to TripCreateCountryList, list shows ["Japan"]
User: [a] → goTo .../new
... (adds "Korea")
User: [q] → goBack to TripCreate
TripCreate remounts, seeds local state from buffer
  values = { name: "Japan", countries: ["Japan", "Korea"] }
User cursors to Submit, [s]
  → settings = { ...DEFAULT_TRIP_SETTINGS, name, ..., countries: ["Japan","Korea"] }
  → createTrip(...)
  → clear("trip-new")
  → goTo /trips/overview
```

### Editing an expense's tags

```
User on ExpenseList → goTo /trips/expenses/form (props.expenseId="e1")
ExpenseForm mounts, formId="expense-edit-e1", buffer empty
  seeds values from existingExpense (incl tags: ["food"])
  buffer.values = { ..., tags: ["food"] }
User cursors to Tags, Enter → goTo /trips/expenses/form/tags
TagSelect mounts, options from settings.tags, initialSelected=["food"]
User space-toggles "food" off, space-toggles "drinks" on, Enter
  → setField("tags", ["drinks"]); goBack()
ExpenseForm remounts, seeds from buffer (now tags=["drinks"])
User: [s]
  → updateExpense(trip, { ...existing, tags: ["drinks"] })
  → clear("expense-edit-e1")
  → goBack
```

## Testing

### New tests

- `src/tui/states/__tests__/formBufferStore.test.ts` — pure-class
  tests for `FormBufferStore`:
  - `setField` creates buffer if missing.
  - `setField` updates existing field.
  - `setValues` replaces.
  - `get` returns `undefined` for missing formId.
  - `clear` removes only the named formId.
  - `clearByPrefix` removes matching ids, leaves non-matching.
  - `subscribe` fires on mutations.

### Updated tests

- `src/core/services/expense/__tests__/expenseService.test.ts` —
  delete the 4 default-tag-merge tests added by the previous spec.
  Existing addExpense/updateExpense/getExpenses/removeExpense tests
  remain.

### Deleted tests

- `src/core/services/trip/__tests__/zventService.test.ts` — gone.

### Manual verification (end of implementation)

1. Create a trip with countries `Japan, Korea` via the sub-pages.
   Inspect settings.yaml: `countries: [Japan, Korea]`, `tags: []`.
2. In Settings > Tags, add `food` and `drinks`. Open new-expense form,
   cursor to Tags, Enter — TagSelect lists `food` and `drinks`.
   Pick both, confirm. Submit. Reload trip; expense.tags is
   `[food, drinks]`.
3. Open an existing expense whose tags include `Zvent: …` from the
   prior merge. The tag persists in expense.tags. If the trip was
   created during the Zvent window, its `settings.tags` still
   contains the same `Zvent: …` string, so it appears as a pickable
   option in TagSelect; otherwise it persists on the expense but
   isn't selectable from the picker. Either way nothing is
   auto-removed.
4. ExpenseForm: type a payee, navigate to Owners select, pick alice,
   return. Payee text is still there. Navigate away with `[q]` to
   ExpenseList, reopen — form is fresh (buffer was cleared).
5. Account create with two owners selected. Inspect accounts.yaml:
   owners array contains both ids.
6. TripDuplicate still works (no zventId, no Zvent stripping).

## Out of scope

- Inline "Add new" on select pages (D3, D4 — pick-only).
- Expense owner splits — UI still emits `string[]`. The
  ExpenseOwnerSplit shape stays in the model for legacy data and
  future work.
- Auto-clearing tags from existing expenses when their tag is
  removed from `settings.tags`. Tags on persisted expenses are
  decoupled from the vocabulary; vocabulary is just a picker.
- Generalizing the existing Settings > CountryList to share code
  with TripCreateCountryList. Different sources (persisted vs
  buffer); slight duplication is acceptable for now.
- Buffer persistence to disk. Drafts only live in memory; closing
  the app discards them.

## Risks

- **Buffer leaks:** if a list screen forgets to `clearByPrefix`, an
  abandoned draft will silently restore on next form open. Mitigated
  by submit-handlers also calling `clear(formId)`. Worst case is a
  minor UX confusion, not data loss.
- **Form prop widening (`Record<string, FieldValue>`)**: every
  existing host screen's submit handler receives
  `Record<string, FieldValue>` instead of `Record<string, string>`.
  Text-only forms (TripDuplicate, TripSettings, the Settings CRUD
  pairs — TagCreate, CategoryCreate, OwnerCreate, etc.) need a
  one-line narrowing helper. We add `getString(values, key)` and
  `getStringArray(values, key)` to `src/tui/models/index.ts` so
  consumers don't sprinkle `as string` casts everywhere. Compile
  errors flag any miss; no runtime risk.
- **`useSyncExternalStore` re-render churn**: the store mutates
  per-`setField`. Every consumer of `useFormBuffer(formId)` will
  re-render on any change to that formId's buffer. Acceptable at the
  expected scale (1 host + maybe 1 sub-page mounted at a time).
- **Sub-page route props duplication**: each select route props
  carry `formId` + `fieldKey`. If a future host wants to share a
  sub-page across multiple fields, we already have the param shape;
  no design change needed.
