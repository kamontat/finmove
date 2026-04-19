# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Run app:** `bun run start` (supports `--trip <name>`, `--page <page>`, `--data-dir <path>`)
- **Type check:** `bun run check:type`
- **Lint:** `bun run check`
- **Auto-fix lint/format:** `bun run fix`
- **Run all tests:** `bun test`
- **Run single test file:** `bun test src/core/services/currency/__tests__/convert-to-thb.test.ts`
- **Run tests in directory:** `bun test src/core/services/expense/__tests__/`

## Architecture

Travel expense management tool. Bun runtime, TypeScript, React+Ink TUI.

### Core/TUI Separation

`src/core/` contains all business logic with zero UI dependencies. `src/tui/` contains the React+Ink terminal UI. This separation exists so core can be reused with a future web frontend.

- **core/models/** — TypeScript types and enums. One type per file, `index.ts` re-exports all.
- **core/services/** — One function per file, grouped by domain (trip, owner, account, expense, currency, export). Each group has an `index.ts` barrel export.
- **core/validators/** — Validation functions returning `string[]` error arrays.
- **tui/components/** — Atomic design: `atoms/`, `molecules/`, `organisms/`. No `index.ts` re-exports in TUI — use direct file path imports.
- **tui/screens/** — Full-page views. Each screen calls core services directly.
- **tui/app.tsx** — Root router using a screen history stack. `q` goes back, `Escape` exits.

### Data Storage

Each trip is a directory (default under `./data/`) containing four YAML files: `settings.yaml`, `owners.yaml`, `accounts.yaml`, `expenses.yaml`.

### Key Domain Concepts

- Expenses store original currency + amount; conversion to THB happens at export time using per-expense or trip-level fallback exchange rates.
- Expenses can have multiple owners with equal, percentage, or fixed-amount splits.
- CSV export produces one row per owner per expense (not one row per expense).

## Conventions

- `index.ts` re-export pattern is used in `src/core/` only. Not in `src/tui/`.
- Tests use Bun's built-in test runner (`bun:test`) and live in `__tests__/` directories adjacent to source.
- Biome handles both linting and formatting (extends `@kcconfigs/biome`).
- TSConfig extends `@kcconfigs/tsconfig/bundler` with `exactOptionalPropertyTypes: true` — use conditional spreading for optional props to Ink components.
