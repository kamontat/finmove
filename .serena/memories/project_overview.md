# Finmove Project Overview

**Purpose:** Travel expense management tool with TUI (Terminal User Interface)

**Tech Stack:**
- Runtime: Bun
- Language: TypeScript
- UI: React + Ink (TUI)
- Testing: Bun's built-in test runner (bun:test)
- Linting/Formatting: Biome (extends @kcconfigs/biome)

**Key Architecture:**
- Core/TUI Separation: `src/core/` (zero UI deps), `src/tui/` (React+Ink TUI)
- Data Storage: YAML files per trip (settings.yaml, owners.yaml, accounts.yaml, expenses.yaml)
- Travel expense tracking with multi-owner splits and currency conversion

**File Naming Conventions:**
- Core: camelCase (e.g., parseArgs.ts, convertToThb.ts)
- TUI: PascalCase (e.g., App.tsx, TripList.tsx)
