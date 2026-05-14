# Delete Reference Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block deletion of an owner or account that is still referenced by any account or expense, and give the TUI user a screen that lists the referencing records and auto-completes the delete once every reference is cleared.

**Architecture:** Two pure helpers in `core/services` introspect references. `removeOwner`/`removeAccount` call those helpers and throw if non-empty (defense in depth). The TUI calls the helpers proactively from the remove-confirm flow: empty → delete now; non-empty → navigate to a new `OwnerReferences` / `AccountReferences` screen that lists referring accounts/expenses, opens each for editing, and auto-deletes once references are empty.

**Tech Stack:** TypeScript, Bun runtime, Bun's built-in test runner, React + Ink TUI.

---

## File map

**Create**
- `src/core/services/owner/findOwnerReferences.ts` — pure helper, returns `{ accounts, expenses }` referencing an owner.
- `src/core/services/account/findAccountReferences.ts` — pure helper, returns `{ expenses }` referencing an account.
- `src/tui/screens/OwnerReferences.tsx` — references screen for an owner (tabs when both accounts and expenses refer; auto-delete on empty).
- `src/tui/screens/AccountReferences.tsx` — references screen for an account (single expenses list; auto-delete on empty).

**Modify**
- `src/core/services/owner/removeOwner.ts` — call `findOwnerReferences` after the existence check; throw if any references.
- `src/core/services/account/removeAccount.ts` — call `findAccountReferences` after the existence check; throw if any references.
- `src/core/services/owner/index.ts` — re-export `findOwnerReferences` and `OwnerReferences` type.
- `src/core/services/account/index.ts` — re-export `findAccountReferences` and `AccountReferences` type.
- `src/core/services/owner/__tests__/ownerService.test.ts` — add helper tests and reference-blocking remove tests; expand fixture setup to allow accounts/expenses.
- `src/core/services/account/__tests__/accountService.test.ts` — add helper tests and reference-blocking remove test.
- `src/tui/models/index.ts` — add typed entries for `/trips/owners/references` and `/trips/accounts/references` in `RouteParams`.
- `src/tui/router.ts` — register the two new routes.
- `src/tui/screens/OwnerList.tsx` — pre-check references in remove-confirm; navigate to references screen when non-empty.
- `src/tui/screens/AccountList.tsx` — same.

---

## Task 1: `findOwnerReferences` helper

**Files:**
- Create: `src/core/services/owner/findOwnerReferences.ts`
- Test: `src/core/services/owner/__tests__/ownerService.test.ts` (extend in place)

- [ ] **Step 1.1: Extend the existing test fixture so it can include accounts and expenses**

Edit `src/core/services/owner/__tests__/ownerService.test.ts`. Replace the entire `setupTrip` function and update the imports near the top of the file.

Update imports at the top (add `findOwnerReferences` import and shared model types). The full top-of-file should become:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Account, Expense, Settings } from "../../../models";
import { loadTrip } from "../../trip/loadTrip";
import { addOwner } from "../addOwner";
import { findOwnerReferences } from "../findOwnerReferences";
import { getOwners } from "../getOwners";
import { removeOwner } from "../removeOwner";
```

Replace the existing `setupTrip` function with this version that accepts optional accounts and expenses:

```ts
interface SetupOptions {
  accounts?: Account[];
  expenses?: Expense[];
}

