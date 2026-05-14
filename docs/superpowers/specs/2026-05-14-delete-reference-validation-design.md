# Delete Reference Validation Design

## Problem

`removeOwner` and `removeAccount` only check that the target ID exists. They will happily delete an owner that an account or expense still references, or an account that an expense still references, leaving the trip in an invalid state (validators catch it later but the data is already on disk).

Deleting a referenced record must be blocked. The user needs an actionable path to clean up the references, not just an error message.

## Scope

- `removeOwner(trip, ownerId)` must refuse when the owner is referenced by any account or expense.
- `removeAccount(trip, accountId)` must refuse when the account is referenced by any expense.
- The TUI must surface a list of referencing records and let the user navigate to each one's edit screen to clear the reference. When the last reference is cleared, the original delete completes automatically.

Out of scope: cascade delete, bulk reference editing, web frontend wiring (the core helpers are shaped to be reusable but the only consumer in this change is the TUI).

## Approach

Two layers:

1. **Core** owns the rule. New pure helpers `findOwnerReferences` and `findAccountReferences` return the referencing records. `removeOwner` and `removeAccount` call the helper internally and throw if non-empty. The helper is exported so the UI can introspect references without catching errors as control flow.
2. **TUI** uses the helper to branch: empty references → delete immediately; non-empty → navigate to a new references screen that lists the offending records, lets the user open each for edit, reloads on return, and auto-completes the delete when the list becomes empty.

The service throw is defense in depth — every UI path pre-checks, but any future caller of `removeOwner`/`removeAccount` is still protected.

## Files

### Add

- `src/core/services/owner/findOwnerReferences.ts`
- `src/core/services/account/findAccountReferences.ts`
- `src/tui/screens/OwnerReferences.tsx`
- `src/tui/screens/AccountReferences.tsx`

### Modify

- `src/core/services/owner/removeOwner.ts` — call `findOwnerReferences`, throw on non-empty.
- `src/core/services/account/removeAccount.ts` — call `findAccountReferences`, throw on non-empty.
- `src/core/services/owner/index.ts` — re-export `findOwnerReferences` and its type.
- `src/core/services/account/index.ts` — re-export `findAccountReferences` and its type.
- `src/core/services/owner/__tests__/ownerService.test.ts` — extend with reference-blocking and `findOwnerReferences` tests.
- `src/core/services/account/__tests__/accountService.test.ts` — same for accounts.
- `src/tui/screens/OwnerList.tsx` — pre-check references in `RemoveSelector.onConfirm`; navigate to references screen if non-empty.
- `src/tui/screens/AccountList.tsx` — same.
- `src/tui/models/index.ts` — add `/trips/owners/references` and `/trips/accounts/references` entries to `RouteParams` so route props are typed.
- `src/tui/router.ts` — register the two new routes.

## Components

### Core helpers

```ts
// src/core/services/owner/findOwnerReferences.ts
export interface OwnerReferences {
  accounts: Account[];
  expenses: Expense[];
}

export function findOwnerReferences(trip: Trip, ownerId: string): OwnerReferences {
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

```ts
// src/core/services/account/findAccountReferences.ts
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

### Service guards

`removeOwner` and `removeAccount` keep their existing existence check, then call the helper and throw if any references remain:

```ts
// removeOwner.ts (after the existing index check)
const refs = findOwnerReferences(trip, ownerId);
if (refs.accounts.length + refs.expenses.length > 0) {
  throw new Error(
    `Owner "${ownerId}" is referenced by ${refs.accounts.length} account(s) and ${refs.expenses.length} expense(s)`,
  );
}
```

```ts
// removeAccount.ts
const refs = findAccountReferences(trip, accountId);
if (refs.expenses.length > 0) {
  throw new Error(
    `Account "${accountId}" is referenced by ${refs.expenses.length} expense(s)`,
  );
}
```

### TUI screens

**`OwnerReferences.tsx`**
- Route props: `{ tripDirPath, ownerId }`.
- On every render (driven by `trip` from `useData`), compute `refs = findOwnerReferences(trip, ownerId)`.
- If `refs.accounts.length + refs.expenses.length === 0`: call `removeOwner(trip, ownerId)`, `reloadTrip()`, `goBack()` (returns to OwnerList). Use `useEffect` so the side effect is scheduled, not run during render.
- Otherwise render:
  - `titleSuffix = "References: ${owner.name}"`.
  - Tabs `[1] Accounts (N)` `[2] Expenses (M)` when both lists are non-empty. Tab state is local `useState<"accounts" | "expenses">`, initialized to whichever has entries (accounts first). When the active tab becomes empty after a reload, auto-switch to the other tab.
  - Single `ListSelect` rendering the active tab's records.
  - Border color set red via `useLayout().setBorderColor("red")` in the screen's effect, matching the pattern used by `OwnerList`/`AccountList` in `selectMode === "remove"`.
  - Hints: `[1/2] switch tab`, `[↑↓] select`, `[Enter] edit`, `[q] back`.
