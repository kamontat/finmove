# Form Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-step sequential input flows with a reusable Form organism that shows all fields at once, with view/edit modes and inline select cycling.

**Architecture:** A `Form` organism manages cursor, view/edit mode, and field values. It uses existing `TextInput` and `DateInput` atoms. Screens pass a field configuration array and an `onSubmit` callback. The Form handles all keyboard interaction internally, toggling focus between "main" (view) and "input" (edit) via the focus context.

**Tech Stack:** TypeScript, React, Ink, Bun

---

### Task 1: Add FormField types to models

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 1: Add form field types**

Add to the bottom of `src/tui/models/index.ts`:

```ts
// --- Form ---

interface FormFieldBase {
  key: string;
  label: string;
  required?: boolean;
}

export type TextFormField = FormFieldBase & {
  type: "text";
  defaultValue?: string;
  placeholder?: string;
};

export type SelectFormField = FormFieldBase & {
  type: "select";
  options: SelectOption[];
  defaultValue?: string;
};

export type DateFormField = FormFieldBase & {
  type: "date";
  defaultValue?: string;
};

export type FormFieldConfig = TextFormField | SelectFormField | DateFormField;
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat: add FormFieldConfig types to shared models"
```

---

### Task 2: Create InlineSelect atom

A small select component for ≤3 options that renders on a single line: `< value >` with left/right cycling.

**Files:**
- Create: `src/tui/components/atoms/InlineSelect.tsx`

- [ ] **Step 1: Create InlineSelect component**

```tsx
// src/tui/components/atoms/InlineSelect.tsx

import { Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { SelectOption } from "../../models";

interface InlineSelectProps {
  options: SelectOption[];
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlineSelect({
  options,
  defaultValue,
  onSubmit,
  onCancel,
}: InlineSelectProps): JSX.Element {
  const defaultIndex = defaultValue
    ? Math.max(0, options.findIndex((o) => o.value === defaultValue))
    : 0;
  const [cursor, setCursor] = useState(defaultIndex);

  useInput((_input, key) => {
    if (key.leftArrow) {
      setCursor((c) => (c > 0 ? c - 1 : options.length - 1));
    } else if (key.rightArrow) {
      setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
    } else if (key.return) {
      const opt = options[cursor];
      if (opt) onSubmit(opt.value);
    } else if (key.escape) {
      onCancel();
    }
  });

  const current = options[cursor];

  return (
    <Text>
      <Text color="cyan">{"< "}</Text>
      <Text bold>{current?.label ?? ""}</Text>
      <Text color="cyan">{" >"}</Text>
      <Text dimColor> (←/→ select, Enter confirm, Esc cancel)</Text>
    </Text>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/atoms/InlineSelect.tsx
git commit -m "feat: add InlineSelect atom for ≤3 option cycling"
```

---

### Task 3: Create DropdownSelect atom

A select component for >3 options that renders a vertical list below the field.

**Files:**
- Create: `src/tui/components/atoms/DropdownSelect.tsx`

- [ ] **Step 1: Create DropdownSelect component**

```tsx
// src/tui/components/atoms/DropdownSelect.tsx

import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { SelectOption } from "../../models";

interface DropdownSelectProps {
  options: SelectOption[];
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function DropdownSelect({
  options,
  defaultValue,
  onSubmit,
  onCancel,
}: DropdownSelectProps): JSX.Element {
  const defaultIndex = defaultValue
    ? Math.max(0, options.findIndex((o) => o.value === defaultValue))
    : 0;
  const [cursor, setCursor] = useState(defaultIndex);

  useInput((_input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : options.length - 1));
    } else if (key.downArrow) {
      setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
    } else if (key.return) {
      const opt = options[cursor];
      if (opt) onSubmit(opt.value);
    } else if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((o, i) => {
        const selected = i === cursor;
        return (
          <Text key={o.value} inverse={selected}>
            {selected ? "> " : "  "}
            {o.label}
          </Text>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/atoms/DropdownSelect.tsx
git commit -m "feat: add DropdownSelect atom for >3 option lists"
```

---

### Task 4: Create Form organism

The main reusable Form component.

**Files:**
- Create: `src/tui/components/organisms/Form.tsx`

- [ ] **Step 1: Create the Form component**