function setupTrip(opts: SetupOptions = {}) {
  const tripDir = join(TEST_DIR, "test-trip");
  mkdirSync(tripDir, { recursive: true });
  writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
  writeFileSync(
    join(tripDir, "owners.yaml"),
    stringify({ owners: [{ id: "alice", name: "Alice" }] }),
  );
  writeFileSync(
    join(tripDir, "accounts.yaml"),
    stringify({ accounts: opts.accounts ?? [] }),
  );
  writeFileSync(
    join(tripDir, "expenses.yaml"),
    stringify({ expenses: opts.expenses ?? [] }),
  );
  return tripDir;
}
```

The existing tests called `setupTrip()` with no arguments and that still works — they'll keep passing.

- [ ] **Step 1.2: Write the failing tests for `findOwnerReferences`**

Append this block to the end of `src/core/services/owner/__tests__/ownerService.test.ts`:

```ts
describe("findOwnerReferences", () => {
  test("returns empty arrays when owner is unreferenced", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(findOwnerReferences(trip, "alice")).toEqual({
      accounts: [],
      expenses: [],
    });
  });

  test("finds owner referenced by an account", () => {
    const tripDir = setupTrip({
      accounts: [
        { id: "a1", name: "Visa", type: "Credit", owners: ["alice"] } as Account,
      ],
    });
    const trip = loadTrip(tripDir);
    const refs = findOwnerReferences(trip, "alice");
    expect(refs.accounts).toHaveLength(1);
    expect(refs.accounts[0]?.id).toBe("a1");
    expect(refs.expenses).toEqual([]);
  });

  test("finds owner referenced by an expense with string owners", () => {
    const tripDir = setupTrip({
      expenses: [
        {
          id: "e1",
          accountId: "x",
          date: "2026-01-01",
          payee: "Cafe",
          category: "Food",
          amount: 100,
          currency: "THB",
          owners: ["alice"],
          description: "",
          tags: [],
        },
      ],
    });
    const trip = loadTrip(tripDir);
    const refs = findOwnerReferences(trip, "alice");
    expect(refs.accounts).toEqual([]);
    expect(refs.expenses).toHaveLength(1);
    expect(refs.expenses[0]?.id).toBe("e1");
  });

  test("finds owner referenced by an expense with split owners", () => {
    const tripDir = setupTrip({
      expenses: [
        {
          id: "e2",
          accountId: "x",
          date: "2026-01-01",
          payee: "Cafe",
          category: "Food",
          amount: 100,
          currency: "THB",
          owners: [{ id: "alice", split: "50%" }],
          description: "",
          tags: [],
        },
      ],
    });
    const trip = loadTrip(tripDir);
    const refs = findOwnerReferences(trip, "alice");
    expect(refs.expenses).toHaveLength(1);
    expect(refs.expenses[0]?.id).toBe("e2");
  });

  test("returns both accounts and expenses when both reference the owner", () => {
    const tripDir = setupTrip({
      accounts: [
        { id: "a1", name: "Visa", type: "Credit", owners: ["alice"] } as Account,
      ],
      expenses: [
        {
          id: "e1",
          accountId: "a1",
          date: "2026-01-01",
          payee: "Cafe",
          category: "Food",
          amount: 100,
          currency: "THB",
          owners: ["alice"],
          description: "",
          tags: [],
        },
      ],
    });
    const trip = loadTrip(tripDir);
    const refs = findOwnerReferences(trip, "alice");
    expect(refs.accounts).toHaveLength(1);
    expect(refs.expenses).toHaveLength(1);
  });

  test("returns empty when owner does not exist", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(findOwnerReferences(trip, "nobody")).toEqual({
      accounts: [],
      expenses: [],
    });
  });
});
```

- [ ] **Step 1.3: Run tests to verify they fail**

Run: `bun test src/core/services/owner/__tests__/ownerService.test.ts`

Expected: 6 new tests fail with `Cannot find module './findOwnerReferences'` (or equivalent). Existing tests still pass.

- [ ] **Step 1.4: Implement `findOwnerReferences`**

Create `src/core/services/owner/findOwnerReferences.ts`:

```ts
import type { Account, Expense, Trip } from "../../models";

export interface OwnerReferences {
  accounts: Account[];
  expenses: Expense[];
}

