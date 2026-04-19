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
- `list-trips.ts` — `listTrips(dataDir): Trip[]`
- `load-trip.ts` — `loadTrip(tripPath): Trip`
- `create-trip.ts` — `createTrip(dataDir, name, settings): Trip`
- `index.ts`

#### `services/owner/`
- `get-owners.ts` — `getOwners(trip): Owner[]`
- `add-owner.ts` — `addOwner(trip, owner): void`
- `remove-owner.ts` — `removeOwner(trip, id): void`
- `index.ts`

#### `services/account/`
- `get-accounts.ts` — `getAccounts(trip): Account[]`
- `add-account.ts` — `addAccount(trip, account): void`
- `remove-account.ts` — `removeAccount(trip, id): void`
- `index.ts`

#### `services/expense/`
- `get-expenses.ts` — `getExpenses(trip): Expense[]`
- `add-expense.ts` — `addExpense(trip, expense): void`
- `remove-expense.ts` — `removeExpense(trip, id): void`
- `index.ts`

#### `services/export/`
- `export-csv.ts` — `exportCSV(trip, outputPath?): string`
- `index.ts`

#### `services/currency/`
- `convert-to-thb.ts` — `convertToTHB(amount, currency, expenseRate?, tripRate?): number`
- `index.ts`

### Core Validators (`src/core/validators/`)

One function per file, `index.ts` re-exports:

- `validate-settings.ts` — validates settings.yaml structure
- `validate-owners.ts` — validates owners.yaml
- `validate-accounts.ts` — validates accounts, checks owner ID references
- `validate-expenses.ts` — validates expenses, checks account ID and owner ID references, validates split totals
- `index.ts`

### TUI (`src/tui/`)

No `index.ts` re-export pattern in the TUI directory. All imports use direct file paths.

#### Components — Atomic Design (`src/tui/components/`)

**Atoms** (`atoms/`):
- `text-label.tsx` — styled text display
- `text-input.tsx` — single line input
- `select-input.tsx` — select/dropdown wrapper
- `checkbox.tsx` — toggle checkbox

**Molecules** (`molecules/`):
- `form-field.tsx` — label + input together
- `confirm-prompt.tsx` — question + yes/no
- `list-item.tsx` — icon + text + metadata row

**Organisms** (`organisms/`):
- `data-table.tsx` — table with headers and rows
- `form.tsx` — group of form fields with validation
- `navigation-menu.tsx` — selectable menu with descriptions

#### Screens (`src/tui/screens/`)

- `trip-list.tsx` — lists all trips. Options: select trip, create new trip.
- `trip-menu.tsx` — main menu for selected trip. Shows trip info. Options: Owners, Accounts, Expenses, Export CSV, Back.
- `owner-list.tsx` — list/add/remove owners.
- `account-list.tsx` — list/add/remove accounts.
- `expense-list.tsx` — list expenses. Options: add, edit, delete.
- `expense-form.tsx` — form for adding/editing an expense.
- `export.tsx` — shows export path (editable), preview, confirm export.

#### App (`src/tui/app.tsx`)

Root component. Handles screen routing via React state. Receives parsed CLI args as props.

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
- **CSV**: `csv` package (csv-stringify)
- **Linting**: Biome