```tsx
// src/tui/components/organisms/Form.tsx

import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import type { FormFieldConfig } from "../../models";
import { DateInput } from "../atoms/DateInput";
import { DropdownSelect } from "../atoms/DropdownSelect";
import { InlineSelect } from "../atoms/InlineSelect";
import { TextInput } from "../atoms/TextInput";
import { useFocus } from "../../states/focus";

interface FormProps {
  fields: FormFieldConfig[];
  onSubmit: (values: Record<string, string>) => void;
  submitLabel?: string;
  submitKey?: string;
}

const INLINE_SELECT_THRESHOLD = 3;

export function Form({
  fields,
  onSubmit,
  submitLabel = "Save",
  submitKey = "s",
}: FormProps): JSX.Element {
  const { setFocus } = useFocus();

  // values: field key → current value (empty string = not filled)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = "";
    }
    return init;
  });

  // cursor: 0..fields.length (last position = submit row)
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState(false);

  const totalItems = fields.length + 1; // fields + submit row

  const canSubmit = useMemo(() => {
    return fields.every((f) => {
      if (!f.required) return true;
      const val = values[f.key] ?? "";
      return val !== "";
    });
  }, [fields, values]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const enterEdit = useCallback(() => {
    setEditing(true);
    setFocus("input");
  }, [setFocus]);

  const exitEdit = useCallback(() => {
    setEditing(false);
    setFocus("main");
  }, [setFocus]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    // For empty fields with placeholders, use placeholder as value
    const result: Record<string, string> = {};
    for (const f of fields) {
      const val = values[f.key] ?? "";
      if (val === "" && "placeholder" in f && f.placeholder) {
        result[f.key] = f.placeholder;
      } else if (val === "" && "defaultValue" in f && f.defaultValue) {
        result[f.key] = f.defaultValue;
      } else {
        result[f.key] = val;
      }
    }
    onSubmit(result);
  }, [canSubmit, fields, values, onSubmit]);

  // View mode keyboard
  useInput(
    (input, key) => {
      if (key.upArrow) {
        setCursor((c) => (c > 0 ? c - 1 : totalItems - 1));
      } else if (key.downArrow) {
        setCursor((c) => (c < totalItems - 1 ? c + 1 : 0));
      } else if (key.return) {
        if (cursor === fields.length) {
          // Submit row
          handleSubmit();
        } else {
          enterEdit();
        }
      } else if (input === submitKey) {
        handleSubmit();
      }
    },
    { isActive: !editing },
  );

  return (
    <Box flexDirection="column">
      {fields.map((field, i) => {
        const isCursor = i === cursor;
        const value = values[field.key] ?? "";
        const isEditing = isCursor && editing;

        return (
          <Box key={field.key} flexDirection="column">
            <Box>
              <Text inverse={isCursor && !editing}>
                {isCursor && !editing ? "> " : "  "}
              </Text>
              <Text bold={isCursor} color={isCursor && !editing ? "cyan" : undefined} dimColor={!isCursor && value === ""}>
                {field.label}
                {field.required ? "" : " (optional)"}:
              </Text>
              {!isEditing && value !== "" && (
                <Text dimColor={!isCursor}> {getDisplayValue(field, value)}</Text>
              )}
              {!isEditing && value === "" && hasPlaceholder(field) && (
                <Text dimColor> ({getPlaceholder(field)})</Text>
              )}
              {isEditing && field.type === "text" && (
                <Text> </Text>
              )}
              {isEditing && field.type === "select" && field.options.length <= INLINE_SELECT_THRESHOLD && (
                <Text> </Text>
              )}
            </Box>
            {/* Edit mode renderers */}
            {isEditing && field.type === "text" && (
              <Box marginLeft={2}>
                <TextInput
                  {...(value !== "" ? { defaultValue: value } : {})}
                  {...(hasPlaceholder(field) ? { placeholder: getPlaceholder(field) } : {})}
                  onSubmit={(v) => {
                    setValue(field.key, v);
                    exitEdit();
                  }}
                  onCancel={exitEdit}
                />
              </Box>
            )}
            {isEditing && field.type === "date" && (
              <Box marginLeft={2}>
                <DateInput
                  defaultValue={value || field.defaultValue || "2026-01-01"}
                  onSubmit={(v) => {
                    setValue(field.key, v);
                    exitEdit();
                  }}
                  onCancel={exitEdit}
                />
              </Box>
            )}
            {isEditing && field.type === "select" && field.options.length <= INLINE_SELECT_THRESHOLD && (
              <Box marginLeft={2}>
                <InlineSelect
                  options={field.options}
                  {...(value !== "" ? { defaultValue: value } : field.defaultValue ? { defaultValue: field.defaultValue } : {})}
                  onSubmit={(v) => {
                    setValue(field.key, v);
                    exitEdit();
                  }}
                  onCancel={exitEdit}
                />
              </Box>
            )}
            {isEditing && field.type === "select" && field.options.length > INLINE_SELECT_THRESHOLD && (
              <Box marginLeft={2}>
                <DropdownSelect
                  options={field.options}
                  {...(value !== "" ? { defaultValue: value } : field.defaultValue ? { defaultValue: field.defaultValue } : {})}
                  onSubmit={(v) => {
                    setValue(field.key, v);
                    exitEdit();
                  }}
                  onCancel={exitEdit}
                />
              </Box>
            )}
          </Box>
        );
      })}
      {/* Submit row */}
      <Box marginTop={1}>
        <Text
          inverse={cursor === fields.length && !editing}
          dimColor={!canSubmit}
          bold={cursor === fields.length}
          color={cursor === fields.length && canSubmit ? "green" : undefined}
        >
          {cursor === fields.length ? "> " : "  "}
          [{submitKey}] {submitLabel}
        </Text>
      </Box>
    </Box>
  );
}

function getDisplayValue(field: FormFieldConfig, value: string): string {
  if (field.type === "select") {
    const opt = field.options.find((o) => o.value === value);
    return opt?.label ?? value;
  }
  return value;
}

function hasPlaceholder(field: FormFieldConfig): boolean {
  if (field.type === "text") return !!field.placeholder;
  if (field.type === "date") return !!field.defaultValue;
  if (field.type === "select") return !!field.defaultValue;
  return false;
}

function getPlaceholder(field: FormFieldConfig): string {
  if (field.type === "text") return field.placeholder ?? "";
  if (field.type === "date") return field.defaultValue ?? "";
  if (field.type === "select") {
    const opt = field.options.find((o) => o.value === field.defaultValue);
    return opt?.label ?? field.defaultValue ?? "";
  }
  return "";
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: PASS (or fixable with `bun run fix`)

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/organisms/Form.tsx
git commit -m "feat: add Form organism with view/edit modes"
```

