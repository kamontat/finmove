# List Page Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize Owners and Accounts pages to match the Trips page pattern (VerticalSelect, edit on select, persistent remove mode), and update Trips delete to stay in delete mode.

**Architecture:** Two new core services (updateOwner, updateAccount) for edit support. All three list screens rewritten to share the same mode pattern: list → add/edit (Form) / select-for-remove (VerticalSelect with red border, persistent). Focus set to "input" during remove mode so `[esc]` is handled by VerticalSelect onCancel.

**Tech Stack:** TypeScript, React, Ink, Bun

---

### Task 1: Create updateOwner core service

**Files:**
- Create: `src/core/services/owner/updateOwner.ts`
- Modify: `src/core/services/owner/index.ts`

- [ ] **Step 1: Create updateOwner**

```ts
// src/core/services/owner/updateOwner.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function updateOwner(
  trip: Trip,
  ownerId: string,
  newName: string,
): void {
  const index = trip.owners.findIndex((o) => o.id === ownerId);
  if (index === -1) {
    throw new Error(`Owner with id "${ownerId}" not found`);
  }

  const filePath = join(trip.dirPath, "owners.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.owners[index].name = newName;
  writeFileSync(filePath, stringify(data));
  trip.owners[index].name = newName;
}
```

- [ ] **Step 2: Add to barrel export**

In `src/core/services/owner/index.ts`, add:

```ts
export { updateOwner } from "./updateOwner";
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/services/owner/updateOwner.ts src/core/services/owner/index.ts
git commit -m "feat: add updateOwner core service"
```

---

### Task 2: Create updateAccount core service

**Files:**
- Create: `src/core/services/account/updateAccount.ts`
- Modify: `src/core/services/account/index.ts`

- [ ] **Step 1: Create updateAccount**

```ts
// src/core/services/account/updateAccount.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { AccountType, Trip } from "../../models";

export function updateAccount(
  trip: Trip,
  accountId: string,
  updates: { name?: string; type?: AccountType; owners?: string[] },
): void {
  const index = trip.accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    throw new Error(`Account with id "${accountId}" not found`);
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  const account = trip.accounts[index];

  if (updates.name !== undefined) {
    data.accounts[index].name = updates.name;
    account.name = updates.name;
  }
  if (updates.type !== undefined) {
    data.accounts[index].type = updates.type;
    account.type = updates.type;
  }
  if (updates.owners !== undefined) {
    data.accounts[index].owners = updates.owners;
    account.owners = updates.owners;
  }

  writeFileSync(filePath, stringify(data));
}
```

- [ ] **Step 2: Add to barrel export**

In `src/core/services/account/index.ts`, add:

```ts
export { updateAccount } from "./updateAccount";
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/services/account/updateAccount.ts src/core/services/account/index.ts
git commit -m "feat: add updateAccount core service"
```

---

### Task 3: Update TripList — persistent delete mode

Only change: delete mode stays in delete mode after each deletion, `[esc]` exits via onCancel, focus set to "input" during delete.

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Update delete mode behavior**

In TripList.tsx, make these changes:

1. When entering delete mode, set focus to "input" instead of "main":

Change line 129 from:
```ts
setFocus("main");
```
to:
```ts
setFocus("input");
```

2. In the `select-for-delete` branch (the `onChange` handler around line 195), after deleting, stay in delete mode instead of returning to list. Refresh trips and check if list is empty:

Replace the delete branch inside onChange:
```ts
if (isDelete) {
  deleteTrip(value);
  refreshTrips();
  setMode("list");
  setBorderColor(null);
  setFocus("menu");
}
```

With:
```ts
if (isDelete) {
  deleteTrip(value);
  const updated = listTrips(dataDir);
  setTrips(updated);
  if (updated.length === 0) {
    setMode("list");
    setBorderColor(null);
    setFocus("menu");
  }
}
```

3. Update the `select-for-delete` hints to show `[esc]` exits delete mode:

In the useEffect, add a hint block for delete mode:
```ts
if (mode === "select-for-delete") {
  setHints([
    { key: "↑↓", label: "Navigate" },
    { key: "Enter", label: "Delete selected" },
    { key: "esc", label: "Back to list" },
  ]);
}
```

4. The VerticalSelect already has `onCancel` which fires on `[esc]`. Since focus is "input", the global handler won't intercept it. The onCancel already resets to list mode.

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "feat: TripList delete mode stays persistent, esc exits"
```

---

### Task 4: Rewrite OwnerList

Complete rewrite to match the Trips page pattern.

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`

- [ ] **Step 1: Rewrite OwnerList**

Replace entire file:

```tsx
// src/tui/screens/OwnerList.tsx

import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Owner } from "../../core/models";
import { addOwner, removeOwner, updateOwner } from "../../core/services/owner";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add" | "edit" | "select-for-remove";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const ADD_FIELDS: FormFieldConfig[] = [
  {
    key: "name",
    label: "Display name",
    type: "text",
    required: true,
    placeholder: "e.g. Alice",
  },
];

export function OwnerList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus, setFocus } = useFocus();
  const { setMenu, setHints, setBorderColor } = useLayout();

  const [mode, setMode] = useState<Mode>("list");
  const [editTarget, setEditTarget] = useState<Owner | null>(null);

  useEffect(() => {
    if (!trip || mode !== "list") {
      setMenu([], () => {});
      if (mode === "add" || mode === "edit") {
        setHints([
          { key: "↑↓", label: "Navigate" },
          { key: "Enter", label: "Edit field" },
          { key: "q", label: "Back" },
          { key: "esc", label: "Exit" },
        ]);
      }
      if (mode === "select-for-remove") {
        setBorderColor("red");
        setHints([
          { key: "↑↓", label: "Navigate" },
          { key: "Enter", label: "Remove selected" },
          { key: "esc", label: "Back to list" },
        ]);
      }
      return;
    }

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(trip.owners.length > 0
          ? [{ label: "Remove", value: "remove", key: "x" }]
          : []),
      ],
      (value) => {
        if (value === "add") {
          setMode("add");
          setFocus("main");
        } else if (value === "remove" && trip.owners.length > 0) {
          setMode("select-for-remove");
          setFocus("input");
        }
      },
    );
    setHints([
      { key: "tab", label: "Switch focus" },
      { key: "←→", label: "Navigate menu" },
      { key: "Enter", label: "Edit owner" },
      { key: "q", label: "Back" },
      { key: "esc", label: "Exit" },
    ]);
  }, [trip, mode, setMenu, setHints, setFocus, setBorderColor]);

  // --- Add mode ---
  if (mode === "add") {
    return (
      <Form
        fields={ADD_FIELDS}
        onSubmit={(values) => {
          const name = values["name"] ?? "";
          if (trip) {
            addOwner(trip, { id: toSlug(name), name });
            reloadTrip();
          }
          setMode("list");
          setFocus("menu");
        }}
      />
    );
  }

  // --- Edit mode ---
  if (mode === "edit" && editTarget) {
    const editFields: FormFieldConfig[] = [
      {
        key: "name",
        label: "Display name",
        type: "text",
        required: true,
        defaultValue: editTarget.name,
      },
    ];
    return (
      <Box flexDirection="column">
        <Text dimColor>ID: {editTarget.id}</Text>
        <Form
          fields={editFields}
          onSubmit={(values) => {
            const name = values["name"] ?? "";
            if (trip) {
              updateOwner(trip, editTarget.id, name);
              reloadTrip();
            }
            setEditTarget(null);
            setMode("list");
            setFocus("menu");
          }}
        />
      </Box>
    );
  }

  // --- Remove mode ---
  if (mode === "select-for-remove" && trip) {
    if (trip.owners.length === 0) {
      setMode("list");
      setBorderColor(null);
      setFocus("menu");
      return <Text dimColor>No owners to remove.</Text>;
    }
    return (
      <VerticalSelect
        options={trip.owners.map((o) => ({
          label: o.name,
          value: o.id,
          detail: `(${o.id})`,
        }))}
        onChange={(value) => {
          removeOwner(trip, value);
          reloadTrip();
          if (trip.owners.length === 0) {
            setMode("list");
            setBorderColor(null);
            setFocus("menu");
          }
        }}
        onCancel={() => {
          setMode("list");
          setBorderColor(null);
          setFocus("menu");
        }}
        color="red"
        isActive
      />
    );
  }

  // --- List mode ---
  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.owners.length === 0) {
    return <Text dimColor>No owners yet. Press [a] to add one.</Text>;
  }

  return (
    <VerticalSelect
      options={trip.owners.map((o) => ({
        label: o.name,
        value: o.id,
        detail: `(${o.id})`,
      }))}
      onChange={(value) => {
        const owner = trip.owners.find((o) => o.id === value);
        if (owner) {
          setEditTarget(owner);
          setMode("edit");
          setFocus("main");
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

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: PASS (or fix with `bun run fix`)

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/OwnerList.tsx
git commit -m "feat: OwnerList matches Trips pattern — VerticalSelect, edit, persistent remove"
```