export function findOwnerReferences(
  trip: Trip,
  ownerId: string,
): OwnerReferences {
  const accounts = trip.accounts.filter((a) => a.owners.includes(ownerId));
  const expenses = trip.expenses.filter((e) => {
    if (!e.owners) return false;
    return e.owners.some((o) =>
      typeof o === "string" ? o === ownerId : o.id === ownerId,
    );
  });
  return { accounts, expenses };
}
```

- [ ] **Step 1.5: Re-export from the service barrel**

Edit `src/core/services/owner/index.ts`. The final file should be:

```ts
export { addOwner } from "./addOwner";
export type { OwnerReferences } from "./findOwnerReferences";
export { findOwnerReferences } from "./findOwnerReferences";
export { getOwners } from "./getOwners";
export { removeOwner } from "./removeOwner";
export { updateOwner } from "./updateOwner";
```

- [ ] **Step 1.6: Run tests to verify they pass**

Run: `bun test src/core/services/owner/__tests__/ownerService.test.ts`

Expected: all tests pass (original tests + 6 new `findOwnerReferences` tests).

- [ ] **Step 1.7: Commit**

```bash
git add src/core/services/owner/findOwnerReferences.ts src/core/services/owner/index.ts src/core/services/owner/__tests__/ownerService.test.ts
git commit -m "feat(core): add findOwnerReferences helper"
```

---

## Task 2: `findAccountReferences` helper

**Files:**
- Create: `src/core/services/account/findAccountReferences.ts`
- Test: `src/core/services/account/__tests__/accountService.test.ts` (extend in place)

- [ ] **Step 2.1: Extend the existing fixture so tests can seed expenses**

Edit `src/core/services/account/__tests__/accountService.test.ts`. Update the imports at the top to add `Expense` and `findAccountReferences`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Expense, Settings } from "../../../models";
import { AccountType } from "../../../models";
import { loadTrip } from "../../trip/loadTrip";
import { addAccount } from "../addAccount";
import { findAccountReferences } from "../findAccountReferences";
import { getAccounts } from "../getAccounts";
import { removeAccount } from "../removeAccount";
import { updateAccount } from "../updateAccount";
```

Replace `setupTrip` with this version (the existing call sites `setupTrip()` still pass since the new parameter is optional):

```ts
interface SetupOptions {
  expenses?: Expense[];
}

function setupTrip(opts: SetupOptions = {}) {
  const tripDir = join(TEST_DIR, "test-trip");
  mkdirSync(tripDir, { recursive: true });
  writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
  writeFileSync(
    join(tripDir, "owners.yaml"),
    stringify({ owners: [{ id: "alice", name: "Alice" }] }),
  );
  writeFileSync(
    join(tripDir, "accounts.yaml"),
    stringify({
      accounts: [{ id: "a1", name: "Visa", type: "Credit", owners: ["alice"] }],
    }),
  );
  writeFileSync(
    join(tripDir, "expenses.yaml"),
    stringify({ expenses: opts.expenses ?? [] }),
  );
  return tripDir;
}
```

- [ ] **Step 2.2: Write the failing tests for `findAccountReferences`**

Append to the end of `src/core/services/account/__tests__/accountService.test.ts`:

```ts
describe("findAccountReferences", () => {
  test("returns empty expenses when account is unreferenced", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(findAccountReferences(trip, "a1")).toEqual({ expenses: [] });
  });

  test("finds account referenced by an expense", () => {
    const tripDir = setupTrip({
      expenses: [
        {
          id: "e1",
          accountId: "a1",
          date: "2026-01-01",
          payee: "Cafe",
          category: "Food",
          amount: 100,
          currency: "THB",
          owners: ["alice"],
          description: "",
          tags: [],
        },
      ],
    });
    const trip = loadTrip(tripDir);
    const refs = findAccountReferences(trip, "a1");
    expect(refs.expenses).toHaveLength(1);
    expect(refs.expenses[0]?.id).toBe("e1");
  });

  test("returns empty when account does not exist", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(findAccountReferences(trip, "nobody")).toEqual({ expenses: [] });
  });
});
```

- [ ] **Step 2.3: Run tests to verify they fail**

Run: `bun test src/core/services/account/__tests__/accountService.test.ts`

Expected: 3 new tests fail with module-not-found. Existing tests pass.

- [ ] **Step 2.4: Implement `findAccountReferences`**

Create `src/core/services/account/findAccountReferences.ts`:

```ts
import type { Expense, Trip } from "../../models";

export interface AccountReferences {
  expenses: Expense[];
}

export function findAccountReferences(
  trip: Trip,
  accountId: string,
): AccountReferences {
  return {
    expenses: trip.expenses.filter((e) => e.accountId === accountId),
  };
}
```

- [ ] **Step 2.5: Re-export from the service barrel**

Edit `src/core/services/account/index.ts`. The final file should be:

```ts
export { addAccount } from "./addAccount";
export type { AccountReferences } from "./findAccountReferences";
export { findAccountReferences } from "./findAccountReferences";
export { getAccounts } from "./getAccounts";
export { removeAccount } from "./removeAccount";
export { updateAccount } from "./updateAccount";
```

- [ ] **Step 2.6: Run tests to verify they pass**

Run: `bun test src/core/services/account/__tests__/accountService.test.ts`

Expected: all tests pass.

- [ ] **Step 2.7: Commit**