---

### Task 5: Rewrite ExpenseForm screen

Replace the multi-step switch/case with a single `<Form>` render.

**Files:**
- Modify: `src/tui/screens/ExpenseForm.tsx`

- [ ] **Step 1: Rewrite ExpenseForm**

Replace entire file:

```tsx
// src/tui/screens/ExpenseForm.tsx

import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import type { Expense } from "../../core/models";
import { today } from "../../core/services/date";
import { addExpense, updateExpense } from "../../core/services/expense";
import type { FormFieldConfig } from "../models";
import { Form } from "../components/organisms/Form";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseForm(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { goBack, currentRoute } = useNavigation();
  const { setHints } = useLayout();

  const expenseId = currentRoute.props["expenseId"] as string | undefined;
  const existingExpense = trip?.expenses.find((e) => e.id === expenseId);

  useEffect(() => {
    setHints([
      { key: "↑↓", label: "navigate" },
      { key: "enter", label: "edit field" },
      { key: "s", label: "save" },
    ]);
  }, [setHints]);

  const fields = useMemo((): FormFieldConfig[] => {
    if (!trip) return [];

    const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];
    // Read current currency from existing expense or default
    const base: FormFieldConfig[] = [
      {
        type: "select",
        key: "account",
        label: "Account",
        required: true,
        options: trip.accounts.map((a) => ({
          label: `${a.name} (${a.type})`,
          value: a.id,
        })),
        ...(existingExpense ? { defaultValue: existingExpense.accountId } : {}),
      },
      {
        type: "date",
        key: "date",
        label: "Date",
        required: true,
        defaultValue: existingExpense?.date ?? today(),
      },
      {
        type: "text",
        key: "payee",
        label: "Payee",
        required: true,
        ...(existingExpense ? { defaultValue: existingExpense.payee } : {}),
      },
      {
        type: "select",
        key: "category",
        label: "Category",
        required: true,
        options: trip.settings.categories.map((c) => ({
          label: c,
          value: c,
        })),
        ...(existingExpense ? { defaultValue: existingExpense.category } : {}),
      },
      {
        type: "text",
        key: "amount",
        label: "Amount",
        required: true,
        ...(existingExpense
          ? { defaultValue: existingExpense.amount.toString() }
          : {}),
      },
      {
        type: "select",
        key: "currency",
        label: "Currency",
        required: true,
        options: allCurrencies.map((c) => ({ label: c, value: c })),
        defaultValue: existingExpense?.currency ?? "THB",
      },
    ];

    // TODO: exchangeRate is conditional — we can't know current currency
    // from inside useMemo since Form manages values internally.
    // For now, always include it. The Form will show it, and the submit
    // handler will ignore it if currency is THB.
    // A future enhancement could let Form expose an onFieldChange callback
    // to dynamically adjust fields.
    const tripRate = trip.settings.currencies;
    base.push({
      type: "text",
      key: "exchangeRate",
      label: "Exchange Rate (→ THB)",
      ...(existingExpense?.exchangeRate
        ? { defaultValue: existingExpense.exchangeRate.toString() }
        : {}),
    });

    base.push(
      {
        type: "text",
        key: "owners",
        label: "Owners",
        placeholder: trip.owners.map((o) => o.id).join(","),
      },
      {
        type: "text",
        key: "description",
        label: "Description",
        ...(existingExpense ? { defaultValue: existingExpense.description } : {}),
      },
      {
        type: "text",
        key: "tags",
        label: "Tags",
        placeholder: "comma-separated",
      },
    );

    return base;
  }, [trip, existingExpense]);

  if (!trip) return <></>;

  return (
    <Form
      fields={fields}
      submitLabel="Save Expense"
      onSubmit={(vals) => {
        const tags = vals.tags ? vals.tags.split(",").map((s) => s.trim()) : [];
        const ownerList =
          !vals.owners || vals.owners.trim() === ""
            ? undefined
            : vals.owners.split(",").map((s) => s.trim());

        const id = existingExpense?.id ?? `exp-${Date.now()}`;
        const curr = vals.currency || "THB";

        const expense: Expense = {
          id,
          accountId: vals.account,
          date: vals.date,
          payee: vals.payee,
          category: vals.category,
          amount: Number.parseFloat(vals.amount),
          currency: curr,
          ...(curr !== "THB" && vals.exchangeRate
            ? { exchangeRate: Number.parseFloat(vals.exchangeRate) }
            : {}),
          ...(ownerList ? { owners: ownerList } : {}),
          description: vals.description || "",
          tags,
        };

        if (existingExpense) {
          updateExpense(trip, expense);
        } else {
          addExpense(trip, expense);
        }
        reloadTrip();
        goBack();
      }}
    />
  );
}
```

