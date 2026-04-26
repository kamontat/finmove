# Code Conventions

## File Organization

**Core Services** (`src/core/services/`):
- One function per file, grouped by domain (trip, owner, account, expense, currency, date, export)
- Each domain has `index.ts` barrel export re-exporting all functions
- File naming: camelCase (e.g., addDays.ts, convertToThb.ts)
- No prop spreading - use conditional spreading for optional props (exactOptionalPropertyTypes: true in TSConfig)

**TUI Components** (`src/tui/`):
- Atomic design: `atoms/`, `molecules/`, `organisms/`
- No `index.ts` re-exports in TUI - use direct file path imports
- File naming: PascalCase

**Tests:**
- Located in `__tests__/` directories adjacent to source
- Use `bun:test` and `describe/test/expect`

## Code Style
- Indentation: tabs (Biome-formatted)
- TSConfig extends @kcconfigs/tsconfig/bundler with exactOptionalPropertyTypes: true
