# List Page Pattern Design Spec

## Overview

Standardize Owners and Accounts pages to follow the same design pattern as the Trips page: selectable list via VerticalSelect, generic menu actions (Add, Remove), edit on select, and persistent remove mode with red border.

Also update Trips page: delete mode stays in delete mode after each deletion, `[esc]` exits delete mode.

## Shared Pattern

All three pages (Trips, Owners, Accounts) follow the same mode structure:

### Modes

| Mode | Behavior |
|---|---|
| `list` | VerticalSelect showing items, menu visible |
| `add` | Form (empty fields), submit creates item |
| `edit` | Form (pre-filled), submit updates item. Owners/Accounts only. |
| `select-for-remove` | Red border, VerticalSelect, immediate delete on select, stays in remove mode (list refreshes), `[esc]` exits to list |

Trips has additional modes:
- `select-for-duplicate` — VerticalSelect to pick source trip
- `duplicate` — Form for new name, submit creates duplicate and navigates to new trip's menu

### Menu Items

- Trips: `[c]` Create, `[d]` Duplicate, `[x]` Delete
- Owners: `[a]` Add, `[x]` Remove
- Accounts: `[a]` Add, `[x]` Remove

### List Item Display

- Trips: name, detail = `(startDate — endDate)`
- Owners: name, detail = `(id)`
- Accounts: name, detail = `(type)`

### Select from List → Edit

Owners and Accounts: selecting an item in list mode enters `edit` mode with a pre-filled Form. The auto-generated ID is shown as a read-only label above the form (not editable — changing ID would break references).

Trips: selecting a trip navigates to the trip menu (existing behavior, unchanged).

## Delete/Remove Mode Behavior

All three pages:
1. Entering remove mode: sets `focus` to `"input"` so global `[esc]` handler is disabled, sets border color to red
2. VerticalSelect shown with items
3. Selecting an item: immediately deletes it, refreshes the list, stays in remove mode
4. If list becomes empty after deletion: automatically exits to list mode
5. `[esc]` (via VerticalSelect `onCancel`): exits to list mode, resets border color, restores focus to `"menu"`

## Trips Page Changes

### Delete mode
- Currently: deletes one trip and returns to list mode
- New: stays in delete mode after each deletion, `[esc]` exits
- Set `focus` to `"input"` when entering delete mode

### Duplicate flow
- After duplicating, navigate to the new trip's menu page (same as create flow). This is already the current behavior.

## Owners Page Changes

### Replace DataTable with VerticalSelect
- Items show owner name, detail shows `(id)`
- Selecting an item enters edit mode

### Add mode
- Form with single field: display name (required)
- On submit: auto-generate ID from name slug, call addOwner, reloadTrip, return to list

### Edit mode
- Read-only label above form: `ID: {ownerId}`
- Form with single field: display name (pre-filled with current name)
- On submit: call a core service to update the owner's name (keeping same ID), reloadTrip, return to list

### Remove mode
- Red border, VerticalSelect showing owners
- Select → removeOwner, reloadTrip, stay in remove mode
- `[esc]` → return to list
- Empty list → return to list

### Menu
- `[a]` Add, `[x]` Remove

## Accounts Page Changes

### Replace DataTable with VerticalSelect
- Items show account name, detail shows `(type)`
- Selecting an item enters edit mode

### Add mode
- Form with fields: name (text, required), type (select: Credit/Debit, required), owners (text, required, comma-separated)
- On submit: auto-generate ID from name slug, call addAccount, reloadTrip, return to list

### Edit mode
- Read-only label above form: `ID: {accountId}`
- Form with fields: name (pre-filled), type (pre-filled), owners (pre-filled as comma-separated string)
- On submit: update account (keeping same ID), reloadTrip, return to list

### Remove mode
- Red border, VerticalSelect showing accounts
- Select → removeAccount, reloadTrip, stay in remove mode
- `[esc]` → return to list
- Empty list → return to list

### Menu
- `[a]` Add, `[x]` Remove

## Core Service Changes

### Update Owner
Need a service to update an owner's display name by ID. File: `src/core/services/owner/updateOwner.ts`

```ts
function updateOwner(trip: Trip, ownerId: string, newName: string): void
```

Reads owners.yaml, finds owner by ID, updates name, writes back.

### Update Account
Need a service to update an account's fields by ID. File: `src/core/services/account/updateAccount.ts`

```ts
function updateAccount(trip: Trip, accountId: string, updates: { name?: string; type?: AccountType; owners?: string[] }): void
```

Reads accounts.yaml, finds account by ID, applies updates, writes back.