```bash
git add src/core/services/account/findAccountReferences.ts src/core/services/account/index.ts src/core/services/account/__tests__/accountService.test.ts
git commit -m "feat(core): add findAccountReferences helper"
```

---

## Task 3: Block `removeOwner` when references exist

**Files:**
- Modify: `src/core/services/owner/removeOwner.ts`
- Test: `src/core/services/owner/__tests__/ownerService.test.ts` (extend the existing `describe("removeOwner")` block)

- [ ] **Step 3.1: Write the failing tests for the new guard**

Open `src/core/services/owner/__tests__/ownerService.test.ts` and locate the existing `describe("removeOwner", ...)` block. Add these two tests inside it (alongside the existing two):

```ts
test("throws when an account references the owner", () => {
  const tripDir = setupTrip({
    accounts: [
      { id: "a1", name: "Visa", type: "Credit", owners: ["alice"] } as Account,
    ],
  });
  const trip = loadTrip(tripDir);
  expect(() => removeOwner(trip, "alice")).toThrow(
    'Owner "alice" is referenced by 1 account(s) and 0 expense(s)',
  );

  const reloaded = loadTrip(tripDir);
  expect(reloaded.owners).toHaveLength(1);
});

test("throws when an expense references the owner", () => {
  const tripDir = setupTrip({
    expenses: [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-01-01",
        payee: "Cafe",
        category: "Food",
        amount: 100,
        currency: "THB",
        owners: ["alice"],
        description: "",
        tags: [],
      },
    ],
  });
  const trip = loadTrip(tripDir);
  expect(() => removeOwner(trip, "alice")).toThrow(
    'Owner "alice" is referenced by 0 account(s) and 1 expense(s)',
  );

  const reloaded = loadTrip(tripDir);
  expect(reloaded.owners).toHaveLength(1);
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `bun test src/core/services/owner/__tests__/ownerService.test.ts`

Expected: both new tests fail — the current `removeOwner` removes the owner regardless of references, so the throw assertion fails and the reloaded owners count is `0` instead of `1`.

- [ ] **Step 3.3: Add the reference check to `removeOwner`**

Edit `src/core/services/owner/removeOwner.ts`. Replace the entire file with:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { findOwnerReferences } from "./findOwnerReferences";

export function removeOwner(trip: Trip, ownerId: string): void {
  const index = trip.owners.findIndex((o) => o.id === ownerId);
  if (index === -1) {
    throw new Error(`Owner with id "${ownerId}" not found`);
  }

  const refs = findOwnerReferences(trip, ownerId);
  if (refs.accounts.length + refs.expenses.length > 0) {
    throw new Error(
      `Owner "${ownerId}" is referenced by ${refs.accounts.length} account(s) and ${refs.expenses.length} expense(s)`,
    );
  }

  const filePath = join(trip.dirPath, "owners.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.owners.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.owners.splice(index, 1);
}
```

- [ ] **Step 3.4: Run tests to verify all owner tests pass**

Run: `bun test src/core/services/owner/__tests__/ownerService.test.ts`

Expected: all tests pass — the two new reference-blocking tests, plus the original "removes when no references" and "throws when not found" tests.

- [ ] **Step 3.5: Commit**

```bash
git add src/core/services/owner/removeOwner.ts src/core/services/owner/__tests__/ownerService.test.ts
git commit -m "feat(core): block removeOwner when references exist"
```

---

## Task 4: Block `removeAccount` when references exist

**Files:**
- Modify: `src/core/services/account/removeAccount.ts`
- Test: `src/core/services/account/__tests__/accountService.test.ts` (extend the existing `describe("removeAccount")` block)

- [ ] **Step 4.1: Write the failing test for the new guard**

Open `src/core/services/account/__tests__/accountService.test.ts` and locate the existing `describe("removeAccount", ...)` block. Add this test inside it (alongside the existing one):

