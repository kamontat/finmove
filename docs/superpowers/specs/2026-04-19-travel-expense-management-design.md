# Travel Expense Management — Design Spec

## Overview

A CLI tool for managing travel expenses across multiple trips. Data is stored in YAML files per trip. The TUI is built with React + Ink, with core logic fully separated for future web frontend migration.

## Trip Data Storage

Each trip is a directory under a configurable data root (default: `./data`).

```
data/<trip-name>/
  settings.yaml
  owners.yaml
  accounts.yaml
  expenses.yaml
```

The user provides the trip directory name when creating a trip.

The data directory can be overridden via `--data-dir <path>` CLI flag.

## Data Models

### `settings.yaml`

```yaml
name: "Japan 2026"
startDate: "2026-05-01"
endDate: "2026-05-14"
countries: ["Japan", "South Korea"]
baseCurrency: "THB"
currencies:
  JPY:
    exchangeRate: 0.23      # 1 JPY = 0.23 THB (fallback rate)
  KRW:
    exchangeRate: 0.027
categories:
  - Flight
  - Hotels
  - Transportation
  - Shopping
  - Eating
  - Activities
tags:
  - souvenir
  - reimbursable
exportPath: "./expenses.csv"   # default export path, relative to trip dir
```

- `baseCurrency` is always THB.
- `currencies` defines foreign currencies used in the trip with fallback exchange rates.
- `categories` includes the 6 defaults (Flight, Hotels, Transportation, Shopping, Eating, Activities) plus any trip-specific additions.
- `tags` is per-trip only; no global defaults.
- `exportPath` is the default CSV export destination.

### `owners.yaml`

```yaml
owners:
  - id: alice
    name: "Alice"
  - id: bob
    name: "Bob"
```

Owners are defined per trip. Each owner has a unique `id` (slug) and a display `name`.

### `accounts.yaml`

```yaml
accounts:
  - id: alice-credit
    name: "Alice's Visa"
    type: Credit
    owners: [alice]
  - id: shared-cash
    name: "Shared Cash"
    type: Debit
    owners: [alice, bob]
```

- `type`: `Credit` or `Debit`.
- `owners`: references owner IDs. One or more owners per account. These are the people who pay for expenses charged to this account.

### `expenses.yaml`

```yaml
expenses:
  - id: "exp-001"
    accountId: alice-credit
    date: "2026-05-02"
    payee: "Ichiran Ramen"
    category: Eating
    amount: 2400
    currency: JPY
    exchangeRate: 0.23          # optional, falls back to settings
    owners:                      # optional, defaults to equal split among all trip owners
      - id: alice
        split: 50%
      - id: bob
        split: 50%
    description: "Lunch at Shibuya"
    tags: [food, ramen]
```

#### Owner split formats

Three ways to define expense owners:

1. **Omitted**: split equally among all trip owners.
2. **List of IDs only** (e.g., `owners: [alice, bob]`): split equally among listed owners only (not all trip owners).
3. **List with split**: each entry has `id` and `split`. Split can be:
   - Percentage: `50%` — must add up to 100% across all owners.
   - Fixed amount: `500` — in the expense's currency.

#### Exchange rate resolution

1. Use `exchangeRate` on the expense if provided.
2. Fall back to the rate defined in `settings.yaml` for that currency.
3. If the expense is already in THB, no conversion needed.

## Architecture

### Approach: Layered Modules

```
src/
  core/           # Pure logic, no UI dependencies
    models/       # TypeScript types/interfaces
    services/     # YAML I/O, CSV export, currency conversion
    validators/   # Schema validation
  tui/            # Ink/React TUI, depends on core/
    screens/      # Full-page views
    components/   # Atomic design components
  main.ts         # CLI entry point
```

Core has zero UI dependencies. TUI imports from core. Replacing TUI with a web frontend later requires no changes to core.

### Core Models (`src/core/models/`)

One type per file, `index.ts` re-exports all:

- `settings.ts` — `Settings`, `CurrencyConfig`
- `owner.ts` — `Owner`
- `account.ts` — `Account`, `AccountType` enum (`Credit`, `Debit`)
- `expense.ts` — `Expense`, `ExpenseOwnerSplit`, `SplitType` enum (`Equal`, `Percentage`, `Amount`)
- `trip.ts` — `Trip` (composite type: settings + owners + accounts + expenses)
- `index.ts` — re-exports all

### Core Services (`src/core/services/`)

One function per file, `index.ts` re-exports per service group:

#### `services/trip/`
- `listTrips.ts` — `listTrips(dataDir): Trip[]`
- `loadTrip.ts` — `loadTrip(tripPath): Trip`
- `createTrip.ts` — `createTrip(dataDir, name, settings): Trip`
- `deleteTrip.ts` — `deleteTrip(tripPath): void`
- `duplicateTrip.ts` — `duplicateTrip(dataDir, sourcePath, newDirName, newName): Trip`
- `toDirName.ts` — `toDirName(tripName, startDate): string` — generates slug directory name
- `index.ts`

#### `services/date/`
- `today.ts` — `today(): string` — returns current date as YYYY-MM-DD
- `addDays.ts` — `addDays(dateStr, days): string` — add/subtract days from a date
- `index.ts`

#### `services/owner/`
- `getOwners.ts` — `getOwners(trip): Owner[]`
- `addOwner.ts` — `addOwner(trip, owner): void`
- `removeOwner.ts` — `removeOwner(trip, id): void`
- `index.ts`

