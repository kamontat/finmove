# Move expense count to Counts block — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `Expenses` count row from the `SpendBlock` to the `CountsBlock` in `TripDashboard.tsx`, as the first row of Counts.

**Architecture:** Presentation-only edit in a single file. Two small contiguous changes: delete a `<Box>` block from `SpendBlock`; insert an equivalent `<Box>` block at the top of `CountsBlock`. The data source (`status.expenseCount` on `TripStatus`) is unchanged.

**Tech Stack:** TypeScript, React, Ink (terminal UI), Bun.

**Spec:** `docs/superpowers/specs/2026-05-16-move-expense-count-to-counts-design.md`

---

## File Structure

**Modified:**
- `src/tui/components/organisms/TripDashboard.tsx` — two small edits.

**Created:** none.

**Tests:** none. `TripDashboard.tsx` has no existing unit tests (purely presentational). Verification is via type-check, lint, and `bun run start`.

---

## Task 1: Move the Expenses row

**Files:**
- Modify: `src/tui/components/organisms/TripDashboard.tsx`

- [ ] **Step 1: Remove the Expenses row from `SpendBlock`**

In `src/tui/components/organisms/TripDashboard.tsx`, inside the `SpendBlock` function, delete the `<Box>` that renders the `Expenses` row. The current block (around lines 105–109) is:

```tsx
<Box>
	<Text dimColor>{"Expenses".padEnd(labelWidth)}</Text>
	<Text>{"  "}</Text>
	<Text bold>{status.expenseCount}</Text>
</Box>
```

After this edit, the `SpendBlock` should render `Total`, `Avg/day`, then `By currency` — no `Expenses` row between `Avg/day` and `By currency`.

Leave `labelWidth` (`"By currency".length`) unchanged. The remaining labels still fit.

- [ ] **Step 2: Add the Expenses row to `CountsBlock`**

In the same file, inside the `CountsBlock` function (around lines 228–253), insert a new `<Box>` as the FIRST row inside the outer `flexDirection="column"` `<Box>`, immediately after `<SectionHeader label="Counts" />` and before the existing `Accounts` row:

```tsx
<Box>
	<Text dimColor>Expenses</Text>
	<Text>{"    "}</Text>
	<Text bold>{status.expenseCount}</Text>
</Box>
```

The 4-space gap matches the existing `Accounts` row exactly (both labels are 8 chars).

The resulting `CountsBlock` JSX order is:

```
SectionHeader "Counts"
Expenses    {status.expenseCount}
Accounts    {status.accountCount}
Categories  {status.categoryCount.used} used / {status.categoryCount.total} total
Tags        {status.tagCount.used} used / {status.tagCount.total} total
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`

Expected: passes with no errors.

- [ ] **Step 4: Lint**

Run: `bun run check`

Expected: passes with no errors.

- [ ] **Step 5: Manual visual verification**

Run: `bun run start`

Open a trip with at least one expense (any trip in `./data/`). Navigate to the trip overview screen. Confirm:

1. The **Spend** block shows `Total`, `Avg/day`, and `By currency` (when present) — and does NOT show an `Expenses` row.
2. The **Counts** block shows `Expenses` as the first row, with the correct count, above `Accounts`.
3. The `Expenses` value column is aligned with the `Accounts` value column.

If anything looks misaligned or missing, fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(tui): move expense count from Spend to Counts block

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Change A (remove from Spend) → Step 1. Change B (add to Counts as first row) → Step 2. Verification (type-check, lint, visual) → Steps 3–5. All spec requirements covered.
- **Placeholders:** None — every code change shows full JSX.
- **Out of scope (per spec):** Renaming `expenseCount`; touching `TripList`; restyling; adding tests for `TripDashboard.tsx`. Confirmed none of these appear in any task.
