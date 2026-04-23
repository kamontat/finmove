# Trip Dashboard Status

## Summary

Replace the single-line summary on the TripMenu screen (the "main dashboard" after selecting a trip) with a rich multi-section status view: progress, spend summary, top categories, per-owner net balance, counts, and warnings.

## Goals

- Surface at a glance: where the trip is in its timeline, how much has been spent, where the money is going, who owes whom, and what's missing.
- Keep all derivation in `core/` (pure, testable); keep the UI presentational.

## Non-goals

- No interactive drill-down on the dashboard. Existing menu navigation is unchanged.
- No snapshot/Ink tests. Testing stays on the core derivation, matching existing project convention.
- No new UI primitives. Uses existing Ink/Box/Text patterns.

## Data model

### `TripStatus`

Lives in `src/core/services/trip/getTripStatus.ts`. Re-exported from `src/core/services/trip/index.ts`.

```ts
export interface TripStatus {
  phase: "upcoming" | "ongoing" | "ended";
  startDate: string;
  endDate: string;
  countries: string[];
  totalDays: number;
  elapsedDays: number;   // 0 if upcoming, totalDays if ended
  remainingDays: number; // totalDays - elapsedDays

  totalSpendThb: number;
  avgPerDayThb: number;  // totalSpendThb / max(elapsedDays, 1); 0 if upcoming
  expenseCount: number;
  byCurrency: { currency: string; amount: number }[]; // original amounts, sorted desc

  topCategories: { category: string; amountThb: number }[]; // top 5 desc; "Other" row if overflow
  categoryCount: { used: number; total: number };
  tagCount: { used: number; total: number };

  ownerBalances: { ownerId: string; name: string; balanceThb: number }[];
  accountCount: number;

  warnings: string[];
}
```

### `getTripStatus(trip: Trip, today: string): TripStatus`

Pure function. `today` is a `YYYY-MM-DD` string (callers use `today()` from `services/date`).

Derivation rules:

1. **Phase / days** — inclusive day count. `totalDays = daysBetween(startDate, endDate) + 1`.
   - `today < startDate` → `phase = "upcoming"`, `elapsedDays = 0`, `remainingDays = totalDays`.
   - `today > endDate` → `phase = "ended"`, `elapsedDays = totalDays`, `remainingDays = 0`.
   - Otherwise → `phase = "ongoing"`, `elapsedDays = daysBetween(startDate, today) + 1`, `remainingDays = totalDays - elapsedDays`.
2. **Paid attribution (per-owner balance)** — the expense's THB amount is split **equally among the account's owners** as "paid". Account with zero owners is skipped and a warning is emitted.
3. **Share** — delegated to the existing `calculateSplits(amountThb, expense.owners, allOwners)`.
4. **Owner balance** — `balanceThb = paid - share`, rounded to 2 decimals.
5. **Missing exchange rate** — `convertToTHB` wrapped in try/catch. On failure the expense is excluded from `totalSpendThb`, `avgPerDayThb`, `topCategories`, and `ownerBalances`. It is still counted in `expenseCount` and contributes to `byCurrency`. Warning: `"N expenses missing THB rate (excluded from totals)"`.
6. **Top categories** — bucket by `expense.category`, sum amountThb, sort desc, take top 5. Remaining categories, if any, collapse into a single `"Other"` row.
7. **`categoryCount.used` / `tagCount.used`** — distinct values appearing on any expense. `.total` comes from `settings.categories.length` / `settings.tags.length`.
8. **`avgPerDayThb`** — `totalSpendThb / elapsedDays` when `elapsedDays > 0`, else `0`. Rounded to 2 decimals.
9. **`byCurrency`** — sum of original `amount` per currency, sorted by amount desc; includes THB if present.

## UI

### `TripDashboard` component

Lives in `src/tui/components/organisms/TripDashboard.tsx`. Presentational — takes a `TripStatus`, renders Ink components. Local sub-blocks (`StatusHeader`, `ProgressBar`, `SpendBlock`, `CategoriesBlock`, `OwnersBlock`, `CountsBlock`, `WarningList`) are defined in-file and not exported.

### Layout (80-col target)

