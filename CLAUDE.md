# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Run app:** `bun run start` (supports `--trip <name>`, `--page <page>`, `--data-dir <path>`)
- **Type check:** `bun run check:type`
- **Lint:** `bun run check`
- **Auto-fix lint/format:** `bun run fix`
- **Run all tests:** `bun test`
- **Run single test file:** `bun test src/core/services/currency/__tests__/convertToThb.test.ts`
- **Run tests in directory:** `bun test src/core/services/expense/__tests__/`

## Architecture

Travel expense management tool. Bun runtime, TypeScript, React+Ink TUI.

### Core/TUI Separation

`src/core/` contains all business logic with zero UI dependencies. `src/tui/` contains the React+Ink terminal UI. This separation exists so core can be reused with a future web frontend.

- **core/models/** — TypeScript types and enums. One type per file, `index.ts` re-exports all.
- **core/services/** — One function per file, grouped by domain (trip, owner, account, expense, currency, date, export). Each group has an `index.ts` barrel export.
- **core/validators/** — Validation functions returning `string[]` error arrays.
- **tui/components/** — Atomic design: `atoms/`, `molecules/`, `organisms/`. No `index.ts` re-exports in TUI — use direct file path imports.
- **tui/screens/** — Screen content components. Each screen renders main box content only; layout is handled by the `Page` organism.
- **tui/App.tsx** — Root router managing screen state, navigation history, focus, and keyboard shortcuts.

### File Naming

- **Core** (`src/core/`): camelCase — `parseArgs.ts`, `convertToThb.ts`, `addOwner.ts`
- **TUI** (`src/tui/`): PascalCase — `App.tsx`, `TripList.tsx`, `SelectInput.tsx`, `HelpBar.tsx`

### UI Layout (Page Organism)

Every screen follows a 3-area layout via the `Page` organism:

1. **Title** — displayed above the main box
2. **Main box** — bordered, contains interactive content (lists, forms, tables)
3. **Menu** — bordered, horizontal `[key] label` items with arrow key navigation + shortcut keys
4. **Help bar** — hidden by default, toggled with `[?]`

Focus switches between main and menu via `[tab]`. Menu shortcuts always work regardless of focus.

### Keyboard Navigation

- `[q]` — go back (or quit if no history). Disabled during text input (expense form, export, pending actions).
- `[esc]` — go back during input flows (steps back through form fields), quit on non-input screens. Disabled during pending actions (handled by screen internally).
- `[tab]` — switch focus between main box and menu. Disabled when no menu is visible.
- `[?]` — toggle help bar.
- Shortcut keys (e.g., `[c]`, `[o]`, `[a]`) — always fire regardless of focus.

### Data Storage

Each trip is a directory (default under `./data/`) containing four YAML files: `settings.yaml`, `owners.yaml`, `accounts.yaml`, `expenses.yaml`. Trip directory names are auto-generated from trip name + year as a slug (a-z, 0-9, hyphens only).

### Key Domain Concepts

- Expenses store original currency + amount; conversion to THB happens at export time using per-expense or trip-level fallback exchange rates.
- Expenses can have multiple owners with equal, percentage, or fixed-amount splits.
- CSV export produces one row per owner per expense (not one row per expense).
- Trips can be duplicated (copies all YAML files, updates name in settings) or deleted.

## Conventions

- `index.ts` re-export pattern is used in `src/core/` only. Not in `src/tui/`.
- Tests use Bun's built-in test runner (`bun:test`) and live in `__tests__/` directories adjacent to source.
- Biome handles both linting and formatting (extends `@kcconfigs/biome`).
- TSConfig extends `@kcconfigs/tsconfig/bundler` with `exactOptionalPropertyTypes: true` — use conditional spreading for optional props to Ink components.
- Reserved keys (`q`, `esc`, `?`) must not be used as menu shortcut keys in `SelectInput`.