```ts
test("throws when an expense references the account", () => {
  const tripDir = setupTrip({
    expenses: [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-01-01",
        payee: "Cafe",
        category: "Food",
        amount: 100,
        currency: "THB",
        owners: ["alice"],
        description: "",
        tags: [],
      },
    ],
  });
  const trip = loadTrip(tripDir);
  expect(() => removeAccount(trip, "a1")).toThrow(
    'Account "a1" is referenced by 1 expense(s)',
  );

  const reloaded = loadTrip(tripDir);
  expect(reloaded.accounts).toHaveLength(1);
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `bun test src/core/services/account/__tests__/accountService.test.ts`

Expected: the new test fails — `removeAccount` currently removes the account regardless of expense references.

- [ ] **Step 4.3: Add the reference check to `removeAccount`**

Edit `src/core/services/account/removeAccount.ts`. Replace the entire file with:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { findAccountReferences } from "./findAccountReferences";

export function removeAccount(trip: Trip, accountId: string): void {
  const index = trip.accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    throw new Error(`Account with id "${accountId}" not found`);
  }

  const refs = findAccountReferences(trip, accountId);
  if (refs.expenses.length > 0) {
    throw new Error(
      `Account "${accountId}" is referenced by ${refs.expenses.length} expense(s)`,
    );
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.accounts.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.accounts.splice(index, 1);
}
```

- [ ] **Step 4.4: Run tests to verify all account tests pass**

Run: `bun test src/core/services/account/__tests__/accountService.test.ts`

Expected: all tests pass.

- [ ] **Step 4.5: Run the entire test suite to be sure nothing else broke**

Run: `bun test`

Expected: all tests across the repo pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/core/services/account/removeAccount.ts src/core/services/account/__tests__/accountService.test.ts
git commit -m "feat(core): block removeAccount when references exist"
```

---

## Task 5: Add typed route params for the new screens

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 5.1: Add the two new entries to `RouteParams`**

Edit `src/tui/models/index.ts`. Inside the `RouteParams` interface, find the line:

```ts
  "/trips/owners/edit": { tripDirPath: string; ownerId: string };
```

Insert immediately after it:

```ts
  "/trips/owners/references": { tripDirPath: string; ownerId: string };
```

Then find:

```ts
  "/trips/accounts/edit": { tripDirPath: string; accountId: string };
```

Insert immediately after it:

```ts
  "/trips/accounts/references": { tripDirPath: string; accountId: string };