Note: The exchangeRate field is always shown for simplicity. The spec wanted it hidden when currency=THB, but since the Form manages values internally the parent can't easily read the current currency to filter fields dynamically. The submit handler ignores exchangeRate when currency is THB, so the behavior is correct. This is a pragmatic deviation — a future `onFieldChange` callback could enable dynamic field lists.

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/ExpenseForm.tsx
git commit -m "feat: ExpenseForm uses Form organism instead of multi-step"
```

---

### Task 6: Rewrite TripList create flow

Replace the create-name → create-start → create-end multi-step with a Form.

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Rewrite TripList**

The TripList screen has multiple modes. Replace the create flow modes (`create-name`, `create-start`, `create-end`) with a single `create` mode that renders a `<Form>`. Also replace the `duplicate-name` mode with a `duplicate` mode that renders a Form.

Remove from `Mode` type: `"create-name"`, `"create-start"`, `"create-end"`, `"duplicate-name"`
Add to `Mode` type: `"create"`, `"duplicate"`

Remove state: `tripName`, `startDate` (Form manages these now)

Replace the entire file with:

```tsx
// src/tui/screens/TripList.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Settings, Trip } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import {
  createTrip,
  deleteTrip,
  duplicateTrip,
  listTrips,
  toDirName,
} from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode =
  | "list"
  | "create"
  | "select-for-duplicate"
  | "duplicate"
  | "select-for-delete";

