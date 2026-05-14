# Optional Trip-Level Exchange Rate + Currency Rename

## Goal

Two related changes to the trip-level currency entries:

1. **Optional rate.** A trip can register a currency without committing to a fallback exchange rate. A blank trip-level rate means *"no fallback — each expense must supply its own rate."*
2. **Renameable code.** The currency code becomes an editable field on the Edit screen, so a user can correct or change a code after creating it. Rename is rejected when any expense still references the old code (consistent with the existing reference-validation pattern used for owners and accounts).

Today, `CurrencyConfig.exchangeRate` is required, which forces users to invent a number at the moment they declare a currency exists. The currency code is also frozen at creation time, so a typo means delete-and-recreate. Both restrictions are removed.

## Scope

In scope:

- Make `CurrencyConfig.exchangeRate` optional in the model and YAML.
- Add an editable `code` field to the Edit form (required), enabling rename.
- Add a `findCurrencyReferences` service that returns expenses referencing a currency code (mirrors `findOwnerReferences` / `findAccountReferences`).
- Block rename when any expense uses the old code; surface the failure as an inline form error.
- Update Currency Create / Edit / List / Delete screens to handle the absent rate.
- Tests for missing-rate paths and rename behavior (success + rejection).

Out of scope:

- `convertToTHB`, `getTripStatus`, `exportCsv`, and `expenseListRow` already handle a missing trip rate. No semantic changes there.
- No `validateSettings` rule requiring a rate.
- No migration step. YAML loads existing files unchanged; missing `exchangeRate` becomes `undefined`.
- No softer fallback for `exportCsv`: it continues to throw when an expense has neither an expense-level nor a trip-level rate.
- No cascade rename (we don't rewrite `expense.currency` for callers). Rename is only allowed when there are zero referencing expenses.
- No new "References" sub-screen for currencies. The rename rejection is communicated through the Form's inline error display (the existing `OwnerReferences` / `AccountReferences` screens exist for the *delete* flow, which we are not changing).

## Known Limitations

The `Form` organism's submit gate requires at least one field to have a non-empty value in `values` (`Form.tsx` line 78–84). With the new two-field Edit form, the user can confirm the `code` field at its `defaultValue` to mark it "touched", which enables submit and lets them clear the rate. So clearing a rate via Edit is now possible — it just requires pressing Enter through the `code` field first. We accept this small UX wart; the alternative (relaxing the Form gate) is out of scope.

## Model Change

`src/core/models/settings.ts`:

```ts
export interface CurrencyConfig {
  exchangeRate?: number;  // was: number
}
```

The `yaml` library omits `undefined` fields on `stringify` and parses absent fields as `undefined` on `parse`, so no serializer work is needed. The currency code remains the map key on `Settings.currencies`; it is not stored inside `CurrencyConfig`.

## Conversion Path (no behavior change)

These already accept a `tripRate?: number` and behave correctly when it is `undefined`:

- `src/core/services/currency/convertToThb.ts` — throws `"No exchange rate available for ${currency}"` for non-THB when both expense and trip rate are missing.
- `src/core/services/trip/getTripStatus.ts` — wraps `convertToTHB` in try/catch and surfaces `"N expenses missing THB rate (excluded from totals)"` in `warnings`.
- `src/core/services/export/exportCsv.ts` — lets `convertToTHB` throw. **Keeps throwing** for this work.
- `src/tui/screens/expenseListRow.ts` — already renders `?` (red) in the Rate and THB columns when both rates are missing.

## New Service

`src/core/services/currency/findCurrencyReferences.ts`:

```ts
import type { Expense, Trip } from "../../models";

export interface CurrencyReferences {
  expenses: Expense[];
}

export function findCurrencyReferences(
  trip: Trip,
  code: string,
): CurrencyReferences {
  return { expenses: trip.expenses.filter((e) => e.currency === code) };
}
```

Re-exported from `src/core/services/currency/index.ts`. Mirrors the shape of `findOwnerReferences` / `findAccountReferences` for consistency, even though only `expenses` is relevant for currency.

## TUI Changes

### `src/tui/screens/CurrencyCreate.tsx`

- Field order: `code` (required, unchanged), `exchangeRate` (now `required: false`). Form auto-appends "(optional)" to the rate label.
- On submit, include `exchangeRate` in the stored `CurrencyConfig` only when the input parses to a finite number. Blank or non-numeric input → store `{}`.

### `src/tui/screens/CurrencyEdit.tsx`

- Two fields:
  1. `code` (required, `defaultValue = existing code from route params`).
  2. `exchangeRate` (optional, `defaultValue = existing.exchangeRate` only when it is defined — uses the conditional-spread pattern required by `exactOptionalPropertyTypes`).
- On submit (within the `Form`'s try/catch, so thrown errors render inline):
  1. Read `newCode` (uppercased, trimmed) and parsed `rate`.
  2. If `newCode === existingCode`: just update the rate (write `{}` or `{ exchangeRate: rate }` under the same key).
  3. If `newCode !== existingCode`:
     - **Reject** if `newCode` already exists in `trip.settings.currencies` — `throw new Error("Currency '${newCode}' already exists")`.
     - Call `findCurrencyReferences(trip, existingCode)`. If `expenses.length > 0`, `throw new Error("Cannot rename: ${expenses.length} expense(s) reference '${existingCode}'")`.
     - Otherwise: build new `currencies` map with `existingCode` removed and `newCode` set to the new `CurrencyConfig`. Call `updateSettings`.
- After successful submit, `goBack()` as today.

### `src/tui/screens/CurrencyList.tsx`

- Change the row `detail`:

  ```ts
  detail: config.exchangeRate !== undefined
    ? `rate: ${config.exchangeRate}`
    : "rate: (not set)"
  ```

- `ListSelect` already renders the detail in dim text — no further styling needed.

### `src/tui/screens/CurrencyDelete.tsx`

- Same `detail` treatment as `CurrencyList`.

## Validators

No change. `validateSettings` does not check `currencies` today; this design does not introduce a check there. Rename rejection is enforced at the action site (CurrencyEdit submit), not in the validator.

## Tests

New tests:

1. `src/core/services/trip/__tests__/updateSettings.test.ts` — write a `CurrencyConfig` with no `exchangeRate`; reload and confirm the field round-trips as absent.
2. `src/core/services/trip/__tests__/getTripStatus.test.ts` — trip has a currency entry with no `exchangeRate` AND the expense has no `exchangeRate`. Asserts the expense is excluded from `totalSpendThb` and the `"missing THB rate"` warning is present.
3. `src/core/services/export/__tests__/exportCsv.test.ts` — non-THB expense with neither rate; asserts the existing throw is preserved.
4. `src/core/services/currency/__tests__/findCurrencyReferences.test.ts` — new file. Cases:
   - No expenses use the code → `{ expenses: [] }`.
   - Several expenses use the code → all returned, others excluded.

Existing tests:

- `convertToThb.test.ts` already covers the missing-rate throw — no new test there.
- TUI screens (Create/Edit) are not covered by unit tests today; this design does not introduce a new pattern requiring TUI tests. Rename behavior is verified manually.

## Verification

- `bun run check:type`
- `bun run check`
- `bun test`
- Manual:
  1. Add a currency without a rate; confirm list shows `rate: (not set)`.
  2. Edit it to add a rate; confirm list shows the rate.
  3. Edit a currency that has zero referencing expenses; change its code; confirm settings.yaml is updated.
  4. Add an expense using that currency; edit the currency and try to rename → inline error appears, settings unchanged.
  5. Edit a currency to the same code as another existing currency → inline error, settings unchanged.

## Files Touched

Modified:

- `src/core/models/settings.ts`
- `src/core/services/currency/index.ts` (new re-export)
- `src/tui/screens/CurrencyCreate.tsx`
- `src/tui/screens/CurrencyEdit.tsx`
- `src/tui/screens/CurrencyList.tsx`
- `src/tui/screens/CurrencyDelete.tsx`
- `src/core/services/trip/__tests__/updateSettings.test.ts`
- `src/core/services/trip/__tests__/getTripStatus.test.ts`
- `src/core/services/export/__tests__/exportCsv.test.ts`

New:

- `src/core/services/currency/findCurrencyReferences.ts`
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