```

- [ ] **Step 5.2: Run the type checker to verify the new keys parse**

Run: `bun run check:type`

Expected: type errors only about `routes` in `src/tui/router.ts` missing the two new keys (because `Routes = { [P in RoutePath]: RouteConfig<P> }` makes every `RoutePath` required). That confirms the new keys are wired into the type. We'll satisfy them in Task 8.

Do NOT commit yet — we want the router to compile first.

---

## Task 6: `OwnerReferences` screen

**Files:**
- Create: `src/tui/screens/OwnerReferences.tsx`

This screen is plain TypeScript/Ink composition. There's no TUI test infrastructure in the repo; verification is by running the app at the end of the plan.

- [ ] **Step 6.1: Create the screen file**

Create `src/tui/screens/OwnerReferences.tsx` with this exact content:

```tsx
import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  findOwnerReferences,
  removeOwner,
} from "../../core/services/owner";
import { ListSelect } from "../components/molecules/ListSelect";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function OwnerReferences(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
  const { goTo, goBack } = useNavigation();

  const { tripDirPath, ownerId } = useRouteProps("/trips/owners/references");

  const refs = useMemo(() => {
    if (!trip) return { accounts: [], expenses: [] };
    return findOwnerReferences(trip, ownerId);
  }, [trip, ownerId]);

  const hasAccounts = refs.accounts.length > 0;
  const hasExpenses = refs.expenses.length > 0;
  const isEmpty = !hasAccounts && !hasExpenses;

  const [activeTab, setActiveTab] = useState<"accounts" | "expenses">(
    hasAccounts ? "accounts" : "expenses",
  );

  useEffect(() => {
    if (activeTab === "accounts" && !hasAccounts && hasExpenses) {
      setActiveTab("expenses");
    } else if (activeTab === "expenses" && !hasExpenses && hasAccounts) {
      setActiveTab("accounts");
    }
  }, [activeTab, hasAccounts, hasExpenses]);

  const deletedRef = useRef(false);
  useEffect(() => {
    if (!trip) return;
    if (deletedRef.current) return;
    if (!isEmpty) return;
    deletedRef.current = true;
    removeOwner(trip, ownerId);
    reloadTrip();
    goBack();
  }, [trip, ownerId, isEmpty, reloadTrip, goBack]);

  const owner = trip?.owners.find((o) => o.id === ownerId);

  useEffect(() => {
    setBorderColor("red");
    setMenu([], () => {});
    setHints([
      { key: "1/2", label: "Switch tab" },
      { key: "↑↓", label: "Navigate" },
      { key: "Enter", label: "Edit" },
      { key: "q/esc", label: "Back" },
      { key: "e", label: "Exit" },
    ]);
    setTitleSuffix(
      owner ? `References: ${owner.name}` : `References: ${ownerId}`,
    );
    return () => {
      setBorderColor(null);
      setTitleSuffix(null);
    };
  }, [setBorderColor, setMenu, setHints, setTitleSuffix, owner, ownerId]);

  useInput((input) => {
    if (focus === "input") return;
    if (input === "1" && hasAccounts) {
      setActiveTab("accounts");
    } else if (input === "2" && hasExpenses) {
      setActiveTab("expenses");
    }
  });

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (isEmpty) {
    return <Text dimColor>Removing...</Text>;
  }

  const tabsLine =
    hasAccounts && hasExpenses ? (
      <Box>
        <Text bold={activeTab === "accounts"} inverse={activeTab === "accounts"}>
          {" [1] Accounts ("}
          {refs.accounts.length}
          {") "}
        </Text>
        <Text> </Text>
        <Text bold={activeTab === "expenses"} inverse={activeTab === "expenses"}>
          {" [2] Expenses ("}
          {refs.expenses.length}
          {") "}
        </Text>
      </Box>
    ) : null;

  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        Cannot delete owner — clear the references below first:
      </Text>
      {tabsLine}
      {activeTab === "accounts" && hasAccounts ? (
        <ListSelect
          options={refs.accounts.map((a) => ({
            label: a.name,
            value: a.id,
            detail: `(${a.type})`,
          }))}
          onChange={(accountId) => {
            goTo("/trips/accounts/edit", {
              props: { tripDirPath, accountId },
            });
          }}
          isActive={focus === "main"}
        />
      ) : null}
      {activeTab === "expenses" && hasExpenses ? (
        <ListSelect
          options={refs.expenses.map((e) => ({
            label: `${e.date} ${e.payee}`,
            value: e.id,
            detail: `(${e.amount} ${e.currency})`,
          }))}
          onChange={(expenseId) => {
            goTo("/trips/expenses/form", {
              props: { tripDirPath, expenseId },
            });
          }}
          isActive={focus === "main"}
        />
      ) : null}
    </Box>
  );
}
```

Notes for the engineer:
- The `deletedRef` guard prevents re-entry if React re-renders the screen between `goBack()` scheduling and unmount.
- The auto-delete effect runs whenever `trip` changes (so when an edit screen calls `reloadTrip()` and returns, we re-check).
- `isActive={focus === "main"}` on the `ListSelect` is required per CLAUDE.md so Enter doesn't double-fire when focus is on the menu.
- Edit route for expenses is `/trips/expenses/form` with `expenseId` prop (this is how the existing codebase opens an expense for editing — see `RouteParams["/trips/expenses/form"]` in `src/tui/models/index.ts`).
- `useInput` from ink is the same hook `useGlobalKeys` uses; per-screen input listeners coexist with the global one.

- [ ] **Step 6.2: Type-check the new file**

Run: `bun run check:type`

Expected: still failing on the missing router entries (Task 8 will add them), but no errors inside `OwnerReferences.tsx` itself. Visually scan the output to confirm.

Do NOT commit yet — we'll commit screens + router together so the tree is always compilable on a checkout.

---

## Task 7: `AccountReferences` screen

**Files:**
- Create: `src/tui/screens/AccountReferences.tsx`

- [ ] **Step 7.1: Create the screen file**

Create `src/tui/screens/AccountReferences.tsx` with this exact content:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  findAccountReferences,
  removeAccount,
} from "../../core/services/account";
import { ListSelect } from "../components/molecules/ListSelect";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountReferences(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
  const { goTo, goBack } = useNavigation();

  const { tripDirPath, accountId } = useRouteProps("/trips/accounts/references");

  const refs = useMemo(() => {
    if (!trip) return { expenses: [] };
    return findAccountReferences(trip, accountId);
  }, [trip, accountId]);

  const isEmpty = refs.expenses.length === 0;

  const deletedRef = useRef(false);
  useEffect(() => {
    if (!trip) return;
    if (deletedRef.current) return;
    if (!isEmpty) return;
    deletedRef.current = true;
    removeAccount(trip, accountId);
    reloadTrip();
    goBack();
  }, [trip, accountId, isEmpty, reloadTrip, goBack]);

  const account = trip?.accounts.find((a) => a.id === accountId);

  useEffect(() => {
    setBorderColor("red");
    setMenu([], () => {});
    setHints([
      { key: "↑↓", label: "Navigate" },
      { key: "Enter", label: "Edit" },
      { key: "q/esc", label: "Back" },
      { key: "e", label: "Exit" },
    ]);
    setTitleSuffix(
      account ? `References: ${account.name}` : `References: ${accountId}`,
    );
    return () => {
      setBorderColor(null);
      setTitleSuffix(null);
    };
  }, [setBorderColor, setMenu, setHints, setTitleSuffix, account, accountId]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (isEmpty) {
    return <Text dimColor>Removing...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        Cannot delete account — clear the expenses below first:
      </Text>
      <ListSelect
        options={refs.expenses.map((e) => ({
          label: `${e.date} ${e.payee}`,
          value: e.id,
          detail: `(${e.amount} ${e.currency})`,
        }))}
        onChange={(expenseId) => {
          goTo("/trips/expenses/form", {
            props: { tripDirPath, expenseId },
          });
        }}
        isActive={focus === "main"}
      />
    </Box>
  );
}
```