const DEFAULT_SETTINGS: Omit<Settings, "name" | "startDate" | "endDate"> = {
  countries: [],
  baseCurrency: "THB",
  currencies: {},
  categories: [
    "Flight",
    "Hotels",
    "Transportation",
    "Shopping",
    "Eating",
    "Activities",
  ],
  tags: [],
  exportPath: "./expenses.csv",
};

export function TripList(): JSX.Element {
  const { goTo, currentRoute } = useNavigation();
  const { focus, setFocus } = useFocus();
  const { setMenu, setHints, setBorderColor, resetLayout } = useLayout();

  const dataDir =
    (currentRoute.props["dataDir"] as string | undefined) ?? "./data";

  const [mode, setMode] = useState<Mode>("list");
  const [targetTrip, setTargetTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

  const refreshTrips = () => {
    setTrips(listTrips(dataDir));
  };

  // Register menu in list mode
  useEffect(() => {
    if (mode !== "list") {
      setMenu([], () => {});
      setBorderColor(null);
      return;
    }

    setMenu(
      [
        { label: "Create", value: "create", key: "c" },
        { label: "Duplicate", value: "duplicate", key: "d" },
        { label: "Delete", value: "delete", key: "x" },
      ],
      (value) => {
        if (value === "create") {
          setMode("create");
        } else if (value === "duplicate" && trips.length > 0) {
          setMode("select-for-duplicate");
          setFocus("main");
        } else if (value === "delete" && trips.length > 0) {
          setMode("select-for-delete");
          setBorderColor("red");
          setFocus("main");
        }
      },
    );
    setHints([{ key: "?", label: "help" }]);
  }, [mode, trips.length, setMenu, setHints, setFocus, setBorderColor]);

  // --- Create flow ---
  const createFields = useMemo((): FormFieldConfig[] => [
    { type: "text", key: "name", label: "Trip name", required: true, placeholder: "e.g. Japan Trip" },
    { type: "date", key: "startDate", label: "Start date", required: true, defaultValue: today() },
    { type: "date", key: "endDate", label: "End date", required: true, defaultValue: addDays(today(), 1) },
  ], []);

  if (mode === "create") {
    return (
      <Form
        fields={createFields}
        submitLabel="Create Trip"
        onSubmit={(vals) => {
          const dirName = toDirName(vals.name, vals.startDate);
          const settings = {
            ...DEFAULT_SETTINGS,
            name: vals.name,
            startDate: vals.startDate,
            endDate: vals.endDate,
          };
          const newTrip = createTrip(dataDir, dirName, settings);
          resetLayout();
          goTo("/trips/menu", {
            props: { tripDirPath: newTrip.dirPath, tripName: vals.name, dataDir },
          });
        }}
      />
    );
  }

  // --- Select trip for duplicate/delete ---
  if (mode === "select-for-duplicate" || mode === "select-for-delete") {
    const isDelete = mode === "select-for-delete";
    return (
      <VerticalSelect
        options={trips.map((t) => ({
          label: t.settings.name,
          value: t.dirPath,
          detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
        }))}
        onChange={(value) => {
          const trip = trips.find((t) => t.dirPath === value);
          if (!trip) return;
          if (isDelete) {
            deleteTrip(value);
            refreshTrips();
            setMode("list");
            setBorderColor(null);
            setFocus("menu");
          } else {
            setTargetTrip(trip);
            setMode("duplicate");
          }
        }}
        onCancel={() => {
          setMode("list");
          setBorderColor(null);
          setFocus("menu");
        }}
        {...(isDelete ? { color: "red" } : {})}
        isActive
      />
    );
  }

  // --- Duplicate flow ---
  if (mode === "duplicate" && targetTrip) {
    const dupFields: FormFieldConfig[] = [
      {
        type: "text",
        key: "newName",
        label: `Duplicate "${targetTrip.settings.name}" — new name`,
        required: true,
        placeholder: "e.g. Japan Trip v2",
      },
    ];
    return (
      <Form
        fields={dupFields}
        submitLabel="Duplicate"
        onSubmit={(vals) => {
          const dirName = toDirName(vals.newName, targetTrip.settings.startDate);
          duplicateTrip(dataDir, targetTrip.dirPath, dirName, vals.newName);
          refreshTrips();
          setTargetTrip(null);
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  // --- Default: trip list ---
  if (trips.length === 0) {
    return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
  }

  return (
    <VerticalSelect
      options={trips.map((t) => ({
        label: t.settings.name,
        value: t.dirPath,
        detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
      }))}
      onChange={(value) => {
        const trip = trips.find((t) => t.dirPath === value);
        if (trip) {
          goTo("/trips/menu", {
            props: {
              tripDirPath: trip.dirPath,
              tripName: trip.settings.name,
              dataDir,
            },
          });
        }
      }}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "feat: TripList create/duplicate use Form organism"
```

---

### Task 7: Rewrite OwnerList — add flow + remove confirm

Replace multi-step add flow with Form. Remove ConfirmPrompt from remove flow — immediate delete.

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`

- [ ] **Step 1: Rewrite OwnerList**

Replace entire file:

```tsx
// src/tui/screens/OwnerList.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addOwner, removeOwner } from "../../core/services/owner";
import { Form } from "../components/organisms/Form";
import { DataTable } from "../components/organisms/DataTable";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add";

const ADD_FIELDS: FormFieldConfig[] = [
  { type: "text", key: "id", label: "Owner ID", required: true, placeholder: "e.g. alice" },
  { type: "text", key: "name", label: "Display name", required: true, placeholder: "e.g. Alice" },
];

export function OwnerList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { setFocus } = useFocus();
  const { setMenu, setHints } = useLayout();

  const [mode, setMode] = useState<Mode>("list");

  useEffect(() => {
    if (!trip || mode !== "list") {
      setMenu([], () => {});
      return;
    }

    const menuOptions = [
      { label: "Add", value: "add", key: "a" },
      ...trip.owners.map((o) => ({
        label: `Remove: ${o.name}`,
        value: `remove:${o.id}`,
      })),
    ];

    setMenu(menuOptions, (value) => {
      if (value === "add") {
        setMode("add");
      } else if (value.startsWith("remove:")) {
        const id = value.replace("remove:", "");
        removeOwner(trip, id);
        reloadTrip();
      }
    });
    setHints([{ key: "?", label: "help" }]);
  }, [trip, mode, setMenu, setHints, setFocus, reloadTrip]);

  if (mode === "add") {
    return (
      <Form
        fields={ADD_FIELDS}
        submitLabel="Add Owner"
        onSubmit={(vals) => {
          if (trip) {
            addOwner(trip, { id: vals.id, name: vals.name });
            reloadTrip();
          }
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.owners.length === 0) {
    return <Text dimColor>No owners yet.</Text>;
  }

  return (
    <DataTable
      headers={["ID", "Name"]}
      rows={trip.owners.map((o) => [o.id, o.name])}
    />
  );
}
```

Key changes:
- Removed `Mode` values `"add-id"`, `"add-name"`, `"remove"` — replaced with single `"add"` mode
- Removed `ConfirmPrompt` import and remove flow — menu action directly calls `removeOwner`
- Removed `newId`, `removeId` state — Form manages add values internally

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/OwnerList.tsx
git commit -m "feat: OwnerList uses Form, remove without confirm"
```

---

### Task 8: Rewrite AccountList — add flow

Replace multi-step add flow with Form.

**Files:**
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 1: Rewrite AccountList**

Replace entire file:

```tsx
// src/tui/screens/AccountList.tsx

import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { AccountType } from "../../core/models";
import { addAccount, removeAccount } from "../../core/services/account";
import { Form } from "../components/organisms/Form";
import { DataTable } from "../components/organisms/DataTable";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add";

const ADD_FIELDS: FormFieldConfig[] = [
  { type: "text", key: "id", label: "Account ID", required: true, placeholder: "e.g. alice-credit" },
  { type: "text", key: "name", label: "Display name", required: true, placeholder: "e.g. Alice's Visa" },
  {
    type: "select",
    key: "type",
    label: "Type",
    required: true,
    options: [
      { label: "Credit", value: "Credit" },
      { label: "Debit", value: "Debit" },
    ],
    defaultValue: "Credit",
  },
  { type: "text", key: "owners", label: "Owner IDs", required: true, placeholder: "e.g. alice,bob" },
];

export function AccountList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { setFocus } = useFocus();
  const { setMenu, setHints } = useLayout();

  const [mode, setMode] = useState<Mode>("list");

  useEffect(() => {
    if (!trip || mode !== "list") {
      setMenu([], () => {});
      return;
    }

    const menuOptions = [
      { label: "Add", value: "add", key: "a" },
      ...trip.accounts.map((a) => ({
        label: `Remove: ${a.name}`,
        value: `remove:${a.id}`,
      })),
    ];

    setMenu(menuOptions, (value) => {
      if (value === "add") {
        setMode("add");
      } else if (value.startsWith("remove:")) {
        const id = value.replace("remove:", "");
        removeAccount(trip, id);
        reloadTrip();
      }
    });
    setHints([{ key: "?", label: "help" }]);
  }, [trip, mode, setMenu, setHints, setFocus, reloadTrip]);

  if (mode === "add") {
    return (
      <Form
        fields={ADD_FIELDS}
        submitLabel="Add Account"
        onSubmit={(vals) => {
          if (trip) {
            const owners = vals.owners.split(",").map((s) => s.trim());
            addAccount(trip, {
              id: vals.id,
              name: vals.name,
              type: vals.type as AccountType,
              owners,
            });
            reloadTrip();
          }
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.accounts.length === 0) {
    return <Text dimColor>No accounts yet.</Text>;
  }

  return (
    <DataTable
      headers={["ID", "Name", "Type", "Owners"]}
      rows={trip.accounts.map((a) => [
        a.id,
        a.name,
        a.type,
        a.owners.join(", "),
      ])}
    />
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/AccountList.tsx
git commit -m "feat: AccountList uses Form organism for add flow"
```

---

### Task 9: Clean up unused imports and molecules

After all screens are converted, the `FormField` molecule and `DateField` molecule may no longer be used. Check and remove if unused.

**Files:**
- Possibly delete: `src/tui/components/molecules/FormField.tsx`
- Possibly delete: `src/tui/components/molecules/DateField.tsx`
- Possibly delete: `src/tui/components/molecules/ConfirmPrompt.tsx` (if only used by OwnerList remove — check Export screen still uses it)

- [ ] **Step 1: Check for remaining imports**

Search for imports of `FormField`, `DateField`, and `ConfirmPrompt` across all files. Keep any molecule that's still imported somewhere.

`FormField` — check if Export.tsx still imports it (it does: path input step). Keep it.
`DateField` — check if Export.tsx or anything else uses it. If not, delete.
`ConfirmPrompt` — Export.tsx uses it for the preview confirm and done confirm. Keep it.

Run: `grep -r "from.*FormField" src/tui/` and similar for DateField.

- [ ] **Step 2: Delete unused files**

Delete any molecule files that have zero remaining imports.

- [ ] **Step 3: Run type check and lint**

Run: `bun run check:type && bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove unused molecule components"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run type check**

Run: `bun run check:type`
Expected: PASS — zero errors

- [ ] **Step 2: Run lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: All existing tests pass

- [ ] **Step 4: Auto-fix formatting**

Run: `bun run fix`
Expected: Clean

- [ ] **Step 5: Smoke test**

Run: `bun run start`
Verify:
1. Navigate to expenses → form shows all fields at once
2. Up/down moves cursor between fields
3. Enter opens edit mode on selected field
4. Text fields: type + Enter confirms, Esc discards
5. Select fields (≤3): left/right cycles, Enter confirms
6. Select fields (>3): dropdown appears, up/down + Enter
7. `[s]` saves when all required fields filled
8. Submit row only activatable when required fields filled
9. Create trip form shows name/startDate/endDate
10. Duplicate trip form shows single name field
11. Add owner form shows id/name
12. Add account form shows id/name/type/owners (type is inline select)
13. Owner remove is immediate (no confirm)
14. `[q]` goes back from view mode, `[esc]` exits

- [ ] **Step 6: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during form integration testing"
```