- Selecting a row:
  - Account row → `goTo("/trips/accounts/edit", { props: { tripDirPath, accountId: a.id } })`.
  - Expense row → `goTo("/trips/expenses/edit", { props: { tripDirPath, expenseId: e.id } })`.
- `isActive` on the inner `ListSelect` is gated on `focus === "main"` (per CLAUDE.md keyboard rules).

**`AccountReferences.tsx`**
- Route props: `{ tripDirPath, accountId }`.
- Same auto-delete-on-empty logic with `findAccountReferences` and `removeAccount`.
- Single list of expenses, no tabs. Selecting goes to `/trips/expenses/edit`.

### List screen wiring

`OwnerList.tsx` (and symmetrically `AccountList.tsx`) changes only the remove-confirm branch:

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

### Route typing and registration

Add to `RouteParams` in `src/tui/models/index.ts`:

```ts
"/trips/owners/references": { tripDirPath: string; ownerId: string };
"/trips/accounts/references": { tripDirPath: string; accountId: string };
```

Register in `src/tui/router.ts` following the existing entry shape (no `borderColor` here — the screens set it dynamically):

```ts
"/trips/owners/references": {
  component: OwnerReferences as unknown as ComponentType,
  title: "References",
  defaultFocus: "main",
},
"/trips/accounts/references": {
  component: AccountReferences as unknown as ComponentType,
  title: "References",
  defaultFocus: "main",
},
```

Title breadcrumbs read `Trips > [tripName] > Owners > References` (and the `titleSuffix` from the screen appends `: [ownerName]`).

## Data flow

```
OwnerList: remove → select owner → Enter
  └─ findOwnerReferences(trip, ownerId)
       ├─ empty → removeOwner + reloadTrip + maybe goBack
       └─ non-empty → goTo /trips/owners/references

OwnerReferences mount / trip change
  └─ findOwnerReferences(trip, ownerId)
       ├─ empty → removeOwner + reloadTrip + goBack (→ OwnerList)
       └─ non-empty → render tabs + list
            └─ Enter on row → goTo edit screen
                 └─ Edit save → goBack (→ OwnerReferences, trip reloaded)
```

`AccountList` / `AccountReferences` follow the same shape with the single-list variant.

## Error handling

- The service-layer throw is the only error path. The UI pre-checks so the throw is unreachable from the TUI under normal use; if it ever fires (race, code change), the existing pattern of catching `Error` in form-style components could be applied, but the new screens don't catch — the throw would surface as a render error, which is the right loud failure for a broken invariant.
- The pre-check itself can't fail: `findOwnerReferences` and `findAccountReferences` are pure reads over `trip.accounts` / `trip.expenses`.

## Edge cases

- **Empty `expense.owners`.** Helper guards with `if (!e.owners) return false`.
- **Mixed `expense.owners` shapes.** Helper handles both `string[]` and `ExpenseOwnerSplit[]` via the `typeof` branch.
- **Tab becomes empty during cleanup.** When the user clears all accounts but expenses remain, auto-switch the active tab on the next reload so the user sees the remaining work.
- **User cancels with `[q]`.** Standard `goBack` returns to OwnerList/AccountList. Nothing is written. The owner/account is left in place with its references intact.
- **Owner/account ID not found at screen mount.** Should not happen (we just came from the list), but guarded by the helper returning empty refs → the auto-delete branch will call `removeOwner`/`removeAccount`, which throws "not found". Accept the loud failure; no defensive UI.
- **`isActive` gating on the list.** Required to avoid the double-fire described in CLAUDE.md's Default Layout notes.

## Testing

Bun tests in the existing `__tests__/ownerService.test.ts` and `accountService.test.ts`, following the in-file fixture pattern.

**`findOwnerReferences`**
- returns `{ accounts: [], expenses: [] }` for an unreferenced owner
- finds owner referenced by an account's `owners` array
- finds owner referenced by an expense with `owners: string[]`
- finds owner referenced by an expense with `owners: ExpenseOwnerSplit[]`
- returns both accounts and expenses when both reference the owner

**`removeOwner`**
- existing "removes when no references" test stays green
- existing "throws when not found" test stays green
- throws when an account references the owner (message includes the counts)
- throws when an expense references the owner

**`findAccountReferences`**
- returns `{ expenses: [] }` for an unreferenced account
- finds account referenced by `expense.accountId`

**`removeAccount`**
- existing tests stay green
- throws when an expense references the account

No TUI tests — there is no TUI test infra in the repo and the new screens are thin compositions of already-tested primitives (`ListSelect`, navigation, `useData`).

## Build sequence

1. `findOwnerReferences.ts` + `findAccountReferences.ts`, exported from each service `index.ts`. Add helper tests.
2. Update `removeOwner.ts` + `removeAccount.ts` to throw on references; extend existing tests.
3. Add `OwnerReferences.tsx` and `AccountReferences.tsx`.
4. Register routes in `tui/router.ts`.
5. Wire the pre-check + navigation into `OwnerList.tsx` and `AccountList.tsx` remove-confirm handlers.
6. Verify: `bun run check:type`, `bun run check`, `bun test`.