- [ ] **Step 7.2: Type-check**

Run: `bun run check:type`

Expected: still complaining about missing router entries (next task fixes it); no errors inside `AccountReferences.tsx`.

---

## Task 8: Register the new routes

**Files:**
- Modify: `src/tui/router.ts`

- [ ] **Step 8.1: Add the imports**

Edit `src/tui/router.ts`. Find the import line:

```ts
import { AccountList } from "./screens/AccountList";
```

Insert immediately after it:

```ts
import { AccountReferences } from "./screens/AccountReferences";
```

Find:

```ts
import { OwnerList } from "./screens/OwnerList";
```

Insert immediately after it:

```ts
import { OwnerReferences } from "./screens/OwnerReferences";
```

- [ ] **Step 8.2: Register the two route entries**

Still in `src/tui/router.ts`. Find this entry:

```ts
"/trips/owners/edit": {
  component: OwnerEdit as unknown as ComponentType,
  title: "Owner",
  defaultFocus: "main",
},
```

Insert immediately after the closing `},`:

```ts
"/trips/owners/references": {
  component: OwnerReferences as unknown as ComponentType,
  title: "References",
  defaultFocus: "main",
},
```

Find this entry:

```ts
"/trips/accounts/edit": {
  component: AccountEdit as unknown as ComponentType,
  title: "Account",
  defaultFocus: "main",
},
```

Insert immediately after the closing `},`:

```ts
"/trips/accounts/references": {
  component: AccountReferences as unknown as ComponentType,
  title: "References",
  defaultFocus: "main",
},
```

- [ ] **Step 8.3: Type-check the whole project**

Run: `bun run check:type`

Expected: clean pass — no errors.

- [ ] **Step 8.4: Commit the route-typing + screens + router together**

```bash
git add src/tui/models/index.ts src/tui/router.ts src/tui/screens/OwnerReferences.tsx src/tui/screens/AccountReferences.tsx
git commit -m "feat(tui): add owner and account references screens"
```

---