```
 [Ongoing]  2026-04-15 — 2026-04-30  |  Japan, Korea
 [███████████░░░░░░░░░] 9/16 days (7 left)

 Spend                          Top categories
 ─────                          ──────────────
 Total          ฿12,345.67      Food      ฿4,200  ████████
 Avg/day         ฿1,371.74      Transport ฿3,100  ██████
 Expenses              23       Lodging   ฿2,800  █████
 By currency   JPY 42,000       Shopping  ฿1,200  ██
               KRW 18,000       Other       ฿845  ▌

 Owners                         Counts
 ──────                         ──────
 Alice          +฿820           Accounts           4
 Bob            −฿310           Categories  5 used / 8 total
 Carol          −฿510           Tags        3 used / 6 total

 ⚠ 2 expenses missing THB rate (excluded from totals)
```

### Ink tree

```
<Box flexDirection="column" gap={1}>
  <StatusHeader />                 // phase badge + dates + countries
  <ProgressBar />                   // 20-cell block bar + "X/Y days (Z left)"

  <Box flexDirection="row" gap={2}>
    <SpendBlock />                  // width 38
    <CategoriesBlock />             // fills remainder
  </Box>

  <Box flexDirection="row" gap={2}>
    <OwnersBlock />
    <CountsBlock />
  </Box>

  {warnings.length > 0 && <WarningList />}
</Box>
```

### Styling

- Phase badge: `[Upcoming]` blue, `[Ongoing]` green, `[Ended]` gray. Bold.
- Section headers (`Spend`, `Top categories`, `Owners`, `Counts`): bold cyan with a dim `─────` divider underneath.
- Labels dim; values bold.
- THB amounts prefixed `฿`; original currency prefixed with the 3-letter code.
- Owner balance: `+฿820` green, `−฿310` red, `฿0` dim.
- Progress bar: 20 cells, `█` elapsed, `░` remaining.
- Category bars: scaled to the largest category value, max 8 cells, using `█ ▓ ▒ ░ ▌` blocks for partials.
- Warnings: yellow, `⚠` prefix.

### TripMenu wiring

`src/tui/screens/TripMenu.tsx` replaces the current one-line `<Text dimColor>…</Text>` with:

```tsx
<TripDashboard status={getTripStatus(trip, today())} />
```

Menu, hints, title, and focus behavior are unchanged.

## Edge cases

| Case | Behavior |
|---|---|
| No expenses | Total/Avg `฿0.00`; top-categories block renders a single dim `—` row; no warning |
| No owners | Owners block hidden; counts block is the only column on that row |
| No accounts | Owners block hidden; warning: `"No accounts configured — per-owner balances unavailable"` |
| All rates missing | Total/Avg `฿0.00`; warning surfaces the count |
| Zero-owner account | Expense excluded from paid attribution; warning: `"Account '<name>' has no owners — expenses not attributed"` |
| Upcoming | Phase `[Upcoming]`, elapsed 0, bar empty, avg/day `฿0.00` |
| Ended | Phase `[Ended]`, elapsed = total, bar full, remaining 0 |
| Single-day trip | `totalDays = 1`; bar fully filled on that day |
| All expenses in THB | `byCurrency` still includes the THB row |
| Categories > 5 | Top 5 + collapsed `Other` row |
| Categories = 0 | top-categories block shows `—` |
| Narrow terminal (<70 cols) | Accept wrap; fixed column widths; matches existing app convention |

## Testing

Unit tests in `src/core/services/trip/__tests__/getTripStatus.test.ts` (Bun's built-in `bun:test`):

1. Phase detection at boundaries: `today = startDate`, `today = endDate`, before, after.
2. Day counts: single day; multi-day; elapsed/remaining math.
3. Total spend with mixed currencies and rates (expense-level rate preferred over trip-level).
4. Owner balance with multi-owner account (paid split equally).
5. Missing exchange rate: excluded from THB totals; counted in `expenseCount` and `byCurrency`; warning emitted.
6. Zero-owner account: excluded from paid; warning emitted.
7. Top categories: sort, top 5, `Other` collapse.
8. `categoryCount.used` / `tagCount.used` against `.total`.
9. Empty trip variations: no expenses, no owners, no accounts.

`TripDashboard` has no tests — it's a thin render over the tested struct.

## Out of scope

- Dashboard interactivity / drill-down.
- Persistent caching of derived values (cheap to recompute).
- Currency conversion UI (no changes to rate management).
- Responsive reflow for narrow terminals (same convention as rest of the app).
