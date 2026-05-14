# Optional Trip-Level Exchange Rate

## Goal

Allow a trip to register a currency without committing to a fallback exchange rate. A blank trip-level rate means *"no fallback — each expense must supply its own rate."*

Today, `CurrencyConfig.exchangeRate` is required, which forces users to invent a number at the moment they declare a currency exists. This change makes the rate optional so currencies can be declared up-front (e.g., when planning a trip) and rates filled in later.

## Scope

In scope:

- Make `CurrencyConfig.exchangeRate` optional in the model and YAML.
- Update Currency Create / Edit / List / Delete screens to handle the absent value.
- Add tests covering the missing-rate paths that flow through `updateSettings`, `getTripStatus`, and `exportCsv`.

Out of scope:

- `convertToTHB`, `getTripStatus`, `exportCsv`, and `expenseListRow` already handle a missing trip rate. No semantic changes there.
- No `validateSettings` rule requiring a rate.
- No "Clear rate" action on the Edit screen — blank submit already clears.
- No migration step. YAML loads existing files unchanged; missing `exchangeRate` becomes `undefined`.
- No softer fallback for `exportCsv`: it continues to throw when an expense has neither an expense-level nor a trip-level rate.

## Known Limitations

The `Form` organism's submit gate requires at least one field to have a non-empty value (`Form.tsx` line 78–84). The Edit screen has a single `exchangeRate` field, so clearing an existing rate and submitting is blocked. To clear a previously-set trip rate, a user deletes the currency entry and re-adds it without a rate. This is accepted; the alternative (relaxing the Form gate) is out of scope for this work.

## Model Change

`src/core/models/settings.ts`:

```ts
export interface CurrencyConfig {
  exchangeRate?: number;  // was: number
}
```

The `yaml` library omits `undefined` fields on `stringify` and parses absent fields as `undefined` on `parse`, so no serializer work is needed.

## Conversion Path (no behavior change)

These already accept a `tripRate?: number` and behave correctly when it is `undefined`:

- `src/core/services/currency/convertToThb.ts` — throws `"No exchange rate available for ${currency}"` for non-THB when both expense and trip rate are missing.
- `src/core/services/trip/getTripStatus.ts` — wraps `convertToTHB` in try/catch and surfaces `"N expenses missing THB rate (excluded from totals)"` in `warnings`.
- `src/core/services/export/exportCsv.ts` — lets `convertToTHB` throw. **Keeps throwing** for this work.
- `src/tui/screens/expenseListRow.ts` — already renders `?` (red) in the Rate and THB columns when both rates are missing.

## TUI Changes

### `src/tui/screens/CurrencyCreate.tsx`

- Set `required: false` on the `exchangeRate` field. The Form organism will auto-append "(optional)" to the label.
- On submit, only include `exchangeRate` in the new `CurrencyConfig` when the input parses to a finite number. Blank or non-numeric input → store `{}`.

### `src/tui/screens/CurrencyEdit.tsx`

- Set `required: false` on the `exchangeRate` field.
- Pass `defaultValue` to the field **only when** `existing.exchangeRate !== undefined` (uses the existing conditional-spread pattern already used elsewhere for `exactOptionalPropertyTypes`).
- On submit: blank or non-numeric → write `{}`. Valid number → write `{ exchangeRate }`.

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

No change. `validateSettings` does not check `currencies` today; this design does not introduce a check.

## Tests

New tests:

1. `src/core/services/trip/__tests__/updateSettings.test.ts` — a case that writes a `CurrencyConfig` with no `exchangeRate` and reloads to confirm the field round-trips as absent.
2. `src/core/services/trip/__tests__/getTripStatus.test.ts` — a case where a currency entry has no `exchangeRate` and the expense also has no `exchangeRate`. Asserts: the expense is excluded from `totalSpendThb` and the `"missing THB rate"` warning is present.
3. `src/core/services/export/__tests__/exportCsv.test.ts` — a case where a non-THB expense has neither rate; asserts the existing throw behavior is preserved.

Existing tests:

- `convertToThb.test.ts` already covers the missing-rate throw — no new test there.
- TUI screens are not covered by unit tests today; this change does not introduce a new pattern requiring tests.

## Verification

- `bun run check:type`
- `bun run check`
- `bun test`
- Manual: launch the app, add a currency without a rate, confirm list shows `rate: (not set)`, edit it to add a rate, edit it again and clear the rate.

## Files Touched

Modified:

- `src/core/models/settings.ts`
- `src/tui/screens/CurrencyCreate.tsx`
- `src/tui/screens/CurrencyEdit.tsx`
- `src/tui/screens/CurrencyList.tsx`
- `src/tui/screens/CurrencyDelete.tsx`
- `src/core/services/trip/__tests__/updateSettings.test.ts`
- `src/core/services/trip/__tests__/getTripStatus.test.ts`
- `src/core/services/export/__tests__/exportCsv.test.ts`

No new files.