## Task 9: Pre-check references in `OwnerList`

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`

- [ ] **Step 9.1: Update the imports**

Edit `src/tui/screens/OwnerList.tsx`. Replace this line:

```ts
import { removeOwner } from "../../core/services/owner";
```

with:

```ts
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
```

- [ ] **Step 9.2: Replace the `onConfirm` handler**

Still in `src/tui/screens/OwnerList.tsx`. Find this block (inside the `<RemoveSelector ... />` JSX):

```tsx
onConfirm={(value) => {
  removeOwner(trip, value);
  reloadTrip();
  if (trip.owners.length === 0) {
    goBack();
  }
}}
```

Replace it with:

```tsx
onConfirm={(value) => {
  const refs = findOwnerReferences(trip, value);
  if (refs.accounts.length === 0 && refs.expenses.length === 0) {
    removeOwner(trip, value);
    reloadTrip();
    if (trip.owners.length === 0) {
      goBack();
    }
    return;
  }
  goTo("/trips/owners/references", {
    props: { tripDirPath: trip.dirPath, ownerId: value },
  });
}}
```

- [ ] **Step 9.3: Type-check**

Run: `bun run check:type`

Expected: clean.

---

## Task 10: Pre-check references in `AccountList`

**Files:**
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 10.1: Update the imports**

Edit `src/tui/screens/AccountList.tsx`. Replace this line:

```ts
import { removeAccount } from "../../core/services/account";
```

with:

```ts
import { findAccountReferences, removeAccount } from "../../core/services/account";
```

- [ ] **Step 10.2: Replace the `onConfirm` handler**

Still in `src/tui/screens/AccountList.tsx`. Find:

```tsx
onConfirm={(value) => {
  removeAccount(trip, value);
  reloadTrip();
  if (trip.accounts.length === 0) {
    goBack();
  }
}}
```

Replace it with:

```tsx
onConfirm={(value) => {
  const refs = findAccountReferences(trip, value);
  if (refs.expenses.length === 0) {
    removeAccount(trip, value);
    reloadTrip();
    if (trip.accounts.length === 0) {
      goBack();
    }
    return;
  }
  goTo("/trips/accounts/references", {
    props: { tripDirPath: trip.dirPath, accountId: value },
  });
}}
```

- [ ] **Step 10.3: Type-check**

Run: `bun run check:type`

Expected: clean.

- [ ] **Step 10.4: Commit**

```bash
git add src/tui/screens/OwnerList.tsx src/tui/screens/AccountList.tsx
git commit -m "feat(tui): route owner/account delete through references screen"
```

---

## Task 11: Final verification

**Files:** none modified.

- [ ] **Step 11.1: Run the full test suite**

Run: `bun test`

Expected: all tests pass.

- [ ] **Step 11.2: Run the type checker**

Run: `bun run check:type`

Expected: clean.

- [ ] **Step 11.3: Run the linter / formatter check**

Run: `bun run check`

Expected: clean. If Biome reports any auto-fixable issues, run `bun run fix`, inspect the diff, and amend the relevant commit (or add a follow-up commit if multiple commits are affected).

- [ ] **Step 11.4: Manual smoke test in the TUI**

Start the app against a test trip directory that has at least one owner referenced by an account and an expense.

Run: `bun run start --data-dir ./data`

Walk through these flows:
1. Navigate to a trip → Owners → press `[x]` → select an owner with no references → confirm. Expect the owner to be removed and the list to reflect it.
2. Navigate to a trip → Owners → press `[x]` → select a referenced owner → confirm. Expect to land on the references screen with red border, title "Owners > References: [name]", and the appropriate list (or tabs).
3. From the references screen, press `[1]` and `[2]` to switch tabs (only when both accounts and expenses are present). Press Enter on an account row — expect to land on the account edit screen.
4. Edit the account to remove the owner, save, and return. Expect the references screen to refresh with one fewer entry. Repeat until empty; expect auto-delete to fire and the screen to pop back to the owner list with the owner gone.
5. Repeat the same flow for an account that's referenced by an expense, using `/trips/accounts/references`.
6. From the references screen, press `[q]`. Expect to land back on the owner/account list with the original owner/account still present.

If any flow misbehaves, the most likely culprits are the `useEffect` dep arrays and the `deletedRef` guard — re-read Task 6/7 carefully.

- [ ] **Step 11.5: No additional commit needed**

Verification only — no source changes. If `bun run fix` introduced changes, they should be committed with a focused message in the affected task's commit (amend) or as `chore: apply biome formatting`.

---

## Self-review notes

Spec coverage: every spec section is exercised by tasks above — helpers (1, 2), service guards (3, 4), route typing (5), screens (6, 7), router (8), list wiring (9, 10), verification (11). Tab auto-switch edge case is implemented in Task 6 Step 6.1. Empty `expense.owners` and mixed-shape owners are covered by Task 1 helper code and exercised by Step 1.2 tests. `[q]` cancel is covered by the global `useGlobalKeys` hook and validated in Step 11.4 flow 6.

Type / name consistency: `OwnerReferences` and `AccountReferences` are used as both screen names and helper return-type names. The screen imports `findOwnerReferences` / `findAccountReferences` and the types are not imported by name in the screens (they're inferred from the helper return type), so there's no shadow-naming bug.