#### `services/account/`
- `getAccounts.ts` — `getAccounts(trip): Account[]`
- `addAccount.ts` — `addAccount(trip, account): void`
- `removeAccount.ts` — `removeAccount(trip, id): void`
- `index.ts`

#### `services/expense/`
- `getExpenses.ts` — `getExpenses(trip): Expense[]`
- `addExpense.ts` — `addExpense(trip, expense): void`
- `removeExpense.ts` — `removeExpense(trip, id): void`
- `updateExpense.ts` — `updateExpense(trip, expense): void`
- `calculateSplits.ts` — `calculateSplits(totalAmount, owners, allTripOwners): OwnerAmount[]`
- `index.ts`

#### `services/export/`
- `exportCsv.ts` — `exportCSV(trip): string`
- `index.ts`

#### `services/currency/`
- `convertToThb.ts` — `convertToTHB(amount, currency, expenseRate?, tripRate?): number`
- `index.ts`

### Core Validators (`src/core/validators/`)

One function per file, `index.ts` re-exports:

- `validateSettings.ts` — validates settings.yaml structure
- `validateOwners.ts` — validates owners.yaml
- `validateAccounts.ts` — validates accounts, checks owner ID references
- `validateExpenses.ts` — validates expenses, checks account ID and owner ID references, validates split totals
- `index.ts`

### TUI (`src/tui/`)

No `index.ts` re-export pattern in the TUI directory. All imports use direct file paths.

#### Components — Atomic Design (`src/tui/components/`)

**Atoms** (`atoms/`):
- `TextLabel.tsx` — styled text display
- `TextInput.tsx` — single line input with optional `onCancel` (esc)
- `SelectInput.tsx` — horizontal `[key] label` menu with arrow key navigation + shortcut keys
- `VerticalSelect.tsx` — vertical list with up/down navigation, `onHighlight`, `onCancel`, and `color` props
- `DateInput.tsx` — segmented date picker (year/month/day), arrow keys to navigate and change values
- `Checkbox.tsx` — toggle checkbox

**Molecules** (`molecules/`):
- `FormField.tsx` — label + text input with optional `onCancel`
- `DateField.tsx` — label + date input with optional `onCancel`
- `ConfirmPrompt.tsx` — question + yes/no
- `HelpBar.tsx` — toggleable keyboard hints, hidden by default
- `ListItem.tsx` — icon + text + metadata row

**Organisms** (`organisms/`):
- `Page.tsx` — standard 3-area layout: title + main box + menu + help bar
- `DataTable.tsx` — table with headers and rows
- `NavigationMenu.tsx` — title + SelectInput wrapper

#### Screens (`src/tui/screens/`)

- `TripList.tsx` — vertical trip list in main box; menu: create, duplicate, delete. Duplicate/delete trigger trip selection mode first.
- `TripMenu.tsx` — shows trip date range and countries. Menu: owners, accounts, expenses, export.
- `OwnerList.tsx` — data table of owners; menu actions trigger add/remove flows.
- `AccountList.tsx` — data table of accounts; menu actions trigger add/remove flows.
- `ExpenseList.tsx` — numbered expense table.
- `ExpenseForm.tsx` — multi-step expense wizard (account, date, payee, category, amount, currency, rate, owners, description, tags).
- `Export.tsx` — export path input, CSV preview, confirm.

#### App (`src/tui/App.tsx`)

Root component. Manages screen state, navigation history stack, focus (main/menu), pending actions, and global keyboard shortcuts. Wraps all screens in the `Page` organism.

### CLI Entry Point (`src/main.ts`)

Parses CLI flags:
- `--trip <name>` — skip to specific trip
- `--page <page>` — skip to specific page within trip (owners, accounts, expenses, export)
- `--data-dir <path>` — override data directory (default: `./data`)

Launches the Ink app with parsed args.

## CSV Export

### Format

- All fields wrapped in double quotes.
- Array values (tags) separated by `;`.
- One row per owner per expense (multi-owner expenses expand into multiple rows).

### Columns

```
"Account","Owner","Date","Payee","Category","Amount","Description","Tags"
```

- **Account** — account display name
- **Owner** — single owner name for this row
- **Date** — `YYYY-MM-DD`
- **Payee** — payee string
- **Category** — category string
- **Amount** — THB amount for this owner's share, rounded to 2 decimal places
- **Description** — description string
- **Tags** — tags joined by `;`

### Amount Calculation

`Amount = originalAmount * exchangeRate * ownerSplitRatio`

For equal splits: `splitRatio = 1 / numberOfOwners`

### Example

Expense: 2400 JPY, rate 0.23, account "Alice's Visa", Alice 60% / Bob 40%:

```csv
"Account","Owner","Date","Payee","Category","Amount","Description","Tags"
"Alice's Visa","Alice","2026-05-02","Ichiran Ramen","Eating","331.20","Lunch at Shibuya","food;ramen"
"Alice's Visa","Bob","2026-05-02","Ichiran Ramen","Eating","220.80","Lunch at Shibuya","food;ramen"
```

### Export Path

Default path from `settings.yaml` `exportPath` field (default: `./expenses.csv` relative to trip dir). Editable in the TUI export screen before exporting.

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **TUI**: React + Ink + @inkjs/ui
- **Data**: YAML (via `yaml` package)
- **CSV**: Hand-rolled (RFC 4180 compliant double-quote escaping)
- **Linting**: Biome