---

### Task 5: Rewrite AccountList

Complete rewrite to match the Trips page pattern.

**Files:**
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 1: Rewrite AccountList**

Replace entire file:

```tsx
// src/tui/screens/AccountList.tsx

import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { AccountType } from "../../core/models";
import {
  addAccount,
  removeAccount,
  updateAccount,
} from "../../core/services/account";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add" | "edit" | "select-for-remove";

interface EditTarget {
  id: string;
  name: string;
  type: string;
  owners: string;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const ADD_FIELDS: FormFieldConfig[] = [
  {
    key: "name",
    label: "Display name",
    type: "text",
    required: true,
    placeholder: "e.g. Alice's Visa",
  },
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
  {
    key: "owners",
    label: "Owner IDs (comma-separated)",
    type: "text",
    required: true,
    placeholder: "e.g. alice,bob",
  },
];

export function AccountList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus, setFocus } = useFocus();
  const { setMenu, setHints, setBorderColor } = useLayout();

  const [mode, setMode] = useState<Mode>("list");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  useEffect(() => {
    if (!trip || mode !== "list") {
      setMenu([], () => {});
      if (mode === "add" || mode === "edit") {
        setHints([
          { key: "↑↓", label: "Navigate" },
          { key: "Enter", label: "Edit field" },
          { key: "q", label: "Back" },
          { key: "esc", label: "Exit" },
        ]);
      }
      if (mode === "select-for-remove") {
        setBorderColor("red");
        setHints([
          { key: "↑↓", label: "Navigate" },
          { key: "Enter", label: "Remove selected" },
          { key: "esc", label: "Back to list" },
        ]);
      }
      return;
    }

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(trip.accounts.length > 0
          ? [{ label: "Remove", value: "remove", key: "x" }]
          : []),
      ],
      (value) => {
        if (value === "add") {
          setMode("add");
          setFocus("main");
        } else if (value === "remove" && trip.accounts.length > 0) {
          setMode("select-for-remove");
          setFocus("input");
        }
      },
    );
    setHints([
      { key: "tab", label: "Switch focus" },
      { key: "←→", label: "Navigate menu" },
      { key: "Enter", label: "Edit account" },
      { key: "q", label: "Back" },
      { key: "esc", label: "Exit" },
    ]);
  }, [trip, mode, setMenu, setHints, setFocus, setBorderColor]);

  // --- Add mode ---
  if (mode === "add") {
    return (
      <Form
        fields={ADD_FIELDS}
        onSubmit={(values) => {
          const name = values["name"] ?? "";
          const ownersStr = values["owners"] ?? "";
          const owners = ownersStr.split(",").map((s) => s.trim());
          if (trip) {
            addAccount(trip, {
              id: toSlug(name),
              name,
              type: (values["type"] ?? "Credit") as AccountType,
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

  // --- Edit mode ---
  if (mode === "edit" && editTarget) {
    const editFields: FormFieldConfig[] = [
      {
        key: "name",
        label: "Display name",
        type: "text",
        required: true,
        defaultValue: editTarget.name,
      },
      {
        key: "type",
        label: "Account Type",
        type: "select",
        required: true,
        options: [
          { label: "Credit", value: "Credit" },
          { label: "Debit", value: "Debit" },
        ],
        defaultValue: editTarget.type,
      },
      {
        key: "owners",
        label: "Owner IDs (comma-separated)",
        type: "text",
        required: true,
        defaultValue: editTarget.owners,
      },
    ];
    return (
      <Box flexDirection="column">
        <Text dimColor>ID: {editTarget.id}</Text>
        <Form
          fields={editFields}
          onSubmit={(values) => {
            const name = values["name"] ?? "";
            const ownersStr = values["owners"] ?? "";
            const owners = ownersStr.split(",").map((s) => s.trim());
            if (trip) {
              updateAccount(trip, editTarget.id, {
                name,
                type: (values["type"] ?? editTarget.type) as AccountType,
                owners,
              });
              reloadTrip();
            }
            setEditTarget(null);
            setMode("list");
            setFocus("menu");
          }}
        />
      </Box>
    );
  }

  // --- Remove mode ---
  if (mode === "select-for-remove" && trip) {
    if (trip.accounts.length === 0) {
      setMode("list");
      setBorderColor(null);
      setFocus("menu");
      return <Text dimColor>No accounts to remove.</Text>;
    }
    return (
      <VerticalSelect
        options={trip.accounts.map((a) => ({
          label: a.name,
          value: a.id,
          detail: `(${a.type})`,
        }))}
        onChange={(value) => {
          removeAccount(trip, value);
          reloadTrip();
          if (trip.accounts.length === 0) {
            setMode("list");
            setBorderColor(null);
            setFocus("menu");
          }
        }}
        onCancel={() => {
          setMode("list");
          setBorderColor(null);
          setFocus("menu");
        }}
        color="red"
        isActive
      />
    );
  }

  // --- List mode ---
  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.accounts.length === 0) {
    return <Text dimColor>No accounts yet. Press [a] to add one.</Text>;
  }

  return (
    <VerticalSelect
      options={trip.accounts.map((a) => ({
        label: a.name,
        value: a.id,
        detail: `(${a.type})`,
      }))}
      onChange={(value) => {
        const account = trip.accounts.find((a) => a.id === value);
        if (account) {
          setEditTarget({
            id: account.id,
            name: account.name,
            type: account.type,
            owners: account.owners.join(", "),
          });
          setMode("edit");
          setFocus("main");
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

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: PASS (or fix with `bun run fix`)

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/AccountList.tsx
git commit -m "feat: AccountList matches Trips pattern — VerticalSelect, edit, persistent remove"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run type check**

Run: `bun run check:type`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 4: Auto-fix formatting**

Run: `bun run fix`

- [ ] **Step 5: Smoke test**

Run: `bun run start`
Verify:
1. Trips delete mode: delete a trip, stays in delete mode, list refreshes. Delete all trips → auto-exits to list. Press esc → exits delete mode.
2. Owners list: shows VerticalSelect with name (id) detail. Select owner → edit form with ID label + name field. Submit → updates name, returns to list.
3. Owners add: [a] → Form with name field. Submit → creates owner with auto-slug ID.
4. Owners remove: [x] → red border, VerticalSelect. Select → deletes, stays in remove mode. Esc → back to list.
5. Accounts list: shows VerticalSelect with name (type) detail. Select → edit form with ID label + name/type/owners. Submit → updates.
6. Accounts add: [a] → Form with name/type/owners. Submit → creates with auto-slug ID.
7. Accounts remove: same as owners remove pattern.

- [ ] **Step 6: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: address issues from list page pattern integration"
```
